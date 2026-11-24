import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Post,
  Req,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { GetMerchantMetricsUseCase } from '../../core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';
import {
  calculateStoreMonthlyCostPyg,
  IMembershipRepository,
  IMerchantRepository,
  IUserRepository,
  IPasswordHasher,
} from '../../core/application/ports/auth.ports';
import { ISubscriptionRepository } from '../../core/application/ports/onboarding.ports';
import { ISifenRepository } from '../../core/application/ports/sifen.ports';
import { User } from '../../core/domain/entities/user.entity';
import { Merchant } from '../../core/domain/entities/merchant.entity';
import { MerchantMembership } from '../../core/domain/entities/merchant-membership.entity';
import { Subscription } from '../../core/domain/entities/subscription.entity';

/** Single source for the cashier password rule: DTO boundary and controller guard. */
const MIN_PASSWORD_LENGTH = 6;

export class CreateCashierDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_PASSWORD_LENGTH)
  password!: string;
}

export class CreateStoreDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  copyFactufyFromCurrent?: boolean;
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  branchCode?: string;

  @IsOptional()
  @IsString()
  posCode?: string;

  @IsOptional()
  @IsString()
  address?: string;
}

@Controller('merchant')
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class MerchantController {
  constructor(
    private readonly getMetricsUseCase: GetMerchantMetricsUseCase,
    @Inject('IMembershipRepository')
    private readonly membershipRepo: IMembershipRepository,
    @Inject('IUserRepository')
    private readonly userRepo: IUserRepository,
    @Inject('IPasswordHasher')
    private readonly passwordHasher: IPasswordHasher,
    @Inject('IMerchantRepository')
    private readonly merchantRepo: IMerchantRepository,
    @Optional()
    @Inject('ISubscriptionRepository')
    private readonly subscriptionRepo?: ISubscriptionRepository,
    @Optional()
    @Inject('ISifenRepository')
    private readonly sifenRepo?: ISifenRepository,
  ) {}

  @Get('metrics')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    const tenantId = TenantContext.getTenantId();
    return this.getMetricsUseCase.execute(tenantId);
  }

  /**
   * Owner-authorized read of the persisted webhook secret for the active
   * tenant. It is never derived from the slug and is scoped to the session's
   * tenant context, so cashiers and other tenants cannot reach it.
   */
  @Get('webhook-secret')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getWebhookSecret() {
    // `getTenantId()` throws a plain Error outside a tenant scope (e.g. a
    // global superadmin session without a selected tenant). Translate that
    // into a deliberate 403 and deny before any repository read, so the
    // secret can never be resolved without an active tenant.
    let tenantId: string;
    try {
      tenantId = TenantContext.getTenantId();
    } catch {
      throw new ForbiddenException('An active tenant is required to read the webhook secret');
    }

    const merchant = await this.merchantRepo.findById(tenantId);
    if (!merchant) {
      throw new NotFoundException(`Merchant tenant '${tenantId}' not found`);
    }
    return { webhookSecret: merchant.webhookSecret };
  }

  @Get('cashiers')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCashiers() {
    const tenantId = TenantContext.getTenantId();
    return this.membershipRepo.findMembersByMerchant(tenantId);
  }

  @Post('cashiers')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async addCashier(@Body() dto: CreateCashierDto) {
    const tenantId = TenantContext.getTenantId();
    // The ValidationPipe enforces the DTO shape; this guard also catches
    // whitespace-only input so a new account can never get a weak password.
    const password = (dto.password ?? '').trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    const cleanEmail = dto.email.toLowerCase().trim();

    let user = await this.userRepo.findByEmail(cleanEmail);
    if (!user) {
      const passwordHash = await this.passwordHasher.hash(password);
      user = new User({
        email: cleanEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        isSuperAdmin: false,
      });
      user = await this.userRepo.save(user);
    }
    // Existing accounts keep their credentials: the owner only links a membership.

    const userId = user.id || `usr-${Date.now()}`;

    // Look up any membership for this tenant so re-adding never creates a
    // duplicate row nor downgrades an existing role.
    let membership = await this.membershipRepo.findByUserAndMerchant(userId, tenantId);
    if (!membership) {
      membership = new MerchantMembership({
        id: `mem-${Date.now()}`,
        userId,
        merchantId: tenantId,
        role: 'CASHIER',
        isActive: true,
      });
      (membership as any).userEmail = user.email;
      (membership as any).userFullName = user.fullName;
      membership = await this.membershipRepo.save(membership);
    } else if (!membership.isActive) {
      membership.activate();
      (membership as any).userEmail = user.email;
      (membership as any).userFullName = user.fullName;
      membership = await this.membershipRepo.save(membership);
    }

    return {
      id: membership.id,
      userId: user.id,
      merchantId: tenantId,
      role: membership.role,
      isActive: membership.isActive,
      createdAt: membership.createdAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  @Delete('cashiers/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async removeCashier(@Param('id') membershipId: string) {
    const tenantId = TenantContext.getTenantId();
    const deleted = await this.membershipRepo.deleteMembership(tenantId, membershipId);
    // Absent and cross-tenant results are indistinguishable: a safe 404
    // instead of a success acknowledgment that would leak existence.
    if (!deleted) {
      throw new NotFoundException('Membership not found');
    }
    return { success: true };
  }

  @Get('stores')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listOwnerStores(@Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id;
    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado.');
    }
    const memberships = await this.membershipRepo.findActiveByUser(userId);
    const ownerStores = memberships.filter((m) => m.membership.role === 'MERCHANT_OWNER');

    const stores = await Promise.all(
      ownerStores.map(async (m) => {
        const tenantId = m.merchant.id || m.merchant.slug;
        const branches = this.merchantRepo.listBranches
          ? await this.merchantRepo.listBranches(tenantId)
          : [];
        const pricing = calculateStoreMonthlyCostPyg(branches.length);
        return {
          tenantId,
          merchantName: m.merchant.name,
          slug: m.merchant.slug,
          status: m.merchant.status,
          branchesCount: branches.length,
          pricing,
        };
      }),
    );

    const totalMonthlyPyg = stores.reduce((acc, s) => acc + s.pricing.totalMonthlyPyg, 0);
    return {
      stores,
      totalMonthlyPyg,
    };
  }

  @Post('stores')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createOwnerStore(@Req() req: any, @Body() dto: CreateStoreDto) {
    const userId = req?.user?.userId || req?.user?.id;
    if (!userId) {
      throw new ForbiddenException('Usuario no autenticado.');
    }
    const currentTenantId = TenantContext.getTenantId();
    if (!req?.user?.isSuperAdmin) {
      const existingStores = (await this.membershipRepo.findActiveByUser(userId)).filter(
        (m) => m.membership.role === 'MERCHANT_OWNER',
      );
      if (existingStores.length >= 10) {
        throw new BadRequestException(
          'Alcanzaste el límite de 10 comercios autogestionados. Contactá a soporte para habilitar más.',
        );
      }
    }
    const cleanName = (dto.name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('El nombre del nuevo comercio es obligatorio.');
    }

    const baseSlug = (dto.slug || cleanName)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'comercio';

    let finalSlug = baseSlug;
    const existingBySlug = await this.merchantRepo.findBySlug(finalSlug);
    if (existingBySlug) {
      finalSlug = `${baseSlug}-${randomBytes(2).toString('hex')}`;
      const retry = await this.merchantRepo.findBySlug(finalSlug);
      if (retry) {
        throw new ConflictException(`El identificador '${finalSlug}' ya existe.`);
      }
    }

    const merchant = await this.merchantRepo.save(
      new Merchant({
        id: finalSlug,
        name: cleanName,
        slug: finalSlug,
        webhookSecret: `sec_${randomBytes(32).toString('hex')}`,
        status: 'active',
      }),
    );

    const targetTenantId = merchant.id || merchant.slug;
    const user = await this.userRepo.findById(userId);
    const membership = new MerchantMembership({
      id: `mem-${Date.now()}-${randomBytes(2).toString('hex')}`,
      userId,
      merchantId: targetTenantId,
      role: 'MERCHANT_OWNER',
      isActive: true,
    });
    if (user) {
      (membership as any).userEmail = user.email;
      (membership as any).userFullName = user.fullName;
    }
    await this.membershipRepo.save(membership);

    if (this.subscriptionRepo) {
      const trialEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await this.subscriptionRepo.save(
        new Subscription({
          id: `sub-${Date.now()}-${randomBytes(2).toString('hex')}`,
          tenantId: targetTenantId,
          status: 'trial',
          currentPeriodEnd: trialEnd,
        }),
      );
    }

    if (dto.copyFactufyFromCurrent && this.sifenRepo && currentTenantId) {
      try {
        const sourceSifen = await this.sifenRepo.getConfigByTenant(currentTenantId);
        if (sourceSifen) {
          await this.sifenRepo.upsertConfig(targetTenantId, {
            enabled: sourceSifen.enabled,
            environment: sourceSifen.environment,
            ruc: sourceSifen.ruc,
            dv: sourceSifen.dv,
            razonSocial: sourceSifen.razonSocial,
            nombreFantasia: cleanName,
            tipoContribuyente: sourceSifen.tipoContribuyente,
            tipoRegimen: sourceSifen.tipoRegimen,
            timbrado: sourceSifen.timbrado,
            fechaInicioTimbrado: sourceSifen.fechaInicioTimbrado,
            establecimiento: sourceSifen.establecimiento,
            puntoExpedicion: sourceSifen.puntoExpedicion,
            provider: sourceSifen.provider,
            factufyClientId: sourceSifen.factufyClientId,
            factufyClientSecret: sourceSifen.factufyClientSecret,
            factufyBranchCode: sourceSifen.factufyBranchCode,
            factufyPosCode: sourceSifen.factufyPosCode,
            updatedByUserId: userId,
          });
        }
      } catch {
        // Non-blocking if source store isn't eligible for SIFEN yet
      }
    }

    return {
      tenantId: targetTenantId,
      merchantName: merchant.name,
      slug: merchant.slug,
      pricing: calculateStoreMonthlyCostPyg(0),
    };
  }

  @Get('branches')
  @Roles('MERCHANT_OWNER', 'CASHIER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listBranches() {
    const tenantId = TenantContext.getTenantId();
    const branches = this.merchantRepo.listBranches
      ? await this.merchantRepo.listBranches(tenantId)
      : [];
    return {
      branches,
      pricing: calculateStoreMonthlyCostPyg(branches.length),
    };
  }

  @Post('branches')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createBranch(@Body() dto: CreateBranchDto) {
    const tenantId = TenantContext.getTenantId();
    if (!this.merchantRepo.createBranch) {
      throw new BadRequestException('Branch management is not available.');
    }
    const branch = await this.merchantRepo.createBranch({
      tenantId,
      name: dto.name,
      branchCode: dto.branchCode,
      posCode: dto.posCode,
      address: dto.address || null,
    });
    const branches = this.merchantRepo.listBranches
      ? await this.merchantRepo.listBranches(tenantId)
      : [branch];
    return {
      branch,
      branches,
      pricing: calculateStoreMonthlyCostPyg(branches.length),
    };
  }

  @Delete('branches/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteBranch(@Param('id') branchId: string) {
    const tenantId = TenantContext.getTenantId();
    if (!this.merchantRepo.deleteBranch) {
      throw new BadRequestException('Branch management is not available.');
    }
    const deleted = await this.merchantRepo.deleteBranch(tenantId, branchId);
    if (!deleted) {
      throw new NotFoundException('Sucursal no encontrada.');
    }
    const branches = this.merchantRepo.listBranches
      ? await this.merchantRepo.listBranches(tenantId)
      : [];
    return {
      success: true,
      branches,
      pricing: calculateStoreMonthlyCostPyg(branches.length),
    };
  }
}
