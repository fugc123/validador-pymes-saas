import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Allow, IsOptional } from 'class-validator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';
import { ILoyaltyRepository } from '../../core/application/ports/loyalty.ports';

export class UpsertLoyaltyProgramDto {
  @Allow()
  isEnabled!: boolean;

  @Allow()
  stampsRequired!: number;

  @Allow()
  rewardTitle!: string;

  @IsOptional()
  @Allow()
  rewardDescription?: string | null;
}

export class RecordLoyaltyVisitDto {
  @Allow()
  customerPhone!: string;

  @IsOptional()
  @Allow()
  customerName?: string | null;
}

@Controller()
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class LoyaltyController {
  constructor(
    @Inject('ILoyaltyRepository')
    private readonly loyaltyRepo: ILoyaltyRepository,
  ) {}

  private requireTenantId(): string {
    try {
      return TenantContext.getTenantId();
    } catch {
      throw new ForbiddenException('Se requiere un comercio activo seleccionado para operar fidelidad.');
    }
  }

  @Get('merchant/loyalty/program')
  @Roles('MERCHANT_OWNER', 'CASHIER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getProgram() {
    const tenantId = this.requireTenantId();
    return this.loyaltyRepo.getProgram(tenantId);
  }

  @Put('merchant/loyalty/program')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async upsertProgram(@Body() dto: UpsertLoyaltyProgramDto) {
    const tenantId = this.requireTenantId();
    return this.loyaltyRepo.upsertProgram({
      tenantId,
      isEnabled: Boolean(dto.isEnabled),
      stampsRequired: Number(dto.stampsRequired || 10),
      rewardTitle: dto.rewardTitle,
      rewardDescription: dto.rewardDescription || null,
    });
  }

  @Get('merchant/loyalty/cards')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listCards() {
    const tenantId = this.requireTenantId();
    return this.loyaltyRepo.listCardsByTenant(tenantId);
  }

  @Get('merchant/loyalty/cards/by-phone')
  @Roles('MERCHANT_OWNER', 'CASHIER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async findByPhone(@Query('phone') phone: string) {
    const tenantId = this.requireTenantId();
    if (!phone || !phone.trim()) {
      throw new BadRequestException('Ingresá un número de teléfono.');
    }
    const card = await this.loyaltyRepo.findCardByPhone(tenantId, phone);
    if (!card) {
      throw new NotFoundException('No se encontró tarjeta de fidelidad para ese número.');
    }
    return card;
  }

  @Post('merchant/loyalty/visit')
  @Roles('MERCHANT_OWNER', 'CASHIER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async recordVisit(@Body() dto: RecordLoyaltyVisitDto) {
    const tenantId = this.requireTenantId();
    return this.loyaltyRepo.recordVisitByPhone(tenantId, dto.customerPhone, dto.customerName, true);
  }

  @Post('merchant/loyalty/coupons/:id/redeem')
  @Roles('MERCHANT_OWNER', 'CASHIER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async redeemCoupon(@Param('id') couponId: string) {
    const tenantId = this.requireTenantId();
    const coupon = await this.loyaltyRepo.redeemCoupon(tenantId, couponId);
    if (!coupon) {
      throw new NotFoundException('Cupón no encontrado.');
    }
    return coupon;
  }
}

@Controller('public/loyalty')
export class PublicLoyaltyController {
  constructor(
    @Inject('ILoyaltyRepository')
    private readonly loyaltyRepo: ILoyaltyRepository,
  ) {}

  @Get(':token')
  @HttpCode(HttpStatus.OK)
  async getPublicCard(@Param('token') token: string) {
    const view = await this.loyaltyRepo.getPublicCardByToken(token);
    if (!view) {
      throw new NotFoundException('Tarjeta de fidelidad no encontrada.');
    }
    return view;
  }
}
