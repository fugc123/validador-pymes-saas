import { BadGatewayException, BadRequestException, Injectable } from '@nestjs/common';
import { calculateParaguayDv, SifenInvoiceItemInput } from '../../core/application/ports/sifen.ports';

export interface FactufyCredentials {
  clientId: string;
  clientSecret: string;
  branchCode: string;
  posCode: string;
  baseUrl?: string;
}

export interface FactufyInvoicePayloadInput {
  externalId: string;
  fechaEmisionIso: string;
  receptorRuc: string;
  receptorDv: string;
  receptorNombre: string;
  receptorTipoContribuyente?: 1 | 2;
  condicionVenta: 'CONTADO' | 'CREDITO';
  totalAmount: number;
  items: SifenInvoiceItemInput[];
}

export interface FactufyEmitResult {
  cdc: string | null;
  jobId: string | null;
  status: 'APPROVED' | 'TEST_OK' | 'GENERATED';
  message: string;
  raw: unknown;
}

@Injectable()
export class FactufyAdapter {
  private tokenCache = new Map<string, { token: string; expiresAt: number }>();

  private resolveBaseUrl(override?: string): string {
    return (override || process.env.FACTUFY_BASE_URL || 'https://api.factufy.com.py').replace(/\/+$/, '');
  }

  async getAccessToken(creds: FactufyCredentials): Promise<string> {
    if (!creds.clientId || !creds.clientSecret) {
      throw new BadRequestException('Faltan credenciales de Factufy (clientId / clientSecret).');
    }

    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const cacheKey = `${baseUrl}|${creds.clientId}|${creds.branchCode}|${creds.posCode}`;
    const cached = this.tokenCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.token;
    }

    const res = await fetch(`${baseUrl}/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: creds.clientId,
        clientSecret: creds.clientSecret,
        branchCode: creds.branchCode || '001',
        posCode: creds.posCode || '001',
      }),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadGatewayException(
        data?.message || `Factufy auth falló (${res.status}). Verificá clientId, clientSecret, branchCode y posCode.`,
      );
    }

    const token =
      data?.accessToken ||
      data?.token ||
      data?.access_token ||
      data?.data?.accessToken ||
      data?.data?.token;
    if (!token || typeof token !== 'string') {
      throw new BadGatewayException('Factufy no devolvió un token JWT válido.');
    }

    this.tokenCache.set(cacheKey, {
      token,
      expiresAt: Date.now() + 45 * 60 * 1000,
    });
    return token;
  }

  async consultRuc(
    creds: FactufyCredentials,
    rawRuc: string,
  ): Promise<{ ruc: string; dv: string; razonSocial: string | null }> {
    const cleanRuc = (rawRuc || '').split('-')[0].replace(/\D/g, '');
    if (cleanRuc.length < 5) {
      throw new BadRequestException('RUC inválido para consultar en Factufy (mínimo 5 dígitos).');
    }

    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const token = await this.getAccessToken(creds);
    const res = await fetch(`${baseUrl}/invoices/ruc/${encodeURIComponent(cleanRuc)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadGatewayException(data?.message || `Error consultando RUC en Factufy (${res.status}).`);
    }

    const payload = data?.data || data;
    return {
      ruc: cleanRuc,
      dv: String(payload?.dv ?? payload?.digitoVerificado ?? calculateParaguayDv(cleanRuc)),
      razonSocial: payload?.razonSocial || payload?.nombre || null,
    };
  }

  async sendInvoice(creds: FactufyCredentials, input: FactufyInvoicePayloadInput): Promise<FactufyEmitResult> {
    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const token = await this.getAccessToken(creds);

    const body = {
      external_id: input.externalId,
      idTipoEmision: 1,
      fechaEmision: input.fechaEmisionIso,
      cliente: {
        idTipoReceptor: 1,
        idTipoOperacion: 1,
        idPais: 'PRY',
        esContribuyente: true,
        idTipoContribuyente: input.receptorTipoContribuyente || 1,
        ruc: input.receptorRuc,
        digitoVerificado: input.receptorDv,
        razonSocial: input.receptorNombre,
      },
      timbrado: {
        idTipoDocumento: 1,
      },
      datosOperacion: {
        idTipoDocumento: 1,
        idMoneda: 'PYG',
        idTipoTransaccion: 1,
        idTipoImpuesto: 1,
      },
      datosFactura: {
        idPresencia: 1,
        condicion: {
          idCondicion: input.condicionVenta === 'CREDITO' ? 2 : 1,
          formasPagos: [
            {
              idFormaPago: 1,
              monto: input.totalAmount,
              idMoneda: 'PYG',
            },
          ],
        },
      },
      detalleFactura: input.items.map((it, idx) => ({
        codigo: it.codigo || `ITEM-${idx + 1}`,
        descripcion: it.descripcion,
        idUnidadMedida: 77,
        cantidad: String(it.cantidad),
        precioUnitario: it.precioUnitario,
        idMoneda: 'PYG',
        idIva: 1,
        ivaBase: 100,
        tasaIva: it.ivaTasa ?? 10,
      })),
    };

    const res = await fetch(`${baseUrl}/invoices`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadGatewayException(data?.message || `Error emitiendo factura en Factufy (${res.status}).`);
    }

    const payload = data?.data || data;
    let cdc: string | null = payload?.cdc || payload?.CDC || null;
    const jobId = payload?.jobId || payload?.job_id || payload?.id || null;
    let status: FactufyEmitResult['status'] = cdc ? 'APPROVED' : 'GENERATED';
    let message: string = data?.message || 'Documento enviado a SIFEN vía Factufy correctamente.';

    if ((!cdc || typeof cdc !== 'string' || cdc.length !== 44) && jobId) {
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise((r) => setTimeout(r, 500));
        try {
          const jobRes = await fetch(`${baseUrl}/invoices/job/${encodeURIComponent(String(jobId))}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!jobRes.ok) continue;
          const jobData: any = await jobRes.json().catch(() => ({}));
          const jobCdc = jobData?.cdc || jobData?.responses?.[0]?.cdc;
          if (typeof jobCdc === 'string' && jobCdc.length === 44) {
            cdc = jobCdc;
            if (jobData?.responses?.[0]?.aprobado) {
              status = 'APPROVED';
              message = jobData.responses[0].mensajeRespuesta || message;
            }
            break;
          }
          if (jobData?.status === 'completed' || jobData?.status === 'failed') {
            break;
          }
        } catch {
          // Non-blocking: return provisional status if polling fails or times out
          break;
        }
      }
    }

    return {
      cdc: typeof cdc === 'string' && cdc.length === 44 ? cdc : null,
      jobId: jobId ? String(jobId) : null,
      status,
      message,
      raw: data,
    };
  }

  async consultStatus(creds: FactufyCredentials, cdc: string): Promise<unknown> {
    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const token = await this.getAccessToken(creds);
    const res = await fetch(`${baseUrl}/invoices/status/${encodeURIComponent(cdc)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new BadGatewayException(data?.message || `Error consultando estado CDC en Factufy (${res.status}).`);
    }
    return data;
  }

  async downloadPdf(creds: FactufyCredentials, cdc: string): Promise<Buffer> {
    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const token = await this.getAccessToken(creds);
    const form = new FormData();
    form.append('cdc', cdc);
    const res = await fetch(`${baseUrl}/invoices/pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      throw new BadGatewayException(`Error descargando PDF KuDE de Factufy (${res.status}).`);
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }
}
