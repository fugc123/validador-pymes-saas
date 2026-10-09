import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class UenoBankParser implements IBankParser {
  public readonly bankName = 'UENO Bank';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('ueno') ||
      (lower.includes('recibiste una transferencia') && lower.includes('titular cuenta débito'))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    // Alternate SIPAP receipt labels are accepted alongside the classic
    // mobile-notification labels (Monto / Titular cuenta débito / Nro. de
    // transacción), so the UENO-specific parser owns these receipts instead
    // of falling through to the universal parser's heuristic payer guesses.
    const rawAmount = getField(/(?:monto|importe)\s*[:\-]?\s*([^\r\n]+)/i);
    const payerName = getField(
      /(?:titular\s*(?:de\s+la\s+)?cuenta\s*d[eé]bito|cliente\s*pagador|enviado\s*por|titular\s*ordenante|ordenante)\s*[:\-]?\s*([^\r\n]+)/i,
    );
    const payerBank = getField(/Entidad\s*d[eé]bito\s*([^\r\n]+)/i);
    const operationDate = getField(/Fecha\s*y\s*hora\s*transferencia\s*([\d/]+(?:\s+[\d:]+)?)/i);

    // SIPAP/operation reference: transacción, operación, referencia or comprobante.
    const receiptNumber =
      getField(/Nro\.?\s*de\s*transacci[oó]n\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i) ||
      getField(
        /(?:Nro\.?\s*de\s*)?operaci[oó]n\s*(?:Nro\.?|N[°º])?\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i,
      ) ||
      getField(
        /(?:referencia\s*sipap|(?:Nro\.?\s*de\s*)?referencia)\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i,
      ) ||
      getField(/(?:Nro\.?\s*de\s*)?comprobante\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i);

    const operationId = receiptNumber;
    if (!operationId) return null;

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId,
      receiptNumber: receiptNumber || operationId,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'UENO Bank',
      currency,
      amount,
      creditAccount: null,
      concept: null,
      rawText: text,
    };
  }
}
