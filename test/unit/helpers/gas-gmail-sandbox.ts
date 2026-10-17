/**
 * Shared Gmail/Apps Script sandbox for the GAS ingestor specs.
 *
 * One emulation of the Gmail model serves both checked-in copies
 * (`google-apps-script/code.gs`) and the generated copy
 * (`client/src/portals/owner/personalized-gas-script.ts`), so the two specs
 * cannot drift apart on mock semantics:
 *
 * - `GmailMessage` carries NO label API (the real class has none): labels
 *   live on threads, `thread.addLabel` labels every existing message of the
 *   conversation, and new messages do not inherit the label.
 * - The `-label:SIPAP_Validador` search returns conversations that still
 *   contain at least one unlabeled message.
 * - Per-message dedup is the script's own `PROCESSED_MSG_IDS` Script
 *   Property, persisted through the mocked `PropertiesService` so a second
 *   `run()` observes what the first one recorded.
 * - Every `GmailApp.search(query, start, max)` call is recorded verbatim so
 *   specs can pin the discovery query text and the bounded paging.
 * - Fetch status codes can be scripted per call (number or queue, the last
 *   value repeats) to model accepted/rejected webhook responses across runs.
 */

import * as vm from 'vm';

export const GAS_LABEL_NAME = 'SIPAP_Validador';

export interface GasFetchCall {
  url: string;
  options: Record<string, unknown>;
}

export interface GasSandbox {
  fetchCalls: GasFetchCall[];
  alerts: string[];
  labeledMessages: number;
  markedRead: number;
  isLabeled: (messageId: string) => boolean;
  addMessage: (threadIndex: number, messageId: string) => void;
  /** Marks a message read before the run, to pin that read state is never a marker. */
  markRead: (messageId: string) => void;
  /** Message IDs the script persisted in the `PROCESSED_MSG_IDS` Script Property. */
  processedIds: () => string[];
  /** Raw argument lists from every `GmailApp.search(...)` call the script made. */
  searchCalls: unknown[][];
  run: () => void;
}

export function gasPayloadText(call: GasFetchCall): string {
  return String(call.options.payload ?? '');
}

interface MessageState {
  id: string;
  labels: string[];
  read: boolean;
}

export function evaluateGasScript(
  scriptSource: string,
  scriptProperties: Record<string, string>,
  statusCode: number | number[] = 201,
  threadMessages: string[][] = [['message-1']],
  filename = 'gas.gs',
): GasSandbox {
  const fetchCalls: GasFetchCall[] = [];
  const alerts: string[] = [];
  const searchCalls: unknown[][] = [];
  const counters = { labeled: 0, read: 0 };
  const state: MessageState[][] = threadMessages.map((ids) =>
    ids.map((id) => ({ id, labels: [] as string[], read: false })),
  );

  const labelName = (label: unknown): string =>
    label && typeof label === 'object' && 'getName' in label
      ? String((label as { getName: () => string }).getName())
      : String(label);

  // The real GmailMessage exposes no label methods; a script calling
  // msg.getLabels()/msg.addLabel() throws here exactly as it does in Gmail.
  const makeMessage = (m: MessageState) => ({
    getId: () => m.id,
    getPlainBody: () => 'body ' + m.id,
    getBody: () => '<p>' + m.id + '</p>',
    getSubject: () => 'Aviso de transferencia',
    getDate: () => new Date('2026-01-01T00:00:00.000Z'),
    markRead: () => {
      m.read = true;
      counters.read += 1;
    },
  });

  // Gmail threads.modify applies the label to every existing message of the
  // thread; messages arriving later do not inherit it.
  const makeThread = (messages: MessageState[]) => ({
    getMessages: () => messages.map(makeMessage),
    addLabel: (label: unknown) => {
      const name = labelName(label);
      messages.forEach((m) => {
        if (!m.labels.includes(name)) {
          m.labels.push(name);
          counters.labeled += 1;
        }
      });
    },
    markRead: () =>
      messages.forEach((m) => {
        m.read = true;
        counters.read += 1;
      }),
  });

  const sandbox: Record<string, unknown> = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          Object.prototype.hasOwnProperty.call(scriptProperties, key)
            ? scriptProperties[key]
            : null,
        // Persists into the caller-owned object, so repeated `run()` calls on
        // one sandbox see the registry written by the previous run.
        setProperty: (key: string, value: string) => {
          scriptProperties[key] = value;
          return value;
        },
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, options: Record<string, unknown>) => {
        const code = Array.isArray(statusCode)
          ? fetchCalls.length < statusCode.length
            ? statusCode[fetchCalls.length]
            : statusCode[statusCode.length - 1]
          : statusCode;
        fetchCalls.push({ url, options });
        return { getResponseCode: () => code, getContentText: () => 'created' };
      },
    },
    GmailApp: {
      getUserLabelByName: () => null,
      createLabel: () => ({ getName: () => GAS_LABEL_NAME }),
      // `-label:SIPAP_Validador` returns conversations that still contain at
      // least one message without the label. The full argument list is
      // recorded so specs can pin the query text and the (start, max) bound.
      search: (...args: unknown[]) => {
        searchCalls.push(args);
        return state
          .filter((messages) => messages.some((m) => !m.labels.includes(GAS_LABEL_NAME)))
          .map(makeThread);
      },
    },
    Logger: { log: () => undefined },
    alert: (message: string) => {
      alerts.push(String(message));
    },
  };

  vm.createContext(sandbox as vm.Context);
  vm.runInContext(scriptSource, sandbox as vm.Context, { filename });

  return {
    fetchCalls,
    alerts,
    get labeledMessages(): number {
      return counters.labeled;
    },
    get markedRead(): number {
      return counters.read;
    },
    isLabeled: (messageId) =>
      state.some((messages) =>
        messages.some((m) => m.id === messageId && m.labels.includes(GAS_LABEL_NAME)),
      ),
    addMessage: (threadIndex, messageId) =>
      state[threadIndex].push({ id: messageId, labels: [], read: false }),
    markRead: (messageId) =>
      state.forEach((messages) =>
        messages.forEach((m) => {
          if (m.id === messageId) m.read = true;
        }),
      ),
    processedIds: () => {
      try {
        return JSON.parse(scriptProperties.PROCESSED_MSG_IDS || '[]') as string[];
      } catch (err) {
        return [];
      }
    },
    searchCalls,
    run: sandbox.procesarTransferenciasBancarias as () => void,
  };
}
