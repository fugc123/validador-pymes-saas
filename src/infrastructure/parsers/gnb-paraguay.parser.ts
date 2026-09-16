import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class GnbParaguayParser implements IBankParser {
  public readonly bankName = 'Banco GNB Paraguay';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('gnb') ||
      (lower.includes('transferencia interbancaria recibida') && lower.includes('crédito a su cuenta'))
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const getField = (pattern: RegExp): string | null => {
      const match = text.match(pattern);
      return match && match[1] ? match[1].trim() : null;
    };

    const receiptNumber = getField(/N[°º.]?\s*Comprobante:\s*([A-Za-z0-9]+)/i);
    const reference = getField(/Referencia:\s*([A-Za-z0-9]+)/i);
    const operationDate = getField(/Fecha\s*y\s*hora:\s*([\d/]+(?:\s+[\d:]+)?)/i);
    const payerName = getField(/Enviado\s*por:\s*([^\r\n]+)/i);
    const payerBank = getField(/Entidad\s*Pagadora:\s*([^\r\n]+)/i);
    const payerAccount = getField(/N[°º.]?\s*Cuenta\s*Pagador:\s*([0-9]+)/i);
    const rawAmount = getField(/Importe:\s*([^\r\n]+)/i);
    const creditAccount = getField(/Cuenta\s*cr[eé]dito:\s*([0-9]+)/i);
    const concept = getField(/Comentario:\s*([^\r\n]+)/i);

    const operationId = reference || receiptNumber;
    if (!operationId) return null;

    const { currency, amount } = parsePyAmount(rawAmount);

    return {
      operationId,
      receiptNumber: receiptNumber || reference || operationId,
      operationDate: operationDate || new Date().toISOString(),
      payerName: payerName ? payerName.replace(/\s+/g, ' ') : 'DESCONOCIDO',
      payerAccount: payerAccount || null,
      payerBank: payerBank ? payerBank.replace(/\s+/g, ' ') : 'Banco GNB',
      currency,
      amount,
      creditAccount: creditAccount || null,
      concept: concept || null,
      rawText: text,
    };
  }
}
