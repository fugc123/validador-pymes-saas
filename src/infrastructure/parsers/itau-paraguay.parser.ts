import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class ItauParaguayParser implements IBankParser {
  public readonly bankName = 'Banco Itaú Paraguay';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('itau') ||
      lower.includes('itaú') ||
      (lower.includes('detalle de la operaci') &&
        (lower.includes('moneda y monto') ||
          lower.includes('monto de la transferencia') ||
          lower.includes('cliente pagador')))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    const operationId = getField(/Nro\.?\s*de\s*operaci[oó]n:\s*([A-Za-z0-9_-]+)/i);
    const operationDate = getField(/Fecha\s*y\s*hora\s*de\s*operaci[oó]n:\s*([\d/]+(?:\s+[\d:]+)?)/i);
    const payerName = getField(/(?:Cliente\s*Pagador|Debitado\s*de|Enviado\s*por):\s*([^\r\n]+)/i);
    const payerAccount = getField(/(?:Nro\.?\s*de\s*cuenta\s*del\s*pagador|Cuenta\s*D[eé]bito):\s*([0-9]+)/i);
    const payerBank = getField(/(?:Entidad\s*pagadora|Banco\s*del\s*pagador|Entidad\s*D[eé]bito):\s*([^\r\n]+)/i);
    const rawAmount = getField(/(?:Moneda\s*y\s*Monto|Monto\s*de\s*la\s*transferencia|Monto|Importe):\s*([^\r\n]+)/i);
    const creditAccount = getField(/(?:Nro\.?\s*de\s*cuenta\s*cr[eé]dito|Acreditado\s*a\s*la\s*cuenta\s*de):\s*([A-Za-z0-9]+)/i);
    const receiptNumber = getField(/(?:Nro\.?\s*comprobante|Referencia|Comprobante):\s*([A-Za-z0-9_-]+)/i);
    const concept = getField(/(?:Concepto\s*de\s*la\s*Transferencia|Concepto|Mensaje):\s*([^\r\n]+)/i);

    if (!operationId && !receiptNumber) {
      return null;
    }

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId: operationId || receiptNumber!,
      receiptNumber: receiptNumber || operationId!,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: payerAccount || null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'Banco Itaú',
      currency,
      amount,
      creditAccount: creditAccount || null,
      concept: concept || null,
      rawText: text,
    };
  }
}
