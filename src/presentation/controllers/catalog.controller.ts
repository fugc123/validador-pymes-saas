import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';
import {
  CatalogItemType,
  CatalogThemePalette,
  DiscountTimeType,
  ICatalogRepository,
  SaleMode,
  SalePaymentMethod,
} from '../../core/application/ports/catalog.ports';
import { IUserRepository } from '../../core/application/ports/auth.ports';
import { ITransferRepository } from '../../core/application/ports/transfer.ports';
import { ClaimTransferUseCase } from '../../core/application/use-cases/transfers/claim-transfer.use-case';

export interface CreateCatalogItemDto {
  itemType: CatalogItemType;
  name: string;
  description?: string | null;
  price: number;
  stock?: number | null;
  imageUrl?: string | null;
  discountPercent?: number;
  discountType?: DiscountTimeType;
  discountDurationHours?: number | null;
  discountDurationDays?: number | null;
  discountDays?: string | null;
}

export interface UpdateCatalogItemDto {
  name?: string;
  description?: string | null;
  price?: number;
  stock?: number | null;
  imageUrl?: string | null;
  discountPercent?: number;
  discountType?: DiscountTimeType;
  discountDurationHours?: number | null;
  discountDurationDays?: number | null;
  discountDays?: string | null;
  isActive?: boolean;
}

export interface CreateSaleDto {
  customerName?: string | null;
  concept?: string | null;
  cashierName?: string | null;
  saleMode?: SaleMode;
  paymentMethod: SalePaymentMethod;
  transferId?: string | null;
  quickAmount?: number;
  items?: Array<{
    itemId: string;
    quantity: number;
  }>;
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
  ) {}

  @Get('merchant/catalog')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMerchantCatalog() {
    const tenantId = TenantContext.getTenantId();
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
    const tenantId = TenantContext.getTenantId();
    return this.catalogRepo.createItem({
      tenantId,
      itemType: dto.itemType,
      name: dto.name,
      description: dto.description,
      price: Number(dto.price),
      stock: dto.stock !== undefined && dto.stock !== null ? Number(dto.stock) : null,
      imageUrl: dto.imageUrl,
      discountPercent: dto.discountPercent ? Number(dto.discountPercent) : 0,
      discountType: dto.discountType || 'none',
      discountDurationHours: dto.discountDurationHours ? Number(dto.discountDurationHours) : null,
      discountDurationDays: dto.discountDurationDays ? Number(dto.discountDurationDays) : null,
      discountDays: dto.discountDays || null,
    });
  }

  @Patch('merchant/catalog/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCatalogItem(@Param('id') itemId: string, @Body() dto: UpdateCatalogItemDto) {
    const tenantId = TenantContext.getTenantId();
    const updated = await this.catalogRepo.updateItem(tenantId, itemId, dto);
    if (!updated) {
      throw new NotFoundException('Catalog item not found');
    }
    return updated;
  }

  @Delete('merchant/catalog/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async deleteCatalogItem(@Param('id') itemId: string) {
    const tenantId = TenantContext.getTenantId();
    const deleted = await this.catalogRepo.deleteItem(tenantId, itemId);
    if (!deleted) {
      throw new NotFoundException('Catalog item not found');
    }
    return { success: true };
  }

  @Patch('merchant/catalog-theme')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async updateCatalogTheme(@Body() body: { theme: CatalogThemePalette }) {
    const tenantId = TenantContext.getTenantId();
    const theme = await this.catalogRepo.setCatalogTheme(tenantId, body.theme);
    return { theme };
  }

  @Get('merchant/sales')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMerchantSales() {
    const tenantId = TenantContext.getTenantId();
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
    const tenantId = TenantContext.getTenantId();
    const items = await this.catalogRepo.listItemsByTenant(tenantId, true);
    return { items };
  }

  @Get('cashier/sales')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCashierSales() {
    const tenantId = TenantContext.getTenantId();
    const sales = await this.catalogRepo.listSalesByTenant(tenantId, 30);
    return { sales };
  }

  @Post('cashier/sales')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async recordCashierSale(@Body() dto: CreateSaleDto) {
    const tenantId = TenantContext.getTenantId();
    const cashierUserId = TenantContext.getUserId();

    const user = await this.userRepo.findById(cashierUserId);
    const cashierName = user?.fullName || (dto.cashierName || '').trim() || 'Cajero';

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
      if (transfer.status === 'pending') {
        await this.claimTransferUseCase.execute({
          tenantId,
          transferId: dto.transferId,
          cashierUserId,
        });
      }
    }

    return this.catalogRepo.createSale({
      tenantId,
      cashierUserId,
      cashierName,
      customerName: dto.customerName,
      concept: dto.concept,
      saleMode: dto.saleMode || 'catalog',
      paymentMethod: dto.paymentMethod,
      transferId: dto.transferId || null,
      quickAmount: dto.quickAmount,
      items: dto.items,
    });
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
}
