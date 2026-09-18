import * as bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { DDL_SCHEMA_SQL } from '../schema';

async function seedPilotData() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://cajasegura_admin:cajasegura_secure_pass_2026@localhost:5432/cajasegura_db',
  });

  console.log('🌱 1. Connecting to PostgreSQL...');
  const client = await pool.connect();

  try {
    console.log('📐 2. Applying DDL Schema...');
    await client.query(DDL_SCHEMA_SQL);

    console.log('👤 3. Seeding SuperAdmin Only...');
    const passwordHash = await bcrypt.hash('password123', 10);

    const adminRes = await client.query(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO UPDATE SET is_super_admin = true
       RETURNING id, email`,
      ['admin@validador.com', passwordHash, 'Platform Administrator'],
    );
    console.log(`   ✅ SuperAdmin: ${adminRes.rows[0].email}`);

    console.log('🏛️ 4. Seeding System Tenant: cajasegura-platform...');
    await client.query(
      `INSERT INTO merchants (name, slug, webhook_secret, status)
       VALUES ($1, $2, $3, 'active')
       ON CONFLICT (slug) DO UPDATE SET webhook_secret = $3, status = 'active'`,
      ['CajaSegura Plataforma', 'cajasegura-platform', 'sec_cajasegura_admin_2026'],
    );
    console.log('   ✅ System Merchant provisioned: cajasegura-platform');

    console.log('\n🚀 Initial Clean Setup Complete!');
    console.log('====================================================');
    console.log('SuperAdmin: admin@validador.com / password123');
    console.log('Todos los datos falsos y tiendas de prueba fueron eliminados.');
    console.log('====================================================');
  } finally {
    client.release();
    await pool.end();
  }
}

seedPilotData().catch((err) => {
  console.error('❌ Error seeding clean data:', err);
  process.exit(1);
});
