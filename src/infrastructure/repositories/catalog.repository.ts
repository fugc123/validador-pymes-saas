import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { CatalogBookingRow, CatalogItemRow, SaleItemRow, SaleRow } from '../database/schema';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import {
  ALLOWED_CATALOG_THEMES,
  BookingMode,
  BookingSlotCount,
  BookingStatus,
  CatalogBooking,
  CatalogItem,
  CatalogItemView,
  CatalogThemePalette,
  CreateBookingInput,
  CreateCatalogItemInput,
  CreateSaleInput,
  evaluateCatalogItemView,
  ICatalogRepository,
  Sale,
  SaleItem,
  UpdateCatalogItemInput,
} from '../../core/application/ports/catalog.ports';

@Injectable()
export class CatalogRepository implements ICatalogRepository {
  private items: CatalogItem[] = [];
  private sales: Sale[] = [];
  private bookings: CatalogBooking[] = [];
  private themes = new Map<string, CatalogThemePalette>();

  constructor(
    @Optional() private readonly dbService?: DatabaseService,
    @Optional()
    @Inject('IMerchantRepository')
    private readonly merchantRepo?: IMerchantRepository,
  ) {}

  private isDbActive(): boolean {
    return Boolean(this.dbService && !this.dbService.isMemoryMode);
  }

  private mapRowToItem(row: CatalogItemRow): CatalogItem {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemType: row.item_type,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      stock: row.stock === null || row.stock === undefined ? null : Number(row.stock),
      imageUrl: row.image_url,
      discountPercent: Number(row.discount_percent || 0),
      discountType: row.discount_type || 'none',
      discountEndsAt: row.discount_ends_at ? new Date(row.discount_ends_at) : null,
      discountDays: row.discount_days,
      isActive: Boolean(row.is_active),
      bookingEnabled: Boolean(row.booking_enabled),
      bookingMode: row.booking_mode === 'days' ? 'days' : 'hours',
      bookingDaysOfWeek: row.booking_days_of_week || '1,2,3,4,5,6',
      bookingTimeSlots: row.booking_time_slots ?? null,
      bookingMaxConcurrent: Math.max(1, Number(row.booking_max_concurrent || 1)),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private normalizeBookingDays(days?: string | null): string {
    const raw = (days ?? '1,2,3,4,5,6')
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
    const unique = Array.from(new Set(raw)).sort((a, b) => a - b);
    return unique.length > 0 ? unique.join(',') : '1,2,3,4,5,6';
  }

  private normalizeBookingSlots(slots?: string | null): string | null {
    if (!slots) return null;
    const cleaned = slots
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{2}:\d{2}$/.test(s));
    const unique = Array.from(new Set(cleaned)).sort();
    return unique.length > 0 ? unique.join(',') : null;
  }

  private resolveDiscountExpiration(
    discountType: 'none' | 'hours' | 'days',
    durationHours?: number | null,
    durationDays?: number | null,
    explicitEndsAt?: Date | null,
    now: Date = new Date(),
  ): Date | null {
    if (discountType === 'none') return null;
    if (explicitEndsAt) return new Date(explicitEndsAt);
    if (discountType === 'hours' && durationHours && durationHours > 0) {
      return new Date(now.getTime() + durationHours * 3600 * 1000);
    }
    if (discountType === 'days' && durationDays && durationDays > 0) {
      return new Date(now.getTime() + durationDays * 24 * 3600 * 1000);
    }
    return null;
  }

  async listItemsByTenant(tenantId: string, onlyActive = false, now: Date = new Date()): Promise<CatalogItemView[]> {
    if (this.isDbActive()) {
      const sql = onlyActive
        ? `SELECT * FROM catalog_items WHERE tenant_id = $1 AND is_active = TRUE ORDER BY created_at DESC`
        : `SELECT * FROM catalog_items WHERE tenant_id = $1 ORDER BY created_at DESC`;
      const res = await this.dbService!.query<CatalogItemRow>(sql, [tenantId]);
      return (res.rows || []).map((r) => evaluateCatalogItemView(this.mapRowToItem(r), now));
    }

    return this.items
      .filter((i) => i.tenantId === tenantId && (!onlyActive || i.isActive))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((i) => evaluateCatalogItemView(i, now));
  }

  async findItemById(tenantId: string, itemId: string, now: Date = new Date()): Promise<CatalogItemView | null> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogItemRow>(
        `SELECT * FROM catalog_items WHERE tenant_id = $1 AND id = $2`,
        [tenantId, itemId],
      );
      if (!res.rows || res.rows.length === 0) return null;
      return evaluateCatalogItemView(this.mapRowToItem(res.rows[0]), now);
    }

    const found = this.items.find((i) => i.tenantId === tenantId && i.id === itemId);
    return found ? evaluateCatalogItemView(found, now) : null;
  }

  async createItem(input: CreateCatalogItemInput, now: Date = new Date()): Promise<CatalogItemView> {
    const cleanName = (input.name || '').trim();
    if (!cleanName) {
      throw new BadRequestException('Item name is required');
    }
    if (input.price === undefined || input.price === null || input.price < 0) {
      throw new BadRequestException('Price must be a non-negative amount');
    }
    const itemType = input.itemType === 'service' ? 'service' : 'product';
    const stock =
      itemType === 'service' || input.stock === undefined || input.stock === null
        ? null
        : Math.max(0, Math.floor(Number(input.stock)));

    const discountPercent = Math.min(99, Math.max(0, Math.floor(Number(input.discountPercent || 0))));
    const discountType = discountPercent > 0 ? input.discountType || 'none' : 'none';
    const discountEndsAt = this.resolveDiscountExpiration(
      discountType,
      input.discountDurationHours,
      input.discountDurationDays,
      input.discountEndsAt,
      now,
    );
    const discountDays = discountType === 'days' && input.discountDays ? input.discountDays.trim() : null;
    const bookingEnabled = itemType === 'service' && Boolean(input.bookingEnabled);
    const bookingMode: BookingMode = input.bookingMode === 'days' ? 'days' : 'hours';
    const bookingDaysOfWeek = this.normalizeBookingDays(input.bookingDaysOfWeek);
    const bookingTimeSlots = bookingMode === 'hours' ? this.normalizeBookingSlots(input.bookingTimeSlots) : null;
    const bookingMaxConcurrent = Math.max(1, Math.floor(Number(input.bookingMaxConcurrent || 1)));

    const item: CatalogItem = {
      id: `itm-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`,
      tenantId: input.tenantId,
      itemType,
      name: cleanName,
      description: input.description ? input.description.trim() : null,
      price: Math.round(Number(input.price)),
      stock,
      imageUrl: input.imageUrl ? input.imageUrl.trim() : null,
      discountPercent,
      discountType,
      discountEndsAt,
      discountDays,
      isActive: true,
      bookingEnabled,
      bookingMode,
      bookingDaysOfWeek,
      bookingTimeSlots,
      bookingMaxConcurrent,
      createdAt: now,
      updatedAt: now,
    };

    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogItemRow>(
        `INSERT INTO catalog_items (
          id, tenant_id, item_type, name, description, price, stock, image_url,
          discount_percent, discount_type, discount_ends_at, discount_days, is_active,
          booking_enabled, booking_mode, booking_days_of_week, booking_time_slots, booking_max_concurrent,
          created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
        RETURNING *`,
        [
          item.id,
          item.tenantId,
          item.itemType,
          item.name,
          item.description,
          item.price,
          item.stock,
          item.imageUrl,
          item.discountPercent,
          item.discountType,
          item.discountEndsAt,
          item.discountDays,
          item.isActive,
          item.bookingEnabled,
          item.bookingMode,
          item.bookingDaysOfWeek,
          item.bookingTimeSlots,
          item.bookingMaxConcurrent,
          item.createdAt,
          item.updatedAt,
        ],
      );
      return evaluateCatalogItemView(this.mapRowToItem(res.rows[0]), now);
    }

    this.items.push(item);
    return evaluateCatalogItemView(item, now);
  }

  async updateItem(
    tenantId: string,
    itemId: string,
    input: UpdateCatalogItemInput,
    now: Date = new Date(),
  ): Promise<CatalogItemView | null> {
    const existing = await this.findItemById(tenantId, itemId, now);
    if (!existing) return null;

    const updatedName = input.name !== undefined ? input.name.trim() : existing.name;
    if (!updatedName) {
      throw new BadRequestException('Item name cannot be empty');
    }

    const updatedPrice =
      input.price !== undefined ? Math.max(0, Math.round(Number(input.price))) : existing.price;

    const updatedStock =
      existing.itemType === 'service'
        ? null
        : input.stock !== undefined
          ? input.stock === null
            ? null
            : Math.max(0, Math.floor(Number(input.stock)))
          : existing.stock;

    const updatedDiscountPercent =
      input.discountPercent !== undefined
        ? Math.min(99, Math.max(0, Math.floor(Number(input.discountPercent))))
        : existing.discountPercent;

    const updatedDiscountType =
      updatedDiscountPercent === 0
        ? 'none'
        : input.discountType !== undefined
          ? input.discountType
          : existing.discountType;

    let updatedDiscountEndsAt = existing.discountEndsAt;
    if (updatedDiscountType === 'none') {
      updatedDiscountEndsAt = null;
    } else if (
      input.discountDurationHours !== undefined ||
      input.discountDurationDays !== undefined ||
      input.discountEndsAt !== undefined
    ) {
      updatedDiscountEndsAt = this.resolveDiscountExpiration(
        updatedDiscountType,
        input.discountDurationHours,
        input.discountDurationDays,
        input.discountEndsAt,
        now,
      );
    }

    const updatedDiscountDays =
      updatedDiscountType === 'days'
        ? input.discountDays !== undefined
          ? input.discountDays
            ? input.discountDays.trim()
            : null
          : existing.discountDays
        : null;

    const updatedBookingEnabled =
      existing.itemType === 'service'
        ? input.bookingEnabled !== undefined
          ? Boolean(input.bookingEnabled)
          : existing.bookingEnabled
        : false;
    const updatedBookingMode: BookingMode =
      input.bookingMode !== undefined ? (input.bookingMode === 'days' ? 'days' : 'hours') : existing.bookingMode;
    const updatedBookingDaysOfWeek =
      input.bookingDaysOfWeek !== undefined
        ? this.normalizeBookingDays(input.bookingDaysOfWeek)
        : existing.bookingDaysOfWeek;
    const updatedBookingTimeSlots =
      updatedBookingMode === 'hours'
        ? input.bookingTimeSlots !== undefined
          ? this.normalizeBookingSlots(input.bookingTimeSlots)
          : existing.bookingTimeSlots
        : null;
    const updatedBookingMaxConcurrent =
      input.bookingMaxConcurrent !== undefined
        ? Math.max(1, Math.floor(Number(input.bookingMaxConcurrent)))
        : existing.bookingMaxConcurrent;

    const updated: CatalogItem = {
      id: existing.id,
      tenantId: existing.tenantId,
      itemType: existing.itemType,
      name: updatedName,
      description: input.description !== undefined ? (input.description ? input.description.trim() : null) : existing.description,
      price: updatedPrice,
      stock: updatedStock,
      imageUrl: input.imageUrl !== undefined ? (input.imageUrl ? input.imageUrl.trim() : null) : existing.imageUrl,
      discountPercent: updatedDiscountPercent,
      discountType: updatedDiscountType,
      discountEndsAt: updatedDiscountEndsAt,
      discountDays: updatedDiscountDays,
      isActive: input.isActive !== undefined ? Boolean(input.isActive) : existing.isActive,
      bookingEnabled: updatedBookingEnabled,
      bookingMode: updatedBookingMode,
      bookingDaysOfWeek: updatedBookingDaysOfWeek,
      bookingTimeSlots: updatedBookingTimeSlots,
      bookingMaxConcurrent: updatedBookingMaxConcurrent,
      createdAt: existing.createdAt,
      updatedAt: now,
    };

    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogItemRow>(
        `UPDATE catalog_items
         SET name = $1, description = $2, price = $3, stock = $4, image_url = $5,
             discount_percent = $6, discount_type = $7, discount_ends_at = $8, discount_days = $9,
             is_active = $10, booking_enabled = $11, booking_mode = $12, booking_days_of_week = $13,
             booking_time_slots = $14, booking_max_concurrent = $15, updated_at = $16
         WHERE tenant_id = $17 AND id = $18
         RETURNING *`,
        [
          updated.name,
          updated.description,
          updated.price,
          updated.stock,
          updated.imageUrl,
          updated.discountPercent,
          updated.discountType,
          updated.discountEndsAt,
          updated.discountDays,
          updated.isActive,
          updated.bookingEnabled,
          updated.bookingMode,
          updated.bookingDaysOfWeek,
          updated.bookingTimeSlots,
          updated.bookingMaxConcurrent,
          updated.updatedAt,
          tenantId,
          itemId,
        ],
      );
      if (!res.rows || res.rows.length === 0) return null;
      return evaluateCatalogItemView(this.mapRowToItem(res.rows[0]), now);
    }

    const idx = this.items.findIndex((i) => i.tenantId === tenantId && i.id === itemId);
    if (idx >= 0) {
      this.items[idx] = updated;
    }
    return evaluateCatalogItemView(updated, now);
  }

  async deleteItem(tenantId: string, itemId: string): Promise<boolean> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query(
        `DELETE FROM catalog_items WHERE tenant_id = $1 AND id = $2`,
        [tenantId, itemId],
      );
      return Boolean(res.rowCount && res.rowCount > 0);
    }

    const idx = this.items.findIndex((i) => i.tenantId === tenantId && i.id === itemId);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  async getCatalogTheme(tenantId: string): Promise<CatalogThemePalette> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<{ catalog_theme?: string }>(
        `SELECT catalog_theme FROM merchants WHERE slug = $1 OR id::text = $1 LIMIT 1`,
        [tenantId],
      );
      const raw = res.rows?.[0]?.catalog_theme as CatalogThemePalette | undefined;
      if (raw && ALLOWED_CATALOG_THEMES.includes(raw)) {
        return raw;
      }
      return 'emerald';
    }
    return this.themes.get(tenantId) || 'emerald';
  }

  async setCatalogTheme(tenantId: string, theme: CatalogThemePalette): Promise<CatalogThemePalette> {
    if (!ALLOWED_CATALOG_THEMES.includes(theme)) {
      throw new BadRequestException(`Unsupported catalog theme: ${theme}`);
    }
    if (this.isDbActive()) {
      await this.dbService!.query(
        `UPDATE merchants SET catalog_theme = $1, updated_at = NOW() WHERE slug = $2 OR id::text = $2`,
        [theme, tenantId],
      );
      return theme;
    }
    this.themes.set(tenantId, theme);
    return theme;
  }

  async getPublicCatalogBySlug(slug: string, now: Date = new Date()): Promise<{
    merchantId: string;
    merchantName: string;
    slug: string;
    theme: CatalogThemePalette;
    items: CatalogItemView[];
  } | null> {
    const cleanSlug = (slug || '').toLowerCase().trim();
    if (!cleanSlug) return null;

    if (this.isDbActive()) {
      const mRes = await this.dbService!.query<{
        id: string;
        name: string;
        slug: string;
        status?: string;
        catalog_theme?: string;
      }>(
        `SELECT id, name, slug, status, catalog_theme FROM merchants WHERE LOWER(slug) = $1 AND status = 'active' LIMIT 1`,
        [cleanSlug],
      );

      if (!mRes.rows || mRes.rows.length === 0) return null;
      const m = mRes.rows[0];
      const theme = ALLOWED_CATALOG_THEMES.includes(m.catalog_theme as CatalogThemePalette)
        ? (m.catalog_theme as CatalogThemePalette)
        : 'emerald';

      const itemsRes = await this.dbService!.query<CatalogItemRow>(
        `SELECT * FROM catalog_items WHERE (tenant_id = $1 OR tenant_id = $2) AND is_active = TRUE ORDER BY created_at DESC`,
        [m.slug, m.id],
      );
      const items = (itemsRes.rows || []).map((r) => evaluateCatalogItemView(this.mapRowToItem(r), now));
      return {
        merchantId: m.slug || m.id,
        merchantName: m.name,
        slug: m.slug,
        theme,
        items,
      };
    }

    const merchant = this.merchantRepo ? await this.merchantRepo.findBySlug(cleanSlug) : null;
    if (!merchant || merchant.status !== 'active') return null;

    const tenantKey = merchant.slug || merchant.id || cleanSlug;
    const theme = await this.getCatalogTheme(tenantKey);
    const itemsBySlug = await this.listItemsByTenant(merchant.slug, true, now);
    const items =
      itemsBySlug.length > 0 || !merchant.id || merchant.id === merchant.slug
        ? itemsBySlug
        : await this.listItemsByTenant(merchant.id, true, now);

    return {
      merchantId: tenantKey,
      merchantName: merchant.name,
      slug: merchant.slug,
      theme,
      items,
    };
  }

  async createSale(input: CreateSaleInput, now: Date = new Date()): Promise<Sale> {
    const saleMode = input.saleMode || 'catalog';
    const paymentMethod = input.paymentMethod;
    if (!['TRANSFER', 'CASH', 'CARD'].includes(paymentMethod)) {
      throw new BadRequestException('Invalid payment method');
    }

    const saleId = `sal-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`;
    const saleItems: SaleItem[] = [];
    let subtotalAmount = 0;
    let discountAmount = 0;
    let totalAmount = 0;

    if (saleMode === 'quick_amount') {
      const amount = Math.round(Number(input.quickAmount || 0));
      if (amount <= 0) {
        throw new BadRequestException('Quick sale amount must be greater than zero');
      }
      if (input.expectedTotalAmount !== undefined && amount !== input.expectedTotalAmount) {
        throw new BadRequestException(
          `El monto de la transferencia (Gs. ${input.expectedTotalAmount}) no coincide con el total de la venta (Gs. ${amount}).`,
        );
      }
      const conceptText = (input.concept || '').trim() || 'Cobro rápido en caja';
      subtotalAmount = amount;
      discountAmount = 0;
      totalAmount = amount;
      saleItems.push({
        id: `sli-${randomUUID().slice(0, 8)}-0`,
        saleId,
        itemId: null,
        itemName: conceptText,
        itemType: 'custom',
        unitPrice: amount,
        appliedDiscountPercent: 0,
        finalUnitPrice: amount,
        quantity: 1,
        lineTotal: amount,
      });
    } else {
      if (!input.items || input.items.length === 0) {
        throw new BadRequestException('At least one item is required for a catalog sale');
      }

      // Aggregate duplicate itemIds so stock validation cannot be bypassed via split lines
      const aggregatedMap = new Map<string, number>();
      for (const reqItem of input.items) {
        const qty = Math.floor(Number(reqItem.quantity || 0));
        if (qty <= 0) {
          throw new BadRequestException('Item quantity must be at least 1');
        }
        aggregatedMap.set(reqItem.itemId, (aggregatedMap.get(reqItem.itemId) || 0) + qty);
      }

      // First pass: validate all items, stock, and totals BEFORE mutating any stock
      const resolvedLines: Array<{
        view: CatalogItemView;
        quantity: number;
      }> = [];

      let previewSubtotal = 0;
      let previewTotal = 0;

      for (const [itemId, qty] of aggregatedMap.entries()) {
        const itemView = await this.findItemById(input.tenantId, itemId, now);
        if (!itemView || !itemView.isActive) {
          throw new NotFoundException(`Catalog item '${itemId}' not found`);
        }
        if (itemView.itemType === 'product' && itemView.stock !== null) {
          const currentStock = itemView.stock;
          if (currentStock < qty) {
            throw new BadRequestException(
              `Stock insuficiente para '${itemView.name}'. Disponible: ${currentStock}, solicitado: ${qty}`,
            );
          }
        }
        previewSubtotal += itemView.price * qty;
        previewTotal += itemView.effectivePrice * qty;
        resolvedLines.push({ view: itemView, quantity: qty });
      }

      if (input.expectedTotalAmount !== undefined && previewTotal !== input.expectedTotalAmount) {
        throw new BadRequestException(
          `El monto de la transferencia (Gs. ${input.expectedTotalAmount}) no coincide con el total de la venta (Gs. ${previewTotal}).`,
        );
      }

      // Second pass: deduct stock & build sale items
      for (let i = 0; i < resolvedLines.length; i++) {
        const { view, quantity } = resolvedLines[i];
        if (view.itemType === 'product' && view.stock !== null) {
          const newStock = Math.max(0, view.stock - quantity);
          if (this.isDbActive()) {
            const stockUpdate = await this.dbService!.query(
              `UPDATE catalog_items
               SET stock = stock - $1, updated_at = NOW()
               WHERE tenant_id = $2 AND id = $3 AND stock >= $1`,
              [quantity, input.tenantId, view.id],
            );
            if (!stockUpdate.rowCount || stockUpdate.rowCount === 0) {
              throw new BadRequestException(`Stock insuficiente para '${view.name}'`);
            }
          } else {
            const memItem = this.items.find((it) => it.tenantId === input.tenantId && it.id === view.id);
            if (memItem) {
              memItem.stock = newStock;
              memItem.updatedAt = now;
            }
          }
        }

        const lineSubtotal = view.price * quantity;
        const lineTotal = view.effectivePrice * quantity;
        subtotalAmount += lineSubtotal;
        discountAmount += lineSubtotal - lineTotal;
        totalAmount += lineTotal;

        saleItems.push({
          id: `sli-${randomUUID().slice(0, 8)}-${i}`,
          saleId,
          itemId: view.id,
          itemName: view.name,
          itemType: view.itemType,
          unitPrice: view.price,
          appliedDiscountPercent: view.effectiveDiscountPercent,
          finalUnitPrice: view.effectivePrice,
          quantity,
          lineTotal,
        });
      }
    }

    const sale: Sale = {
      id: saleId,
      tenantId: input.tenantId,
      cashierUserId: input.cashierUserId,
      cashierName: input.cashierName || 'Cajero',
      customerName: input.customerName ? input.customerName.trim() : null,
      customerRuc: input.customerRuc ? input.customerRuc.trim() : null,
      customerEmail: input.customerEmail ? input.customerEmail.trim() : null,
      concept: input.concept ? input.concept.trim() : null,
      saleMode,
      paymentMethod,
      transferId: input.transferId || null,
      subtotalAmount,
      discountAmount,
      totalAmount,
      items: saleItems,
      createdAt: now,
    };

    if (this.isDbActive()) {
      await this.dbService!.query(
        `INSERT INTO sales (
          id, tenant_id, cashier_user_id, cashier_name, customer_name, concept,
          sale_mode, payment_method, transfer_id, subtotal_amount, discount_amount, total_amount, created_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          sale.id,
          sale.tenantId,
          sale.cashierUserId,
          sale.cashierName,
          sale.customerName,
          sale.customerRuc,
          sale.customerEmail,
          sale.concept,
          sale.saleMode,
          sale.paymentMethod,
          sale.transferId,
          sale.subtotalAmount,
          sale.discountAmount,
          sale.totalAmount,
          sale.createdAt,
        ],
      );

      for (const si of sale.items) {
        await this.dbService!.query(
          `INSERT INTO sale_items (
            id, sale_id, item_id, item_name, item_type, unit_price,
            applied_discount_percent, final_unit_price, quantity, line_total
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            si.id,
            si.saleId,
            si.itemId,
            si.itemName,
            si.itemType,
            si.unitPrice,
            si.appliedDiscountPercent,
            si.finalUnitPrice,
            si.quantity,
            si.lineTotal,
          ],
        );
      }
      return sale;
    }

    this.sales.unshift(sale);
    return sale;
  }

  async listSalesByTenant(tenantId: string, limit = 100): Promise<Sale[]> {
    if (this.isDbActive()) {
      const sRes = await this.dbService!.query<SaleRow>(
        `SELECT * FROM sales WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [tenantId, limit],
      );
      const salesRows = sRes.rows || [];
      if (salesRows.length === 0) return [];

      const saleIds = salesRows.map((s) => s.id);
      const itemsRes = await this.dbService!.query<SaleItemRow>(
        `SELECT * FROM sale_items WHERE sale_id = ANY($1::varchar[])`,
        [saleIds],
      );
      const itemsBySale = new Map<string, SaleItem[]>();
      for (const row of itemsRes.rows || []) {
        const list = itemsBySale.get(row.sale_id) || [];
        list.push({
          id: row.id,
          saleId: row.sale_id,
          itemId: row.item_id,
          itemName: row.item_name,
          itemType: row.item_type,
          unitPrice: Number(row.unit_price),
          appliedDiscountPercent: Number(row.applied_discount_percent),
          finalUnitPrice: Number(row.final_unit_price),
          quantity: Number(row.quantity),
          lineTotal: Number(row.line_total),
        });
        itemsBySale.set(row.sale_id, list);
      }

      return salesRows.map((r) => ({
        id: r.id,
        tenantId: r.tenant_id,
        cashierUserId: r.cashier_user_id,
        cashierName: r.cashier_name,
        customerName: r.customer_name,
        customerRuc: r.customer_ruc,
        customerEmail: r.customer_email,
        concept: r.concept,
        saleMode: r.sale_mode,
        paymentMethod: r.payment_method,
        transferId: r.transfer_id,
        subtotalAmount: Number(r.subtotal_amount),
        discountAmount: Number(r.discount_amount),
        totalAmount: Number(r.total_amount),
        items: itemsBySale.get(r.id) || [],
        createdAt: new Date(r.created_at),
      }));
    }

    return this.sales.filter((s) => s.tenantId === tenantId).slice(0, limit);
  }

  private mapRowToBooking(row: CatalogBookingRow): CatalogBooking {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      itemId: row.item_id,
      itemName: row.item_name,
      bookingMode: row.booking_mode === 'days' ? 'days' : 'hours',
      startDate: row.start_date,
      endDate: row.end_date,
      timeSlot: row.time_slot,
      customerName: row.customer_name,
      customerPhone: row.customer_phone,
      notes: row.notes,
      status: row.status,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private parseIsoDate(dateStr: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw new BadRequestException(`Invalid date format '${dateStr}'. Expected YYYY-MM-DD`);
    }
    const parsed = new Date(`${dateStr}T12:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dateStr) {
      throw new BadRequestException(`Invalid calendar date '${dateStr}'`);
    }
    return parsed;
  }

  private enumerateOccupiedDates(startDate: string, endDate: string): string[] {
    const start = this.parseIsoDate(startDate);
    const end = this.parseIsoDate(endDate);
    if (end.getTime() < start.getTime()) {
      throw new BadRequestException('End date cannot be earlier than start date');
    }
    const dates: string[] = [];
    const cursor = new Date(start.getTime());
    if (startDate === endDate) {
      return [startDate];
    }
    // For multi-day stays (e.g. hotel check-in -> check-out), occupy nights [startDate, endDate)
    while (cursor.getTime() < end.getTime() && dates.length < 90) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }

  private isBookingOccupyingDate(b: { startDate: string; endDate: string }, targetDate: string): boolean {
    if (b.startDate === b.endDate) {
      return b.startDate === targetDate;
    }
    return b.startDate <= targetDate && targetDate < b.endDate;
  }

  async createBooking(input: CreateBookingInput): Promise<CatalogBooking> {
    const customerName = (input.customerName || '').trim();
    const customerPhone = (input.customerPhone || '').trim();
    if (!customerName) {
      throw new BadRequestException('Customer name is required');
    }
    if (!customerPhone) {
      throw new BadRequestException('Customer phone is required');
    }

    const item = await this.findItemById(input.tenantId, input.itemId);
    if (!item || !item.isActive) {
      throw new NotFoundException('Service not found or inactive');
    }
    if (item.itemType !== 'service' || !item.bookingEnabled) {
      throw new BadRequestException('This item does not accept bookings');
    }

    const startDate = (input.startDate || '').trim();
    const endDate = item.bookingMode === 'hours' ? startDate : (input.endDate || startDate).trim();
    const occupiedDates = this.enumerateOccupiedDates(startDate, endDate);

    const allowedDays = item.bookingDaysOfWeek
      .split(',')
      .map((d) => Number(d.trim()))
      .filter((n) => !Number.isNaN(n));

    for (const dateStr of occupiedDates) {
      const dayOfWeek = this.parseIsoDate(dateStr).getUTCDay();
      if (!allowedDays.includes(dayOfWeek)) {
        throw new BadRequestException(`Service is not available on ${dateStr}`);
      }
    }

    let timeSlot: string | null = null;
    if (item.bookingMode === 'hours') {
      timeSlot = (input.timeSlot || '').trim();
      if (!/^\d{2}:\d{2}$/.test(timeSlot)) {
        throw new BadRequestException('A valid time slot (HH:mm) is required');
      }
      if (item.bookingTimeSlots) {
        const configured = item.bookingTimeSlots.split(',').map((s) => s.trim());
        if (!configured.includes(timeSlot)) {
          throw new BadRequestException(`Time slot '${timeSlot}' is not enabled for this service`);
        }
      }
    }

    const now = new Date();
    const booking: CatalogBooking = {
      id: `bkg-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`,
      tenantId: input.tenantId,
      itemId: item.id,
      itemName: item.name,
      bookingMode: item.bookingMode,
      startDate,
      endDate,
      timeSlot,
      customerName,
      customerPhone,
      notes: input.notes ? input.notes.trim() : null,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    if (this.isDbActive()) {
      const existingRes = await this.dbService!.query<CatalogBookingRow>(
        `SELECT * FROM catalog_bookings
         WHERE tenant_id = $1 AND item_id = $2 AND status IN ('pending', 'confirmed')
           AND start_date <= $3 AND end_date >= $4`,
        [input.tenantId, item.id, endDate, startDate],
      );
      const active = (existingRes.rows || []).map((r) => this.mapRowToBooking(r));

      if (item.bookingMode === 'hours') {
        const count = active.filter((b) => b.startDate === startDate && b.timeSlot === timeSlot).length;
        if (count >= item.bookingMaxConcurrent) {
          throw new ConflictException('This time slot is already fully booked');
        }
      } else {
        for (const dateStr of occupiedDates) {
          const count = active.filter((b) => this.isBookingOccupyingDate(b, dateStr)).length;
          if (count >= item.bookingMaxConcurrent) {
            throw new ConflictException(`No availability remaining on ${dateStr}`);
          }
        }
      }

      const inserted = await this.dbService!.query<CatalogBookingRow>(
        `INSERT INTO catalog_bookings (
          id, tenant_id, item_id, item_name, booking_mode, start_date, end_date,
          time_slot, customer_name, customer_phone, notes, status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        RETURNING *`,
        [
          booking.id,
          booking.tenantId,
          booking.itemId,
          booking.itemName,
          booking.bookingMode,
          booking.startDate,
          booking.endDate,
          booking.timeSlot,
          booking.customerName,
          booking.customerPhone,
          booking.notes,
          booking.status,
          booking.createdAt,
          booking.updatedAt,
        ],
      );
      return this.mapRowToBooking(inserted.rows[0]);
    }

    const active = this.bookings.filter(
      (b) =>
        b.tenantId === input.tenantId &&
        b.itemId === item.id &&
        (b.status === 'pending' || b.status === 'confirmed'),
    );
    if (item.bookingMode === 'hours') {
      const count = active.filter((b) => b.startDate === startDate && b.timeSlot === timeSlot).length;
      if (count >= item.bookingMaxConcurrent) {
        throw new ConflictException('This time slot is already fully booked');
      }
    } else {
      for (const dateStr of occupiedDates) {
        const count = active.filter((b) => this.isBookingOccupyingDate(b, dateStr)).length;
        if (count >= item.bookingMaxConcurrent) {
          throw new ConflictException(`No availability remaining on ${dateStr}`);
        }
      }
    }

    this.bookings.unshift(booking);
    return booking;
  }

  async listBookingsByTenant(tenantId: string, limit = 100): Promise<CatalogBooking[]> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogBookingRow>(
        `SELECT * FROM catalog_bookings WHERE tenant_id = $1 ORDER BY start_date ASC, created_at DESC LIMIT $2`,
        [tenantId, limit],
      );
      return (res.rows || []).map((r) => this.mapRowToBooking(r));
    }

    return this.bookings
      .filter((b) => b.tenantId === tenantId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  async updateBookingStatus(
    tenantId: string,
    bookingId: string,
    status: BookingStatus,
  ): Promise<CatalogBooking | null> {
    const now = new Date();
    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogBookingRow>(
        `UPDATE catalog_bookings
         SET status = $1, updated_at = $2
         WHERE tenant_id = $3 AND id = $4
         RETURNING *`,
        [status, now, tenantId, bookingId],
      );
      if (!res.rows || res.rows.length === 0) return null;
      return this.mapRowToBooking(res.rows[0]);
    }

    const found = this.bookings.find((b) => b.tenantId === tenantId && b.id === bookingId);
    if (!found) return null;
    found.status = status;
    found.updatedAt = now;
    return found;
  }

  async getBookingAvailability(
    tenantId: string,
    itemId: string,
    fromDate: string,
    toDate: string,
  ): Promise<BookingSlotCount[]> {
    this.parseIsoDate(fromDate);
    this.parseIsoDate(toDate);

    let active: CatalogBooking[];
    if (this.isDbActive()) {
      const res = await this.dbService!.query<CatalogBookingRow>(
        `SELECT * FROM catalog_bookings
         WHERE tenant_id = $1 AND item_id = $2 AND status IN ('pending', 'confirmed')
           AND start_date <= $3 AND end_date >= $4`,
        [tenantId, itemId, toDate, fromDate],
      );
      active = (res.rows || []).map((r) => this.mapRowToBooking(r));
    } else {
      active = this.bookings.filter(
        (b) =>
          b.tenantId === tenantId &&
          b.itemId === itemId &&
          (b.status === 'pending' || b.status === 'confirmed') &&
          b.startDate <= toDate &&
          b.endDate >= fromDate,
      );
    }

    const counts = new Map<string, BookingSlotCount>();
    for (const b of active) {
      if (b.bookingMode === 'hours') {
        const key = `${b.startDate}|${b.timeSlot || ''}`;
        const cur = counts.get(key);
        if (cur) cur.bookedCount += 1;
        else counts.set(key, { date: b.startDate, timeSlot: b.timeSlot, bookedCount: 1 });
      } else {
        const dates = this.enumerateOccupiedDates(b.startDate, b.endDate);
        for (const d of dates) {
          if (d < fromDate || d > toDate) continue;
          const key = `${d}|`;
          const cur = counts.get(key);
          if (cur) cur.bookedCount += 1;
          else counts.set(key, { date: d, timeSlot: null, bookedCount: 1 });
        }
      }
    }
    return Array.from(counts.values());
  }
}
