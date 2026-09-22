import * as crypto from 'crypto';
import { IBankParser, ParsedTransferData } from './parser.interface';
import { htmlToPlainText, parsePyAmount } from './base-parser';

export class UniversalSipapParser implements IBankParser {
  public readonly bankName = 'SIPAP / Billeteras / Financieras (Universal)';

  canParse(content: string): boolean {
    if (!content) return false;
    const lower = content.toLowerCase();
    return (
      lower.includes('transferencia') ||
      lower.includes('transferir') ||
      lower.includes('transfiri') ||
      lower.includes('transacci') ||
      lower.includes('acreditad') ||
      lower.includes('recibist') ||
      lower.includes('recib') ||
      lower.includes('cobraste') ||
      lower.includes('cobro') ||
      lower.includes('sipap') ||
      lower.includes('spi') ||
      lower.includes('comprobante') ||
      lower.includes('constancia') ||
      lower.includes('depósito') ||
      lower.includes('deposito') ||
      lower.includes('crédito') ||
      lower.includes('credito') ||
      lower.includes('debit') ||
      lower.includes('pago') ||
      lower.includes('giro') ||
      lower.includes('envío') ||
      lower.includes('envio') ||
      lower.includes('carga') ||
      lower.includes('monto') ||
      lower.includes('importe') ||
      lower.includes('valor') ||
      lower.includes('total') ||
      lower.includes('gs') ||
      lower.includes('pyg') ||
      lower.includes('guaran') ||
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
      lower.includes('rio') ||
      lower.includes('zeta') ||
      lower.includes('tigo') ||
      lower.includes('personal') ||
      lower.includes('zimple') ||
      lower.includes('mango') ||
      lower.includes('wally') ||
      lower.includes('vaquita') ||
      lower.includes('financiera') ||
      lower.includes('cooperativa')
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

    // 1. AMOUNT Extraction (Pares Clave-Valor + Lenguaje Natural de Billeteras)
    const rawAmount = findMatch([
      // Claves directas (Monto, Importe, Moneda y Monto, Total, etc.)
      /(?:moneda\s*y\s*monto|monto(?:\s*de\s*la\s*transferencia|\s*total|\s*acreditado|\s*enviado|\s*recibido)?|importe(?:\s*de\s*la\s*operaci[oó]n|\s*total|\s*acreditado|\s*recibido)?|valor(?:\s*total|\s*acreditado)?|total)\s*[:\-]?\s*(?:gs\.?|pyg|guaran[ií]es)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,10})/i,
      // Lenguaje natural de billeteras y notificaciones directas
      /(?:recibiste|transfiri[oó]|envi[oó]|te\s*enviaron|te\s*transfirieron|cobraste|giro\s*de|carga\s*de|acreditaci[oó]n\s*de|pago\s*de)\s*(?:un\s*monto\s*de\s*)?(?:gs\.?|pyg)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,10})/i,
      // Símbolo monetario paraguayo seguido de monto
      /(?:gs\.?|pyg|guaran[ií]es)\s*[:\-]?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,10})/i,
      // Monto seguido de símbolo monetario paraguayo
      /([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,10})\s*(?:gs\.?|pyg|guaran[ií]es)/i,
      // Fallback genérico por palabra clave monto/importe/por
      /(?:monto|importe|por|total)\s*[:\-]?\s*(?:gs\.?|pyg)?\s*([0-9]{1,3}(?:[.,][0-9]{3})+|[0-9]{4,10})/i,
    ]);

    const { currency, amount } = parsePyAmount(rawAmount);
    if (amount <= 0) {
      return null;
    }

    // 2. PAYER NAME Extraction (Diccionario Semántico Universal)
    let payerName = findMatch([
      // Etiquetas estándar de bancos y entidades
      /(?:titular\s*(?:cuenta\s*)?d[eé]bito|cuenta\s*d[eé]bito\s*titular)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:cliente\s*pagador|nombre\s*del\s*pagador|pagador)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:debitado\s*de|enviado\s*por|enviada\s*por|remitente|titular\s*ordenante|ordenante)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:usuario|cliente|persona\s*que\s*env[ií]a)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:origen|desde)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:\bde\b)\s*[:\-]\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      // Lenguaje natural de billeteras
      /(?:transferencia\s*recibida\s*de|transferencia\s*de|recibida\s*de|recibiste\s*de)\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /(?:te\s*transfiri[oó]|te\s*envi[oó])\s*(?:dinero\s*)?([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})/i,
      /([A-Za-zÁÉÍÓÚáéíóúÑñ\s.'-]{3,60})\s*(?:te\s*transfiri[oó]|te\s*envi[oó])/i,
      // Líneas donde se especifica remitente entre paréntesis o tras "de"
      /(?:\bde\s+)([A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}(?:\s+[A-Za-zÁÉÍÓÚáéíóúÑñ]{2,})+)/i,
    ]);

    if (payerName) {
      payerName = payerName.split(/[\r\n\t,;]/)[0].trim().replace(/\s+/g, ' ');
      // Limpiar prefijos comunes como 'la cuenta de', 'cuenta de', 'Sr/Sra'
      payerName = payerName.replace(/^(?:la\s*cuenta\s*de|cuenta\s*de|sr\.?|sra\.?|don|doña)\s+/i, '');
      // Limpiar números de teléfono o códigos adjuntos al nombre
      payerName = payerName.replace(/\(?09\d{2}[\s.-]?\d{3}[\s.-]?\d{3}\)?/g, '').trim();
    } else {
      payerName = 'CLIENTE SIPAP';
    }

    // 3. OPERATION ID / RECEIPT NUMBER Extraction (Cascada de Identificadores)
    let operationId = findMatch([
      /(?<!(?:importe|monto|detalle|fecha|tipo|estado)\s*de\s*la\s*)(?:(?:nro\.?|n[°º])\s*(?:de\s*)?operaci[oó]n|operaci[oó]n(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?<!(?:importe|monto|detalle|fecha|tipo|estado)\s*de\s*la\s*)(?:(?:nro\.?|n[°º])\s*(?:de\s*)?transacci[oó]n|transacci[oó]n(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:(?:nro\.?|n[°º])\s*(?:de\s*)?comprobante|comprobante(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:referencia\s*sipap|referencia\s*spi|(?:nro\.?|n[°º])\s*(?:de\s*)?referencia|referencia(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:id\s*(?:de\s*)?operaci[oó]n|id\s*(?:de\s*)?transferencia|\bid\b|\bticket\b|\bc[oó]digo\b)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
    ]);

    let receiptNumber = findMatch([
      /(?:(?:nro\.?|n[°º])\s*(?:de\s*)?comprobante|comprobante(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
      /(?:referencia\s*sipap|referencia\s*spi|(?:nro\.?|n[°º])\s*(?:de\s*)?referencia|referencia(?:\s*(?:nro\.?|n[°º.]?))?)\s*[:\-#]?\s*([A-Za-z0-9\-_]+)/i,
    ]);

    let finalOperationId: string;
    let finalReceiptNumber: string;

    if (!operationId && !receiptNumber) {
      // Fallback Determinístico Idempotente
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
      /(?:fecha\s*de\s*(?:operaci[oó]n|proceso|emisi[oó]n)|\bfecha\b)\s*[:\-]?\s*([\d/]+(?:\s+[\d:]+)?)/i,
    ]) || new Date().toISOString();

    // 5. ENTITY / BANK / WALLET Detection (Bancos, Billeteras y Financieras)
    let detectedBank = 'SIPAP / Entidad Financiera';
    const lower = text.toLowerCase();

    // Billeteras y Fintechs
    if (lower.includes('tigo') || lower.includes('tigo money')) detectedBank = 'Tigo Money';
    else if (lower.includes('personal') || lower.includes('billetera personal')) detectedBank = 'Personal Pay';
    else if (lower.includes('zimple')) detectedBank = 'Zimple';
    else if (lower.includes('mango')) detectedBank = 'Mango';
    else if (lower.includes('wally')) detectedBank = 'Wally';
    else if (lower.includes('vaquita')) detectedBank = 'Vaquita';
    else if (lower.includes('claro pay')) detectedBank = 'Claro Pay';
    else if (lower.includes('bancard') || lower.includes('pago móvil')) detectedBank = 'Bancard';

    // Bancos
    else if (lower.includes('ueno')) detectedBank = 'UENO Bank';
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
    else if (lower.includes('rio') || lower.includes('zeta')) detectedBank = 'Zeta Banco';

    // Financieras y Cooperativas
    else if (lower.includes('tufinanciera') || lower.includes('tu financiera')) detectedBank = 'Tu Financiera';
    else if (lower.includes('fic')) detectedBank = 'FIC Finanzas';
    else if (lower.includes('finlatina')) detectedBank = 'Finlatina';
    else if (lower.includes('cooperativa') || lower.includes('coomecipar') || lower.includes('san cristobal') || lower.includes('medalla') || lower.includes('universitaria')) {
      detectedBank = 'Cooperativa';
    }

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
