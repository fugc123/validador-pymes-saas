/**
 * Client webhook secret request helper at `client/src/context/webhook-requests.ts`.
 *
 * The module must be a pure request helper (no React): it forwards the token
 * it is given as a Bearer credential to the owner-authorized endpoint and it
 * fails closed — a missing token, an HTTP failure, or a response without a
 * persisted `webhookSecret` must reject instead of fabricating a secret.
 */

import { requestWebhookSecret } from '../../client/src/context/webhook-requests';

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
});
