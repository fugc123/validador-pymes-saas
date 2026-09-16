import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class AtlasBankParser implements IBankParser {
  public readonly bankName = 'Banco Atlas';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('atlas') ||
      (lower.includes('aviso de cr[eé]dito') && lower.includes('transferencia sipap'))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    const receiptNumber = getField(/Nro\.?\s*de\s*Comprobante:\s*([A-Za-z0-9]+)/i);
    const reference = getField(/Referencia\s*SIPAP:\s*([A-Za-z0-9]+)/i);
    const payerName = getField(/(?:Ordenante|Pagador):\s*([^\r\n]+)/i);
    const payerBank = getField(/(?:Banco\s*D[eé]bito|Entidad\s*Emisora):\s*([^\r\n]+)/i);
    const rawAmount = getField(/(?:Monto|Importe):\s*([^\r\n]+)/i);
    const operationDate = getField(/Fecha:\s*([\d/]+(?:\s+[\d:]+)?)/i);

    const operationId = reference || receiptNumber;
    if (!operationId) return null;

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId,
      receiptNumber: receiptNumber || operationId,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'Banco Atlas',
      currency,
      amount,
      creditAccount: null,
      concept: null,
      rawText: text,
    };
  }
}
