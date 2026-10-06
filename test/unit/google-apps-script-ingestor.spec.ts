/**
 * Google Apps Script ingestor (TASK-07) behavioral pin.
 *
 * `google-apps-script/code.gs` must not carry a hardcoded webhook secret. It
 * reads `WEBHOOK_SECRET` from the owner-controlled Script Properties and fails
 * closed (no request, no label) when the property is missing or blank, so a
 * stale or leaked constant can never be replayed against the tenant webhook.
 */

import { readFileSync } from 'fs';
import * as path from 'path';
import * as vm from 'vm';

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'google-apps-script', 'code.gs');
const README_PATH = path.join(__dirname, '..', '..', 'google-apps-script', 'README.md');

interface FetchCall {
  url: string;
  options: Record<string, unknown>;
}

interface Sandbox {
  fetchCalls: FetchCall[];
  labeledThreads: number;
  markedRead: number;
  run: () => void;
}

function evaluateScript(
  scriptProperties: Record<string, string>,
  statusCode = 201,
): Sandbox {
  const source = readFileSync(SCRIPT_PATH, 'utf8');
  const fetchCalls: FetchCall[] = [];
  const labeledThreads = { count: 0 };
  const readThreads = { count: 0 };
  const sandbox: Record<string, unknown> = {
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) =>
          Object.prototype.hasOwnProperty.call(scriptProperties, key) ? scriptProperties[key] : null,
      }),
    },
    UrlFetchApp: {
      fetch: (url: string, options: Record<string, unknown>) => {
        fetchCalls.push({ url, options });
        return { getResponseCode: () => statusCode, getContentText: () => 'created' };
      },
    },
    GmailApp: {
      getUserLabelByName: () => null,
      createLabel: () => ({}),
      search: () => [
        {
          getMessages: () => [
            {
              getId: () => 'message-1',
              getPlainBody: () => 'body text',
              getBody: () => '<p>body html</p>',
              getSubject: () => 'Aviso de transferencia',
              getDate: () => new Date('2026-01-01T00:00:00.000Z'),
            },
          ],
          addLabel: () => {
            labeledThreads.count += 1;
          },
          markRead: () => {
            readThreads.count += 1;
          },
        },
      ],
    },
    Logger: { log: () => undefined },
  };

  vm.createContext(sandbox as vm.Context);
  vm.runInContext(source, sandbox as vm.Context, { filename: 'code.gs' });

  return {
    fetchCalls,
    get labeledThreads(): number {
      return labeledThreads.count;
    },
    get markedRead(): number {
      return readThreads.count;
    },
    run: sandbox.procesarTransferenciasBancarias as () => void,
  };
}

describe('google-apps-script/code.gs webhook secret', () => {
  it('exposes the ingestor entry point', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' });
    expect(typeof script.run).toBe('function');
  });

  it('fails closed without sending any request when WEBHOOK_SECRET is not set', () => {
    const script = evaluateScript({});

    expect(() => script.run()).toThrow(/WEBHOOK_SECRET/);
    expect(script.fetchCalls).toHaveLength(0);
    expect(script.labeledThreads).toBe(0);
  });

  it('fails closed when the stored WEBHOOK_SECRET is blank', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: '   ' });

    expect(() => script.run()).toThrow(/WEBHOOK_SECRET/);
    expect(script.fetchCalls).toHaveLength(0);
  });

  it('sends the persisted secret as the webhook header instead of a baked-in value', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' });

    script.run();

    expect(script.fetchCalls).toHaveLength(1);
    const headers = script.fetchCalls[0].options.headers as Record<string, string>;
    expect(headers['X-Merchant-Webhook-Secret']).toBe('stored-secret-value');
    expect(script.labeledThreads).toBe(1);
  });

  it('labels the Gmail thread and marks it read only on a 2xx response', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' }, 201);

    script.run();

    expect(script.fetchCalls).toHaveLength(1);
    expect(script.labeledThreads).toBe(1);
    expect(script.markedRead).toBe(1);
  });

  it.each([401, 500])(
    'neither labels nor marks the Gmail thread read on HTTP %i, so the message is retried',
    (statusCode) => {
      const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' }, statusCode);

      script.run();

      expect(script.fetchCalls).toHaveLength(1);
      expect(script.labeledThreads).toBe(0);
      expect(script.markedRead).toBe(0);
    },
  );

  it('keeps the secret out of the script source', () => {
    const source = readFileSync(SCRIPT_PATH, 'utf8');

    expect(source).not.toMatch(/sec_[A-Za-z0-9]{8,}/);
    expect(source).not.toMatch(/const\s+WEBHOOK_SECRET\s*=/);
  });

  it('keeps the secret out of the script README and documents Script Properties', () => {
    const readme = readFileSync(README_PATH, 'utf8');

    expect(readme).toContain('WEBHOOK_SECRET');
    expect(readme).toMatch(/Propiedades del script/i);
    expect(readme).not.toMatch(/sec_[A-Za-z0-9]{8,}/);
  });
});
