import { SifenConfig, SifenInvoice } from '../ports/sifen.ports';

function formatPdfLiteral(raw: string): string {
  const safeAscii = (raw || '')
    .replace(/\r?\n/g, ' ')
    .replace(/[€]/g, 'EUR')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  let out = '';
  for (let i = 0; i < safeAscii.length; i++) {
    const ch = safeAscii[i];
    const code = ch.charCodeAt(0);
    if (ch === '\\' || ch === '(' || ch === ')') {
      out += '\\' + ch;
    } else if (code >= 0x20 && code <= 0xff) {
      out += ch;
    } else {
      out += ' ';
    }
  }
  return out;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = (text || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return ['-'];
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (current.length === 0) {
      current = w;
    } else if (current.length + 1 + w.length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function formatCdcBlocks(cdc: string): string {
  return (cdc || '').replace(/(\d{4})(?=\d)/g, '$1 ');
}

/**
 * Generates a compact, standards-compliant A4 KuDE PDF document (%PDF-1.4)
 * with no external runtime dependencies, usable both for homologation mock invoices
 * and as a fallback when an upstream provider PDF endpoint is unavailable.
 */
export function generateKudePdfBuffer(
  invoice: SifenInvoice,
  config?: SifenConfig | null,
): Buffer {
  const cmds: string[] = [];
  let y = 795;

  const drawText = (
    text: string,
    x: number,
    yPos: number,
    font: 'F1' | 'F2' | 'F3' = 'F2',
    size = 10,
  ) => {
    cmds.push(`BT /${font} ${size} Tf 1 0 0 1 ${x} ${yPos} Tm (${formatPdfLiteral(text)}) Tj ET`);
  };

  const drawLine = (yPos: number) => {
    cmds.push(`0.75 w 42 ${yPos} m 553 ${yPos} l S`);
  };

  // Header
  drawText('KuDE - DOCUMENTO TRIBUTARIO ELECTRONICO (SIFEN)', 42, y, 'F1', 13);
  y -= 16;
  drawText(
    invoice.environment === 'prod'
      ? 'Ambiente: PRODUCCION (DNIT Paraguay)'
      : 'Ambiente: HOMOLOGACION / TEST (SIFEN Paraguay)',
    42,
    y,
    'F2',
    9,
  );
  y -= 12;
  drawLine(y);
  y -= 20;

  // Emisor section
  const issuerName = config?.razonSocial || 'COMERCIO EMISOR SIFEN';
  const issuerRuc = config ? `${config.ruc}-${config.dv}` : invoice.cdc.slice(2, 11);
  const issuerAddress = config?.direccion || 'Asuncion, Paraguay';
  drawText(`EMISOR: ${issuerName}`, 42, y, 'F1', 11);
  y -= 15;
  drawText(`RUC Emisor: ${issuerRuc}    |    Timbrado Nro: ${invoice.timbrado}`, 42, y, 'F2', 10);
  y -= 14;
  drawText(`Direccion: ${issuerAddress}    |    Tel: ${config?.telefono || '-'}`, 42, y, 'F2', 9);
  y -= 12;
  drawLine(y);
  y -= 20;

  // Document info
  drawText(`FACTURA ELECTRONICA NRO: ${invoice.numeroDocumento}`, 42, y, 'F1', 12);
  y -= 16;
  const emittedStr = new Date(invoice.createdAt || Date.now()).toISOString().replace('T', ' ').slice(0, 19);
  drawText(
    `Fecha Emision (UTC): ${emittedStr}    |    Condicion: ${invoice.condicionVenta}`,
    42,
    y,
    'F2',
    10,
  );
  y -= 14;
  drawText(`Estado Documento: ${invoice.status}`, 42, y, 'F2', 9);
  y -= 12;
  drawLine(y);
  y -= 20;

  // Receptor section
  const receptorDoc = invoice.receptorDv
    ? `${invoice.receptorRuc}-${invoice.receptorDv}`
    : invoice.receptorRuc;
  drawText('DATOS DEL RECEPTOR / CLIENTE', 42, y, 'F1', 10);
  y -= 15;
  drawText(`Nombre / Razon Social: ${invoice.receptorNombre}`, 42, y, 'F2', 10);
  y -= 14;
  drawText(`RUC / Documento: ${receptorDoc}`, 42, y, 'F2', 10);
  y -= 12;
  drawLine(y);
  y -= 22;

  // Totals
  drawText('RESUMEN DE OPERACION', 42, y, 'F1', 10);
  y -= 16;
  drawText(
    `TOTAL A PAGAR: Gs. ${Math.round(Number(invoice.totalAmount || 0)).toLocaleString('es-PY')}`,
    42,
    y,
    'F1',
    12,
  );
  y -= 15;
  drawText(
    `Liquidacion IVA (10%): Gs. ${Math.round(Number(invoice.iva10Amount || 0)).toLocaleString('es-PY')}`,
    42,
    y,
    'F2',
    10,
  );
  y -= 14;
  for (const line of wrapText(`Detalle / Estado: ${invoice.responseMessage || ''}`, 88)) {
    drawText(line, 42, y, 'F2', 9);
    y -= 13;
  }
  y -= 8;
  drawLine(y);
  y -= 20;

  // SIFEN Footer & CDC
  drawText('CDC (Codigo de Control - 44 digitos):', 42, y, 'F1', 10);
  y -= 15;
  drawText(formatCdcBlocks(invoice.cdc), 42, y, 'F3', 10);
  y -= 18;
  drawText('Verificacion publica en SET / DNIT e-Kuatia:', 42, y, 'F2', 9);
  y -= 13;
  for (const urlLine of wrapText(invoice.qrUrl || '', 92)) {
    drawText(urlLine, 42, y, 'F3', 8);
    y -= 11;
  }

  const streamContent = cmds.join('\n') + '\n';
  const streamLen = Buffer.byteLength(streamContent, 'latin1');

  const objects: string[] = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj\n',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj\n',
    '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj\n',
    `7 0 obj\n<< /Length ${streamLen} >>\nstream\n${streamContent}endstream\nendobj\n`,
  ];

  const header = '%PDF-1.4\n';
  const chunks: Buffer[] = [Buffer.from(header, 'latin1')];
  let offset = Buffer.byteLength(header, 'latin1');
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(offset);
    const buf = Buffer.from(obj, 'latin1');
    chunks.push(buf);
    offset += buf.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  chunks.push(Buffer.from(xref + trailer, 'latin1'));
  return Buffer.concat(chunks);
}
