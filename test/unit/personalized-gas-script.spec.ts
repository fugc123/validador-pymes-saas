/**
 * Personalized Google Apps Script builder (TASK-07) contract pin.
 *
 * Before this change, `client/src/portals/owner/OwnerDashboard.tsx` handed
 * merchants a generated script that started with `const WEBHOOK_SECRET =
 * '<persisted secret>'`, which contradicted the checked-in
 * `google-apps-script/code.gs` (secret read from Script Properties) and the
 * README (secret never in code).
 *
 * The pure helper `buildPersonalizedGasScript(baseApiUrl, merchantSlug)`
 * closes that split: the generated script reads `WEBHOOK_SECRET` from
 * `PropertiesService.getScriptProperties()` at runtime and sends that
 * retrieved value as `X-Merchant-Webhook-Secret`, the helper takes no secret
 * argument and embeds no constant secret assignment, and the injected URL and
 * slug are JSON-escaped so hostile input cannot break out of the generated
 * source. A rejected webhook response (non-2xx) must leave the Gmail message
 * untouched so the next run retries it.
 *
 * TASK-02: the shared sandbox (`helpers/gas-gmail-sandbox.ts`) — the same one
 * used for `google-apps-script/code.gs` — keeps the generated copy
 * behaviorally synchronized: one successful message must not hide a failed or
 * later message in the same conversation, and the recorded `GmailApp.search`
 * arguments pin the same discovery query contract on both copies.
 */

import { readFileSync } from 'fs';
import * as path from 'path';

import {
  gasPayloadText as payloadText,
  evaluateGasScript,
} from './helpers/gas-gmail-sandbox';

import { buildPersonalizedGasScript } from '../../client/src/portals/owner/personalized-gas-script';

const SCRIPT_PATH = path.join(__dirname, '..', '..', 'google-apps-script', 'code.gs');

/**
 * Normalizes the `procesarTransferenciasBancarias` body of either copy so the
 * two can be compared: the checked-in script logs with emoji, the panel copy
 * does not, and their surrounding headers differ.
 */
function normalizedFunctionBody(source: string): string {
  return source
    .slice(source.indexOf('function procesarTransferenciasBancarias'))
    .replace(/`;\s*$/, '') // generated copy closes a template literal
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]\s?/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function evaluatePersonalizedScript(
  source: string,
  scriptProperties: Record<string, string>,
  statusCode: number | number[] = 201,
  threadMessages: string[][] = [['message-1']],
) {
  return evaluateGasScript(
    source,
    scriptProperties,
    statusCode,
    threadMessages,
    'personalized-gas.gs',
  );
}

describe('personalized Google Apps Script builder', () => {
  const BASE_API_URL = 'https://api.example.com';
  const MERCHANT_SLUG = 'kiosko-san-roque';

  it('accepts only the API URL and the merchant slug, never a secret argument', () => {
    expect(buildPersonalizedGasScript.length).toBe(2);
  });

  it('reads WEBHOOK_SECRET from Script Properties at runtime', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);

    expect(script).toMatch(
      /PropertiesService\s*\.\s*getScriptProperties\(\)\s*\.\s*getProperty\(\s*['"]WEBHOOK_SECRET['"]\s*\)/,
    );
  });

  it('sends the retrieved Script Property value as X-Merchant-Webhook-Secret', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(script, {
      WEBHOOK_SECRET: 'stored-secret-value',
    });

    expect(typeof sandbox.run).toBe('function');
    sandbox.run();

    expect(sandbox.fetchCalls).toHaveLength(1);
    const headers = sandbox.fetchCalls[0].options.headers as Record<string, string>;
    expect(headers['X-Merchant-Webhook-Secret']).toBe('stored-secret-value');
    // The value came from the Script Property, not from the generated source.
    expect(script).not.toContain('stored-secret-value');
  });

  it('contains no constant secret assignment and no secret-looking literal', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);

    expect(script).not.toMatch(/const\s+WEBHOOK_SECRET\s*=/);
    expect(script).not.toMatch(/WEBHOOK_SECRET\s*=\s*['"]/);
    expect(script).not.toMatch(/sec_[A-Za-z0-9]{8,}/);
  });

  it('JSON-escapes the API URL and the merchant slug in the generated source', () => {
    const hostileUrl = 'https://api.example.com/"\n+alert("pwned")//';
    const hostileSlug = 'slug"; alert("pwned");//\\';
    const script = buildPersonalizedGasScript(hostileUrl, hostileSlug);

    expect(script).toContain(JSON.stringify(hostileUrl));
    expect(script).toContain(JSON.stringify(hostileSlug));
    expect(script).not.toContain(hostileUrl);
    expect(script).not.toContain(hostileSlug);

    const sandbox = evaluatePersonalizedScript(script, {
      WEBHOOK_SECRET: 'stored-secret-value',
    });
    sandbox.run();

    expect(sandbox.alerts).toHaveLength(0);
    expect(sandbox.fetchCalls).toHaveLength(1);
    expect(sandbox.fetchCalls[0].url).toBe(
      `${hostileUrl}/api/v1/webhook/${hostileSlug}`,
    );
  });

  it('labels the message and marks it read only on a 2xx response', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(
      script,
      { WEBHOOK_SECRET: 'stored-secret-value' },
      201,
    );

    sandbox.run();

    expect(sandbox.fetchCalls).toHaveLength(1);
    expect(sandbox.labeledMessages).toBe(1);
    expect(sandbox.markedRead).toBe(1);
    expect(sandbox.isLabeled('message-1')).toBe(true);
    expect(sandbox.processedIds()).toContain('message-1');
  });

  it.each([401, 500])(
    'neither labels nor marks the message read on HTTP %i, so the message is retried',
    (statusCode) => {
      const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
      const sandbox = evaluatePersonalizedScript(
        script,
        { WEBHOOK_SECRET: 'stored-secret-value' },
        statusCode,
      );

      sandbox.run();

      expect(sandbox.fetchCalls).toHaveLength(1);
      expect(sandbox.labeledMessages).toBe(0);
      expect(sandbox.markedRead).toBe(0);
      expect(sandbox.isLabeled('message-1')).toBe(false);
    },
  );

  it('stays in sync with google-apps-script/code.gs on the per-message registry', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);

    // GmailMessage has no label API: both copies dedupe through the
    // Script-Property registry and label only a whole, fully processed thread.
    expect(script).not.toContain('msg.getLabels(');
    expect(script).not.toContain('msg.addLabel(');
    expect(script).toContain('PROCESSED_MSG_IDS');
    expect(script).toContain('thread.addLabel(');
    expect(script).toContain('msg.markRead();');
    expect(script).not.toContain('thread.markRead();');
  });

  it('keeps the generated body identical to google-apps-script/code.gs', () => {
    const checkedIn = readFileSync(SCRIPT_PATH, 'utf8');
    const generated = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);

    expect(normalizedFunctionBody(generated)).toBe(normalizedFunctionBody(checkedIn));
  });
});

describe('personalized Google Apps Script conversation retry safety (TASK-02)', () => {
  const BASE_API_URL = 'https://api.example.com';
  const MERCHANT_SLUG = 'kiosko-san-roque';

  it('records only the message that succeeded so a failed sibling stays eligible', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(
      script,
      { WEBHOOK_SECRET: 'stored-secret-value' },
      [201, 500],
      [['message-1', 'message-2']],
    );

    sandbox.run();

    expect(sandbox.fetchCalls).toHaveLength(2);
    expect(sandbox.processedIds()).toContain('message-1');
    expect(sandbox.processedIds()).not.toContain('message-2');
    // The thread keeps no label, so `-label:` returns it on the next run.
    expect(sandbox.labeledMessages).toBe(0);
    expect(sandbox.markedRead).toBe(1);
  });

  it('retries only the failed message on the next run and never reposts the successful one', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(
      script,
      { WEBHOOK_SECRET: 'stored-secret-value' },
      [201, 500, 201],
      [['message-1', 'message-2']],
    );

    sandbox.run(); // message-1 accepted, message-2 rejected
    expect(sandbox.fetchCalls).toHaveLength(2);

    sandbox.run(); // run 2: only the failed message goes out again
    expect(sandbox.fetchCalls).toHaveLength(3);
    expect(payloadText(sandbox.fetchCalls[2])).toContain('message-2');
    expect(payloadText(sandbox.fetchCalls[2])).not.toContain('message-1');
    expect(sandbox.isLabeled('message-2')).toBe(true);

    sandbox.run(); // run 3: conversation fully processed, nothing is reposted
    expect(sandbox.fetchCalls).toHaveLength(3);
  });

  it('keeps a later message in an already-processed conversation eligible without reposting', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(
      script,
      { WEBHOOK_SECRET: 'stored-secret-value' },
      201,
      [['message-1']],
    );

    sandbox.run(); // message-1 processed and labeled
    expect(sandbox.fetchCalls).toHaveLength(1);

    sandbox.addMessage(0, 'message-2'); // a new message arrives in the same thread
    sandbox.run();

    expect(sandbox.fetchCalls).toHaveLength(2);
    expect(payloadText(sandbox.fetchCalls[1])).toContain('message-2');
    expect(payloadText(sandbox.fetchCalls[1])).not.toContain('message-1');
    expect(sandbox.isLabeled('message-2')).toBe(true);
  });
});

describe('personalized Google Apps Script Gmail discovery query (TASK-02)', () => {
  const BASE_API_URL = 'https://api.example.com';
  const MERCHANT_SLUG = 'kiosko-san-roque';

  it('broadens full-text discovery with plural and received-transfer phrases', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(script, {
      WEBHOOK_SECRET: 'stored-secret-value',
    });

    sandbox.run();

    const query = String(sandbox.searchCalls[0][0]);
    expect(query).toContain('"transferencias"');
    expect(query).toContain('"recibida"');
    expect(query).toContain('"has recibido"');
    expect(query).toContain('"te transfirió"');
  });

  it('keeps the OR shape, accent variants, label exclusion, and the 15-thread bound', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(script, {
      WEBHOOK_SECRET: 'stored-secret-value',
    });

    sandbox.run();

    expect(sandbox.searchCalls[0]).toHaveLength(3);
    expect(sandbox.searchCalls[0][1]).toBe(0);
    expect(sandbox.searchCalls[0][2]).toBe(15);
    const query = String(sandbox.searchCalls[0][0]);
    expect(query).toContain('"itau" OR "itaú"');
    expect(query).toContain('"te transfirio" OR "te transfirió"');
    expect(query).toContain('-label:SIPAP_Validador');
  });
});
