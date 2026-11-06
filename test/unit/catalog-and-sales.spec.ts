import { DDL_SCHEMA_SQL } from '../../src/infrastructure/database/schema';
import { CatalogRepository } from '../../src/infrastructure/repositories/catalog.repository';
import { InMemoryMerchantRepository } from '../../src/infrastructure/repositories/in-memory.repositories';

describe('Catalog, Inventory, Time Discounts & POS Sales (T1)', () => {
  let merchantRepo: InMemoryMerchantRepository;
  let catalogRepo: CatalogRepository;

  beforeEach(() => {
    merchantRepo = new InMemoryMerchantRepository();
    catalogRepo = new CatalogRepository(undefined, merchantRepo);
  });

  it('defines PostgreSQL tables for catalog_items, sales, sale_items and catalog_theme', () => {
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS catalog_items');
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS sales');
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS sale_items');
    expect(DDL_SCHEMA_SQL).toContain('ALTER TABLE merchants ADD COLUMN IF NOT EXISTS catalog_theme');
  });

  it('creates products with stock and services with optional time-based discounts (hours & days)', async () => {
    const baseTime = new Date('2026-11-05T14:00:00Z'); // Thursday (day 4)

    const product = await catalogRepo.createItem(
      {
        tenantId: 'copy-shop-impresiones',
        itemType: 'product',
        name: 'Resma A4 75g',
        price: 40000,
        stock: 15,
        discountPercent: 10,
        discountType: 'hours',
        discountDurationHours: 4,
      },
      baseTime,
    );

    expect(product.itemType).toBe('product');
    expect(product.stock).toBe(15);
    expect(product.isDiscountActive).toBe(true);
    expect(product.effectiveDiscountPercent).toBe(10);
    expect(product.effectivePrice).toBe(36000);

    // 5 hours later, the 4-hour discount expires automatically
    const afterExpiry = new Date('2026-11-05T19:01:00Z');
    const expiredView = await catalogRepo.findItemById('copy-shop-impresiones', product.id, afterExpiry);
    expect(expiredView?.isDiscountActive).toBe(false);
    expect(expiredView?.effectivePrice).toBe(40000);

    // Service with day-based discount on Thursday (4)
    const service = await catalogRepo.createItem(
      {
        tenantId: 'copy-shop-impresiones',
        itemType: 'service',
        name: 'Anillado y Plastificado',
        price: 20000,
        discountPercent: 25,
        discountType: 'days',
        discountDays: '4',
        discountDurationDays: 7,
      },
      baseTime,
    );

    expect(service.itemType).toBe('service');
    expect(service.stock).toBeNull();
    expect(service.isDiscountActive).toBe(true);
    expect(service.effectivePrice).toBe(15000);
  });

  it('records a catalog sale, deducts product stock atomically, and tracks cashier and payment method', async () => {
    const now = new Date('2026-11-05T15:00:00Z');
    const prod = await catalogRepo.createItem(
      {
        tenantId: 'copy-shop-impresiones',
        itemType: 'product',
        name: 'Pendrive 32GB',
        price: 50000,
        stock: 5,
        discountPercent: 20,
        discountType: 'hours',
        discountDurationHours: 2,
      },
      now,
    );

    const serv = await catalogRepo.createItem(
      {
        tenantId: 'copy-shop-impresiones',
        itemType: 'service',
        name: 'Instalación de Software',
        price: 80000,
      },
      now,
    );

    const sale = await catalogRepo.createSale(
      {
        tenantId: 'copy-shop-impresiones',
        cashierUserId: 'usr-cashier-1',
        cashierName: 'María Cajera',
        customerName: 'Juan Pérez',
        saleMode: 'catalog',
        paymentMethod: 'TRANSFER',
        transferId: 'tx-123',
        items: [
          { itemId: prod.id, quantity: 2 },
          { itemId: serv.id, quantity: 1 },
        ],
      },
      now,
    );

    // 2 * 40,000 (discounted) + 1 * 80,000 = 160,000
    expect(sale.subtotalAmount).toBe(180000);
    expect(sale.discountAmount).toBe(20000);
    expect(sale.totalAmount).toBe(160000);
    expect(sale.cashierName).toBe('María Cajera');
    expect(sale.paymentMethod).toBe('TRANSFER');
    expect(sale.transferId).toBe('tx-123');

    const updatedProd = await catalogRepo.findItemById('copy-shop-impresiones', prod.id, now);
    expect(updatedProd?.stock).toBe(3);

    // Attempting to buy more than remaining stock throws BadRequestException
    await expect(
      catalogRepo.createSale(
        {
          tenantId: 'copy-shop-impresiones',
          cashierUserId: 'usr-cashier-1',
          cashierName: 'María Cajera',
          saleMode: 'catalog',
          paymentMethod: 'CASH',
          items: [{ itemId: prod.id, quantity: 4 }],
        },
        now,
      ),
    ).rejects.toThrow(/Stock insuficiente/);
  });

  it('records a quick amount sale (Monto Libre + Qué pasó) and lists tenant movements', async () => {
    const sale = await catalogRepo.createSale({
      tenantId: 'copy-shop-impresiones',
      cashierUserId: 'usr-cashier-2',
      cashierName: 'Carlos Turno Tarde',
      customerName: 'Cliente Mostrador',
      concept: 'Impresión urgente 50 páginas color',
      saleMode: 'quick_amount',
      paymentMethod: 'CASH',
      quickAmount: 75000,
    });

    expect(sale.saleMode).toBe('quick_amount');
    expect(sale.totalAmount).toBe(75000);
    expect(sale.concept).toBe('Impresión urgente 50 páginas color');
    expect(sale.items[0].itemName).toBe('Impresión urgente 50 páginas color');

    const movements = await catalogRepo.listSalesByTenant('copy-shop-impresiones');
    expect(movements).toHaveLength(1);
    expect(movements[0].cashierName).toBe('Carlos Turno Tarde');
  });

  it('serves public catalog by merchant slug with custom color palette and photo/no-photo items', async () => {
    await catalogRepo.setCatalogTheme('copy-shop-impresiones', 'indigo');
    await catalogRepo.createItem({
      tenantId: 'copy-shop-impresiones',
      itemType: 'product',
      name: 'Cuaderno Universitario',
      price: 25000,
      stock: 12,
      imageUrl: 'https://example.com/cuaderno.jpg',
    });
    await catalogRepo.createItem({
      tenantId: 'copy-shop-impresiones',
      itemType: 'service',
      name: 'Diseño de Flyer',
      price: 60000,
      imageUrl: null,
    });

    const publicCatalog = await catalogRepo.getPublicCatalogBySlug('copy-shop-impresiones');
    expect(publicCatalog).not.toBeNull();
    expect(publicCatalog?.merchantName).toBe('Copy Shop Impresiones');
    expect(publicCatalog?.theme).toBe('indigo');
    expect(publicCatalog?.items).toHaveLength(2);
  });
});
