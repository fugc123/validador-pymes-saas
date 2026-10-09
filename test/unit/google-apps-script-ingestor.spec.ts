/**
 * Google Apps Script ingestor (TASK-07) behavioral pin.
 *
 * `google-apps-script/code.gs` must not carry a hardcoded webhook secret. It
 * reads `WEBHOOK_SECRET` from the owner-controlled Script Properties and fails
 * closed (no request, no label) when the property is missing or blank, so a
 * stale or leaked constant can never be replayed against the tenant webhook.
 *
 * TASK-02: the shared sandbox (`helpers/gas-gmail-sandbox.ts`) emulates
 * Gmail's label model — labels live on individual messages, `thread.addLabel`
 * labels every message in the conversation, and the `-label:` search returns
 * conversations that still contain at least one unlabeled message. A message
 * that succeeded must not hide a failed or later message in the same
 * conversation.
 */

import { readFileSync } from 'fs';
import * as path from 'path';

import {
  gasPayloadText as payloadText,
  evaluateGasScript,
} from './helpers/gas-gmail-sandbox';

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'google-apps-script', 'code.gs');
const README_PATH = path.join(__dirname, '..', '..', 'google-apps-script', 'README.md');

function evaluateScript(
  scriptProperties: Record<string, string>,
  statusCode: number | number[] = 201,
  threadMessages: string[][] = [['message-1']],
) {
  return evaluateGasScript(
    readFileSync(SCRIPT_PATH, 'utf8'),
    scriptProperties,
    statusCode,
    threadMessages,
    'code.gs',
  );
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
    expect(script.labeledMessages).toBe(0);
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
    expect(script.labeledMessages).toBe(1);
  });

  it('labels the message and marks it read only on a 2xx response', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' }, 201);

    script.run();

    expect(script.fetchCalls).toHaveLength(1);
    expect(script.labeledMessages).toBe(1);
    expect(script.markedRead).toBe(1);
    expect(script.isLabeled('message-1')).toBe(true);
  });

  it.each([401, 500])(
    'neither labels nor marks the message read on HTTP %i, so the message is retried',
    (statusCode) => {
      const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' }, statusCode);

      script.run();

      expect(script.fetchCalls).toHaveLength(1);
      expect(script.labeledMessages).toBe(0);
      expect(script.markedRead).toBe(0);
      expect(script.isLabeled('message-1')).toBe(false);
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

describe('google-apps-script/code.gs conversation retry safety (TASK-02)', () => {
  it('labels only the message that succeeded so a failed sibling stays eligible', () => {
    const script = evaluateScript(
      { WEBHOOK_SECRET: 'stored-secret-value' },
      [201, 500],
      [['message-1', 'message-2']],
    );

    script.run();

    expect(script.fetchCalls).toHaveLength(2);
    expect(script.isLabeled('message-1')).toBe(true);
    expect(script.isLabeled('message-2')).toBe(false);
    expect(script.markedRead).toBe(1);
  });

  it('retries only the failed message on the next run and never reposts the successful one', () => {
    const script = evaluateScript(
      { WEBHOOK_SECRET: 'stored-secret-value' },
      [201, 500, 201],
      [['message-1', 'message-2']],
    );

    script.run(); // message-1 accepted, message-2 rejected
    expect(script.fetchCalls).toHaveLength(2);

    script.run(); // run 2: only the failed message goes out again
    expect(script.fetchCalls).toHaveLength(3);
    expect(payloadText(script.fetchCalls[2])).toContain('message-2');
    expect(payloadText(script.fetchCalls[2])).not.toContain('message-1');
    expect(script.isLabeled('message-2')).toBe(true);

    script.run(); // run 3: conversation fully processed, nothing is reposted
    expect(script.fetchCalls).toHaveLength(3);
  });

  it('keeps a later message in an already-processed conversation eligible without reposting', () => {
    const script = evaluateScript({ WEBHOOK_SECRET: 'stored-secret-value' }, 201, [
      ['message-1'],
    ]);

    script.run(); // message-1 processed and labeled
    expect(script.fetchCalls).toHaveLength(1);

    script.addMessage(0, 'message-2'); // a new message arrives in the same thread
    script.run();

    expect(script.fetchCalls).toHaveLength(2);
    expect(payloadText(script.fetchCalls[1])).toContain('message-2');
    expect(payloadText(script.fetchCalls[1])).not.toContain('message-1');
    expect(script.isLabeled('message-2')).toBe(true);
  });
});
