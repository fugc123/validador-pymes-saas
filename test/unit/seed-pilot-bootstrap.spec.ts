/**
 * Seed bootstrap hardening (TASK-06) behavioral pin.
 *
 * `seed-pilot.ts` must fail closed on missing configuration, derive the
 * superadmin password only from `SUPERADMIN_PASSWORD`, never print credentials
 * or webhook secrets, and generate a strong system-tenant webhook secret that
 * the stored value preserves across reruns (no silent rotation, no
 * `MASTER_WEBHOOK_SECRET` bypass).
 */

import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import {
  createSeedPool,
  generateWebhookSecret,
  requireEnv,
  runSeed,
  type SeedClient,
} from '../../src/infrastructure/database/seeds/seed-pilot';

interface QueryCall {
  sql: string;
  params: unknown[];
}

interface FakeClient {
  client: SeedClient;
  calls: QueryCall[];
}

function fakeClient(): FakeClient {
  const calls: QueryCall[] = [];
  const client: SeedClient = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      calls.push({ sql, params });
      if (sql.includes('INSERT INTO users')) {
        return { rows: [{ id: 'user-1', email: 'admin@validador.com' }] };
      }
      if (sql.includes('INSERT INTO merchants')) {
        return { rows: [{ slug: 'cajasegura-platform' }] };
      }
      return { rows: [] };
    }),
  };
  return { client, calls };
}

function findCall(calls: QueryCall[], fragment: string): QueryCall {
  const found = calls.find((call) => call.sql.includes(fragment));
  if (!found) {
    throw new Error(`no query executed containing: ${fragment}`);
  }
  return found;
}

describe('seed-pilot bootstrap', () => {
  const SUPERADMIN_PASSWORD = 'Bootstrap-Credential-918273645';
  const managedEnvKeys = ['SUPERADMIN_PASSWORD', 'DATABASE_URL'];
  const originalEnv: Record<string, string | undefined> = {};

  beforeAll(() => {
    for (const key of managedEnvKeys) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterAll(() => {
    for (const key of managedEnvKeys) {
      if (originalEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalEnv[key];
      }
    }
  });

  describe('requireEnv', () => {
    it('fails closed when the variable is missing', () => {
      delete process.env.SUPERADMIN_PASSWORD;
      expect(() => requireEnv('SUPERADMIN_PASSWORD')).toThrow(/SUPERADMIN_PASSWORD/);
    });

    it('fails closed when the variable is blank', () => {
      process.env.SUPERADMIN_PASSWORD = '   ';
      expect(() => requireEnv('SUPERADMIN_PASSWORD')).toThrow(/SUPERADMIN_PASSWORD/);
    });

    it('returns the configured value', () => {
      process.env.SUPERADMIN_PASSWORD = SUPERADMIN_PASSWORD;
      expect(requireEnv('SUPERADMIN_PASSWORD')).toBe(SUPERADMIN_PASSWORD);
    });
  });

  describe('createSeedPool', () => {
    it('refuses to build a pool without DATABASE_URL', () => {
      delete process.env.DATABASE_URL;
      expect(() => createSeedPool()).toThrow(/DATABASE_URL/);
    });

    it('builds the pool from the configured DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgres://seed-user:seed-pass@127.0.0.1:5432/seed_db';
      const pool = createSeedPool();
      expect(pool).toBeInstanceOf(Pool);
      void pool.end();
    });
  });

  describe('runSeed', () => {
    it('stops before any database write when SUPERADMIN_PASSWORD is missing', async () => {
      delete process.env.SUPERADMIN_PASSWORD;
      const { client, calls } = fakeClient();

      await expect(runSeed(client)).rejects.toThrow(/SUPERADMIN_PASSWORD/);

      expect(calls).toHaveLength(0);
    });

    it('hashes the superadmin password from the environment instead of a baked-in value', async () => {
      process.env.SUPERADMIN_PASSWORD = SUPERADMIN_PASSWORD;
      const { client, calls } = fakeClient();

      await runSeed(client);

      const insert = findCall(calls, 'INSERT INTO users');
      const [email, passwordHash, fullName] = insert.params as [string, string, string];
      expect(email).toBe('admin@validador.com');
      expect(fullName).toBe('Platform Administrator');
      expect(passwordHash).not.toBe(SUPERADMIN_PASSWORD);
      await expect(bcrypt.compare(SUPERADMIN_PASSWORD, passwordHash)).resolves.toBe(true);
      await expect(bcrypt.compare('@Uncharted2413', passwordHash)).resolves.toBe(false);
    });

    it('seeds a strong system webhook secret that reruns preserve instead of rotating', async () => {
      process.env.SUPERADMIN_PASSWORD = SUPERADMIN_PASSWORD;
      const { client, calls } = fakeClient();

      await runSeed(client);

      const upsert = findCall(calls, 'INSERT INTO merchants');
      expect(upsert.sql).toMatch(/ON CONFLICT \(slug\) DO UPDATE/);
      expect(upsert.sql).toMatch(/webhook_secret\s*=\s*COALESCE\(/);
      expect(upsert.sql).not.toMatch(/webhook_secret\s*=\s*\$\d/);

      const secret = upsert.params[2] as string;
      expect(secret).toMatch(/^sec_[0-9a-f]{64}$/);
      expect(secret.length).toBeLessThanOrEqual(128);
      expect(new Set([generateWebhookSecret(), generateWebhookSecret()]).size).toBe(2);
    });

    it('never prints the superadmin password or the generated webhook secret', async () => {
      process.env.SUPERADMIN_PASSWORD = SUPERADMIN_PASSWORD;
      const { client, calls } = fakeClient();
      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

      try {
        await runSeed(client);

        const upsert = findCall(calls, 'INSERT INTO merchants');
        const generatedSecret = upsert.params[2] as string;
        const logged = logSpy.mock.calls
          .map((args) => args.map((value) => String(value)).join(' '))
          .join('\n');

        expect(logged).not.toContain(SUPERADMIN_PASSWORD);
        expect(logged).not.toContain(generatedSecret);
        expect(logged).not.toContain('cajasegura_secure_pass_2026');
      } finally {
        logSpy.mockRestore();
      }
    });
  });
});
