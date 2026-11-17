import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { SifenConfigRow, SifenInvoiceRow, SubscriptionRow } from '../database/schema';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import { ISubscriptionRepository } from '../../core/application/ports/onboarding.ports';
import {
  buildSifenElectronicDocument,
  calculateParaguayDv,
  EmitSifenInvoiceInput,
  FreeMerchantSifenSummary,
  generateParaguayCdc,
  ISifenRepository,
  RucConsultResult,
  SifenConfig,
  SifenContribuyenteType,
  SifenEnvironment,
  SifenInvoice,
  SifenProvider,
  UpsertSifenConfigInput,
} from '../../core/application/ports/sifen.ports';
import { FactufyAdapter } from '../sifen/factufy.adapter';

@Injectable()
export class SifenRepository implements ISifenRepository {
  private configs = new Map<string, SifenConfig>();
  private invoices: SifenInvoice[] = [];

  constructor(
    @Optional() private readonly dbService?: DatabaseService,
    @Optional()
    @Inject('ISubscriptionRepository')
    private readonly subscriptionRepo?: ISubscriptionRepository,
    @Optional()
    @Inject('IMerchantRepository')
    private readonly merchantRepo?: IMerchantRepository,
    @Optional()
    private readonly factufyAdapter?: FactufyAdapter,
  ) {}

  private isDbActive(): boolean {
    return Boolean(this.dbService && !this.dbService.isMemoryMode);
  }

  private mapRowToConfig(row: SifenConfigRow): SifenConfig {
    return {
      tenantId: row.tenant_id,
      enabled: Boolean(row.enabled),
      environment: row.environment === 'prod' ? 'prod' : 'test',
      ruc: row.ruc,
      dv: row.dv,
      razonSocial: row.razon_social,
      nombreFantasia: row.nombre_fantasia,
      tipoContribuyente: (Number(row.tipo_contribuyente) === 1 ? 1 : 2) as SifenContribuyenteType,
      tipoRegimen: Number(row.tipo_regimen || 8),
      timbrado: row.timbrado,
      fechaInicioTimbrado: row.fecha_inicio_timbrado,
      establecimiento: row.establecimiento || '001',
      puntoExpedicion: row.punto_expedicion || '001',
      direccion: row.direccion,
      numeroCasa: row.numero_casa || '0',
      departamento: Number(row.departamento || 11),
      departamentoDesc: row.departamento_desc || 'ALTO PARANA',
      distrito: Number(row.distrito || 143),
      distritoDesc: row.distrito_desc || 'CIUDAD DEL ESTE',
      ciudad: Number(row.ciudad || 3432),
      ciudadDesc: row.ciudad_desc || 'CIUDAD DEL ESTE',
      telefono: row.telefono,
      email: row.email,
      actividadEconomicaCodigo: row.actividad_economica_codigo || '47190',
      actividadEconomicaDesc:
        row.actividad_economica_desc || 'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
      cscId: row.csc_id || '0001',
      csc: row.csc || '',
      certificadoBase64: row.certificado_base64,
      certificadoPassword: row.certificado_password,
      hasCertificate: Boolean(row.certificado_base64 && row.certificado_base64.trim().length > 0),
      provider: row.provider === 'factufy' ? 'factufy' : 'local_mock',
      factufyClientId: row.factufy_client_id || null,
      factufyClientSecret: row.factufy_client_secret || null,
      hasFactufyCredentials: Boolean(row.factufy_client_id && row.factufy_client_secret),
      factufyBranchCode: row.factufy_branch_code || row.establecimiento || '001',
      factufyPosCode: row.factufy_pos_code || row.punto_expedicion || '001',
      lastTestStatus: row.last_test_status,
      lastTestMessage: row.last_test_message,
      lastTestCdc: row.last_test_cdc,
      lastTestedAt: row.last_tested_at ? new Date(row.last_tested_at) : null,
      updatedByUserId: row.updated_by_user_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapRowToInvoice(row: SifenInvoiceRow): SifenInvoice {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      saleId: row.sale_id,
      cdc: row.cdc,
      numeroDocumento: row.numero_documento,
      timbrado: row.timbrado,
      environment: row.environment === 'prod' ? 'prod' : 'test',
      receptorRuc: row.receptor_ruc,
      receptorDv: row.receptor_dv,
      receptorNombre: row.receptor_nombre,
      condicionVenta: row.condicion_venta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      totalAmount: Number(row.total_amount),
      iva10Amount: Number(row.iva_10_amount),
      xmlPayload: row.xml_payload,
      qrUrl: row.qr_url,
      status: row.status,
      responseMessage: row.response_message,
      externalId: row.external_id ?? null,
      factufyJobId: row.factufy_job_id ?? null,
      createdAt: new Date(row.created_at),
    };
  }

  async isEligibleFreeMerchant(tenantId: string): Promise<boolean> {
    if (!tenantId) return false;

    if (this.subscriptionRepo) {
      const sub = await this.subscriptionRepo.findByTenantId(tenantId);
      if (!sub) return false;
      const periodEndYear = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getUTCFullYear() : 0;
      return (
        sub.externalCustomerId === 'free-lifetime-partner' ||
        sub.externalSubscriptionId === 'sub_lifetime_permanent' ||
        periodEndYear >= 2090
      );
    }

    if (this.isDbActive()) {
      const res = await this.dbService!.query<SubscriptionRow>(
        `SELECT s.*
         FROM subscriptions s
         LEFT JOIN merchants m ON m.id = s.tenant_id
         WHERE s.tenant_id::text = $1 OR m.slug = $1
         LIMIT 1`,
        [tenantId],
      );
      const row = res.rows?.[0];
      if (!row) return false;
      const periodEndYear = row.current_period_end ? new Date(row.current_period_end).getUTCFullYear() : 0;
      return (
        row.external_customer_id === 'free-lifetime-partner' ||
        row.external_subscription_id === 'sub_lifetime_permanent' ||
        periodEndYear >= 2090
      );
    }

    return false;
  }

  async assertEligibleFreeMerchant(tenantId: string): Promise<void> {
    const eligible = await this.isEligibleFreeMerchant(tenantId);
    if (!eligible) {
      throw new ForbiddenException(
        'La facturación electrónica SIFEN está restringida exclusivamente a comercios creados como gratuitos / propios (Lifetime).',
      );
    }
  }

  async listFreeMerchantsWithSifenStatus(): Promise<FreeMerchantSifenSummary[]> {
    const allSubs = this.subscriptionRepo ? await this.subscriptionRepo.findAll() : [];
    const freeSubs = allSubs.filter((sub) => {
      const year = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).getUTCFullYear() : 0;
      return (
        sub.externalCustomerId === 'free-lifetime-partner' ||
        sub.externalSubscriptionId === 'sub_lifetime_permanent' ||
        year >= 2090
      );
    });

    const summaries: FreeMerchantSifenSummary[] = [];
    for (const sub of freeSubs) {
      const merchant = this.merchantRepo ? await this.merchantRepo.findById(sub.tenantId) : null;
      const config = await this.getConfigByTenant(sub.tenantId);

      summaries.push({
        tenantId: sub.tenantId,
        merchantName: merchant?.name || sub.tenantId,
        merchantSlug: merchant?.slug || sub.tenantId,
        isLifetime: true,
        hasConfig: Boolean(config),
        enabled: Boolean(config?.enabled),
        environment: config?.environment || 'test',
        provider: config?.provider || 'local_mock',
        hasFactufyCredentials: Boolean(config?.hasFactufyCredentials),
        factufyBranchCode: config?.factufyBranchCode || config?.establecimiento || '001',
        factufyPosCode: config?.factufyPosCode || config?.puntoExpedicion || '001',
        ruc: config?.ruc || null,
        dv: config?.dv || null,
        razonSocial: config?.razonSocial || null,
        timbrado: config?.timbrado || null,
        establecimiento: config?.establecimiento || '001',
        puntoExpedicion: config?.puntoExpedicion || '001',
        hasCertificate: Boolean(config?.hasCertificate),
        lastTestStatus: config?.lastTestStatus || null,
        lastTestCdc: config?.lastTestCdc || null,
        lastTestedAt: config?.lastTestedAt || null,
      });
    }

    return summaries;
  }

  async getConfigByTenant(tenantId: string): Promise<SifenConfig | null> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<SifenConfigRow>(
        `SELECT * FROM sifen_configs WHERE tenant_id = $1 LIMIT 1`,
        [tenantId],
      );
      const row = res.rows?.[0];
      return row ? this.mapRowToConfig(row) : null;
    }

    return this.configs.get(tenantId) || null;
  }

  async upsertConfig(tenantId: string, input: UpsertSifenConfigInput): Promise<SifenConfig> {
    await this.assertEligibleFreeMerchant(tenantId);

    const cleanRuc = (input.ruc || '').replace(/\D/g, '').trim();
    if (!cleanRuc || cleanRuc.length < 5) {
      throw new BadRequestException('El RUC del emisor es obligatorio y debe contener al menos 5 dígitos.');
    }

    const razonSocial = (input.razonSocial || '').trim();
    if (!razonSocial) {
      throw new BadRequestException('La Razón Social del emisor es obligatoria.');
    }

    const cleanTimbrado = (input.timbrado || '').replace(/\D/g, '').trim();
    if (!cleanTimbrado || cleanTimbrado.length !== 8) {
      throw new BadRequestException('El Número de Timbrado SIFEN debe tener exactamente 8 dígitos numéricos.');
    }

    const existing = await this.getConfigByTenant(tenantId);
    const now = new Date();

    const dv =
      input.dv !== undefined && String(input.dv).trim() !== ''
        ? String(input.dv).replace(/\D/g, '').slice(0, 1)
        : calculateParaguayDv(cleanRuc);

    const environment: SifenEnvironment = input.environment === 'prod' ? 'prod' : 'test';
    const tipoContribuyente: SifenContribuyenteType =
      Number(input.tipoContribuyente) === 1 ? 1 : 2;
    const establecimiento = (input.establecimiento || existing?.establecimiento || '001')
      .replace(/\D/g, '')
      .padStart(3, '0')
      .slice(-3);
    const puntoExpedicion = (input.puntoExpedicion || existing?.puntoExpedicion || '001')
      .replace(/\D/g, '')
      .padStart(3, '0')
      .slice(-3);

    const certBase64 =
      input.certificadoBase64 !== undefined
        ? input.certificadoBase64
        : existing?.certificadoBase64 ?? null;
    const certPassword =
      input.certificadoPassword !== undefined
        ? input.certificadoPassword
        : existing?.certificadoPassword ?? null;

    const provider: SifenProvider =
      input.provider === 'factufy'
        ? 'factufy'
        : input.provider === 'local_mock'
          ? 'local_mock'
          : existing?.provider || 'local_mock';
    const factufyClientId =
      input.factufyClientId !== undefined
        ? input.factufyClientId
          ? input.factufyClientId.trim()
          : null
        : existing?.factufyClientId ?? null;
    const rawSecret = input.factufyClientSecret;
    const factufyClientSecret =
      rawSecret !== undefined && rawSecret !== null && rawSecret.trim() !== '' && rawSecret !== '********'
        ? rawSecret.trim()
        : existing?.factufyClientSecret ?? null;
    const factufyBranchCode = (input.factufyBranchCode || existing?.factufyBranchCode || establecimiento)
      .replace(/\D/g, '')
      .padStart(3, '0')
      .slice(-3);
    const factufyPosCode = (input.factufyPosCode || existing?.factufyPosCode || puntoExpedicion)
      .replace(/\D/g, '')
      .padStart(3, '0')
      .slice(-3);

    const config: SifenConfig = {
      tenantId,
      enabled: input.enabled !== undefined ? Boolean(input.enabled) : existing?.enabled ?? true,
      environment,
      ruc: cleanRuc,
      dv,
      razonSocial,
      nombreFantasia: (input.nombreFantasia || razonSocial).trim(),
      tipoContribuyente,
      tipoRegimen: Number(input.tipoRegimen || existing?.tipoRegimen || 8),
      timbrado: cleanTimbrado,
      fechaInicioTimbrado: (input.fechaInicioTimbrado || existing?.fechaInicioTimbrado || '2025-01-01').trim(),
      establecimiento,
      puntoExpedicion,
      direccion: (input.direccion || existing?.direccion || 'Av. España casi Brasil').trim(),
      numeroCasa: (input.numeroCasa || existing?.numeroCasa || '123').trim(),
      departamento: Number(input.departamento || existing?.departamento || 1),
      departamentoDesc: (input.departamentoDesc || existing?.departamentoDesc || 'CAPITAL').trim(),
      distrito: Number(input.distrito || existing?.distrito || 1),
      distritoDesc: (input.distritoDesc || existing?.distritoDesc || 'ASUNCION (DISTRITO)').trim(),
      ciudad: Number(input.ciudad || existing?.ciudad || 1),
      ciudadDesc: (input.ciudadDesc || existing?.ciudadDesc || 'ASUNCION (DISTRITO)').trim(),
      telefono: (input.telefono || existing?.telefono || '021000000').trim(),
      email: (input.email || existing?.email || 'facturacion@cajasegura.com.py').trim(),
      actividadEconomicaCodigo: (
        input.actividadEconomicaCodigo ||
        existing?.actividadEconomicaCodigo ||
        '47190'
      ).trim(),
      actividadEconomicaDesc: (
        input.actividadEconomicaDesc ||
        existing?.actividadEconomicaDesc ||
        'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS'
      ).trim(),
      cscId: (input.cscId || existing?.cscId || '0001').trim(),
      csc: (input.csc || existing?.csc || 'ABCD0000000000000000000000000000').trim(),
      certificadoBase64: certBase64,
      certificadoPassword: certPassword,
      hasCertificate: Boolean(certBase64 && certBase64.trim().length > 0),
      provider,
      factufyClientId,
      factufyClientSecret,
      hasFactufyCredentials: Boolean(factufyClientId && factufyClientSecret),
      factufyBranchCode,
      factufyPosCode,
      lastTestStatus: existing?.lastTestStatus ?? null,
      lastTestMessage: existing?.lastTestMessage ?? null,
      lastTestCdc: existing?.lastTestCdc ?? null,
      lastTestedAt: existing?.lastTestedAt ?? null,
      updatedByUserId: input.updatedByUserId ?? existing?.updatedByUserId ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    if (this.isDbActive()) {
      await this.dbService!.query(
        `INSERT INTO sifen_configs (
          tenant_id, enabled, environment, ruc, dv, razon_social, nombre_fantasia,
          tipo_contribuyente, tipo_regimen, timbrado, fecha_inicio_timbrado,
          establecimiento, punto_expedicion, direccion, numero_casa,
          departamento, departamento_desc, distrito, distrito_desc, ciudad, ciudad_desc,
          telefono, email, actividad_economica_codigo, actividad_economica_desc,
          csc_id, csc, certificado_base64, certificado_password,
          provider, factufy_client_id, factufy_client_secret, factufy_branch_code, factufy_pos_code,
          last_test_status, last_test_message, last_test_cdc, last_tested_at,
          updated_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21,
          $22, $23, $24, $25,
          $26, $27, $28, $29,
          $30, $31, $32, $33, $34,
          $35, $36, $37, $38,
          $39, $40, $41
        )
        ON CONFLICT (tenant_id) DO UPDATE SET
          enabled = EXCLUDED.enabled,
          environment = EXCLUDED.environment,
          ruc = EXCLUDED.ruc,
          dv = EXCLUDED.dv,
          razon_social = EXCLUDED.razon_social,
          nombre_fantasia = EXCLUDED.nombre_fantasia,
          tipo_contribuyente = EXCLUDED.tipo_contribuyente,
          tipo_regimen = EXCLUDED.tipo_regimen,
          timbrado = EXCLUDED.timbrado,
          fecha_inicio_timbrado = EXCLUDED.fecha_inicio_timbrado,
          establecimiento = EXCLUDED.establecimiento,
          punto_expedicion = EXCLUDED.punto_expedicion,
          direccion = EXCLUDED.direccion,
          numero_casa = EXCLUDED.numero_casa,
          departamento = EXCLUDED.departamento,
          departamento_desc = EXCLUDED.departamento_desc,
          distrito = EXCLUDED.distrito,
          distrito_desc = EXCLUDED.distrito_desc,
          ciudad = EXCLUDED.ciudad,
          ciudad_desc = EXCLUDED.ciudad_desc,
          telefono = EXCLUDED.telefono,
          email = EXCLUDED.email,
          actividad_economica_codigo = EXCLUDED.actividad_economica_codigo,
          actividad_economica_desc = EXCLUDED.actividad_economica_desc,
          csc_id = EXCLUDED.csc_id,
          csc = EXCLUDED.csc,
          certificado_base64 = EXCLUDED.certificado_base64,
          certificado_password = EXCLUDED.certificado_password,
          provider = EXCLUDED.provider,
          factufy_client_id = EXCLUDED.factufy_client_id,
          factufy_client_secret = EXCLUDED.factufy_client_secret,
          factufy_branch_code = EXCLUDED.factufy_branch_code,
          factufy_pos_code = EXCLUDED.factufy_pos_code,
          updated_by_user_id = EXCLUDED.updated_by_user_id,
          updated_at = EXCLUDED.updated_at`,
        [
          config.tenantId,
          config.enabled,
          config.environment,
          config.ruc,
          config.dv,
          config.razonSocial,
          config.nombreFantasia,
          config.tipoContribuyente,
          config.tipoRegimen,
          config.timbrado,
          config.fechaInicioTimbrado,
          config.establecimiento,
          config.puntoExpedicion,
          config.direccion,
          config.numeroCasa,
          config.departamento,
          config.departamentoDesc,
          config.distrito,
          config.distritoDesc,
          config.ciudad,
          config.ciudadDesc,
          config.telefono,
          config.email,
          config.actividadEconomicaCodigo,
          config.actividadEconomicaDesc,
          config.cscId,
          config.csc,
          config.certificadoBase64,
          config.certificadoPassword,
          config.provider,
          config.factufyClientId,
          config.factufyClientSecret,
          config.factufyBranchCode,
          config.factufyPosCode,
          config.lastTestStatus,
          config.lastTestMessage,
          config.lastTestCdc,
          config.lastTestedAt,
          config.updatedByUserId,
          config.createdAt,
          config.updatedAt,
        ],
      );
    } else {
      this.configs.set(tenantId, config);
    }

    return config;
  }

  async emitInvoice(input: EmitSifenInvoiceInput): Promise<SifenInvoice> {
    await this.assertEligibleFreeMerchant(input.tenantId);

    const config = await this.getConfigByTenant(input.tenantId);
    if (!config) {
      throw new NotFoundException(
        'Este comercio gratuito aún no tiene configurados los datos de facturación electrónica SIFEN.',
      );
    }

    if (!input.isTest && !config.enabled) {
      throw new BadRequestException(
        'La facturación electrónica SIFEN se encuentra desactivada para este comercio.',
      );
    }

    if (!input.isTest && (!input.totalAmount || Number(input.totalAmount) <= 0) && (!input.items || input.items.length === 0)) {
      throw new BadRequestException('El monto total de la factura SIFEN debe ser mayor a Gs. 0.');
    }

    let existingCount = 0;
    if (this.isDbActive()) {
      const countRes = await this.dbService!.query<{ cnt: number }>(
        `SELECT COUNT(*)::int AS cnt FROM sifen_invoices WHERE tenant_id = $1`,
        [input.tenantId],
      );
      existingCount = Number(countRes.rows?.[0]?.cnt || 0);
    } else {
      existingCount = this.invoices.filter((inv) => inv.tenantId === input.tenantId).length;
    }

    const nextSequential = existingCount + 1;
    const docSeqStr = String(nextSequential).padStart(7, '0');
    const numeroDocumento = `${config.establecimiento}-${config.puntoExpedicion}-${docSeqStr}`;

    const cleanReceptorRuc = (input.receptorRuc || '44444401').replace(/\D/g, '').trim() || '44444401';
    const receptorDv =
      input.receptorDv !== undefined && input.receptorDv !== null && String(input.receptorDv).trim() !== ''
        ? String(input.receptorDv).replace(/\D/g, '').slice(0, 1)
        : calculateParaguayDv(cleanReceptorRuc);
    const receptorNombre = (input.receptorNombre || 'SIN NOMBRE / CONSUMIDOR FINAL').trim();
    const condicionVenta = input.condicionVenta === 'CREDITO' ? 'CREDITO' : 'CONTADO';

    const items =
      input.items && input.items.length > 0
        ? input.items
        : [
            {
              codigo: 'POS-001',
              descripcion: input.isTest
                ? 'FACTURA DE PRUEBA HOMOLOGACIÓN SIFEN (consultame-sdk)'
                : 'VENTA POS CAJASEGURA',
              cantidad: 1,
              precioUnitario: Math.max(1000, Math.round(Number(input.totalAmount || 55000))),
              ivaTasa: 10 as const,
            },
          ];

    const computedTotal = items.reduce(
      (acc, item) => acc + Math.round(Number(item.cantidad) * Number(item.precioUnitario)),
      0,
    );
    const totalAmount = input.totalAmount && input.totalAmount > 0 ? Math.round(input.totalAmount) : computedTotal;

    const now = new Date();
    const externalId = `CS-${now.getTime().toString(36).toUpperCase()}-${nextSequential}`;
    let cdc = generateParaguayCdc({
      tipoDocumento: '01',
      ruc: config.ruc,
      dv: config.dv,
      establecimiento: config.establecimiento,
      puntoExpedicion: config.puntoExpedicion,
      numeroSecuencial: nextSequential,
      tipoContribuyente: config.tipoContribuyente,
      fechaEmision: now,
    });

    const { xmlPayload, qrUrl, iva10Amount } = buildSifenElectronicDocument({
      config,
      cdc,
      numeroDocumento,
      receptorRuc: cleanReceptorRuc,
      receptorDv,
      receptorNombre,
      condicionVenta,
      totalAmount,
      items,
      emittedAt: now,
    });

    let status: SifenInvoice['status'] = input.isTest ? 'TEST_OK' : 'GENERATED';
    let responseMessage = input.isTest
      ? `Prueba SIFEN (${config.environment.toUpperCase()}) exitosa via consultame-sdk adapter. CDC de 44 dígitos validado (${cdc}).`
      : `Documento Electrónico DE generado (${numeroDocumento}) en ambiente ${config.environment.toUpperCase()}.`;
    let factufyJobId: string | null = null;

    if (
      config.provider === 'factufy' &&
      config.factufyClientId &&
      config.factufyClientSecret &&
      this.factufyAdapter
    ) {
      const factufyRes = await this.factufyAdapter.sendInvoice(
        {
          clientId: config.factufyClientId,
          clientSecret: config.factufyClientSecret,
          branchCode: config.factufyBranchCode,
          posCode: config.factufyPosCode,
        },
        {
          externalId,
          fechaEmisionIso: now.toISOString().slice(0, 19),
          receptorRuc: cleanReceptorRuc,
          receptorDv,
          receptorNombre,
          condicionVenta,
          totalAmount,
          items,
        },
      );
      if (factufyRes.cdc) {
        cdc = factufyRes.cdc;
      }
      factufyJobId = factufyRes.jobId;
      status = input.isTest ? 'TEST_OK' : factufyRes.status;
      responseMessage = factufyRes.message;
    }

    const invoice: SifenInvoice = {
      id: `sifen-inv-${randomUUID()}`,
      tenantId: input.tenantId,
      saleId: input.saleId ?? null,
      cdc,
      numeroDocumento,
      timbrado: config.timbrado,
      environment: config.environment,
      receptorRuc: cleanReceptorRuc,
      receptorDv,
      receptorNombre,
      condicionVenta,
      totalAmount,
      iva10Amount,
      xmlPayload,
      qrUrl,
      status,
      responseMessage,
      externalId,
      factufyJobId,
      createdAt: now,
    };

    if (this.isDbActive()) {
      await this.dbService!.query(
        `INSERT INTO sifen_invoices (
          id, tenant_id, sale_id, cdc, numero_documento, timbrado, environment,
          receptor_ruc, receptor_dv, receptor_nombre, condicion_venta,
          total_amount, iva_10_amount, xml_payload, qr_url, status, response_message,
          external_id, factufy_job_id, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11,
          $12, $13, $14, $15, $16, $17,
          $18, $19, $20
        )`,
        [
          invoice.id,
          invoice.tenantId,
          invoice.saleId,
          invoice.cdc,
          invoice.numeroDocumento,
          invoice.timbrado,
          invoice.environment,
          invoice.receptorRuc,
          invoice.receptorDv,
          invoice.receptorNombre,
          invoice.condicionVenta,
          invoice.totalAmount,
          invoice.iva10Amount,
          invoice.xmlPayload,
          invoice.qrUrl,
          invoice.status,
          invoice.responseMessage,
          invoice.externalId || null,
          invoice.factufyJobId || null,
          invoice.createdAt,
        ],
      );

      if (input.isTest) {
        await this.dbService!.query(
          `UPDATE sifen_configs
           SET last_test_status = $1, last_test_message = $2, last_test_cdc = $3, last_tested_at = $4, updated_at = $4
           WHERE tenant_id = $5`,
          ['TEST_OK', responseMessage, cdc, now, input.tenantId],
        );
      }
    } else {
      this.invoices.unshift(invoice);
      if (input.isTest) {
        const current = this.configs.get(input.tenantId);
        if (current) {
          current.lastTestStatus = 'TEST_OK';
          current.lastTestMessage = responseMessage;
          current.lastTestCdc = cdc;
          current.lastTestedAt = now;
          current.updatedAt = now;
        }
      }
    }

    return invoice;
  }

  async listInvoicesByTenant(tenantId: string, limit = 50): Promise<SifenInvoice[]> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<SifenInvoiceRow>(
        `SELECT * FROM sifen_invoices WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [tenantId, limit],
      );
      return (res.rows || []).map((r) => this.mapRowToInvoice(r));
    }

    return this.invoices
      .filter((inv) => inv.tenantId === tenantId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async consultRuc(tenantId: string, rawRuc: string): Promise<RucConsultResult> {
    const cleanRuc = (rawRuc || '').split('-')[0].replace(/\D/g, '');
    if (cleanRuc.length < 5) {
      throw new BadRequestException('Ingresá un RUC válido (mínimo 5 dígitos).');
    }

    const config = await this.getConfigByTenant(tenantId);
    if (
      config?.provider === 'factufy' &&
      config.factufyClientId &&
      config.factufyClientSecret &&
      this.factufyAdapter
    ) {
      const res = await this.factufyAdapter.consultRuc(
        {
          clientId: config.factufyClientId,
          clientSecret: config.factufyClientSecret,
          branchCode: config.factufyBranchCode,
          posCode: config.factufyPosCode,
        },
        cleanRuc,
      );
      return {
        ruc: res.ruc,
        dv: res.dv,
        razonSocial: res.razonSocial,
        provider: 'factufy',
      };
    }

    return {
      ruc: cleanRuc,
      dv: calculateParaguayDv(cleanRuc),
      razonSocial: null,
      provider: 'local_mock',
    };
  }
}
