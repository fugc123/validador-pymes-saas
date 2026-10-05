/**
 * Pure HTTP helpers for tenant selection and tenant switching (no React, no
 * state): each forwards the credential it is given as a Bearer token and
 * fails closed — a missing credential, a failed request, or a response
 * without an issued `accessToken` rejects instead of fabricating a session.
 */

export type SessionRole = 'SUPER_ADMIN' | 'MERCHANT_OWNER' | 'CASHIER';

export interface IssuedSession {
  accessToken: string;
  activeTenant: {
    tenantId: string;
    merchantName: string;
    role: SessionRole;
  };
}

export interface TenantSelectionRequest {
  temporaryToken: string | null;
  userId: string;
  tenantId: string;
  role?: string;
}

export interface TenantSwitchRequest {
  accessToken: string;
  userId: string;
  targetTenantId: string;
  role?: string;
}

async function postSession(
  url: string,
  credential: string | null | undefined,
  body: Record<string, unknown>,
): Promise<IssuedSession> {
  if (!credential) {
    throw new Error('Missing credential: the auth request was not sent.');
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credential}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error('Auth request failed: no response from the server.');
  }

  if (!res.ok) {
    throw new Error(`Auth request rejected with status ${res.status}.`);
  }

  const data = (await res.json()) as Partial<IssuedSession> | null;
  if (!data || typeof data.accessToken !== 'string' || !data.accessToken || !data.activeTenant) {
    throw new Error('Auth response did not issue an access token.');
  }
  return data as IssuedSession;
}

export function requestTenantSelection(input: TenantSelectionRequest): Promise<IssuedSession> {
  return postSession('/api/v1/auth/select-tenant', input.temporaryToken, {
    userId: input.userId,
    tenantId: input.tenantId,
    role: input.role,
  });
}

export function requestTenantSwitch(input: TenantSwitchRequest): Promise<IssuedSession> {
  return postSession('/api/v1/auth/switch-tenant', input.accessToken, {
    userId: input.userId,
    targetTenantId: input.targetTenantId,
    role: input.role,
  });
}
