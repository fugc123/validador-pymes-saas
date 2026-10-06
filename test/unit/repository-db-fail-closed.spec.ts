import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { Transfer } from '../../src/core/domain/entities/transfer.entity';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import { MerchantRequest } from '../../src/core/domain/entities/merchant-request.entity';
import { MerchantMembership } from '../../src/core/domain/entities/merchant-membership.entity';
import { Subscription } from '../../src/core/domain/entities/subscription.entity';
import { PaymentReport } from '../../src/core/application/ports/onboarding.ports';
import {
  InMemoryMerchantRepository,
  InMemoryMerchantRequestRepository,
  InMemoryMembershipRepository,
  InMemoryPaymentReportRepository,
  InMemorySubscriptionRepository,
  InMemoryTransferRepository,
  InMemoryUserRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';

/**
 * In configured database mode every repository adapter must fail closed:
 * - read errors propagate instead of returning seeded/in-memory data
 * - an empty SELECT is a definitive null/[] result, never a memory fallback
 * - write errors and zero-row writes reject instead of reporting a persisted
 *   mutation that only happened in memory
 * - a failed or zero-row claim can never be reported as a successful claim
 * Memory mode (no DatabaseService configured) keeps using the in-memory arrays.
 */

type QueryResultLike = { rows: any[]; rowCount: number };

const EMPTY: QueryResultLike = { rows: [], rowCount: 0 };
const READ_FAILURE = new Error('connection terminated unexpectedly');
const WRITE_FAILURE = new Error('connection reset by peer');

const MERCHANT_UUID = '11111111-2222-3333-4444-555555555555';
const USER_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const TRANSFER_UUID = '99999999-8888-7777-6666-555555555555';
const REQUEST_UUID = '44444444-5555-6666-7777-888888888888';

/** Builds a repository wired to a stubbed database service in database mode. */
function dbMode(query: jest.Mock) {
  return { isMemoryMode: false, query } as unknown as DatabaseService;
}

function failingQuery(error: Error) {
  return jest.fn().mockRejectedValue(error);
}

function pendingTransfer(overrides: { id?: string; operationId?: string } = {}): Transfer {
  return new Transfer({
    id: overrides.id ?? 'tr-test-1',
    tenantId: 'copy-shop-impresiones',
    operationId: overrides.operationId ?? 'OP-1001',
    operationDate: '2026-10-05',
    payerName: 'Maria Lopez',
    amount: 150000,
    status: 'pending',
  });
}

function transferRow(overrides: Record<string, unknown> = {}): QueryResultLike['rows'][number] {
  return {
    id: TRANSFER_UUID,
    tenant_id: MERCHANT_UUID,
    operation_id: 'OP-1001',
    receipt_number: null,
    operation_date: '2026-10-05',
    payer_name: 'Maria Lopez',
    payer_account: null,
    payer_bank: 'Itau',
    currency: 'PYG',
    amount: 150000,
    credit_account: null,
    concept: 'Pago de prueba',
    raw_body: null,
    status: 'pending',
    claimed_at: null,
    claimed_by_user_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Saves one transfer through a successful database write so the memory cache is populated. */
async function seededTransferRepo() {
  const query = jest.fn(async (sql: string) => {
    if (/SELECT id FROM merchants/.test(sql)) return { rows: [{ id: MERCHANT_UUID }], rowCount: 1 };
    if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: USER_UUID }], rowCount: 1 };
    if (/INSERT INTO transfers/.test(sql)) return { rows: [transferRow()], rowCount: 1 };
    return EMPTY;
  });
  const repo = new InMemoryTransferRepository(dbMode(query));
  await repo.save(pendingTransfer());
  return { repo, query };
}

function newMembership() {
  return new MerchantMembership({
    id: 'mem-test-1',
    userId: USER_UUID,
    merchantId: 'copy-shop-impresiones',
    role: 'CASHIER',
    isActive: true,
  });
}

function newSubscription() {
  return new Subscription({
    id: 'sub-test-1',
    tenantId: 'copy-shop-impresiones',
    status: 'trial',
    currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
}

function newRequest(id?: string) {
  return new MerchantRequest({
    id,
    businessName: 'Kiosko Prueba',
    ownerName: 'Owner Prueba',
    email: 'owner@prueba.test',
    phone: '0981 000 000',
    city: 'Asuncion',
  });
}

function newPaymentReport() {
  return new PaymentReport({
    id: 'rep-test-1',
    tenantId: 'kiosko-san-roque',
    reportedByUserId: 'usr-franco-owner',
    payerName: 'Franco Galeano',
    amount: 150000,
  });
}

describe('Repository adapters fail closed in database mode', () => {
  describe('reads never fall back to seeded or in-memory data', () => {
    it('UserRepository.findByEmail propagates a read failure instead of the seeded account', async () => {
      const repo = new InMemoryUserRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findByEmail('admin@validador.com')).rejects.toBe(READ_FAILURE);
    });

    it('UserRepository.findByEmail returns null for an empty SELECT instead of the seeded account', async () => {
      const repo = new InMemoryUserRepository(dbMode(jest.fn().mockResolvedValue(EMPTY)));

      expect(await repo.findByEmail('admin@validador.com')).toBeNull();
    });

    it('UserRepository.findById propagates a read failure instead of the seeded account', async () => {
      const repo = new InMemoryUserRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findById('usr-admin-1')).rejects.toBe(READ_FAILURE);
    });

    it('MerchantRepository.findBySlug propagates a read failure instead of a seeded tenant secret', async () => {
      const repo = new InMemoryMerchantRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findBySlug('copy-shop-impresiones')).rejects.toBe(READ_FAILURE);
    });

    it('MerchantRepository.findBySlug returns null for an empty SELECT instead of a seeded tenant', async () => {
      const repo = new InMemoryMerchantRepository(dbMode(jest.fn().mockResolvedValue(EMPTY)));

      expect(await repo.findBySlug('copy-shop-impresiones')).toBeNull();
    });

    it('MembershipRepository.findByUserAndMerchant propagates a read failure instead of seeded membership', async () => {
      const repo = new InMemoryMembershipRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findByUserAndMerchant('usr-franco-owner', 'comercio-franco')).rejects.toBe(READ_FAILURE);
    });

    it('MembershipRepository.findActiveByUser returns [] for an empty SELECT instead of seeded memberships', async () => {
      const repo = new InMemoryMembershipRepository(dbMode(jest.fn().mockResolvedValue(EMPTY)));

      expect(await repo.findActiveByUser('usr-franco-owner')).toEqual([]);
    });

    it('MembershipRepository.findMembersByMerchant returns [] for an empty SELECT instead of seeded members', async () => {
      const repo = new InMemoryMembershipRepository(dbMode(jest.fn().mockResolvedValue(EMPTY)));

      expect(await repo.findMembersByMerchant('copy-shop-impresiones')).toEqual([]);
    });

    it('TransferRepository.findByTenantAndOperationId propagates a read failure (idempotency check)', async () => {
      const repo = new InMemoryTransferRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findByTenantAndOperationId('copy-shop-impresiones', 'OP-1001')).rejects.toBe(READ_FAILURE);
    });

    it('TransferRepository.findById propagates a read failure (claim anti-replay lookup)', async () => {
      const repo = new InMemoryTransferRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findById('copy-shop-impresiones', 'tr-test-1')).rejects.toBe(READ_FAILURE);
    });

    it('TransferRepository.getMetricsByTenant propagates a read failure instead of zeroed metrics', async () => {
      const repo = new InMemoryTransferRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.getMetricsByTenant('copy-shop-impresiones')).rejects.toBe(READ_FAILURE);
    });

    it('SubscriptionRepository.findByTenantId propagates a read failure instead of the seeded subscription', async () => {
      const repo = new InMemorySubscriptionRepository(dbMode(failingQuery(READ_FAILURE)));

      await expect(repo.findByTenantId('cajasegura-platform')).rejects.toBe(READ_FAILURE);
    });

    it('SubscriptionRepository.findByTenantId returns null for an empty SELECT instead of the seeded subscription', async () => {
      const repo = new InMemorySubscriptionRepository(dbMode(jest.fn().mockResolvedValue(EMPTY)));

      expect(await repo.findByTenantId('cajasegura-platform')).toBeNull();
    });

    it('PaymentReportRepository.findById returns null for an empty SELECT instead of a cached report', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ id: 'rep-test-1', tenant_id: 'kiosko-san-roque', reported_by_user_id: 'usr-franco-owner', payer_name: 'Franco Galeano', amount: 150000, status: 'pending', matched_transfer_id: null, created_at: new Date().toISOString() }], rowCount: 1 });
      const repo = new InMemoryPaymentReportRepository(dbMode(query));
      await repo.save(newPaymentReport());
      query.mockResolvedValue(EMPTY);

      expect(await repo.findById('rep-test-1')).toBeNull();
    });

    it('PaymentReportRepository.findAll propagates a read failure instead of cached reports', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ id: 'rep-test-1', tenant_id: 'kiosko-san-roque', reported_by_user_id: 'usr-franco-owner', payer_name: 'Franco Galeano', amount: 150000, status: 'pending', matched_transfer_id: null, created_at: new Date().toISOString() }], rowCount: 1 });
      const repo = new InMemoryPaymentReportRepository(dbMode(query));
      await repo.save(newPaymentReport());
      query.mockRejectedValue(READ_FAILURE);

      await expect(repo.findAll()).rejects.toBe(READ_FAILURE);
    });
  });

  describe('empty database results are definitive', () => {
    it('TransferRepository.findPendingByAmountAndPayer returns [] instead of cached transfers', async () => {
      const { repo, query } = await seededTransferRepo();
      query.mockResolvedValue(EMPTY);

      expect(await repo.findPendingByAmountAndPayer('copy-shop-impresiones', 150000)).toEqual([]);
    });

    it('MerchantRequestRepository.findAll returns [] instead of cached requests', async () => {
      const query = jest.fn().mockResolvedValue({ rows: [{ id: REQUEST_UUID, created_at: new Date().toISOString() }], rowCount: 1 });
      const repo = new InMemoryMerchantRequestRepository(dbMode(query));
      await repo.save(newRequest('req-1'));
      query.mockResolvedValue(EMPTY);

      expect(await repo.findAll()).toEqual([]);
    });
  });

  describe('claims honor the 45-minute anti-replay window in database mode', () => {
    it('TransferRepository.updateClaimed applies an inclusive 45-minute created_at cutoff so an expired transfer cannot be claimed', async () => {
      const claimTime = new Date('2026-10-05T12:45:00.000Z');
      const { repo, query } = await seededTransferRepo();
      query.mockImplementation(async (sql: string) => {
        if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: USER_UUID }], rowCount: 1 };
        // UPDATE matches no row: the transfer was created outside the 45-minute window.
        return EMPTY;
      });

      expect(
        await repo.updateClaimed('copy-shop-impresiones', TRANSFER_UUID, 'usr-cashier-1', claimTime),
      ).toBe(false);

      const updateCall = query.mock.calls.find(([sql]) => /UPDATE transfers/i.test(String(sql)));
      expect(updateCall).toBeDefined();
      const [sql, params] = updateCall as unknown as [string, unknown[]];
      // Inclusive bound: Transfer.isExpired only rejects age > 45 minutes, so a transfer
      // created exactly 45 minutes before claimTime must still be claimable -> `>=`.
      expect(sql).toMatch(/created_at\s*>=/);
      const cutoff = claimTime.getTime() - 45 * 60 * 1000;
      expect(params.some((p) => p instanceof Date && p.getTime() === cutoff)).toBe(true);
    });
  });

  describe('writes reject on database errors and zero-row results', () => {
    it('TransferRepository.save rejects when the tenant cannot be resolved', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemoryTransferRepository(dbMode(query));

      await expect(repo.save(pendingTransfer())).rejects.toThrow();
    });

    it('TransferRepository.save rejects when the INSERT fails', async () => {
      const query = jest.fn(async (sql: string) => {
        if (/SELECT id FROM merchants/.test(sql)) return { rows: [{ id: MERCHANT_UUID }], rowCount: 1 };
        if (/INSERT INTO transfers/.test(sql)) throw WRITE_FAILURE;
        return EMPTY;
      });
      const repo = new InMemoryTransferRepository(dbMode(query));

      await expect(repo.save(pendingTransfer())).rejects.toBe(WRITE_FAILURE);
    });

    it('TransferRepository.save rejects when the INSERT persists no row', async () => {
      const query = jest.fn(async (sql: string) => {
        if (/SELECT id FROM merchants/.test(sql)) return { rows: [{ id: MERCHANT_UUID }], rowCount: 1 };
        if (/INSERT INTO transfers/.test(sql)) return EMPTY;
        return EMPTY;
      });
      const repo = new InMemoryTransferRepository(dbMode(query));

      await expect(repo.save(pendingTransfer())).rejects.toThrow();
    });

    it('TransferRepository.updateClaimed propagates a failed claim UPDATE (never reports claimed)', async () => {
      const { repo, query } = await seededTransferRepo();
      query.mockImplementation(async (sql: string) => {
        if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: USER_UUID }], rowCount: 1 };
        if (/UPDATE transfers/i.test(sql)) throw READ_FAILURE;
        return EMPTY;
      });

      await expect(
        repo.updateClaimed('copy-shop-impresiones', TRANSFER_UUID, 'usr-cashier-1', new Date()),
      ).rejects.toBe(READ_FAILURE);
    });

    it('TransferRepository.updateClaimed returns false for a zero-row UPDATE instead of claiming from memory', async () => {
      const { repo, query } = await seededTransferRepo();
      query.mockImplementation(async (sql: string) => {
        if (/SELECT id FROM users/.test(sql)) return { rows: [{ id: USER_UUID }], rowCount: 1 };
        return EMPTY;
      });

      expect(await repo.updateClaimed('copy-shop-impresiones', TRANSFER_UUID, 'usr-cashier-1', new Date())).toBe(false);
    });

    it('TransferRepository.updateClaimed rejects when the cashier cannot be resolved (no UPDATE issued)', async () => {
      const { repo, query } = await seededTransferRepo();
      query.mockImplementation(async (sql: string) => {
        if (/SELECT id FROM users/.test(sql)) return EMPTY;
        if (/UPDATE transfers/i.test(sql)) return { rows: [transferRow({ status: 'claimed' })], rowCount: 1 };
        return EMPTY;
      });

      await expect(
        repo.updateClaimed('copy-shop-impresiones', TRANSFER_UUID, 'usr-missing-cashier', new Date()),
      ).rejects.toThrow();
      expect(query.mock.calls.some(([sql]) => /^UPDATE/i.test(String(sql).trim()))).toBe(false);
    });

    it('MembershipRepository.save rejects when the tenant cannot be resolved', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemoryMembershipRepository(dbMode(query));

      await expect(repo.save(newMembership())).rejects.toThrow();
    });

    it('MembershipRepository.save rejects when the INSERT fails', async () => {
      const query = jest.fn(async (sql: string) => {
        if (/SELECT id FROM merchants/.test(sql)) return { rows: [{ id: MERCHANT_UUID }], rowCount: 1 };
        if (/INSERT INTO merchant_memberships/.test(sql)) throw WRITE_FAILURE;
        return EMPTY;
      });
      const repo = new InMemoryMembershipRepository(dbMode(query));

      await expect(repo.save(newMembership())).rejects.toBe(WRITE_FAILURE);
    });

    it('MerchantRepository.save rejects when the upsert persists no row', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemoryMerchantRepository(dbMode(query));

      await expect(
        repo.save(
          new Merchant({
            id: 'nuevo-comercio',
            name: 'Nuevo Comercio',
            slug: 'nuevo-comercio',
            webhookSecret: 'sec_nuevo_comercio_2026',
            status: 'active',
          }),
        ),
      ).rejects.toThrow();
    });

    it('SubscriptionRepository.save rejects when the tenant cannot be resolved', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemorySubscriptionRepository(dbMode(query));

      await expect(repo.save(newSubscription())).rejects.toThrow();
    });

    it('SubscriptionRepository.save rejects when the upsert writes no row', async () => {
      const query = jest.fn(async (sql: string) =>
        /SELECT id FROM merchants/.test(sql) ? { rows: [{ id: MERCHANT_UUID }], rowCount: 1 } : EMPTY,
      );
      const repo = new InMemorySubscriptionRepository(dbMode(query));

      await expect(repo.save(newSubscription())).rejects.toThrow();
    });

    it('PaymentReportRepository.save rejects when the INSERT fails', async () => {
      const query = jest.fn().mockRejectedValue(WRITE_FAILURE);
      const repo = new InMemoryPaymentReportRepository(dbMode(query));

      await expect(repo.save(newPaymentReport())).rejects.toBe(WRITE_FAILURE);
    });

    it('MerchantRequestRepository.save rejects when the INSERT fails', async () => {
      const query = jest.fn().mockRejectedValue(WRITE_FAILURE);
      const repo = new InMemoryMerchantRequestRepository(dbMode(query));

      await expect(repo.save(newRequest('req-1'))).rejects.toBe(WRITE_FAILURE);
    });

    it('MerchantRequestRepository.save rejects when the INSERT persists no row', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemoryMerchantRequestRepository(dbMode(query));

      await expect(repo.save(newRequest('req-1'))).rejects.toThrow();
    });

    it('MerchantRequestRepository.save updates an existing persisted row instead of inserting a duplicate', async () => {
      const query = jest.fn().mockResolvedValue(EMPTY);
      const repo = new InMemoryMerchantRequestRepository(dbMode(query));

      await expect(repo.save(newRequest(REQUEST_UUID))).rejects.toThrow();
      const [sql] = query.mock.calls[0];
      expect(String(sql).trim()).toMatch(/^UPDATE merchant_requests/i);
    });

    it('MerchantRequestRepository.save returns the persisted id for a new request', async () => {
      const query = jest.fn().mockResolvedValue({
        rows: [{ id: REQUEST_UUID, created_at: new Date().toISOString() }],
        rowCount: 1,
      });
      const repo = new InMemoryMerchantRequestRepository(dbMode(query));

      const saved = await repo.save(newRequest('req-1'));

      expect(saved.id).toBe(REQUEST_UUID);
      expect(String(query.mock.calls[0][0]).trim()).toMatch(/^INSERT INTO merchant_requests/i);
    });
  });
});

describe('Memory mode (no database configured) keeps the in-memory stores working', () => {
  it('still resolves seeded accounts and tenants', async () => {
    const users = new InMemoryUserRepository();
    const merchants = new InMemoryMerchantRepository();

    expect((await users.findByEmail('admin@validador.com'))?.isSuperAdmin).toBe(true);
    expect((await merchants.findBySlug('copy-shop-impresiones'))?.name).toBe('Copy Shop Impresiones');
  });

  it('still stores, reads, and claims transfers in memory', async () => {
    const repo = new InMemoryTransferRepository();

    await repo.save(pendingTransfer());

    expect(await repo.findByTenantAndOperationId('copy-shop-impresiones', 'OP-1001')).not.toBeNull();
    expect(await repo.updateClaimed('copy-shop-impresiones', 'tr-test-1', 'usr-cashier-1', new Date())).toBe(true);
    expect((await repo.findById('copy-shop-impresiones', 'tr-test-1'))?.isClaimed()).toBe(true);
  });
});
