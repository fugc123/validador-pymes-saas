/**
 * Personalized Google Apps Script builder (TASK-07) contract pin.
 *
 * `client/src/portals/owner/OwnerDashboard.tsx` still hands merchants a
 * generated script that starts with `const WEBHOOK_SECRET = '<persisted
 * secret>'`, which contradicts the checked-in `google-apps-script/code.gs`
 * (secret read from Script Properties) and the README (secret never in code).
 *
 * The planned pure helper `buildPersonalizedGasScript(baseApiUrl,
 * merchantSlug)` must close that split: the generated script reads
 * `WEBHOOK_SECRET` from `PropertiesService.getScriptProperties()` at runtime
 * and sends that retrieved value as `X-Merchant-Webhook-Secret`, the helper
 * takes no secret argument and embeds no constant secret assignment, and the
 * injected URL/slug are JSON-escaped so hostile input cannot break out of the
 * generated source.
 */

import * as vm from 'vm';

import { buildPersonalizedGasScript } from '../../client/src/portals/owner/personalized-gas-script';

interface FetchCall {
  url: string;
  options: Record<string, unknown>;
}

interface Sandbox {
  fetchCalls: FetchCall[];
  alerts: string[];
  run: () => void;
}

function evaluatePersonalizedScript(
  source: string,
  scriptProperties: Record<string, string>,
): Sandbox {
  const fetchCalls: FetchCall[] = [];
  const alerts: string[] = [];
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
        fetchCalls.push({ url, options });
        return { getResponseCode: () => 201, getContentText: () => 'created' };
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
          addLabel: () => undefined,
          markRead: () => undefined,
        },
      ],
    },
    Logger: { log: () => undefined },
    alert: (message: string) => {
      alerts.push(String(message));
    },
  };

  vm.createContext(sandbox as vm.Context);
  vm.runInContext(source, sandbox as vm.Context, { filename: 'personalized-gas.gs' });

  return {
    fetchCalls,
    alerts,
    run: sandbox.procesarTransferenciasBancarias as () => void,
  };
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
});
