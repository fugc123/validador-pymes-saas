import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Allow, IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';
import { validateSafeImageUrl } from '../../core/application/utils/image-security';
import {
  BookingMode,
  BookingStatus,
  CatalogItemType,
  CatalogThemePalette,
  DiscountTimeType,
  ICatalogRepository,
  SaleMode,
  SalePaymentMethod,
} from '../../core/application/ports/catalog.ports';
import { IUserRepository } from '../../core/application/ports/auth.ports';
import { ITransferRepository } from '../../core/application/ports/transfer.ports';
import { ILoyaltyRepository } from '../../core/application/ports/loyalty.ports';
import { ClaimTransferUseCase } from '../../core/application/use-cases/transfers/claim-transfer.use-case';

export class CreateCatalogItemDto {
  @Allow()
  itemType!: CatalogItemType;

  @Allow()
  name!: string;

  @IsOptional()
  @Allow()
  description?: string | null;

  @Allow()
  price!: number;

  @IsOptional()
  @Allow()
  stock?: number | null;

  @IsOptional()
  @Allow()
  imageUrl?: string | null;

  @IsOptional()
  @Allow()
  discountPercent?: number;

  @IsOptional()
  @Allow()
  discountType?: DiscountTimeType;

  @IsOptional()
  @Allow()
  discountDurationHours?: number | null;

  @IsOptional()
  @Allow()
  discountDurationDays?: number | null;

  @IsOptional()
  @Allow()
  discountDays?: string | null;

  @IsOptional()
  @Allow()
  bookingEnabled?: boolean;

  @IsOptional()
  @Allow()
  bookingMode?: BookingMode;

  @IsOptional()
  @Allow()
  bookingDaysOfWeek?: string | null;

  @IsOptional()
  @Allow()
  bookingTimeSlots?: string | null;

  @IsOptional()
  @Allow()
  bookingMaxConcurrent?: number;
}

export class UpdateCatalogItemDto {
  @IsOptional()
  @Allow()
  name?: string;

  @IsOptional()
  @Allow()
  description?: string | null;

  @IsOptional()
  @Allow()
  price?: number;

  @IsOptional()
  @Allow()
  stock?: number | null;

  @IsOptional()
  @Allow()
  imageUrl?: string | null;

  @IsOptional()
  @Allow()
  discountPercent?: number;

  @IsOptional()
  @Allow()
  discountType?: DiscountTimeType;

  @IsOptional()
  @Allow()
  discountDurationHours?: number | null;

  @IsOptional()
  @Allow()
  discountDurationDays?: number | null;

  @IsOptional()
  @Allow()
  discountDays?: string | null;

  @IsOptional()
  @Allow()
  isActive?: boolean;

  @IsOptional()
  @Allow()
  bookingEnabled?: boolean;

  @IsOptional()
  @Allow()
  bookingMode?: BookingMode;

  @IsOptional()
  @Allow()
  bookingDaysOfWeek?: string | null;

  @IsOptional()
  @Allow()
  bookingTimeSlots?: string | null;

  @IsOptional()
  @Allow()
  bookingMaxConcurrent?: number;
}

export class CreatePublicBookingDto {
  @IsString()
  @MaxLength(100)
  itemId!: string;

  @IsString()
  @MaxLength(10)
  startDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  endDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  timeSlot?: string | null;

  @IsString()
  @MaxLength(120)
  customerName!: string;

  @IsString()
  @MaxLength(40)
  customerPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}

export class UpdateBookingStatusDto {
  @Allow()
  status!: BookingStatus;
}

export class CreateSaleDto {
  @IsOptional()
  @Allow()
  customerName?: string | null;

  @IsOptional()
  @Allow()
  customerPhone?: string | null;

  @IsOptional()
  @Allow()
  customerRuc?: string | null;

  @IsOptional()
  @Allow()
  customerEmail?: string | null;

  @IsOptional()
  @Allow()
  concept?: string | null;

  @IsOptional()
  @Allow()
  cashierName?: string | null;

  @IsOptional()
  @Allow()
  saleMode?: SaleMode;

  @Allow()
  paymentMethod!: SalePaymentMethod;

  @IsOptional()
  @Allow()
  transferId?: string | null;

  @IsOptional()
  @Allow()
  quickAmount?: number;

  @IsOptional()
  @Allow()
  items?: Array<{
    itemId: string;
    quantity: number;
  }>;
}

export class UpdateCatalogThemeDto {
  @Allow()
  theme!: CatalogThemePalette;
}

@Controller()
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class CatalogController {
  constructor(
    @Inject('ICatalogRepository')
    private readonly catalogRepo: ICatalogRepository,
    @Inject('IUserRepository')
    private readonly userRepo: IUserRepository,
    @Inject('ITransferRepository')
    private readonly transferRepo: ITransferRepository,
    private readonly claimTransferUseCase: ClaimTransferUseCase,
    @Optional()
    @Inject('ILoyaltyRepository')
    private readonly loyaltyRepo?: ILoyaltyRepository,
  ) {}

  private requireTenantId(): string {
    try {
      return TenantContext.getTenantId();
    } catch {
      throw new ForbiddenException('Se requiere un comercio activo seleccionado para operar el catálogo.');
    }
  }

  @Get('merchant/catalog')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMerchantCatalog() {
    const tenantId = this.requireTenantId();
    const [theme, items] = await Promise.all([
      this.catalogRepo.getCatalogTheme(tenantId),
      this.catalogRepo.listItemsByTenant(tenantId, false),
    ]);
    return { theme, items };
  }

  @Post('merchant/catalog')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async createCatalogItem(@Body() dto: CreateCatalogItemDto) {
    const tenantId = this.requireTenantId();
    const safeImageUrl = validateSafeImageUrl(dto.imageUrl);
    return this.catalogRepo.createItem({
      tenantId,
      itemType: dto.itemType,
      name: dto.name,
      description: dto.description,
      price: Number(dto.price),
      stock: dto.stock !== undefined && dto.stock !== null ? Number(dto.stock) : null,
      imageUrl: safeImageUrl,
      discountPercent: dto.discountPercent ? Number(dto.discountPercent) : 0,
      discountType: dto.discountType || 'none',
      discountDurationHours: dto.discountDurationHours ? Number(dto.discountDurationHours) : null,
      discountDurationDays: dto.discountDurationDays ? Number(dto.discountDurationDays) : null,
      discountDays: dto.discountDays || null,
      bookingEnabled: Boolean(dto.bookingEnabled),
      bookingMode: dto.bookingMode || 'hours',
      bookingDaysOfWeek: dto.bookingDaysOfWeek || null,
      bookingTimeSlots: dto.bookingTimeSlots || null,
      bookingMaxConcurrent: dto.bookingMaxConcurrent ? Number(dto.bookingMaxConcurrent) : 1,
    });
  }

  @Patch('merchant/catalog/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCatalogItem(@Param('id') itemId: string, @Body() dto: UpdateCatalogItemDto) {
    const tenantId = this.requireTenantId();
    const payload = { ...dto };
    if (dto.imageUrl !== undefined) {
      payload.imageUrl = validateSafeImageUrl(dto.imageUrl);
    }
    const updated = await this.catalogRepo.updateItem(tenantId, itemId, payload);
    if (!updated) {
      throw new NotFoundException('Catalog item not found');
    }
    return updated;
  }

  @Delete('merchant/catalog/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteCatalogItem(@Param('id') itemId: string) {
    const tenantId = this.requireTenantId();
    const deleted = await this.catalogRepo.deleteItem(tenantId, itemId);
    if (!deleted) {
      throw new NotFoundException('Catalog item not found');
    }
    return { success: true };
  }

  @Patch('merchant/catalog-theme')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCatalogTheme(@Body() body: UpdateCatalogThemeDto) {
    const tenantId = this.requireTenantId();
    const theme = await this.catalogRepo.setCatalogTheme(tenantId, body.theme);
    return { theme };
  }

  @Get('merchant/sales')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMerchantSales() {
    const tenantId = this.requireTenantId();
    const sales = await this.catalogRepo.listSalesByTenant(tenantId, 200);
    const totalRevenue = sales.reduce((acc, s) => acc + s.totalAmount, 0);
    const transferSalesCount = sales.filter((s) => s.paymentMethod === 'TRANSFER').length;
    const otherSalesCount = sales.length - transferSalesCount;

    return {
      summary: {
        totalSalesCount: sales.length,
        totalRevenue,
        transferSalesCount,
        otherSalesCount,
      },
      sales,
    };
  }

  @Get('cashier/catalog')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCashierCatalog() {
    const tenantId = this.requireTenantId();
    const items = await this.catalogRepo.listItemsByTenant(tenantId, true);
    return { items };
  }

  @Get('cashier/sales')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCashierSales() {
    const tenantId = this.requireTenantId();
    const sales = await this.catalogRepo.listSalesByTenant(tenantId, 30);
    return { sales };
  }

  @Post('cashier/sales')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async recordCashierSale(@Body() dto: CreateSaleDto) {
    const tenantId = this.requireTenantId();
    const cashierUserId = TenantContext.getUserId();

    const user = await this.userRepo.findById(cashierUserId);
    const cashierName = user?.fullName || (dto.cashierName || '').trim() || 'Cajero';

    let expectedTotalAmount: number | undefined;

    if (dto.paymentMethod === 'TRANSFER') {
      if (!dto.transferId) {
        throw new BadRequestException(
          'Para concretar una venta por transferencia debés validar y vincular el pago SIPAP primero.',
        );
      }
      const transfer = await this.transferRepo.findById(tenantId, dto.transferId);
      if (!transfer) {
        throw new NotFoundException('Transferencia vinculada no encontrada para este comercio.');
      }
      if (transfer.status !== 'pending') {
        throw new ConflictException(
          '⛔ Anti-Replay: Esta transferencia ya fue reclamada o se encuentra expirada y no puede reutilizarse.',
        );
      }
      expectedTotalAmount = transfer.amount;
    }

    const sale = await this.catalogRepo.createSale({
      tenantId,
      cashierUserId,
      cashierName,
      customerName: dto.customerName,
      customerRuc: dto.customerRuc,
      customerEmail: dto.customerEmail,
      concept: dto.concept,
      saleMode: dto.saleMode || 'catalog',
      paymentMethod: dto.paymentMethod,
      transferId: dto.transferId || null,
      quickAmount: dto.quickAmount,
      expectedTotalAmount,
      items: dto.items,
    });

    if (dto.paymentMethod === 'TRANSFER' && dto.transferId) {
      await this.claimTransferUseCase.execute({
        tenantId,
        transferId: dto.transferId,
        cashierUserId,
      });
    }

    let loyaltyUpdate = null;
    if (this.loyaltyRepo && dto.customerPhone && dto.customerPhone.replace(/\D/g, '').length >= 6) {
      try {
        loyaltyUpdate = await this.loyaltyRepo.recordVisitByPhone(tenantId, dto.customerPhone, dto.customerName);
      } catch {
        // Non-blocking: sale and transfer claim already succeeded
      }
    }

    return loyaltyUpdate ? { ...sale, loyaltyUpdate } : sale;
  }

  @Get('merchant/catalog/bookings')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async listMerchantBookings() {
    const tenantId = this.requireTenantId();
    return this.catalogRepo.listBookingsByTenant(tenantId);
  }

  @Patch('merchant/catalog/bookings/:id/status')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateBookingStatus(@Param('id') bookingId: string, @Body() dto: UpdateBookingStatusDto) {
    const tenantId = this.requireTenantId();
    const allowed: BookingStatus[] = ['pending', 'confirmed', 'cancelled', 'completed'];
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException('Estado de reserva inválido.');
    }
    const updated = await this.catalogRepo.updateBookingStatus(tenantId, bookingId, dto.status);
    if (!updated) {
      throw new NotFoundException('Reserva no encontrada.');
    }
    return updated;
  }
}

@Controller('public/catalog')
export class PublicCatalogController {
  constructor(
    @Inject('ICatalogRepository')
    private readonly catalogRepo: ICatalogRepository,
  ) {}

  @Get(':slug')
  @HttpCode(HttpStatus.OK)
  async getPublicStorefront(@Param('slug') slug: string) {
    const catalog = await this.catalogRepo.getPublicCatalogBySlug(slug);
    if (!catalog) {
      throw new NotFoundException(`No se encontró el catálogo para el comercio '${slug}'`);
    }
    return catalog;
  }

  @Get(':slug/availability')
  @HttpCode(HttpStatus.OK)
  async getPublicBookingAvailability(
    @Param('slug') slug: string,
    @Query('itemId') itemId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    const catalog = await this.catalogRepo.getPublicCatalogBySlug(slug);
    if (!catalog) {
      throw new NotFoundException(`No se encontró el catálogo para el comercio '${slug}'`);
    }
    if (!itemId || !fromDate || !toDate) {
      throw new BadRequestException('Se requieren itemId, fromDate y toDate.');
    }
    const item = catalog.items.find((i) => i.id === itemId && i.bookingEnabled);
    if (!item) {
      throw new NotFoundException('Servicio reservable no encontrado.');
    }
    if (toDate < fromDate) {
      throw new BadRequestException('toDate no puede ser anterior a fromDate.');
    }
    return this.catalogRepo.getBookingAvailability(item.tenantId, itemId, fromDate, toDate);
  }

  @Post(':slug/bookings')
  @Throttle({ default: { limit: 8, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async createPublicBooking(@Param('slug') slug: string, @Body() dto: CreatePublicBookingDto) {
    const catalog = await this.catalogRepo.getPublicCatalogBySlug(slug);
    if (!catalog) {
      throw new NotFoundException(`No se encontró el catálogo para el comercio '${slug}'`);
    }
    const item = catalog.items.find((i) => i.id === dto.itemId && i.bookingEnabled);
    if (!item) {
      throw new NotFoundException('Servicio reservable no encontrado.');
    }
    return this.catalogRepo.createBooking({
      tenantId: item.tenantId,
      itemId: dto.itemId,
      startDate: dto.startDate,
      endDate: dto.endDate,
      timeSlot: dto.timeSlot,
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      notes: dto.notes,
    });
  }
}
