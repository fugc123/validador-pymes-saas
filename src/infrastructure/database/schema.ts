export interface MerchantRow {
  id: string;
  name: string;
  slug: string;
  webhook_secret: string;
  status: 'active' | 'suspended' | 'pending';
  catalog_theme?: string;
  created_at: Date;
  updated_at: Date;
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  is_super_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MerchantMembershipRow {
  id: string;
  user_id: string;
  merchant_id: string;
  role: 'MERCHANT_OWNER' | 'CASHIER';
  is_active: boolean;
  created_at: Date;
}

export interface TransferRow {
  id: string;
  tenant_id: string;
  operation_id: string;
  receipt_number: string | null;
  operation_date: string;
  payer_name: string;
  payer_account: string | null;
  payer_bank: string | null;
  currency: string;
  amount: number;
  credit_account: string | null;
  concept: string | null;
  raw_body: string | null;
  status: 'pending' | 'claimed' | 'expired';
  claimed_at: Date | null;
  claimed_by_user_id: string | null;
  created_at: Date;
}

export interface SubscriptionRow {
  id: string;
  tenant_id: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  current_period_end: Date;
  external_customer_id: string | null;
  external_subscription_id: string | null;
  created_at: Date;
}

export interface MerchantRequestRow {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string;
  city: string;
  status: 'requested' | 'approved' | 'rejected';
  created_at: Date;
}

export interface CatalogItemRow {
  id: string;
  tenant_id: string;
  item_type: 'product' | 'service';
  name: string;
  description: string | null;
  price: number;
  stock: number | null;
  image_url: string | null;
  discount_percent: number;
  discount_type: 'none' | 'hours' | 'days';
  discount_ends_at: Date | null;
  discount_days: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface SaleRow {
  id: string;
  tenant_id: string;
  cashier_user_id: string;
  cashier_name: string;
  customer_name: string | null;
  concept: string | null;
  sale_mode: 'catalog' | 'quick_amount';
  payment_method: 'TRANSFER' | 'CASH' | 'CARD';
  transfer_id: string | null;
  subtotal_amount: number;
  discount_amount: number;
  total_amount: number;
  created_at: Date;
}

export interface SaleItemRow {
  id: string;
  sale_id: string;
  item_id: string | null;
  item_name: string;
  item_type: 'product' | 'service' | 'custom';
  unit_price: number;
  applied_discount_percent: number;
  final_unit_price: number;
  quantity: number;
  line_total: number;
}

export const DDL_SCHEMA_SQL = `
-- Merchants Table (Tenants)
CREATE TABLE IF NOT EXISTS merchants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    webhook_secret VARCHAR(128) NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'pending')),
    catalog_theme VARCHAR(50) DEFAULT 'emerald',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS catalog_theme VARCHAR(50) DEFAULT 'emerald';
CREATE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);

-- Global Users Table
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

-- Merchant Memberships
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

-- Bank Transfers (Scoped by tenant_id)
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

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'trial' CHECK (status IN ('trial', 'active', 'past_due', 'cancelled')),
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    external_customer_id VARCHAR(255),
    external_subscription_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Merchant Signup Requests
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

-- Payment Reports Table
CREATE TABLE IF NOT EXISTS payment_reports (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    reported_by_user_id VARCHAR(100) NOT NULL,
    payer_name VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL DEFAULT 150000,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'matched', 'rejected')),
    matched_transfer_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Catalog Items Table (Products & Services with Time Discounts)
CREATE TABLE IF NOT EXISTS catalog_items (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('product', 'service')),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price INTEGER NOT NULL CHECK (price >= 0),
    stock INTEGER,
    image_url TEXT,
    discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 99),
    discount_type VARCHAR(20) NOT NULL DEFAULT 'none' CHECK (discount_type IN ('none', 'hours', 'days')),
    discount_ends_at TIMESTAMP WITH TIME ZONE,
    discount_days VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_catalog_items_tenant ON catalog_items(tenant_id, is_active);

-- Sales Table (POS Movements & Checkout History)
CREATE TABLE IF NOT EXISTS sales (
    id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    cashier_user_id VARCHAR(100) NOT NULL,
    cashier_name VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255),
    concept TEXT,
    sale_mode VARCHAR(30) NOT NULL DEFAULT 'catalog' CHECK (sale_mode IN ('catalog', 'quick_amount')),
    payment_method VARCHAR(30) NOT NULL CHECK (payment_method IN ('TRANSFER', 'CASH', 'CARD')),
    transfer_id VARCHAR(100),
    subtotal_amount INTEGER NOT NULL,
    discount_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_created ON sales(tenant_id, created_at DESC);

-- Sale Items Table (Line items per Sale)
CREATE TABLE IF NOT EXISTS sale_items (
    id VARCHAR(100) PRIMARY KEY,
    sale_id VARCHAR(100) NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_id VARCHAR(100),
    item_name VARCHAR(255) NOT NULL,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('product', 'service', 'custom')),
    unit_price INTEGER NOT NULL,
    applied_discount_percent INTEGER NOT NULL DEFAULT 0,
    final_unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    line_total INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
`;
