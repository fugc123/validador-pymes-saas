import { DDL_SCHEMA_SQL } from '../../src/infrastructure/database/schema';

describe('PostgreSQL DDL Schema Invariants (T03)', () => {
  it('should define all 6 tables specified in the SDD design document', () => {
    const tables = [
      'merchants',
      'users',
      'merchant_memberships',
      'transfers',
      'subscriptions',
      'merchant_requests',
    ];

    for (const table of tables) {
      expect(DDL_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('should enforce tenant isolation through tenant_id foreign keys and cascade on delete', () => {
    expect(DDL_SCHEMA_SQL).toContain('tenant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE');
    expect(DDL_SCHEMA_SQL).toContain('tenant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE');
  });

  it('should enforce Article II Anti-Replay Invariant through unique constraint (tenant_id, operation_id)', () => {
    expect(DDL_SCHEMA_SQL).toContain('CONSTRAINT uq_tenant_operation UNIQUE (tenant_id, operation_id)');
  });

  it('should enforce ADR-008 membership invariant (user_id, merchant_id)', () => {
    expect(DDL_SCHEMA_SQL).toContain('CONSTRAINT uq_user_merchant UNIQUE (user_id, merchant_id)');
  });

  it('should create necessary performance indexes for high-speed POS lookup', () => {
    expect(DDL_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_transfers_tenant_lookup ON transfers(tenant_id, amount, status, created_at)');
    expect(DDL_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug)');
    expect(DDL_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    expect(DDL_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON merchant_memberships(user_id)');
    expect(DDL_SCHEMA_SQL).toContain('CREATE INDEX IF NOT EXISTS idx_memberships_merchant_id ON merchant_memberships(merchant_id)');
  });
});
