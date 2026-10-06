import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { Pool } from 'pg';
import { DDL_SCHEMA_SQL } from '../schema';

const SUPERADMIN_EMAIL = 'admin@validador.com';
const SYSTEM_TENANT_SLUG = 'cajasegura-platform';

/** Minimal query surface the seed needs, satisfied by a `pg` pool client. */
export interface SeedClient {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** Reads a required environment variable, failing closed when it is absent or blank. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`${name} is required and must not be empty`);
  }
  return value;
}

/**32 bytes of CSPRNG entropy (64 hex chars), within the 128-char column limit. */
export function generateWebhookSecret(): string {
  return `sec_${randomBytes(32).toString('hex')}`;
}

export function createSeedPool(): Pool {
  return new Pool({ connectionString: requireEnv('DATABASE_URL') });
}

/**
 * Provisions the system tenant without rotating its webhook secret: the stored
 * value wins on rerun, a freshly generated secret is only used when the stored
 * one is missing or empty.
 */
const UPSERT_SYSTEM_MERCHANT_SQL = `
  INSERT INTO merchants (name, slug, webhook_secret, status)
  VALUES ($1, $2, $3, 'active')
  ON CONFLICT (slug) DO UPDATE
     SET status = 'active',
         webhook_secret = COALESCE(NULLIF(merchants.webhook_secret, ''), EXCLUDED.webhook_secret)
`;

export async function runSeed(client: SeedClient): Promise<void> {
  const superadminPassword = requireEnv('SUPERADMIN_PASSWORD');

  console.log('🌱 1. Applying DDL Schema...');
  await client.query(DDL_SCHEMA_SQL);

  console.log('👤 2. Seeding SuperAdmin Only...');
  const passwordHash = await bcrypt.hash(superadminPassword, 10);
  const adminRes = await client.query(
    `INSERT INTO users (email, password_hash, full_name, is_super_admin)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2, is_super_admin = true
     RETURNING id, email`,
    [SUPERADMIN_EMAIL, passwordHash, 'Platform Administrator'],
  );
  console.log(`   ✅ SuperAdmin: ${String(adminRes.rows[0].email)}`);

  console.log('🏛️ 3. Seeding System Tenant...');
  await client.query(UPSERT_SYSTEM_MERCHANT_SQL, [
    'CajaSegura Plataforma',
    SYSTEM_TENANT_SLUG,
    generateWebhookSecret(),
  ]);
  console.log(`   ✅ System Merchant provisioned: ${SYSTEM_TENANT_SLUG}`);

  console.log('\n🚀 Initial Clean Setup Complete!');
  console.log('Credentials come from environment variables only and are never printed.');
}

async function main(): Promise<void> {
  const pool = createSeedPool();
  console.log('🌱 Connecting to PostgreSQL...');
  const client = await pool.connect();
  try {
    await runSeed(client);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('❌ Seed failed:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
