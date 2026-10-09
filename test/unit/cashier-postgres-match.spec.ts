/**
 * TASK-03 correction: cashier matching against the PostgreSQL query contract.
 *
 * The unit doubles in `cashier-pos.spec.ts` ignore the optional payerFilter
 * argument, so they cannot observe the real database-mode prefilter: when an
 * identifier is passed, `findPendingByAmountAndPayer` appends
 * `AND t.payer_name ILIKE $3`. PostgreSQL ILIKE is a case-insensitive
 * substring match on payer_name alone — it cannot express the use case's
 * diacritic-insensitive, non-contiguous word match, and it hides every row
 * whose payer name does not contain a pasted operation/receipt reference.
 *
 * This spec runs VerifyTransferUseCase on the REAL InMemoryTransferRepository
 * in database mode against a fake DatabaseService that executes the SELECT the
 * way PostgreSQL does: each WHERE clause applies only when the SQL actually
 * contains it. So a production change that pushes the identifier back into SQL,
 * or drops the tenant / exact-amount / pending-only clauses, fails here.
 */

import { DatabaseService } from '../../src/infrastructure/database/database.service';
import { VerifyTransferUseCase } from '../../src/core/application/use-cases/transfers/verify-transfer.use-case';
import { InMemoryTransferRepository } from '../../src/infrastructure/repositories/in-memory.repositories';

type FixtureRow = Record<string, unknown> & { tenantSlug: string };

const TENANT = 'kiosko-san-roque';

function pendingRow(overrides: Record<string, unknown> = {}): FixtureRow {
  return {
    id: 'tr-001',
    tenantSlug: TENANT,
    operation_id: 'OP-1001',
    receipt_number: null,
    operation_date: '2026-10-08',
    payer_name: 'PAGADOR EJEMPLO',
    payer_account: null,
    payer_bank: 'Itau',
    currency: 'PYG',
    amount: 10000,
    credit_account: null,
    concept: null,
    raw_body: null,
    status: 'pending',
    claimed_at: null,
    claimed_by_user_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Executes the repository's transfers SELECT like PostgreSQL would:
 * tenant (`m.slug = $1`), exact amount (`t.amount = $2`) and
 * `t.status = 'pending'` each apply only when the SQL contains them, and the
 * optional `payer_name ILIKE $3` prefilter is a case-insensitive,
 * diacritic-sensitive substring match on payer_name alone.
 */
function postgresContractDb(fixtures: FixtureRow[]) {
  const query = jest.fn(async (sql: string, params: unknown[]) => {
    const [tenant, amount, ilikePattern] = params as [string, number, string?];
    const rows = fixtures.filter((row) => {
      if (/m\.slug = \$1/.test(sql) && row.tenantSlug !== tenant) return false;
      if (/t\.amount = \$2/.test(sql) && row.amount !== amount) return false;
      if (/t\.status = 'pending'/.test(sql) && row.status !== 'pending') return false;
      if (/payer_name ILIKE/i.test(sql)) {
        const needle = String(ilikePattern ?? '').replace(/%/g, '').toLowerCase();
        if (!String(row.payer_name).toLowerCase().includes(needle)) return false;
      }
      return true;
    });
    return { rows, rowCount: rows.length };
  });
  const db = { isMemoryMode: false, query } as unknown as DatabaseService;
  return { db, query };
}

function verifyWith(db: DatabaseService, amount: number, payerFilter?: string) {
  const useCase = new VerifyTransferUseCase(new InMemoryTransferRepository(db));
  return useCase.execute({ tenantId: TENANT, amount, payerFilter });
}

describe('Cashier verify against the PostgreSQL query contract (TASK-03)', () => {
  it('matches a non-contiguous multi-word payer name the ILIKE prefilter would hide', async () => {
    const { db } = postgresContractDb([
      pendingRow({
        id: 'tr-alann',
        payer_name: 'ALANN RODRIGO ARCE RODRIGUEZ',
        operation_id: '76820403',
        amount: 50000,
      }),
    ]);

    const result = await verifyWith(db, 50000, 'alann arce');

    expect(result.found).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].payerName).toBe('ALANN RODRIGO ARCE RODRIGUEZ');
  });

  it('matches a diacritic payer-name query against the accent-free stored name', async () => {
    const { db } = postgresContractDb([
      pendingRow({ id: 'tr-mia', payer_name: 'MIA GIMENEZ', operation_id: '45602', amount: 45000 }),
    ]);

    const result = await verifyWith(db, 45000, 'Giménez');

    expect(result.found).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].payerName).toBe('MIA GIMENEZ');
  });

  it('selects a reference whose text is absent from payer_name', async () => {
    const { db } = postgresContractDb([
      pendingRow({
        id: 'tr-ref',
        payer_name: 'JUAN PEREZ',
        operation_id: 'SIP-998877',
        receipt_number: 'RC-5521',
        amount: 30000,
      }),
    ]);

    const result = await verifyWith(db, 30000, 'SIP-998877');

    expect(result.found).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].operationId).toBe('SIP-998877');
  });

  it('never pushes the identifier into the SQL parameter list', async () => {
    const { db, query } = postgresContractDb([
      pendingRow({ id: 'tr-chena', payer_name: 'ALEJANDRA CHENA', operation_id: '45601', amount: 26000 }),
    ]);

    const result = await verifyWith(db, 26000, 'chena');

    expect(result.found).toBe(true);
    // Every executed query is the two-parameter tenant + amount candidate
    // SELECT; the identifier must never become the ILIKE $3 prefilter.
    expect(query.mock.calls.length).toBeGreaterThan(0);
    expect(query.mock.calls.every(([, params]) => (params as unknown[]).length === 2)).toBe(true);
  });

  it('returns not_found for an empty identifier without issuing any SQL', async () => {
    const { db, query } = postgresContractDb([
      pendingRow({ payer_name: 'ALEJANDRA CHENA', operation_id: '45601', amount: 26000 }),
    ]);

    const result = await verifyWith(db, 26000, '   ');

    expect(result.found).toBe(false);
    expect(result.status).toBe('not_found');
    expect(query).not.toHaveBeenCalled();
  });

  it('keeps tenant, exact amount, and pending-only constraints when a reference matches', async () => {
    const { db } = postgresContractDb([
      pendingRow({
        id: 'tr-target',
        payer_name: 'ANA TORRES',
        operation_id: 'SIP-77',
        amount: 30000,
      }),
      // Same reference, but outside the tenant scope.
      pendingRow({
        id: 'tr-other-tenant',
        tenantSlug: 'otro-comercio',
        payer_name: 'OTRO PAGADOR',
        operation_id: 'SIP-77',
        amount: 30000,
      }),
      // Same reference and amount, but already claimed (anti-replay).
      pendingRow({
        id: 'tr-claimed',
        payer_name: 'PAGADOR COBRADO',
        operation_id: 'SIP-77',
        amount: 30000,
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claimed_by_user_id: 'cashier-1',
      }),
      // Same reference, but a different amount.
      pendingRow({
        id: 'tr-wrong-amount',
        payer_name: 'PAGADOR MONTO',
        operation_id: 'SIP-77',
        amount: 99999,
      }),
    ]);

    const result = await verifyWith(db, 30000, 'SIP-77');

    expect(result.found).toBe(true);
    expect(result.transfers).toHaveLength(1);
    expect(result.transfers[0].id).toBe('tr-target');
  });
});
