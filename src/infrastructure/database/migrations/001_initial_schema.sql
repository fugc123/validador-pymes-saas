-- Validador PYME SaaS - DDL Schema Migration 001
-- Aligned with constitution.md & design.md

-- 1. Merchants Table (Tenants)
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    webhook_secret VARCHAR(128) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);

-- 2. Global Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    is_super_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 3. Merchant Memberships (Many-to-Many with Dynamic Roles)
CREATE TABLE IF NOT EXISTS merchant_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL CHECK (role IN ('MERCHANT_OWNER', 'CASHIER')),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_merchant UNIQUE (user_id, merchant_id)
);
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON merchant_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_merchant_id ON merchant_memberships(merchant_id);

-- 4. Bank Transfers (Strictly Scoped by tenant_id)
CREATE TABLE IF NOT EXISTS transfers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    operation_id VARCHAR(100) NOT NULL,
    receipt_number VARCHAR(100),
    operation_date VARCHAR(100) NOT NULL,
    payer_name VARCHAR(255) NOT NULL,
    payer_account VARCHAR(100),
    payer_bank VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'PYG',
    amount INTEGER NOT NULL,
    credit_account VARCHAR(100),
    concept TEXT,
    raw_body TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'expired')),
    claimed_at TIMESTAMP WITH TIME ZONE,
    claimed_by_user_id UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_tenant_operation UNIQUE (tenant_id, operation_id)
);
CREATE INDEX IF NOT EXISTS idx_transfers_tenant_lookup ON transfers(tenant_id, amount, status, created_at);

-- 5. Subscriptions Table ($15/mo Lifecycle)
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    external_customer_id VARCHAR(255),
    external_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Merchant Signup Requests (Lead Capture)
CREATE TABLE IF NOT EXISTS merchant_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_name VARCHAR(255) NOT NULL,
    owner_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    city VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'requested' CHECK (status IN ('requested', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
