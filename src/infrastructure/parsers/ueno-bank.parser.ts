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

    const rawAmount = getField(/Monto\s*([^\r\n]+)/i);
    const payerName = getField(/Titular\s*cuenta\s*d[eé]bito\s*([^\r\n]+)/i);
    const payerBank = getField(/Entidad\s*d[eé]bito\s*([^\r\n]+)/i);
    const receiptNumber = getField(/Nro\.?\s*de\s*transacci[oó]n\s*([A-Za-z0-9]+)/i);
    const operationDate = getField(/Fecha\s*y\s*hora\s*transferencia\s*([\d/]+(?:\s+[\d:]+)?)/i);

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
