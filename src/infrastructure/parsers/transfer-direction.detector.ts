/**
 * TASK-03: transfer direction detection from bank notification text.
 *
 * Only positively identified received transfers may be persisted. The
 * evidence lists are bank-specific phrases (Itaú, GNB, UENO, Familiar,
 * Atlas, Continental, wallets) matched against text normalized to
 * lowercase without diacritics and with whitespace collapsed. Contradictory
 * evidence fails closed to 'unknown' (discarded, never defaulted to
 * received).
 */

export type TransferDirection = 'received' | 'sent' | 'unknown';

const RECEIVED_EVIDENCE: readonly RegExp[] = [
  /\brecibiste\b/,
  /\bhas recibido\b/,
  /\brecibida\b/,
  /\brecibido\b/,
  /\bte transfirio\b/,
  /\bte enviaron\b/,
  /\bte envio\b/,
  /\bte han enviado\b/,
  /\bcredito a su cuenta\b/,
  /\bacreditad/,
  /\baviso de credito\b/,
  /\bmonto acreditado\b/,
  /\btransferencia acreditada\b/,
  /\benviado por\b/,
  /\bmonto recibido\b/,
  /\bcobraste\b/,
  /\bcliente pagador\b/,
  /\btitular ordenante\b/,
  /\bremitente\b/,
];

const SENT_EVIDENCE: readonly RegExp[] = [
  /\benviaste\b/,
  /\bhas enviado\b/,
  /\busted enviado\b/,
  /\btransferencia enviada\b/,
  /\benviada por\b/,
  /\bdebito por transferencia\b/,
  /\bdebit(?:o|ado|ada)\s+(?:de|en)\s+(?:tu|su)\s+cuenta\b/,
  /\b(?:has|ha)\s+realizado\s+una\s+(?:transferencia|envio)\b/,
  /\b(?:has|ha)\s+realizado\s+un\s+envio\b/,
  /\brealizaste\s+una\s+(?:transferencia|envio)\b/,
  /\brealizaste\s+un\s+envio\b/,
  /\benvio realizado\b/,
  /\benvio exitoso\b/,
  /\bcomprobante de envio\b/,
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function detectTransferDirection(text: string): TransferDirection {
  const normalized = normalize(text ?? '');
  if (!normalized) return 'unknown';
  const hasReceived = RECEIVED_EVIDENCE.some((pattern) => pattern.test(normalized));
  const hasSent = SENT_EVIDENCE.some((pattern) => pattern.test(normalized));
  if (hasReceived && !hasSent) return 'received';
  if (hasSent && !hasReceived) return 'sent';
  return 'unknown';
}
