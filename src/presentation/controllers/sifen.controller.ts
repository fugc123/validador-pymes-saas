import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  Put,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import { FactufyAdapter } from '../../infrastructure/sifen/factufy.adapter';
import {
  calculateParaguayDv,
  EmitSifenInvoiceInput,
  ISifenRepository,
  SifenConfig,
  SifenInvoiceItemInput,
  SubmitSifenRequestInput,
  UpsertSifenConfigInput,
} from '../../core/application/ports/sifen.ports';

export interface TestSifenEmissionDto {
  receptorRuc?: string;
  receptorDv?: string;
  receptorNombre?: string;
  totalAmount?: number;
}

export interface CashierEmitSifenDto {
  saleId?: string | null;
  receptorRuc: string;
  receptorDv?: string | null;
  receptorNombre: string;
  condicionVenta?: 'CONTADO' | 'CREDITO';
  totalAmount: number;
  items?: SifenInvoiceItemInput[];
}

export interface SuperAdminConsultRucDto {
  ruc: string;
  factufyClientId?: string;
  factufyClientSecret?: string;
  factufyBranchCode?: string;
  factufyPosCode?: string;
}

@Controller('sifen')
@UseGuards(RolesGuard)
export class SifenController {
  constructor(
    @Inject('ISifenRepository')
    private readonly sifenRepo: ISifenRepository,
    @Inject('IMerchantRepository')
    private readonly merchantRepo: IMerchantRepository,
    @Optional()
    private readonly factufyAdapter?: FactufyAdapter,
  ) {}

  private sanitizeConfig(config: SifenConfig | null) {
    if (!config) return null;
    return {
      ...config,
      certificadoBase64: null,
      certificadoPassword: null,
      factufyClientSecret: config.factufyClientSecret ? '********' : null,
    };
  }

  @Get('superadmin/configs')
  @Roles('SUPER_ADMIN')
  async listFreeMerchantConfigs() {
    const merchants = await this.sifenRepo.listFreeMerchantsWithSifenStatus();
    return {
      status: 'ok',
      data: merchants,
    };
  }

  @Get('superadmin/config/:tenantId')
  @Roles('SUPER_ADMIN')
  async getFreeMerchantConfig(@Param('tenantId') tenantId: string) {
    await this.sifenRepo.assertEligibleFreeMerchant(tenantId);

    const merchant = await this.merchantRepo.findById(tenantId);
    const config = await this.sifenRepo.getConfigByTenant(tenantId);
    const invoices = await this.sifenRepo.listInvoicesByTenant(tenantId, 20);

    const businessDisplayName = merchant?.name || tenantId.toUpperCase();
    const defaultRuc = '80012345';
    const defaultDv = calculateParaguayDv(defaultRuc);

    const autocompleteTemplate: UpsertSifenConfigInput = {
      enabled: true,
      environment: 'test',
      ruc: defaultRuc,
      dv: defaultDv,
      razonSocial: `${businessDisplayName.toUpperCase()} E.A.S.`,
      nombreFantasia: businessDisplayName,
      tipoContribuyente: 2,
      tipoRegimen: 8,
      timbrado: '12560102',
      fechaInicioTimbrado: '2025-01-01',
      establecimiento: '001',
      puntoExpedicion: '001',
      direccion: 'Av. Mariscal López esq. República Argentina',
      numeroCasa: '1450',
      departamento: 1,
      departamentoDesc: 'CAPITAL',
      distrito: 1,
      distritoDesc: 'ASUNCION (DISTRITO)',
      ciudad: 1,
      ciudadDesc: 'ASUNCION (DISTRITO)',
      telefono: '021600100',
      email: `facturacion@${merchant?.slug || 'empresa'}.com.py`,
      actividadEconomicaCodigo: '47190',
      actividadEconomicaDesc: 'COMERCIO AL POR MENOR EN COMERCIOS NO ESPECIALIZADOS',
      cscId: '0001',
      csc: 'ABCD0000000000000000000000000000',
      provider: 'local_mock',
      factufyBranchCode: '001',
      factufyPosCode: '001',
    };

    return {
      status: 'ok',
      data: {
        tenantId,
        merchantName: businessDisplayName,
        merchantSlug: merchant?.slug || tenantId,
        isLifetime: true,
        config: this.sanitizeConfig(config),
        autocompleteTemplate,
        invoices,
      },
    };
  }

  @Put('superadmin/config/:tenantId')
  @Roles('SUPER_ADMIN')
  async saveFreeMerchantConfig(
    @Param('tenantId') tenantId: string,
    @Body() dto: UpsertSifenConfigInput,
    @Req() req: any,
  ) {
    const saved = await this.sifenRepo.upsertConfig(tenantId, {
      ...dto,
      updatedByUserId: req?.user?.userId || 'superadmin',
    });

    return {
      status: 'ok',
      message: 'Configuración SIFEN guardada exitosamente para el comercio gratuito.',
      data: this.sanitizeConfig(saved),
    };
  }

  @Post('superadmin/test-emission/:tenantId')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async runTestEmission(
    @Param('tenantId') tenantId: string,
    @Body() dto: TestSifenEmissionDto,
  ) {
    const invoice = await this.sifenRepo.emitInvoice({
      tenantId,
      receptorRuc: dto?.receptorRuc || '44444401',
      receptorDv: dto?.receptorDv,
      receptorNombre: dto?.receptorNombre || 'CLIENTE DE PRUEBA HOMOLOGACIÓN SIFEN',
      condicionVenta: 'CONTADO',
      totalAmount: dto?.totalAmount && dto.totalAmount > 0 ? Number(dto.totalAmount) : 110000,
      isTest: true,
    });

    const updatedConfig = await this.sifenRepo.getConfigByTenant(tenantId);

    return {
      status: 'ok',
      message: invoice.responseMessage,
      data: {
        invoice,
        config: this.sanitizeConfig(updatedConfig),
      },
    };
  }

  @Post('superadmin/consult-ruc/:tenantId')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async consultRucForSuperAdmin(
    @Param('tenantId') tenantId: string,
    @Body() dto: SuperAdminConsultRucDto,
  ) {
    const cleanRuc = (dto?.ruc || '').split('-')[0].replace(/\D/g, '');
    if (cleanRuc.length < 5) {
      throw new BadRequestException('Ingresá un RUC válido (mínimo 5 dígitos).');
    }

    const bodySecret = (dto?.factufyClientSecret || '').trim();
    if (
      dto?.factufyClientId &&
      dto.factufyClientId.trim() &&
      bodySecret &&
      bodySecret !== '********' &&
      this.factufyAdapter
    ) {
      try {
        const res = await this.factufyAdapter.consultRuc(
          {
            clientId: dto.factufyClientId.trim(),
            clientSecret: bodySecret,
            branchCode: dto.factufyBranchCode || '001',
            posCode: dto.factufyPosCode || '001',
          },
          cleanRuc,
        );
        return {
          status: 'ok',
          data: {
            ruc: res.ruc,
            dv: res.dv,
            razonSocial: res.razonSocial,
            provider: 'factufy',
          },
        };
      } catch {
        // Fallback to stored tenant credentials or local Modulo-11 if draft creds fail
      }
    }

    const result = await this.sifenRepo.consultRuc(tenantId, cleanRuc);
    return {
      status: 'ok',
      data: result,
    };
  }

  @Get('cashier/status')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  async getCashierSifenStatus(@Req() req: any) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }

    const isFreeMerchant = await this.sifenRepo.isEligibleFreeMerchant(tenantId);
    if (!isFreeMerchant) {
      return {
        status: 'ok',
        data: {
          isFreeMerchant: false,
          enabled: false,
          config: null,
          recentInvoices: [],
        },
      };
    }

    const config = await this.sifenRepo.getConfigByTenant(tenantId);
    const recentInvoices = config ? await this.sifenRepo.listInvoicesByTenant(tenantId, 10) : [];

    return {
      status: 'ok',
      data: {
        isFreeMerchant: true,
        enabled: Boolean(config?.enabled),
        config: config
          ? {
              environment: config.environment,
              ruc: config.ruc,
              dv: config.dv,
              razonSocial: config.razonSocial,
              nombreFantasia: config.nombreFantasia,
              timbrado: config.timbrado,
              establecimiento: config.establecimiento,
              puntoExpedicion: config.puntoExpedicion,
            }
          : null,
        recentInvoices,
      },
    };
  }

  @Post('cashier/emit')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async emitCashierInvoice(@Req() req: any, @Body() dto: CashierEmitSifenDto) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }

    const input: EmitSifenInvoiceInput = {
      tenantId,
      saleId: dto.saleId ?? null,
      receptorRuc: dto.receptorRuc || '44444401',
      receptorDv: dto.receptorDv ?? null,
      receptorNombre: dto.receptorNombre || 'SIN NOMBRE / CONSUMIDOR FINAL',
      condicionVenta: dto.condicionVenta === 'CREDITO' ? 'CREDITO' : 'CONTADO',
      totalAmount: Number(dto.totalAmount || 0),
      items: dto.items,
      isTest: false,
    };

    const invoice = await this.sifenRepo.emitInvoice(input);
    return {
      status: 'ok',
      message: 'Factura Electrónica SIFEN generada correctamente.',
      data: invoice,
    };
  }

  @Get('cashier/ruc/:ruc')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  async consultRuc(@Req() req: any, @Param('ruc') ruc: string) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }
    const result = await this.sifenRepo.consultRuc(tenantId, ruc);
    return {
      status: 'ok',
      data: result,
    };
  }

  @Get('cashier/invoices/:cdc/pdf')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  async downloadInvoicePdf(@Req() req: any, @Param('cdc') cdc: string, @Res() res: any) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }
    if (!/^\d{44}$/.test(cdc || '')) {
      throw new BadRequestException('CDC inválido (debe tener exactamente 44 dígitos numéricos).');
    }
    if (this.sifenRepo.findInvoiceByCdc) {
      const ownedInvoice = await this.sifenRepo.findInvoiceByCdc(tenantId, cdc);
      if (!ownedInvoice) {
        throw new NotFoundException('Factura electrónica no encontrada para este comercio.');
      }
    }
    const config = await this.sifenRepo.getConfigByTenant(tenantId);
    if (
      !config ||
      config.provider !== 'factufy' ||
      !config.factufyClientId ||
      !config.factufyClientSecret ||
      !this.factufyAdapter
    ) {
      throw new BadRequestException('Este comercio no tiene credenciales de Factufy configuradas para descargar PDF.');
    }
    const pdf = await this.factufyAdapter.downloadPdf(
      {
        clientId: config.factufyClientId,
        clientSecret: config.factufyClientSecret,
        branchCode: config.factufyBranchCode,
        posCode: config.factufyPosCode,
      },
      cdc,
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Factura-${cdc}.pdf"`);
    return res.send(pdf);
  }

  @Get('merchant/request')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  async getMerchantOnboardingRequest(@Req() req: any) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }
    const [request, isEligible, config] = await Promise.all([
      this.sifenRepo.getOnboardingRequest ? this.sifenRepo.getOnboardingRequest(tenantId) : null,
      this.sifenRepo.isEligibleFreeMerchant(tenantId),
      this.sifenRepo.getConfigByTenant(tenantId),
    ]);
    return {
      status: 'ok',
      data: {
        request,
        isEligible,
        config: this.sanitizeConfig(config),
      },
    };
  }

  @Post('merchant/request')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async submitMerchantOnboardingRequest(@Req() req: any, @Body() dto: SubmitSifenRequestInput) {
    const tenantId = req?.user?.tenantId;
    if (!tenantId) {
      throw new BadRequestException('No se encontró un comercio activo en la sesión.');
    }
    if (!this.sifenRepo.submitOnboardingRequest) {
      throw new BadRequestException('El envío de solicitudes SIFEN no está disponible.');
    }
    const saved = await this.sifenRepo.submitOnboardingRequest(tenantId, {
      ...dto,
      requestedByUserId: req?.user?.userId || null,
    });
    return {
      status: 'ok',
      message: 'Solicitud de Facturación Electrónica recibida. El equipo la revisará para habilitar tu comercio.',
      data: saved,
    };
  }

  @Get('superadmin/requests')
  @Roles('SUPER_ADMIN')
  async listOnboardingRequests() {
    const requests = this.sifenRepo.listOnboardingRequests
      ? await this.sifenRepo.listOnboardingRequests()
      : [];
    return {
      status: 'ok',
      data: requests,
    };
  }

  @Post('superadmin/requests/:tenantId/approve')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async approveOnboardingRequest(@Param('tenantId') tenantId: string, @Req() req: any) {
    if (!this.sifenRepo.approveOnboardingRequest) {
      throw new BadRequestException('La aprobación de solicitudes SIFEN no está disponible.');
    }
    const approved = await this.sifenRepo.approveOnboardingRequest(
      tenantId,
      req?.user?.userId || 'superadmin',
    );
    return {
      status: 'ok',
      message: 'Comercio aprobado para Facturación Electrónica. Ahora podés cargar sus credenciales Factufy.',
      data: approved,
    };
  }
}
