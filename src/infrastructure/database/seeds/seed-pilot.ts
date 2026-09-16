import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { DDL_SCHEMA_SQL } from '../schema';

async function seedPilotData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/validador_saas',
  });

  console.log('🌱 1. Connecting to PostgreSQL...');
  const client = await pool.connect();

  try {
    console.log('📐 2. Applying DDL Schema...');
    await client.query(DDL_SCHEMA_SQL);

    console.log('🏪 3. Seeding Pilot Merchant: Kiosko San Roque...');
    const pilotSlug = 'kiosko-san-roque';
    const pilotSecret = 'sec_kiosko_san_roque_pilot_2026';

    const merchantRes = await client.query(
      `INSERT INTO merchants (name, slug, webhook_secret, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (slug) DO UPDATE SET webhook_secret = $3, status = 'active'
       RETURNING id, name, slug`,
      ['Kiosko San Roque', pilotSlug, pilotSecret],
    );
    const merchant = merchantRes.rows[0];
    console.log(`   ✅ Merchant ID: ${merchant.id} (${merchant.name})`);

    console.log('👤 4. Seeding Users (SuperAdmin, Owner, Cashier)...');
    const passwordHash = await bcrypt.hash('password123', 10);

    // 4.1 SuperAdmin
    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO UPDATE SET is_super_admin = true
       RETURNING id, email`,
      ['admin@validador.com', passwordHash, 'Platform Administrator'],
    );
    console.log(`   ✅ SuperAdmin: ${adminRes.rows[0].email}`);

    // 4.2 Merchant Owner
    const ownerRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (email) DO UPDATE SET full_name = $3
       RETURNING id, email`,
      ['franco@kiosko.com', passwordHash, 'Franco Galeano (Dueño)'],
    );
    const owner = ownerRes.rows[0];
    console.log(`   ✅ Owner: ${owner.email}`);

    // 4.3 Cashier
    const cashierRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (email) DO UPDATE SET full_name = $3
       RETURNING id, email`,
      ['carlos@kiosko.com', passwordHash, 'Carlos Almirón (Cajero)'],
    );
    const cashier = cashierRes.rows[0];
    console.log(`   ✅ Cashier: ${cashier.email}`);

    console.log('🔗 5. Creating Organization Memberships (ADR-008)...');
    // Owner membership
    await client.query(
      `INSERT INTO merchant_memberships (user_id, merchant_id, role, is_active)
       VALUES ($1, $2, 'MERCHANT_OWNER', true)
       ON CONFLICT (user_id, merchant_id) DO UPDATE SET role = 'MERCHANT_OWNER', is_active = true`,
      [owner.id, merchant.id],
    );

    // Cashier membership
    await client.query(
      `INSERT INTO merchant_memberships (user_id, merchant_id, role, is_active)
       VALUES ($1, $2, 'CASHIER', true)
       ON CONFLICT (user_id, merchant_id) DO UPDATE SET role = 'CASHIER', is_active = true`,
      [cashier.id, merchant.id],
    );
    console.log('   ✅ Memberships created: Owner & Cashier linked to Kiosko San Roque');

    console.log('💳 6. Activating 7-Day Trial Subscription ($15/mo)...');
    const trialEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await client.query(
      `INSERT INTO subscriptions (tenant_id, status, current_period_end)
       VALUES ($1, 'trial', $2)
       ON CONFLICT (tenant_id) DO UPDATE SET status = 'trial', current_period_end = $2`,
      [merchant.id, trialEnd],
    );
    console.log(`   ✅ Subscription active until: ${trialEnd.toLocaleDateString()}`);

    console.log('\n🚀 Pilot Merchant provisioned successfully!');
    console.log('====================================================');
    console.log('Credenciales de Acceso:');
    console.log('1. SuperAdmin: admin@validador.com / password123');
    console.log('2. Dueño:      franco@kiosko.com   / password123');
    console.log('3. Cajero:     carlos@kiosko.com   / password123');
    console.log('----------------------------------------------------');
    console.log(`Webhook URL:    POST /api/v1/webhook/${pilotSlug}`);
    console.log(`Webhook Secret: ${pilotSecret}`);
    console.log('====================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

seedPilotData().catch((err) => {
  console.error('❌ Error seeding pilot data:', err);
  process.exit(1);
});
