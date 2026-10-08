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
 * later message in the same conversation.
 */

import {
  gasPayloadText as payloadText,
  evaluateGasScript,
} from './helpers/gas-gmail-sandbox';

import { buildPersonalizedGasScript } from '../../client/src/portals/owner/personalized-gas-script';

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

  it('stays in sync with google-apps-script/code.gs on message-level labeling', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);

    // Per-message labeling: the generated copy must never fall back to
    // thread-level addLabel/markRead, which hides failed siblings.
    expect(script).toContain('msg.addLabel(label);');
    expect(script).toContain('msg.markRead();');
    expect(script).not.toContain('thread.addLabel(');
    expect(script).not.toContain('thread.markRead();');
    expect(script).toContain('msg.getLabels()');
  });
});

describe('personalized Google Apps Script conversation retry safety (TASK-02)', () => {
  const BASE_API_URL = 'https://api.example.com';
  const MERCHANT_SLUG = 'kiosko-san-roque';

  it('labels only the message that succeeded so a failed sibling stays eligible', () => {
    const script = buildPersonalizedGasScript(BASE_API_URL, MERCHANT_SLUG);
    const sandbox = evaluatePersonalizedScript(
      script,
      { WEBHOOK_SECRET: 'stored-secret-value' },
      [201, 500],
      [['message-1', 'message-2']],
    );

    sandbox.run();

    expect(sandbox.fetchCalls).toHaveLength(2);
    expect(sandbox.isLabeled('message-1')).toBe(true);
    expect(sandbox.isLabeled('message-2')).toBe(false);
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
