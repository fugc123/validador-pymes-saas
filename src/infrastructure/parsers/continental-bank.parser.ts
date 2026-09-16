import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class ContinentalBankParser implements IBankParser {
  public readonly bankName = 'Banco Continental';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('continental') ||
      (lower.includes('acreditaci[oó]n de transferencia') && lower.includes('remitente'))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    const operationId = getField(/(?:Nro\.?\s*Referencia|Referencia):\s*([A-Za-z0-9]+)/i);
    const receiptNumber = getField(/Comprobante:\s*([A-Za-z0-9]+)/i);
    const payerName = getField(/(?:Remitente|Cliente\s*Ordenante):\s*([^\r\n]+)/i);
    const payerBank = getField(/(?:Banco\s*Remitente|Entidad\s*Origen):\s*([^\r\n]+)/i);
    const rawAmount = getField(/(?:Monto\s*Acreditado|Monto|Importe):\s*([^\r\n]+)/i);
    const operationDate = getField(/(?:Fecha\/Hora|Fecha):\s*([\d/]+(?:\s+[\d:]+)?)/i);

    const finalOpId = operationId || receiptNumber;
    if (!finalOpId) return null;

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId: finalOpId,
      receiptNumber: receiptNumber || finalOpId,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'Banco Continental',
      currency,
      amount,
      creditAccount: null,
      concept: null,
      rawText: text,
    };
  }
}
