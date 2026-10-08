/**
 * Shared Gmail/Apps Script sandbox for the GAS ingestor specs.
 *
 * One emulation of the Gmail label model serves both checked-in copies
 * (`google-apps-script/code.gs`) and the generated copy
 * (`client/src/portals/owner/personalized-gas-script.ts`), so the two specs
 * cannot drift apart on mock semantics:
 *
 * - Labels live on individual messages; `thread.addLabel` labels every
 *   message of the conversation (Gmail threads.modify semantics).
 * - The `-label:SIPAP_Validador` search returns conversations that still
 *   contain at least one unlabeled message.
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
  const counters = { labeled: 0, read: 0 };
  const state: MessageState[][] = threadMessages.map((ids) =>
    ids.map((id) => ({ id, labels: [] as string[], read: false })),
  );

  const labelName = (label: unknown): string =>
    label && typeof label === 'object' && 'getName' in label
      ? String((label as { getName: () => string }).getName())
      : String(label);

  const makeMessage = (m: MessageState) => ({
    getId: () => m.id,
    getPlainBody: () => 'body ' + m.id,
    getBody: () => '<p>' + m.id + '</p>',
    getSubject: () => 'Aviso de transferencia',
    getDate: () => new Date('2026-01-01T00:00:00.000Z'),
    getLabels: () => m.labels.map((name) => ({ getName: () => name })),
    addLabel: (label: unknown) => {
      const name = labelName(label);
      if (!m.labels.includes(name)) m.labels.push(name);
      counters.labeled += 1;
    },
    markRead: () => {
      m.read = true;
      counters.read += 1;
    },
  });

  // Gmail threads.modify applies the label to every message of the thread.
  const makeThread = (messages: MessageState[]) => ({
    getMessages: () => messages.map(makeMessage),
    addLabel: (label: unknown) => messages.forEach((m) => makeMessage(m).addLabel(label)),
    markRead: () => messages.forEach((m) => makeMessage(m).markRead()),
  });

  const sandbox: Record<string, unknown> = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          Object.prototype.hasOwnProperty.call(scriptProperties, key)
            ? scriptProperties[key]
            : null,
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
      // least one message without the label.
      search: () =>
        state
          .filter((messages) => messages.some((m) => !m.labels.includes(GAS_LABEL_NAME)))
          .map(makeThread),
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
    run: sandbox.procesarTransferenciasBancarias as () => void,
  };
}
