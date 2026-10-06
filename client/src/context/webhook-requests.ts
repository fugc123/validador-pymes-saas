/**
 * Pure HTTP helper for reading the persisted merchant webhook secret (no
 * React, no state): forwards the credential it is given as a Bearer token and
 * fails closed — a missing credential, a failed request, or a response
 * without a persisted `webhookSecret` rejects instead of fabricating a
 * secret or deriving one from the tenant slug.
 */

export async function requestWebhookSecret(
  accessToken: string | null | undefined,
): Promise<string> {
  if (!accessToken) {
    throw new Error('Missing credential: the webhook secret request was not sent.');
  }

  let res: Response;
  try {
    res = await fetch('/api/v1/merchant/webhook-secret', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    throw new Error('Webhook secret request failed: no response from the server.');
  }

  if (!res.ok) {
    throw new Error(`Webhook secret request rejected with status ${res.status}.`);
  }

  const data = (await res.json()) as { webhookSecret?: unknown } | null;
  if (!data || typeof data.webhookSecret !== 'string' || !data.webhookSecret) {
    throw new Error('Webhook secret response did not carry a persisted secret.');
  }
  return data.webhookSecret;
}

/**
 * Pure test-transfer helper (no React, no state): reads the persisted secret
 * through `requestWebhookSecret` using the given credential, then posts
 * `{ text }` to the tenant webhook with that exact value as the
 * `x-merchant-webhook-secret` header.
 *
 * Fails closed: a missing credential, a failed/empty secret read, a network
 * error, or a non-OK webhook response rejects; only a 2xx webhook response
 * resolves. The secret is never logged, stored, or replaced by a fallback.
 */
export async function sendTestWebhook(
  accessToken: string | null | undefined,
  tenantSlug: string,
  text: string,
): Promise<void> {
  const webhookSecret = await requestWebhookSecret(accessToken);

  let res: Response;
  try {
    res = await fetch(`/api/v1/webhook/${tenantSlug}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-merchant-webhook-secret': webhookSecret,
      },
      body: JSON.stringify({ text }),
    });
  } catch {
    throw new Error('Webhook test request failed: no response from the server.');
  }

  if (!res.ok) {
    throw new Error(`Webhook test rejected with status ${res.status}.`);
  }
}
