export type CatalogItemType = 'product' | 'service';
export type DiscountTimeType = 'none' | 'hours' | 'days';
export type SalePaymentMethod = 'TRANSFER' | 'CASH' | 'CARD';
export type SaleMode = 'catalog' | 'quick_amount';
export type CatalogThemePalette = 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan' | 'violet';
export type BookingMode = 'hours' | 'days';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';

export const ALLOWED_CATALOG_THEMES: CatalogThemePalette[] = [
  'emerald',
  'indigo',
  'rose',
  'amber',
  'cyan',
  'violet',
];

export interface CatalogItem {
  id: string;
  tenantId: string;
  itemType: CatalogItemType;
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  imageUrl: string | null;
  discountPercent: number;
  discountType: DiscountTimeType;
  discountEndsAt: Date | null;
  discountDays: string | null;
  isActive: boolean;
  bookingEnabled: boolean;
  bookingMode: BookingMode;
  bookingDaysOfWeek: string;
  bookingTimeSlots: string | null;
  bookingMaxConcurrent: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogItemView extends CatalogItem {
  isDiscountActive: boolean;
  effectiveDiscountPercent: number;
  effectivePrice: number;
}

export interface CreateCatalogItemInput {
  tenantId: string;
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
  discountEndsAt?: Date | null;
  bookingEnabled?: boolean;
  bookingMode?: BookingMode;
  bookingDaysOfWeek?: string | null;
  bookingTimeSlots?: string | null;
  bookingMaxConcurrent?: number;
}

export interface UpdateCatalogItemInput {
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
  discountEndsAt?: Date | null;
  isActive?: boolean;
  bookingEnabled?: boolean;
  bookingMode?: BookingMode;
  bookingDaysOfWeek?: string | null;
  bookingTimeSlots?: string | null;
  bookingMaxConcurrent?: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  itemId: string | null;
  itemName: string;
  itemType: 'product' | 'service' | 'custom';
  unitPrice: number;
  appliedDiscountPercent: number;
  finalUnitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  tenantId: string;
  cashierUserId: string;
  cashierName: string;
  customerName: string | null;
  customerRuc: string | null;
  customerEmail: string | null;
  concept: string | null;
  saleMode: SaleMode;
  paymentMethod: SalePaymentMethod;
  transferId: string | null;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: SaleItem[];
  createdAt: Date;
}

export interface CreateSaleInput {
  tenantId: string;
  cashierUserId: string;
  cashierName: string;
  customerName?: string | null;
  customerRuc?: string | null;
  customerEmail?: string | null;
  concept?: string | null;
  saleMode: SaleMode;
  paymentMethod: SalePaymentMethod;
  transferId?: string | null;
  quickAmount?: number;
  expectedTotalAmount?: number;
  items?: Array<{
    itemId: string;
    quantity: number;
  }>;
}

export function evaluateCatalogItemView(item: CatalogItem, now: Date = new Date()): CatalogItemView {
  let isDiscountActive = false;

  if (item.discountPercent > 0 && item.discountType !== 'none') {
    const notExpired = !item.discountEndsAt || item.discountEndsAt.getTime() > now.getTime();

    if (item.discountType === 'hours') {
      isDiscountActive = Boolean(item.discountEndsAt && item.discountEndsAt.getTime() > now.getTime());
    } else if (item.discountType === 'days') {
      const daysCsv = (item.discountDays || '').trim();
      if (daysCsv.length > 0) {
        const allowedDays = daysCsv
          .split(',')
          .map((d) => Number(d.trim()))
          .filter((n) => !Number.isNaN(n));
        const currentDay = now.getDay(); // 0 = Sun ... 6 = Sat
        isDiscountActive = allowedDays.includes(currentDay) && notExpired;
      } else {
        isDiscountActive = Boolean(item.discountEndsAt && item.discountEndsAt.getTime() > now.getTime());
      }
    }
  }

  const effectiveDiscountPercent = isDiscountActive ? item.discountPercent : 0;
  const effectivePrice =
    effectiveDiscountPercent > 0
      ? Math.max(0, Math.round(item.price * (1 - effectiveDiscountPercent / 100)))
      : item.price;

  return {
    ...item,
    isDiscountActive,
    effectiveDiscountPercent,
    effectivePrice,
  };
}

export interface CatalogBooking {
  id: string;
  tenantId: string;
  itemId: string;
  itemName: string;
  bookingMode: BookingMode;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  timeSlot: string | null; // HH:mm for 'hours' mode
  customerName: string;
  customerPhone: string;
  notes: string | null;
  status: BookingStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateBookingInput {
  tenantId: string;
  itemId: string;
  startDate: string;
  endDate?: string;
  timeSlot?: string | null;
  customerName: string;
  customerPhone: string;
  notes?: string | null;
}

export interface BookingSlotCount {
  date: string;
  timeSlot: string | null;
  bookedCount: number;
}

export interface ICatalogRepository {
  listItemsByTenant(tenantId: string, onlyActive?: boolean): Promise<CatalogItemView[]>;
  findItemById(tenantId: string, itemId: string): Promise<CatalogItemView | null>;
  createItem(input: CreateCatalogItemInput): Promise<CatalogItemView>;
  updateItem(tenantId: string, itemId: string, input: UpdateCatalogItemInput): Promise<CatalogItemView | null>;
  deleteItem(tenantId: string, itemId: string): Promise<boolean>;
  getCatalogTheme(tenantId: string): Promise<CatalogThemePalette>;
  setCatalogTheme(tenantId: string, theme: CatalogThemePalette): Promise<CatalogThemePalette>;
  getPublicCatalogBySlug(slug: string): Promise<{
    merchantId: string;
    merchantName: string;
    slug: string;
    theme: CatalogThemePalette;
    items: CatalogItemView[];
  } | null>;
  createSale(input: CreateSaleInput, now?: Date): Promise<Sale>;
  listSalesByTenant(tenantId: string, limit?: number): Promise<Sale[]>;
  createBooking(input: CreateBookingInput): Promise<CatalogBooking>;
  listBookingsByTenant(tenantId: string, limit?: number): Promise<CatalogBooking[]>;
  updateBookingStatus(tenantId: string, bookingId: string, status: BookingStatus): Promise<CatalogBooking | null>;
  getBookingAvailability(tenantId: string, itemId: string, fromDate: string, toDate: string): Promise<BookingSlotCount[]>;
}
