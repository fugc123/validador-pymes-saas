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
    const url = `${baseUrl}/invoices/ruc/${encodeURIComponent(cleanRuc)}`;
    const maxAttempts = 3;
    let lastErrorMessage = '';

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: any = await res.json().catch(() => ({}));

        if (res.ok) {
          const payload = data?.data || data;
          const rawName =
            payload?.razonSocial ||
            payload?.nombre ||
            payload?.nombreCompleto ||
            [payload?.nombres, payload?.apellidos].filter(Boolean).join(' ') ||
            '';
          const cleanName = String(rawName).trim();

          return {
            ruc: cleanRuc,
            dv: String(payload?.dv ?? payload?.digitoVerificado ?? calculateParaguayDv(cleanRuc)),
            razonSocial: cleanName.length > 0 ? cleanName : null,
          };
        }

        lastErrorMessage = data?.message || `Error consultando RUC en Factufy (${res.status}).`;
        if (res.status < 500 || attempt === maxAttempts) {
          throw new BadGatewayException(lastErrorMessage);
        }
      } catch (err: any) {
        if (err instanceof BadGatewayException || err instanceof BadRequestException) {
          throw err;
        }
        lastErrorMessage = err?.message || 'Error de red consultando RUC en Factufy.';
        if (attempt === maxAttempts) {
          throw new BadGatewayException(lastErrorMessage);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new BadGatewayException(lastErrorMessage || 'Error consultando RUC en Factufy.');
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
      const resolved = await this.resolveJobCdc(
        {
          clientId: creds.clientId,
          clientSecret: creds.clientSecret,
          branchCode: creds.branchCode,
          posCode: creds.posCode,
          baseUrl: creds.baseUrl,
        },
        String(jobId),
        6,
        600,
      );
      if (resolved.cdc) {
        cdc = resolved.cdc;
        if (resolved.approved) {
          status = 'APPROVED';
        }
        if (resolved.message) {
          message = resolved.message;
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

  async resolveJobCdc(
    creds: FactufyCredentials,
    jobId: string,
    maxAttempts = 6,
    delayMs = 600,
  ): Promise<{ cdc: string | null; approved?: boolean; message?: string }> {
    const cleanJobId = (jobId || '').trim();
    if (!cleanJobId) return { cdc: null };

    const baseUrl = this.resolveBaseUrl(creds.baseUrl);
    const token = await this.getAccessToken(creds);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (attempt > 0 && delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
      try {
        const jobRes = await fetch(`${baseUrl}/invoices/job/${encodeURIComponent(cleanJobId)}`, {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!jobRes.ok) continue;
        const jobData: any = await jobRes.json().catch(() => ({}));
        const jobCdc = jobData?.cdc || jobData?.responses?.[0]?.cdc;
        if (typeof jobCdc === 'string' && /^\d{44}$/.test(jobCdc)) {
          return {
            cdc: jobCdc,
            approved: Boolean(jobData?.responses?.[0]?.aprobado),
            message: jobData?.responses?.[0]?.mensajeRespuesta,
          };
        }
        if (jobData?.status === 'failed') {
          break;
        }
      } catch {
        break;
      }
    }

    return { cdc: null };
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
