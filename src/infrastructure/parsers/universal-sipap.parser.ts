import * as crypto from 'crypto';
import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class UniversalSipapParser implements IBankParser {
  public readonly bankName = 'SIPAP Paraguay (Universal)';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('transferencia') ||
      lower.includes('acreditad') ||
      lower.includes('recibist') ||
      lower.includes('sipap') ||
      lower.includes('comprobante') ||
      lower.includes('depósito') ||
      lower.includes('deposito') ||
      lower.includes('crédito') ||
      lower.includes('credito') ||
      lower.includes('debit') ||
      lower.includes('monto') ||
      lower.includes('importe') ||
      lower.includes('itau') ||
      lower.includes('itaú') ||
      lower.includes('ueno') ||
      lower.includes('continental') ||
      lower.includes('familiar') ||
      lower.includes('atlas') ||
      lower.includes('gnb') ||
      lower.includes('bnf') ||
      lower.includes('sudameris') ||
      lower.includes('basa') ||
      lower.includes('bancop') ||
      lower.includes('solar') ||
      lower.includes('rio')
    );
  }

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;
    const text = content.includes('<') && content.includes('>') ? htmlToPlainText(content) : content;

    const findMatch = (patterns: RegExp[]): string | null => {
      for (const p of patterns) {
        const m = text.match(p);
        if (m && m[1] && m[1].trim().length > 0) {
          return m[1].trim();
        }
      }
      return null;
    };

    // 1. AMOUNT Extraction
    const rawAmount = findMatch([
      /(?:moneda\s*y\s*monto|monto(?:\s*de\s*la\s*transferencia)?|importe(?:\s*de\s*la\s*operaci[oó]n)?|monto\s*acreditado|valor)\s*[:\-]?\s*(?:gs\.?|pyg)?\s*([0-9.,]+)/i,
      /(?:gs\.?|pyg|guaran[ií]es)\s*[:\-]?\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,10})/i,
      /([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,10})\s*(?:gs\.?|pyg|guaran[ií]es)/i,
      /monto\s*[:\-]?\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,10})/i,
      /importe\s*[:\-]?\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,10})/i,
      /(?:por|total)\s*[:\-]?\s*(?:gs\.?|pyg)?\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{4,10})/i,
    ]);

    const { currency, amount } = parsePyAmount(rawAmount);
    if (amount <= 0) {
      return null;
    }

    // 2. PAYER NAME Extraction
    let payerName = findMatch([
      /(?:titular\s*cuenta\s*d[eé]bito|cuenta\s*d[eé]bito\s*titular)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:cliente\s*pagador|nombre\s*del\s*pagador|pagador)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:debitado\s*de|enviado\s*por|remitente|ordenante|titular\s*ordenante)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:transferencia\s*recibida\s*de|transferencia\s*de|recibida\s*de|recibiste\s*de)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:te\s*transfiri[oó]|te\s*envi[oó])\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})\s*(?:te\s*transfiri[oó]|te\s*envi[oó])/i,
      /(?:origen|desde)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:\bde\b)\s*[:\-]\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,50})/i,
      /(?:\bde\s+)([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,})+)/i,
    ]);

    if (payerName) {
      payerName = payerName.split(/[\r\n\t,;.]/)[0].trim().replace(/\s+/g, ' ');
      // Clean leading/trailing noise
      payerName = payerName.replace(/^(?:la\s*cuenta|cuenta\s*de|sr|sra)\s+/i, '');
    } else {
      payerName = 'CLIENTE SIPAP';
    }

    // 3. OPERATION ID / RECEIPT NUMBER Extraction
    let operationId = findMatch([
      /(?<!(?:importe|monto|detalle|fecha|tipo|estado)\s*de\s*la\s*)(?:nro\.?\s*(?:de\s*)?operaci[oó]n|operaci[oó]n\s*n[°º.]?|\boperaci[oó]n\b)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?<!(?:importe|monto|detalle|fecha|tipo|estado)\s*de\s*la\s*)(?:nro\.?\s*(?:de\s*)?transacci[oó]n|transacci[oó]n\s*n[°º.]?|\btransacci[oó]n\b)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:nro\.?\s*(?:de\s*)?comprobante|comprobante(?:\s*n[°º.])?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:referencia\s*sipap|\breferencia\b)\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i,
      /(?:id\s*transferencia|\bid\b)\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i,
    ]);

    let receiptNumber = findMatch([
      /(?:nro\.?\s*comprobante|comprobante(?:\s*n[°º.])?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:referencia)\s*[:\-#]\s*([A-Za-z0-9\-_]+)/i,
    ]);

    let finalOperationId: string;
    let finalReceiptNumber: string;

    if (!operationId && !receiptNumber) {
      const hash = crypto
        .createHash('md5')
        .update(`${payerName}_${amount}_${text.slice(0, 100)}`)
        .digest('hex')
        .slice(0, 10)
        .toUpperCase();
      finalOperationId = `SIPAP-${hash}`;
      finalReceiptNumber = finalOperationId;
    } else if (!operationId && receiptNumber) {
      finalOperationId = receiptNumber;
      finalReceiptNumber = receiptNumber;
    } else if (operationId && !receiptNumber) {
      finalOperationId = operationId;
      finalReceiptNumber = operationId;
    } else {
      finalOperationId = operationId!;
      finalReceiptNumber = receiptNumber!;
    }

    // 4. DATE Extraction
    const operationDate = findMatch([
      /(?:fecha\s*y\s*hora(?:\s*de\s*operaci[oó]n|\s*transferencia)?|fecha\/hora)\s*[:\-]?\s*([\d/]+(?:\s+[\d:]+)?)/i,
      /(?:fecha)\s*[:\-]?\s*([\d/]+(?:\s+[\d:]+)?)/i,
    ]) || new Date().toISOString();

    // 5. BANK NAME Extraction
    let detectedBank = 'SIPAP Paraguay';
    const lower = text.toLowerCase();
    if (lower.includes('ueno')) detectedBank = 'UENO Bank';
    else if (lower.includes('itau') || lower.includes('itaú')) detectedBank = 'Banco Itaú';
    else if (lower.includes('continental')) detectedBank = 'Banco Continental';
    else if (lower.includes('gnb')) detectedBank = 'Banco GNB';
    else if (lower.includes('familiar')) detectedBank = 'Banco Familiar';
    else if (lower.includes('atlas')) detectedBank = 'Banco Atlas';
    else if (lower.includes('bnf') || lower.includes('fomento')) detectedBank = 'BNF';
    else if (lower.includes('sudameris')) detectedBank = 'Sudameris Bank';
    else if (lower.includes('basa')) detectedBank = 'Banco Basa';
    else if (lower.includes('bancop')) detectedBank = 'Bancop';
    else if (lower.includes('solar')) detectedBank = 'Solar Banco';

    return {
      operationId: finalOperationId,
      receiptNumber: finalReceiptNumber,
      operationDate,
      payerName: payerName.toUpperCase(),
      payerAccount: null,
      payerBank: detectedBank,
      currency,
      amount,
      creditAccount: null,
      concept: null,
      rawText: text,
    };
  }
}
