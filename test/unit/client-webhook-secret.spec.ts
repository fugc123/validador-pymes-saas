/**
 * Client webhook secret request helper at `client/src/context/webhook-requests.ts`.
 *
 * The module must be a pure request helper (no React): it forwards the token
 * it is given as a Bearer credential to the owner-authorized endpoint and it
 * fails closed — a missing token, an HTTP failure, or a response without a
 * persisted `webhookSecret` must reject instead of fabricating a secret.
 *
 * It also exposes `sendTestWebhook(accessToken, tenantSlug, text)`, the pure
 * helper the owner dashboard must use for its test transfer: it reads the
 * stored secret through `requestWebhookSecret` (Bearer credential), posts
 * `{ text }` as JSON to `/api/v1/webhook/<tenantSlug>` with the
 * `x-merchant-webhook-secret` header carrying that stored value, resolves on
 * any 2xx response, and rejects on a non-OK response or a network failure —
 * it must never report demo success when the webhook was not accepted.
 */

import { requestWebhookSecret, sendTestWebhook } from '../../client/src/context/webhook-requests';

const jsonResponse = (body: unknown, init?: { ok?: boolean; status?: number }) =>
  ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  }) as unknown as Response;

describe('client webhook secret request helper', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('fetches the persisted secret with the Bearer token and returns it verbatim', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ webhookSecret: 'stored-secret-value' }));

    const secret = await requestWebhookSecret('owner-access-token');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/merchant/webhook-secret');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer owner-access-token',
    );
    expect(secret).toBe('stored-secret-value');
  });

  it('fails closed without a token instead of issuing a request', async () => {
    await expect(requestWebhookSecret(null)).rejects.toBeInstanceOf(Error);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a rejected response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Forbidden' }, { ok: false, status: 403 }),
    );

    await expect(requestWebhookSecret('cashier-token')).rejects.toBeInstanceOf(Error);
  });

  it('fails closed when the response carries no webhookSecret', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}));

    await expect(requestWebhookSecret('owner-access-token')).rejects.toBeInstanceOf(Error);
  });

  it('fails closed when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(requestWebhookSecret('owner-access-token')).rejects.toBeInstanceOf(Error);
  });

  describe('sendTestWebhook - owner dashboard test transfer', () => {
    const STORED_SECRET = 'stored-secret-9f2c41ab77e0d5b3';
    const TENANT_SLUG = 'acme-kiosko';
    const MESSAGE = 'Pago de prueba /PRUEBA SISTEMA/';

    it('uses the Bearer credential to read the stored secret and posts it verbatim, resolving on 2xx', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ webhookSecret: STORED_SECRET }))
        .mockResolvedValueOnce(jsonResponse({ accepted: true }, { ok: true, status: 201 }));

      // Resolves only on a successful webhook response; a rejection fails this test.
      await sendTestWebhook('owner-access-token', TENANT_SLUG, MESSAGE);

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [secretUrl, secretInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(secretUrl).toBe('/api/v1/merchant/webhook-secret');
      expect(secretInit.method).toBe('GET');
      expect((secretInit.headers as Record<string, string>).Authorization).toBe(
        'Bearer owner-access-token',
      );

      const [webhookUrl, webhookInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(webhookUrl).toBe(`/api/v1/webhook/${TENANT_SLUG}`);
      expect(webhookInit.method).toBe('POST');
      const headers = webhookInit.headers as Record<string, string>;
      expect(headers['x-merchant-webhook-secret']).toBe(STORED_SECRET);
      expect(headers['x-merchant-webhook-secret']).not.toBe(`sec_${TENANT_SLUG}_pos`);
      expect((JSON.parse(webhookInit.body as string) as { text: string }).text).toBe(MESSAGE);
    });

    it('rejects on a non-OK webhook response instead of signalling demo success', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ webhookSecret: STORED_SECRET }))
        .mockResolvedValueOnce(
          jsonResponse({ message: 'Invalid webhook secret' }, { ok: false, status: 401 }),
        );

      await expect(sendTestWebhook('owner-access-token', TENANT_SLUG, MESSAGE)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it('rejects when the webhook request fails at the network layer', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ webhookSecret: STORED_SECRET }))
        .mockRejectedValueOnce(new TypeError('fetch failed'));

      await expect(sendTestWebhook('owner-access-token', TENANT_SLUG, MESSAGE)).rejects.toBeInstanceOf(
        Error,
      );
    });

    it('rejects without posting when the stored secret cannot be read', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ message: 'Forbidden' }, { ok: false, status: 403 }),
      );

      await expect(sendTestWebhook('owner-access-token', TENANT_SLUG, MESSAGE)).rejects.toBeInstanceOf(
        Error,
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('rejects without issuing any request when the credential is missing', async () => {
      await expect(sendTestWebhook(null, TENANT_SLUG, MESSAGE)).rejects.toBeInstanceOf(Error);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
