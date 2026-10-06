import { Pool } from 'pg';
import { DatabaseService } from '../../src/infrastructure/database/database.service';

jest.mock('pg', () => ({ Pool: jest.fn() }));

/**
 * Configured persistence must fail closed:
 * - no DB configuration outside production keeps the documented simulated mode
 * - production without DB configuration refuses to start
 * - a configured connection or migration failure fails startup instead of
 *   flipping the service into memory mode
 * - runtime query failures propagate instead of returning an empty result
 */

const CONNECT_FAILURE = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
  code: 'ECONNREFUSED',
});
const QUERY_FAILURE = new Error('connection terminated unexpectedly');

const config = (env: Record<string, string | undefined>) =>
  ({ get: (key: string) => env[key] }) as any;

describe('DatabaseService fail-closed behavior', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  function poolStub() {
    const pool = {
      connect: jest.fn().mockResolvedValue({ release: jest.fn() }),
      query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: jest.fn(),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };
    (Pool as unknown as jest.Mock).mockImplementation(() => pool);
    return pool;
  }

  it('uses simulated memory mode when no database is configured outside production', async () => {
    const svc = new DatabaseService(config({}));

    await svc.onModuleInit();

    expect(svc.isMemoryMode).toBe(true);
    const res = await svc.query('SELECT 1');
    expect(res.rows).toEqual([]);
    expect(res.rowCount).toBe(0);
    expect(await svc.getClient()).toBeNull();
    expect(svc.getHealth().connected).toBe(false);
    expect(Pool).not.toHaveBeenCalled();
  });

  it('refuses to start in production without a database configuration', async () => {
    const svc = new DatabaseService(config({ NODE_ENV: 'production' }));

    await expect(svc.onModuleInit()).rejects.toThrow(/DATABASE_URL|DB_HOST/);
    expect(svc.isMemoryMode).toBe(false);
    expect(Pool).not.toHaveBeenCalled();
  });

  it('fails startup on a configured connection error instead of falling back to memory mode', async () => {
    const pool = poolStub();
    pool.connect.mockRejectedValue(CONNECT_FAILURE);
    const svc = new DatabaseService(config({ DATABASE_URL: 'postgresql://app@127.0.0.1:5432/app' }));

    await expect(svc.onModuleInit()).rejects.toThrow(/PostgreSQL initialization failed/);
    expect(svc.isMemoryMode).toBe(false);
  });

  it('fails startup when the migration query fails instead of falling back to memory mode', async () => {
    const pool = poolStub();
    pool.query.mockRejectedValue(QUERY_FAILURE);
    const svc = new DatabaseService(config({ DB_HOST: 'db.internal' }));

    await expect(svc.onModuleInit()).rejects.toThrow(/PostgreSQL initialization failed/);
    expect(svc.isMemoryMode).toBe(false);
  });

  it('propagates runtime query failures while configured instead of returning an empty result', async () => {
    const pool = poolStub();
    const svc = new DatabaseService(config({ DATABASE_URL: 'postgresql://app@127.0.0.1:5432/app' }));
    await svc.onModuleInit();
    expect(svc.isMemoryMode).toBe(false);

    pool.query.mockRejectedValue(QUERY_FAILURE);

    await expect(svc.query('SELECT 1')).rejects.toBe(QUERY_FAILURE);
    expect(svc.isMemoryMode).toBe(false);
  });
});
