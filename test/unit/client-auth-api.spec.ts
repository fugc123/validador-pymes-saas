/**
 * Client auth request helpers for tenant selection and tenant switching, at the
 * planned path `client/src/context/auth-requests.ts`.
 *
 * The module must be a pure request helper (no React): it forwards the token it
 * is given as a Bearer credential, and it fails closed — a missing token, an
 * HTTP failure, or a response without an issued `accessToken` must reject
 * instead of fabricating a session.
 */

import {
  requestTenantSelection,
  requestTenantSwitch,
} from '../../client/src/context/auth-requests';

const ACTIVE_TENANT = {
  tenantId: 'tenant-kiosko',
  merchantName: 'Kiosko San Roque',
  role: 'CASHIER',
};

const jsonResponse = (body: unknown, init?: { ok?: boolean; status?: number }) =>
  ({
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  }) as unknown as Response;

const issuedSession = { accessToken: 'scoped-access-token', activeTenant: ACTIVE_TENANT };

describe('client auth request helpers', () => {
  const realFetch = globalThis.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('sends the temporary Bearer token when selecting a tenant', async () => {
    fetchMock.mockResolvedValue(jsonResponse(issuedSession));

    const result = await requestTenantSelection({
      temporaryToken: 'temporary-selection-token',
      userId: 'usr-1',
      tenantId: 'tenant-kiosko',
      role: 'CASHIER',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/select-tenant');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer temporary-selection-token',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      userId: 'usr-1',
      tenantId: 'tenant-kiosko',
      role: 'CASHIER',
    });

    expect(result.accessToken).toBe('scoped-access-token');
    expect(result.activeTenant).toEqual(ACTIVE_TENANT);
  });

  it('sends the scoped access token when switching tenant', async () => {
    fetchMock.mockResolvedValue(jsonResponse(issuedSession));

    const result = await requestTenantSwitch({
      accessToken: 'scoped-access-token',
      userId: 'usr-1',
      targetTenantId: 'tenant-farmacia',
      role: 'MERCHANT_OWNER',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/auth/switch-tenant');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe(
      'Bearer scoped-access-token',
    );
    expect(JSON.parse(init.body as string)).toEqual({
      userId: 'usr-1',
      targetTenantId: 'tenant-farmacia',
      role: 'MERCHANT_OWNER',
    });

    expect(result.accessToken).toBe('scoped-access-token');
    expect(result.activeTenant).toEqual(ACTIVE_TENANT);
  });

  it('fails closed without a temporary token instead of issuing a request', async () => {
    await expect(
      requestTenantSelection({
        temporaryToken: null,
        userId: 'usr-1',
        tenantId: 'tenant-kiosko',
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed without an access token instead of issuing a request', async () => {
    await expect(
      requestTenantSwitch({
        accessToken: '',
        userId: 'usr-1',
        targetTenantId: 'tenant-farmacia',
      }),
    ).rejects.toBeInstanceOf(Error);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed on a rejected selection response without returning a token', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ message: 'Invalid tenant selection token' }, { ok: false, status: 401 }),
    );

    await expect(
      requestTenantSelection({
        temporaryToken: 'temporary-selection-token',
        userId: 'usr-1',
        tenantId: 'tenant-kiosko',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('fails closed on a rejected switch response without returning a token', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Forbidden' }, { ok: false, status: 403 }));

    await expect(
      requestTenantSwitch({
        accessToken: 'scoped-access-token',
        userId: 'usr-1',
        targetTenantId: 'tenant-farmacia',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('fails closed when the selection response carries no accessToken', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ activeTenant: ACTIVE_TENANT }));

    await expect(
      requestTenantSelection({
        temporaryToken: 'temporary-selection-token',
        userId: 'usr-1',
        tenantId: 'tenant-kiosko',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('fails closed when the switch response carries no accessToken', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ activeTenant: ACTIVE_TENANT }));

    await expect(
      requestTenantSwitch({
        accessToken: 'scoped-access-token',
        userId: 'usr-1',
        targetTenantId: 'tenant-farmacia',
      }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('fails closed when the request itself fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      requestTenantSwitch({
        accessToken: 'scoped-access-token',
        userId: 'usr-1',
        targetTenantId: 'tenant-farmacia',
      }),
    ).rejects.toBeInstanceOf(Error);
  });
});
