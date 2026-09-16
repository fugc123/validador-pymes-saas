import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class FamiliarBankParser implements IBankParser {
  public readonly bankName = 'Banco Familiar';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('familiar') ||
      (lower.includes('transferencia sipap recibida') && lower.includes('ordenante'))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    const operationId = getField(/Nro\.?\s*de\s*Operaci[oó]n:\s*([A-Za-z0-9]+)/i);
    const receiptNumber = getField(/(?:Comprobante|Nro\.?\s*Comprobante):\s*([A-Za-z0-9]+)/i);
    const payerName = getField(/(?:Titular\s*Ordenante|Ordenante):\s*([^\r\n]+)/i);
    const payerBank = getField(/(?:Banco\s*Origen|Entidad\s*Remitente):\s*([^\r\n]+)/i);
    const rawAmount = getField(/(?:Importe|Monto):\s*([^\r\n]+)/i);
    const operationDate = getField(/(?:Fecha\s*y\s*Hora|Fecha):\s*([\d/]+(?:\s+[\d:]+)?)/i);

    const finalOpId = operationId || receiptNumber;
    if (!finalOpId) return null;

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId: finalOpId,
      receiptNumber: receiptNumber || finalOpId,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'Banco Familiar',
      currency,
      amount,
      creditAccount: null,
      concept: null,
      rawText: text,
    };
  }
}
