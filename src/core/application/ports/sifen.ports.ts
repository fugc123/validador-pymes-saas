import * as crypto from 'crypto';

export type SifenEnvironment = 'test' | 'prod';
export type SifenContribuyenteType = 1 | 2; // 1 = Persona Física, 2 = Persona Jurídica

export interface SifenConfig {
  tenantId: string;
  enabled: boolean;
  environment: SifenEnvironment;
  ruc: string;
  dv: string;
  razonSocial: string;
  nombreFantasia: string;
  tipoContribuyente: SifenContribuyenteType;
  tipoRegimen: number;
  timbrado: string;
  fechaInicioTimbrado: string;
  establecimiento: string;
  puntoExpedicion: string;
  direccion: string;
  numeroCasa: string;
  departamento: number;
  departamentoDesc: string;
  distrito: number;
  distritoDesc: string;
  ciudad: number;
  ciudadDesc: string;
  telefono: string;
  email: string;
  actividadEconomicaCodigo: string;
  actividadEconomicaDesc: string;
  cscId: string;
  csc: string;
  certificadoBase64: string | null;
  certificadoPassword: string | null;
  hasCertificate: boolean;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  lastTestCdc: string | null;
  lastTestedAt: Date | null;
  updatedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertSifenConfigInput {
  enabled?: boolean;
  environment?: SifenEnvironment;
  ruc: string;
  dv: string;
  razonSocial: string;
  nombreFantasia?: string;
  tipoContribuyente?: SifenContribuyenteType;
  tipoRegimen?: number;
  timbrado: string;
  fechaInicioTimbrado?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
  direccion?: string;
  numeroCasa?: string;
  departamento?: number;
  departamentoDesc?: string;
  distrito?: number;
  distritoDesc?: string;
  ciudad?: number;
  ciudadDesc?: string;
  telefono?: string;
  email?: string;
  actividadEconomicaCodigo?: string;
  actividadEconomicaDesc?: string;
  cscId?: string;
  csc?: string;
  certificadoBase64?: string | null;
  certificadoPassword?: string | null;
  updatedByUserId?: string | null;
}

export interface SifenInvoiceItemInput {
  codigo?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa?: 10 | 5 | 0;
}

export interface EmitSifenInvoiceInput {
  tenantId: string;
  saleId?: string | null;
  receptorRuc: string;
  receptorDv?: string | null;
  receptorNombre: string;
  condicionVenta?: 'CONTADO' | 'CREDITO';
  totalAmount?: number;
  items?: SifenInvoiceItemInput[];
  isTest?: boolean;
}

export interface SifenInvoice {
  id: string;
  tenantId: string;
  saleId: string | null;
  cdc: string;
  numeroDocumento: string;
  timbrado: string;
  environment: SifenEnvironment;
  receptorRuc: string;
  receptorDv: string | null;
  receptorNombre: string;
  condicionVenta: 'CONTADO' | 'CREDITO';
  totalAmount: number;
  iva10Amount: number;
  xmlPayload: string;
  qrUrl: string;
  status: 'GENERATED' | 'TEST_OK' | 'APPROVED' | 'REJECTED';
  responseMessage: string;
  createdAt: Date;
}

export interface FreeMerchantSifenSummary {
  tenantId: string;
  merchantName: string;
  merchantSlug: string;
  isLifetime: boolean;
  hasConfig: boolean;
  enabled: boolean;
  environment: SifenEnvironment;
  ruc: string | null;
  dv: string | null;
  razonSocial: string | null;
  timbrado: string | null;
  establecimiento: string;
  puntoExpedicion: string;
  hasCertificate: boolean;
  lastTestStatus: string | null;
  lastTestCdc: string | null;
  lastTestedAt: Date | null;
}

export interface ISifenRepository {
  isEligibleFreeMerchant(tenantId: string): Promise<boolean>;
  assertEligibleFreeMerchant(tenantId: string): Promise<void>;
  listFreeMerchantsWithSifenStatus(): Promise<FreeMerchantSifenSummary[]>;
  getConfigByTenant(tenantId: string): Promise<SifenConfig | null>;
  upsertConfig(tenantId: string, input: UpsertSifenConfigInput): Promise<SifenConfig>;
  emitInvoice(input: EmitSifenInvoiceInput): Promise<SifenInvoice>;
  listInvoicesByTenant(tenantId: string, limit?: number): Promise<SifenInvoice[]>;
}

/**
 * Calculates the Paraguayan RUC / CDC Modulo-11 check digit (DV).
 */
export function calculateParaguayDv(numericStr: string, baseMax = 11): string {
  const digits = numericStr.replace(/\D/g, '');
  if (!digits) return '0';

  let factor = 2;
  let total = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    total += Number(digits[i]) * factor;
    factor++;
    if (factor > baseMax) {
      factor = 2;
    }
  }
  const remainder = total % 11;
  const dv = remainder > 1 ? 11 - remainder : 0;
  return String(dv);
}

/**
 * Generates an official 44-digit Paraguayan SIFEN CDC (Código de Control):
 * - 2 digits: Tipo de Documento (01 = Factura Electrónica)
 * - 8 digits: RUC Emisor (zero-padded left)
 * - 1 digit: DV Emisor
 * - 3 digits: Establecimiento (e.g. 001)
 * - 3 digits: Punto de Expedición (e.g. 001)
 * - 7 digits: Número de Documento (zero-padded)
 * - 1 digit: Tipo de Contribuyente (1 or 2)
 * - 8 digits: Fecha de Emisión (YYYYMMDD)
 * - 1 digit: Tipo de Emisión (1 = Normal)
 * - 9 digits: Código de Seguridad Aleatorio
 * - 1 digit: Dígito Verificador Modulo 11 of the preceding 43 digits
 */
export function generateParaguayCdc(params: {
  tipoDocumento?: string;
  ruc: string;
  dv: string;
  establecimiento: string;
  puntoExpedicion: string;
  numeroSecuencial: number;
  tipoContribuyente: SifenContribuyenteType;
  fechaEmision?: Date;
  codigoSeguridad?: string;
}): string {
  const tipoDoc = (params.tipoDocumento || '01').padStart(2, '0').slice(-2);
  const rucPadded = params.ruc.replace(/\D/g, '').padStart(8, '0').slice(-8);
  const dvDigit = (params.dv.replace(/\D/g, '') || calculateParaguayDv(rucPadded)).slice(-1);
  const est = (params.establecimiento || '001').replace(/\D/g, '').padStart(3, '0').slice(-3);
  const pun = (params.puntoExpedicion || '001').replace(/\D/g, '').padStart(3, '0').slice(-3);
  const numDoc = String(Math.max(1, params.numeroSecuencial)).padStart(7, '0').slice(-7);
  const tipoCont = String(params.tipoContribuyente === 1 ? 1 : 2);

  const d = params.fechaEmision || new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const fechaStr = `${yyyy}${mm}${dd}`;

  const tipoEmision = '1';
  const codSeg =
    params.codigoSeguridad && /^\d{9}$/.test(params.codigoSeguridad)
      ? params.codigoSeguridad
      : String(crypto.randomInt(100000000, 1000000000));

  const base43 = `${tipoDoc}${rucPadded}${dvDigit}${est}${pun}${numDoc}${tipoCont}${fechaStr}${tipoEmision}${codSeg}`;
  const dvCdc = calculateParaguayDv(base43);
  return `${base43}${dvCdc}`;
}

/**
 * Builds the SIFEN / consultame-sdk compatible XML Document (`rDE`) and QR validation URL.
 */
export function buildSifenElectronicDocument(params: {
  config: SifenConfig;
  cdc: string;
  numeroDocumento: string;
  receptorRuc: string;
  receptorDv?: string | null;
  receptorNombre: string;
  condicionVenta: 'CONTADO' | 'CREDITO';
  totalAmount: number;
  items: SifenInvoiceItemInput[];
  emittedAt?: Date;
}): { xmlPayload: string; qrUrl: string; iva10Amount: number } {
  const emittedAt = params.emittedAt || new Date();
  const isoDate = emittedAt.toISOString().slice(0, 19);
  const iva10Amount = Math.round(params.totalAmount / 11);

  const digestInput = `${params.cdc}|${isoDate}|${params.totalAmount}|${params.config.csc || 'CSC-DEFAULT'}`;
  const cHashQr = crypto.createHash('sha256').update(digestInput).digest('hex');

  const baseQrHost =
    params.config.environment === 'prod'
      ? 'https://ekuatia.set.gov.py/consultas/qr?'
      : 'https://ekuatia.set.gov.py/consultas-test/qr?';

  const qrUrl = `${baseQrHost}nVersion=150&Id=${params.cdc}&dFeEmiDE=${Buffer.from(isoDate).toString('hex')}&dRucRec=${params.receptorRuc}&dTotGralOpe=${params.totalAmount}&dTotIVA=${iva10Amount}&cItems=${params.items.length}&DigestValue=${cHashQr.slice(0, 32)}&IdCSC=${params.config.cscId || '0001'}`;

  const itemsXml = params.items
    .map(
      (item, idx) => `        <gCamItem>
          <dCodInt>${item.codigo || `ITEM-${idx + 1}`}</dCodInt>
          <dDesProSer>${escapeXml(item.descripcion)}</dDesProSer>
          <dCantProSer>${item.cantidad}</dCantProSer>
          <gValorItem>
            <dPUniProSer>${item.precioUnitario}</dPUniProSer>
            <dTotBruOpeItem>${item.cantidad * item.precioUnitario}</dTotBruOpeItem>
          </gValorItem>
        </gCamItem>`,
    )
    .join('\n');

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<rDE xmlns="http://ekuatia.set.gov.py/sifen/xsd">
  <dVerFor>150</dVerFor>
  <DE Id="${params.cdc}">
    <gOpeDE>
      <iTipEmi>1</iTipEmi>
      <dDesTipEmi>Normal</dDesTipEmi>
      <dCodSeg>${params.cdc.slice(34, 43)}</dCodSeg>
    </gOpeDE>
    <gTimb>
      <iTiDE>1</iTiDE>
      <dDesTiDE>Factura electrónica</dDesTiDE>
      <dNumTim>${escapeXml(params.config.timbrado)}</dNumTim>
      <dEst>${escapeXml(params.config.establecimiento)}</dEst>
      <dPunExp>${escapeXml(params.config.puntoExpedicion)}</dPunExp>
      <dNumDoc>${escapeXml(params.numeroDocumento.split('-').pop() || '0000001')}</dNumDoc>
      <dFeIniT>${escapeXml(params.config.fechaInicioTimbrado)}</dFeIniT>
    </gTimb>
    <gDatGralOpe>
      <dFeEmiDE>${isoDate}</dFeEmiDE>
      <gEmis>
        <dRucEm>${escapeXml(params.config.ruc)}</dRucEm>
        <dDVEmi>${escapeXml(params.config.dv)}</dDVEmi>
        <iTipCont>${params.config.tipoContribuyente}</iTipCont>
        <dNomEmi>${escapeXml(params.config.razonSocial)}</dNomEmi>
        <dNomFanEmi>${escapeXml(params.config.nombreFantasia || params.config.razonSocial)}</dNomFanEmi>
        <dDirEmi>${escapeXml(params.config.direccion)}</dDirEmi>
        <dNumCas>${escapeXml(params.config.numeroCasa || '0')}</dNumCas>
        <cDepEmi>${params.config.departamento}</cDepEmi>
        <dDesDepEmi>${escapeXml(params.config.departamentoDesc)}</dDesDepEmi>
        <cCiuEmi>${params.config.ciudad}</cCiuEmi>
        <dDesCiuEmi>${escapeXml(params.config.ciudadDesc)}</dDesCiuEmi>
        <dTelEmi>${escapeXml(params.config.telefono)}</dTelEmi>
        <dEmailE>${escapeXml(params.config.email)}</dEmailE>
        <gActEco>
          <cActEco>${escapeXml(params.config.actividadEconomicaCodigo)}</cActEco>
          <dDesActEco>${escapeXml(params.config.actividadEconomicaDesc)}</dDesActEco>
        </gActEco>
      </gEmis>
      <gDatRec>
        <dRucRec>${escapeXml(params.receptorRuc)}</dRucRec>
        <dDVRec>${escapeXml(params.receptorDv || calculateParaguayDv(params.receptorRuc))}</dDVRec>
        <dNomRec>${escapeXml(params.receptorNombre)}</dNomRec>
      </gDatRec>
    </gDatGralOpe>
    <gDtipDE>
      <gCamFE>
        <iIndPres>1</iIndPres>
      </gCamFE>
${itemsXml}
    </gDtipDE>
    <gTotSub>
      <dTotGralOpe>${params.totalAmount}</dTotGralOpe>
      <dIVA10>${iva10Amount}</dIVA10>
      <dTotIVA>${iva10Amount}</dTotIVA>
    </gTotSub>
  </DE>
  <gCamFuFD>
    <dCarQR>${escapeXml(qrUrl)}</dCarQR>
  </gCamFuFD>
</rDE>`;

  return { xmlPayload, qrUrl, iva10Amount };
}

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
