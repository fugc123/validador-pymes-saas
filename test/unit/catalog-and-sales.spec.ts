import { DDL_SCHEMA_SQL } from '../../src/infrastructure/database/schema';
import { CatalogRepository } from '../../src/infrastructure/repositories/catalog.repository';
import {
  InMemoryMerchantRepository,
  InMemoryTransferRepository,
  InMemoryUserRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';
import {
  CatalogController,
  PublicCatalogController,
} from '../../src/presentation/controllers/catalog.controller';
import { ClaimTransferUseCase } from '../../src/core/application/use-cases/transfers/claim-transfer.use-case';
import { TenantContext } from '../../src/presentation/interceptors/tenant-context.service';
import { Transfer } from '../../src/core/domain/entities/transfer.entity';

describe('Catalog, Inventory, Time Discounts & POS Sales (T1 & T2)', () => {
  let merchantRepo: InMemoryMerchantRepository;
  let userRepo: InMemoryUserRepository;
  let transferRepo: InMemoryTransferRepository;
  let catalogRepo: CatalogRepository;
  let claimUseCase: ClaimTransferUseCase;
  let catalogController: CatalogController;
  let publicController: PublicCatalogController;

  beforeEach(() => {
    merchantRepo = new InMemoryMerchantRepository();
    userRepo = new InMemoryUserRepository();
    transferRepo = new InMemoryTransferRepository();
    catalogRepo = new CatalogRepository(undefined, merchantRepo);
    claimUseCase = new ClaimTransferUseCase(transferRepo);
    catalogController = new CatalogController(
      catalogRepo,
      userRepo,
      transferRepo,
      claimUseCase,
    );
    publicController = new PublicCatalogController(catalogRepo);
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

  it('executes CatalogController and PublicCatalogController flows including TRANSFER claiming', async () => {
    await TenantContext.run(
      { tenantId: 'copy-shop-impresiones', userId: 'usr-alcarazviole', role: 'MERCHANT_OWNER' },
      async () => {
        await catalogController.updateCatalogTheme({ theme: 'rose' });
        const created = await catalogController.createCatalogItem({
          itemType: 'product',
          name: 'Carpeta Archivadora',
          price: 30000,
          stock: 10,
        });

        // Ingest a pending transfer of 60,000 Gs
        const savedTx = await transferRepo.save(
          new Transfer({
            id: 'tx-pos-sale-1',
            tenantId: 'copy-shop-impresiones',
            operationId: 'OP-999111',
            operationDate: new Date().toISOString(),
            payerName: 'Lucia Benitez',
            payerBank: 'UENO',
            amount: 60000,
            status: 'pending',
          }),
        );

        const sale = await catalogController.recordCashierSale({
          customerName: 'Lucia Benitez',
          saleMode: 'catalog',
          paymentMethod: 'TRANSFER',
          transferId: savedTx.id,
          items: [{ itemId: created.id, quantity: 2 }],
        });

        expect(sale.totalAmount).toBe(60000);
        expect(sale.transferId).toBe(savedTx.id);

        // Verify transfer was claimed atomically
        const updatedTx = await transferRepo.findById('copy-shop-impresiones', savedTx.id!);
        expect(updatedTx?.status).toBe('claimed');

        // Anti-Replay: attempting to reuse the already-claimed transfer must throw ConflictException without deducting stock
        await expect(
          catalogController.recordCashierSale({
            customerName: 'Replay Attacker',
            saleMode: 'catalog',
            paymentMethod: 'TRANSFER',
            transferId: savedTx.id,
            items: [{ itemId: created.id, quantity: 1 }],
          }),
        ).rejects.toThrow(/Anti-Replay/);

        // Duplicate itemId lines exceeding stock must be rejected
        await expect(
          catalogController.recordCashierSale({
            customerName: 'Split Line Buyer',
            saleMode: 'catalog',
            paymentMethod: 'CASH',
            items: [
              { itemId: created.id, quantity: 5 },
              { itemId: created.id, quantity: 5 },
            ],
          }),
        ).rejects.toThrow(/Stock insuficiente/);

        // Verify merchant sales summary
        const merchantSales = await catalogController.getMerchantSales();
        expect(merchantSales.summary.totalSalesCount).toBe(1);
        expect(merchantSales.summary.totalRevenue).toBe(60000);
        expect(merchantSales.summary.transferSalesCount).toBe(1);
      },
    );

    const storefront = await publicController.getPublicStorefront('copy-shop-impresiones');
    expect(storefront.theme).toBe('rose');
    expect(storefront.items[0].stock).toBe(8);
  });

  it('persists optional customerName, customerRuc, and customerEmail when provided on sale', async () => {
    const sale = await catalogRepo.createSale({
      tenantId: 'copy-shop-impresiones',
      cashierUserId: 'usr-cashier-1',
      cashierName: 'María Cajera',
      customerName: 'Empresa Ejemplo S.A.',
      customerRuc: '80012345-6',
      customerEmail: 'facturacion@ejemplo.com.py',
      concept: 'Servicio de impresión corporativa',
      saleMode: 'quick_amount',
      paymentMethod: 'CASH',
      quickAmount: 150000,
    });

    expect(sale.customerName).toBe('Empresa Ejemplo S.A.');
    expect(sale.customerRuc).toBe('80012345-6');
    expect(sale.customerEmail).toBe('facturacion@ejemplo.com.py');

    const sales = await catalogRepo.listSalesByTenant('copy-shop-impresiones');
    expect(sales[0].customerRuc).toBe('80012345-6');
    expect(sales[0].customerEmail).toBe('facturacion@ejemplo.com.py');
  });

  it('allows selling a product without stock control (stock = null, e.g. restaurant or hotel)', async () => {
    const burger = await catalogRepo.createItem({
      tenantId: 'restaurante-demo',
      itemType: 'product',
      name: 'Hamburguesa Completa',
      price: 35000,
      stock: null,
    });

    expect(burger.stock).toBeNull();

    const sale = await catalogRepo.createSale({
      tenantId: 'restaurante-demo',
      cashierUserId: 'usr-cashier-1',
      cashierName: 'Caja 1',
      saleMode: 'catalog',
      paymentMethod: 'CASH',
      items: [{ itemId: burger.id, quantity: 4 }],
    });

    expect(sale.totalAmount).toBe(140000);
    const items = await catalogRepo.listItemsByTenant('restaurante-demo');
    expect(items[0].stock).toBeNull();
  });

  it('supports hourly service bookings with day-of-week and slot conflict validation', async () => {
    const nextWeekdayIso = (targetDay: number): string => {
      const d = new Date(Date.now() + 24 * 3600 * 1000);
      while (d.getUTCDay() !== targetDay) {
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return d.toISOString().slice(0, 10);
    };
    const nextMonday = nextWeekdayIso(1);
    const nextSunday = nextWeekdayIso(0);

    const haircut = await catalogRepo.createItem({
      tenantId: 'barberia-demo',
      itemType: 'service',
      name: 'Corte Clásico',
      price: 50000,
      bookingEnabled: true,
      bookingMode: 'hours',
      bookingDaysOfWeek: '1,2,3,4,5', // Mon-Fri
      bookingTimeSlots: '09:00,10:00,11:00',
      bookingMaxConcurrent: 1,
    });

    const booking = await catalogRepo.createBooking({
      tenantId: 'barberia-demo',
      itemId: haircut.id,
      startDate: nextMonday,
      timeSlot: '09:00',
      customerName: 'Juan Pérez',
      customerPhone: '0981123456',
    });
    expect(booking.status).toBe('pending');
    expect(booking.customerPhone).toBe('0981123456');

    // Same slot on same day should reject (maxConcurrent = 1)
    await expect(
      catalogRepo.createBooking({
        tenantId: 'barberia-demo',
        itemId: haircut.id,
        startDate: nextMonday,
        timeSlot: '09:00',
        customerName: 'Pedro',
        customerPhone: '0982000111',
      }),
    ).rejects.toThrow(/already fully booked/i);

    // Sunday (day 0, not in Mon-Fri) should reject
    await expect(
      catalogRepo.createBooking({
        tenantId: 'barberia-demo',
        itemId: haircut.id,
        startDate: nextSunday,
        timeSlot: '09:00',
        customerName: 'Ana',
        customerPhone: '0983000222',
      }),
    ).rejects.toThrow(/not available/i);
  });

  it('supports multi-day hotel bookings and enforces capacity & tenant isolation', async () => {
    const addDays = (days: number): string =>
      new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const d1 = addDays(4);
    const d2 = addDays(5);
    const d3 = addDays(6);
    const d4 = addDays(7);

    const room = await catalogRepo.createItem({
      tenantId: 'hotel-asuncion',
      itemType: 'service',
      name: 'Habitación Doble',
      price: 280000,
      bookingEnabled: true,
      bookingMode: 'days',
      bookingDaysOfWeek: '0,1,2,3,4,5,6',
      bookingMaxConcurrent: 1,
    });

    const stay = await catalogRepo.createBooking({
      tenantId: 'hotel-asuncion',
      itemId: room.id,
      startDate: d1,
      endDate: d3, // nights d1 and d2
      customerName: 'María Gómez',
      customerPhone: '0971555666',
    });
    expect(stay.bookingMode).toBe('days');

    // Overlapping night d2 -> rejected
    await expect(
      catalogRepo.createBooking({
        tenantId: 'hotel-asuncion',
        itemId: room.id,
        startDate: d2,
        endDate: d4,
        customerName: 'Carlos',
        customerPhone: '0971000999',
      }),
    ).rejects.toThrow(/no availability/i);

    // Check-in on checkout date (d3) -> allowed
    const nextStay = await catalogRepo.createBooking({
      tenantId: 'hotel-asuncion',
      itemId: room.id,
      startDate: d3,
      endDate: d4,
      customerName: 'Lucía',
      customerPhone: '0985111222',
    });
    expect(nextStay.startDate).toBe(d3);

    // Tenant isolation: another tenant cannot see or update hotel-asuncion's bookings
    expect(await catalogRepo.listBookingsByTenant('otro-comercio')).toHaveLength(0);
    expect(await catalogRepo.updateBookingStatus('otro-comercio', stay.id, 'confirmed')).toBeNull();
    const confirmed = await catalogRepo.updateBookingStatus('hotel-asuncion', stay.id, 'confirmed');
    expect(confirmed?.status).toBe('confirmed');
  });

  it('rejects same-day bookings whose time slot has already passed in Paraguay time (UTC-3)', async () => {
    // 2026-11-24T17:30:00.000Z === 2026-11-24 14:30 in Paraguay (UTC-3), Tuesday (day 2)
    const fixedNow = new Date('2026-11-24T17:30:00.000Z');

    const service = await catalogRepo.createItem({
      tenantId: 'barberia-hoy',
      itemType: 'service',
      name: 'Corte Express',
      price: 45000,
      bookingEnabled: true,
      bookingMode: 'hours',
      bookingDaysOfWeek: '0,1,2,3,4,5,6',
      bookingTimeSlots: '09:00,14:00,14:30,15:00,17:00',
      bookingMaxConcurrent: 1,
    });

    // Past time slot today -> rejected
    await expect(
      catalogRepo.createBooking(
        {
          tenantId: 'barberia-hoy',
          itemId: service.id,
          startDate: '2026-11-24',
          timeSlot: '09:00',
          customerName: 'Pedro',
          customerPhone: '0981111222',
        },
        fixedNow,
      ),
    ).rejects.toThrow(/ya pasó hoy/i);

    // Exact current HH:mm today -> rejected
    await expect(
      catalogRepo.createBooking(
        {
          tenantId: 'barberia-hoy',
          itemId: service.id,
          startDate: '2026-11-24',
          timeSlot: '14:30',
          customerName: 'Pedro',
          customerPhone: '0981111222',
        },
        fixedNow,
      ),
    ).rejects.toThrow(/ya pasó hoy/i);

    // Past date -> rejected
    await expect(
      catalogRepo.createBooking(
        {
          tenantId: 'barberia-hoy',
          itemId: service.id,
          startDate: '2026-11-23',
          timeSlot: '17:00',
          customerName: 'Pedro',
          customerPhone: '0981111222',
        },
        fixedNow,
      ),
    ).rejects.toThrow(/fecha pasada/i);

    // Future slot later today -> accepted
    const validToday = await catalogRepo.createBooking(
      {
        tenantId: 'barberia-hoy',
        itemId: service.id,
        startDate: '2026-11-24',
        timeSlot: '15:00',
        customerName: 'Pedro',
        customerPhone: '0981111222',
      },
      fixedNow,
    );
    expect(validToday.status).toBe('pending');
    expect(validToday.timeSlot).toBe('15:00');
  });

  it('allows CASHIER role to view availability, create counter bookings (e.g. day after tomorrow), update status, and preserves tenant isolation', async () => {
    const pyToday = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const dayAfterTomorrow = new Date(new Date(`${pyToday}T12:00:00.000Z`).getTime() + 2 * 86400_000)
      .toISOString()
      .slice(0, 10);

    const svc = await catalogRepo.createItem({
      tenantId: 'barberia-caja',
      itemType: 'service',
      name: 'Barba + Corte',
      price: 65000,
      bookingEnabled: true,
      bookingMode: 'hours',
      bookingDaysOfWeek: '0,1,2,3,4,5,6',
      bookingTimeSlots: '10:00,11:00,15:00',
      bookingMaxConcurrent: 1,
    });

    await TenantContext.run(
      { tenantId: 'barberia-caja', userId: 'usr-cajero-1', role: 'CASHIER' },
      async () => {
        const initialAvail = await catalogController.getCashierBookingAvailability(
          svc.id,
          dayAfterTomorrow,
          dayAfterTomorrow,
        );
        expect(initialAvail).toEqual([]);

        const created = await catalogController.createCashierBooking({
          itemId: svc.id,
          startDate: dayAfterTomorrow,
          endDate: dayAfterTomorrow,
          timeSlot: '10:00',
          customerName: 'Luis Mostrador',
          customerPhone: '0981555777',
          notes: 'Viene en 2 días',
        });
        expect(created.tenantId).toBe('barberia-caja');
        expect(created.status).toBe('pending');

        const listRes = await catalogController.getCashierBookings();
        expect(listRes.bookings).toHaveLength(1);
        expect(listRes.bookings[0].startDate).toBe(dayAfterTomorrow);

        const confirmed = await catalogController.updateCashierBookingStatus(created.id, {
          status: 'confirmed',
        });
        expect(confirmed.status).toBe('confirmed');

        const afterAvail = await catalogController.getCashierBookingAvailability(
          svc.id,
          dayAfterTomorrow,
          dayAfterTomorrow,
        );
        expect(afterAvail).toEqual([
          { date: dayAfterTomorrow, timeSlot: '10:00', bookedCount: 1 },
        ]);
      },
    );

    // Other tenant cashier cannot list or update barberia-caja bookings
    await TenantContext.run(
      { tenantId: 'otro-comercio', userId: 'usr-cajero-2', role: 'CASHIER' },
      async () => {
        const otherList = await catalogController.getCashierBookings();
        expect(otherList.bookings).toHaveLength(0);
      },
    );
  });
});
