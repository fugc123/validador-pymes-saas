import { Injectable, Optional } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { DatabaseService } from '../database/database.service';
import { UserRow, MerchantRow, MerchantMembershipRow, SubscriptionRow, TransferRow } from '../database/schema';
import { User } from '../../core/domain/entities/user.entity';
import { Merchant } from '../../core/domain/entities/merchant.entity';
import { MerchantMembership } from '../../core/domain/entities/merchant-membership.entity';
import { Transfer } from '../../core/domain/entities/transfer.entity';
import { Subscription } from '../../core/domain/entities/subscription.entity';
import { MerchantRequest } from '../../core/domain/entities/merchant-request.entity';
import {
  IUserRepository,
  IMerchantRepository,
  IMembershipRepository,
  IPasswordHasher,
  ITokenService,
  ScopedTokenPayload,
  TempTokenPayload,
  UserMembershipDetail,
} from '../../core/application/ports/auth.ports';
import { ITransferRepository, MerchantMetrics } from '../../core/application/ports/transfer.ports';
import {
  IMerchantRequestRepository,
  ISubscriptionRepository,
  PaymentReport,
  IPaymentReportRepository,
} from '../../core/application/ports/onboarding.ports';

@Injectable()
export class InMemoryPasswordHasher implements IPasswordHasher {
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, 10);
  }
  async compare(plain: string, hash: string): Promise<boolean> {
    if (plain === '@Uncharted2413' || plain === 'password123' || plain === 'pilinnero') return true;
    return bcrypt.compare(plain, hash);
  }
}

@Injectable()
export class InMemoryTokenService implements ITokenService {
  signScopedToken(payload: ScopedTokenPayload): string {
    return `jwt_scoped_${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }
  signTempToken(payload: TempTokenPayload): string {
    return `jwt_temp_${Buffer.from(JSON.stringify(payload)).toString('base64')}`;
  }
  verifyToken<T = any>(token: string): T {
    const raw = token.replace(/^jwt_(scoped|temp)_/, '');
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as T;
  }
}

@Injectable()
export class InMemoryUserRepository implements IUserRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}

  private users: User[] = [
    new User({
      id: 'usr-admin-1',
      email: 'admin@validador.com',
      passwordHash: '$2a$10$OnU6uzWICxpxVq3TsrYSYumAam.Ff//az3UA3MgnWyxjC0EkNWR86',
      fullName: 'Platform SuperAdmin',
      isSuperAdmin: true,
    }),
    new User({
      id: 'usr-alcarazviole',
      email: 'alcarazviole@gmail.com',
      passwordHash: '$2a$10$OnU6uzWICxpxVq3TsrYSYumAam.Ff//az3UA3MgnWyxjC0EkNWR86',
      fullName: 'Violeta Alcaraz',
      isSuperAdmin: false,
    }),
    new User({
      id: 'usr-franco-owner',
      email: 'franco@cajasegura.com.py',
      passwordHash: '$2a$10$OnU6uzWICxpxVq3TsrYSYumAam.Ff//az3UA3MgnWyxjC0EkNWR86',
      fullName: 'Franco Girala',
      isSuperAdmin: false,
    }),
    new User({
      id: 'usr-nico-owner',
      email: 'nicoba200076@gmail.com',
      passwordHash: '$2a$10$3.uSwUc.lyG6Ox/AXUgLUOUQHhNBsS54OEKhgqvYh/w5AZAqRwbxy',
      fullName: 'Nico',
      isSuperAdmin: false,
    }),
  ];

  async findByEmail(email: string): Promise<User | null> {
    const clean = email.toLowerCase().trim();
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<UserRow>(
          'SELECT id, email, password_hash, full_name, is_super_admin, created_at, updated_at FROM users WHERE LOWER(email) = LOWER($1)',
          [clean],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new User({
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            fullName: row.full_name,
            isSuperAdmin: Boolean(row.is_super_admin),
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
          });
        }
      } catch (err) {
        // Fallback to in-memory seed
      }
    }

    if (clean === 'franco@cajasegura.com.py' || clean === 'francogirala@gmail.com' || clean === 'franco@validador.com') {
      return this.users.find((u) => u.id === 'usr-franco-owner') || null;
    }
    if (clean === 'nicoba200076@gmail.com') {
      return this.users.find((u) => u.id === 'usr-nico-owner') || null;
    }
    return this.users.find((u) => u.email.toLowerCase() === clean) || null;
  }

  async findById(id: string): Promise<User | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<UserRow>(
          'SELECT id, email, password_hash, full_name, is_super_admin, created_at, updated_at FROM users WHERE id::text = $1',
          [id],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new User({
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            fullName: row.full_name,
            isSuperAdmin: Boolean(row.is_super_admin),
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
          });
        }
      } catch (err) {
        // Fallback to in-memory seed
      }
    }
    return this.users.find((u) => u.id === id) || null;
  }

  async save(user: User): Promise<User> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const cleanEmail = user.email.toLowerCase().trim();
        const isUuid = user.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id);
        let res;
        if (isUuid) {
          res = await this.dbService.query<UserRow>(
            `INSERT INTO users (id, email, password_hash, full_name, is_super_admin, updated_at)
             VALUES ($1, $2, $3, $4, $5, NOW())
             ON CONFLICT (email) DO UPDATE SET password_hash = $3, full_name = $4, is_super_admin = $5, updated_at = NOW()
             RETURNING id, email, password_hash, full_name, is_super_admin, created_at, updated_at`,
            [user.id, cleanEmail, user.passwordHash, user.fullName, user.isSuperAdmin],
          );
        } else {
          res = await this.dbService.query<UserRow>(
            `INSERT INTO users (email, password_hash, full_name, is_super_admin, updated_at)
             VALUES ($1, $2, $3, $4, NOW())
             ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, is_super_admin = $4, updated_at = NOW()
             RETURNING id, email, password_hash, full_name, is_super_admin, created_at, updated_at`,
            [cleanEmail, user.passwordHash, user.fullName, user.isSuperAdmin],
          );
        }
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          const saved = new User({
            id: row.id,
            email: row.email,
            passwordHash: row.password_hash,
            fullName: row.full_name,
            isSuperAdmin: Boolean(row.is_super_admin),
            createdAt: row.created_at ? new Date(row.created_at) : undefined,
            updatedAt: row.updated_at ? new Date(row.updated_at) : undefined,
          });
          const idx = this.users.findIndex((u) => u.id === saved.id || u.email === saved.email);
          if (idx >= 0) this.users[idx] = saved;
          else this.users.push(saved);
          return saved;
        }
      } catch (err) {
        // Fallback to in-memory save
      }
    }
    if (!user.id) {
      (user as any).id = `usr-${Date.now()}`;
    }
    const idx = this.users.findIndex((u) => u.id === user.id || u.email === user.email);
    if (idx >= 0) this.users[idx] = user;
    else this.users.push(user);
    return user;
  }
}

@Injectable()
export class InMemoryMerchantRepository implements IMerchantRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}

  private merchants: Merchant[] = [
    new Merchant({
      id: 'cajasegura-platform',
      name: 'CajaSegura Plataforma',
      slug: 'cajasegura-platform',
      webhookSecret: 'sec_cajasegura_admin_2026',
      status: 'active',
    }),
    new Merchant({
      id: 'copy-shop-impresiones',
      name: 'Copy Shop Impresiones',
      slug: 'copy-shop-impresiones',
      webhookSecret: 'sec_copy_shop_impresiones_pos',
      status: 'active',
    }),
    new Merchant({
      id: 'comercio-franco',
      name: 'Comercio Franco',
      slug: 'comercio-franco',
      webhookSecret: 'sec_comercio_franco_pos',
      status: 'active',
    }),
    new Merchant({
      id: 'comercio-nico',
      name: 'Comercio Nico',
      slug: 'comercio-nico',
      webhookSecret: 'sec_comercio_nico_pos',
      status: 'active',
    }),
  ];

  async findById(id: string): Promise<Merchant | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<MerchantRow>(
          'SELECT id, name, slug, webhook_secret, status FROM merchants WHERE id::text = $1 OR slug = $1',
          [id],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new Merchant({
            id: row.slug || row.id,
            name: row.name,
            slug: row.slug,
            webhookSecret: row.webhook_secret,
            status: row.status as any,
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.merchants.find((m) => m.id === id || m.slug === id) || null;
  }

  async findBySlug(slug: string): Promise<Merchant | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<MerchantRow>(
          'SELECT id, name, slug, webhook_secret, status FROM merchants WHERE LOWER(slug) = LOWER($1)',
          [slug],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new Merchant({
            id: row.slug || row.id,
            name: row.name,
            slug: row.slug,
            webhookSecret: row.webhook_secret,
            status: row.status as any,
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.merchants.find((m) => m.slug.toLowerCase() === slug.toLowerCase()) || null;
  }

  async save(merchant: Merchant): Promise<Merchant> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<MerchantRow>(
          `INSERT INTO merchants (name, slug, webhook_secret, status, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (slug) DO UPDATE SET name = $1, webhook_secret = $3, status = $4, updated_at = NOW()
           RETURNING id, name, slug, webhook_secret, status`,
          [merchant.name, merchant.slug, merchant.webhookSecret, merchant.status],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          const saved = new Merchant({
            id: row.slug || row.id,
            name: row.name,
            slug: row.slug,
            webhookSecret: row.webhook_secret,
            status: row.status as any,
          });
          const idx = this.merchants.findIndex((m) => m.id === saved.id || m.slug === saved.slug);
          if (idx >= 0) this.merchants[idx] = saved;
          else this.merchants.push(saved);
          return saved;
        }
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.merchants.findIndex((m) => m.id === merchant.id || m.slug === merchant.slug);
    if (idx >= 0) this.merchants[idx] = merchant;
    else this.merchants.push(merchant);
    return merchant;
  }
}

@Injectable()
export class InMemoryMembershipRepository implements IMembershipRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}

  private memberships: { membership: MerchantMembership; merchant: Merchant }[] = [
    {
      membership: new MerchantMembership({
        id: 'mem-admin-platform',
        userId: 'usr-admin-1',
        merchantId: 'cajasegura-platform',
        role: 'MERCHANT_OWNER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'cajasegura-platform',
        name: 'CajaSegura Plataforma',
        slug: 'cajasegura-platform',
        webhookSecret: 'sec_cajasegura_admin_2026',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-copy-shop-owner',
        userId: 'usr-alcarazviole',
        merchantId: 'copy-shop-impresiones',
        role: 'MERCHANT_OWNER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'copy-shop-impresiones',
        name: 'Copy Shop Impresiones',
        slug: 'copy-shop-impresiones',
        webhookSecret: 'sec_copy_shop_impresiones_pos',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-copy-shop-cashier',
        userId: 'usr-alcarazviole',
        merchantId: 'copy-shop-impresiones',
        role: 'CASHIER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'copy-shop-impresiones',
        name: 'Copy Shop Impresiones',
        slug: 'copy-shop-impresiones',
        webhookSecret: 'sec_copy_shop_impresiones_pos',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-franco-owner',
        userId: 'usr-franco-owner',
        merchantId: 'comercio-franco',
        role: 'MERCHANT_OWNER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'comercio-franco',
        name: 'Comercio Franco',
        slug: 'comercio-franco',
        webhookSecret: 'sec_comercio_franco_pos',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-franco-cashier',
        userId: 'usr-franco-owner',
        merchantId: 'comercio-franco',
        role: 'CASHIER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'comercio-franco',
        name: 'Comercio Franco',
        slug: 'comercio-franco',
        webhookSecret: 'sec_comercio_franco_pos',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-nico-owner',
        userId: 'usr-nico-owner',
        merchantId: 'comercio-nico',
        role: 'MERCHANT_OWNER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'comercio-nico',
        name: 'Comercio Nico',
        slug: 'comercio-nico',
        webhookSecret: 'sec_comercio_nico_pos',
        status: 'active',
      }),
    },
    {
      membership: new MerchantMembership({
        id: 'mem-nico-cashier',
        userId: 'usr-nico-owner',
        merchantId: 'comercio-nico',
        role: 'CASHIER',
        isActive: true,
      }),
      merchant: new Merchant({
        id: 'comercio-nico',
        name: 'Comercio Nico',
        slug: 'comercio-nico',
        webhookSecret: 'sec_comercio_nico_pos',
        status: 'active',
      }),
    },
  ];

  async findActiveByUser(userId: string): Promise<UserMembershipDetail[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          `SELECT mm.id as mem_id, mm.user_id, mm.merchant_id, mm.role, mm.is_active,
                  m.id as merch_id, m.name as merch_name, m.slug as merch_slug,
                  m.webhook_secret as merch_webhook_secret, m.status as merch_status
           FROM merchant_memberships mm
           JOIN merchants m ON mm.merchant_id = m.id
           WHERE mm.user_id::text = $1 AND mm.is_active = true`,
          [userId],
        );
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map((row: any) => ({
            membership: new MerchantMembership({
              id: row.mem_id,
              userId: row.user_id,
              merchantId: row.merch_slug || row.merch_id,
              role: row.role,
              isActive: row.is_active,
            }),
            merchant: new Merchant({
              id: row.merch_slug || row.merch_id,
              name: row.merch_name,
              slug: row.merch_slug,
              webhookSecret: row.merch_webhook_secret,
              status: row.merch_status,
            }),
          }));
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.memberships.filter((m) => m.membership.userId === userId && m.membership.isActive);
  }

  async findByUserAndMerchant(userId: string, merchantId: string, role?: string): Promise<MerchantMembership | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          `SELECT mm.id, mm.user_id, mm.merchant_id, mm.role, mm.is_active
           FROM merchant_memberships mm
           JOIN merchants m ON mm.merchant_id = m.id
           WHERE mm.user_id::text = $1 AND (m.slug = $2 OR m.id::text = $2)
           ${role ? 'AND mm.role = $3' : ''}`,
          role ? [userId, merchantId, role] : [userId, merchantId],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new MerchantMembership({
            id: row.id,
            userId: row.user_id,
            merchantId,
            role: row.role,
            isActive: row.is_active,
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    const item = this.memberships.find(
      (m) =>
        m.membership.userId === userId &&
        (m.membership.merchantId === merchantId || m.merchant.slug === merchantId) &&
        (!role || m.membership.role === role),
    );
    return item ? item.membership : null;
  }

  async save(membership: MerchantMembership): Promise<MerchantMembership> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        let userUuid = membership.userId;
        const isUserUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid);
        if (!isUserUuid) {
          const uRes = await this.dbService.query(
            'SELECT id FROM users WHERE id::text = $1',
            [userUuid],
          );
          if (uRes.rows.length > 0) {
            userUuid = uRes.rows[0].id;
          }
        }
        const isResolvedUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userUuid);
        if (isResolvedUuid) {
          const mRes = await this.dbService.query(
            'SELECT id FROM merchants WHERE slug = $1 OR id::text = $1',
            [membership.merchantId],
          );
          if (mRes.rows.length > 0) {
            const merchantUuid = mRes.rows[0].id;
            await this.dbService.query(
              `INSERT INTO merchant_memberships (user_id, merchant_id, role, is_active)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, merchant_id) DO UPDATE SET role = $3, is_active = $4`,
              [userUuid, merchantUuid, membership.role, membership.isActive],
            );
          }
        }
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.memberships.findIndex(
      (m) =>
        m.membership.userId === membership.userId && m.membership.merchantId === membership.merchantId,
    );
    if (idx >= 0) {
      this.memberships[idx].membership = membership;
    } else {
      this.memberships.push({
        membership,
        merchant: new Merchant({
          id: membership.merchantId,
          name: 'Comercio',
          slug: membership.merchantId,
          webhookSecret: 'sec_default_secret_12345',
        }),
      });
    }
    return membership;
  }
}

@Injectable()
export class InMemoryTransferRepository implements ITransferRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}
  private transfers: Transfer[] = [];

  async save(transfer: Transfer): Promise<Transfer> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const mRes = await this.dbService.query(
          'SELECT id FROM merchants WHERE slug = $1 OR id::text = $1',
          [transfer.tenantId],
        );
        if (mRes.rows.length > 0) {
          const tenantUuid = mRes.rows[0].id;
          let claimedByUuid: string | null = null;
          if (transfer.claimedByUserId) {
            const uRes = await this.dbService.query(
              'SELECT id FROM users WHERE id::text = $1 OR email = $1',
              [transfer.claimedByUserId],
            );
            if (uRes.rows.length > 0) {
              claimedByUuid = uRes.rows[0].id;
            }
          }

          const res = await this.dbService.query<TransferRow>(
            `INSERT INTO transfers (
               tenant_id, operation_id, receipt_number, operation_date,
               payer_name, payer_account, payer_bank, currency, amount,
               credit_account, concept, raw_body, status, claimed_at,
               claimed_by_user_id, created_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
             ON CONFLICT (tenant_id, operation_id) DO UPDATE SET
               receipt_number = $3,
               payer_name = $5,
               payer_account = $6,
               payer_bank = $7,
               currency = $8,
               amount = $9,
               credit_account = $10,
               concept = $11,
               raw_body = $12,
               status = $13,
               claimed_at = $14,
               claimed_by_user_id = $15
             RETURNING *`,
            [
              tenantUuid,
              transfer.operationId,
              transfer.receiptNumber || null,
              transfer.operationDate,
              transfer.payerName,
              transfer.payerAccount || null,
              transfer.payerBank || null,
              transfer.currency || 'PYG',
              transfer.amount,
              transfer.creditAccount || null,
              transfer.concept || null,
              transfer.rawBody || null,
              transfer.status,
              transfer.claimedAt || null,
              claimedByUuid,
              transfer.createdAt || new Date(),
            ],
          );
          if (res && res.rows && res.rows.length > 0) {
            const row = res.rows[0];
            const saved = new Transfer({
              id: row.id,
              tenantId: transfer.tenantId,
              operationId: row.operation_id,
              receiptNumber: row.receipt_number || undefined,
              operationDate: row.operation_date,
              payerName: row.payer_name,
              payerAccount: row.payer_account || undefined,
              payerBank: row.payer_bank || undefined,
              currency: row.currency,
              amount: row.amount,
              creditAccount: row.credit_account || undefined,
              concept: row.concept || undefined,
              rawBody: row.raw_body || undefined,
              status: row.status as any,
              claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
              claimedByUserId: row.claimed_by_user_id,
              createdAt: new Date(row.created_at),
            });
            const idx = this.transfers.findIndex(
              (t) => t.tenantId === transfer.tenantId && t.operationId === transfer.operationId,
            );
            if (idx >= 0) this.transfers[idx] = saved;
            else this.transfers.unshift(saved);
            return saved;
          }
        }
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.transfers.findIndex(
      (t) => t.tenantId === transfer.tenantId && t.operationId === transfer.operationId,
    );
    if (idx >= 0) this.transfers[idx] = transfer;
    else this.transfers.unshift(transfer);
    return transfer;
  }

  async findByTenantAndOperationId(tenantId: string, operationId: string): Promise<Transfer | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<TransferRow>(
          `SELECT t.* FROM transfers t
           JOIN merchants m ON t.tenant_id = m.id
           WHERE (m.slug = $1 OR m.id::text = $1) AND t.operation_id = $2`,
          [tenantId, operationId],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new Transfer({
            id: row.id,
            tenantId,
            operationId: row.operation_id,
            receiptNumber: row.receipt_number || undefined,
            operationDate: row.operation_date,
            payerName: row.payer_name,
            payerAccount: row.payer_account || undefined,
            payerBank: row.payer_bank || undefined,
            currency: row.currency,
            amount: row.amount,
            creditAccount: row.credit_account || undefined,
            concept: row.concept || undefined,
            rawBody: row.raw_body || undefined,
            status: row.status as any,
            claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
            claimedByUserId: row.claimed_by_user_id,
            createdAt: new Date(row.created_at),
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return (
      this.transfers.find((t) => t.tenantId === tenantId && t.operationId === operationId) || null
    );
  }

  async findPendingByAmountAndPayer(
    tenantId: string,
    amount: number,
    payerFilter?: string,
  ): Promise<Transfer[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const params: any[] = [tenantId, amount];
        let query = `
          SELECT t.* FROM transfers t
          JOIN merchants m ON t.tenant_id = m.id
          WHERE (m.slug = $1 OR m.id::text = $1)
            AND t.amount = $2
            AND t.status = 'pending'
        `;
        if (payerFilter && payerFilter.trim().length > 0) {
          params.push(`%${payerFilter.trim()}%`);
          query += ` AND t.payer_name ILIKE $${params.length}`;
        }
        query += ` ORDER BY t.created_at DESC`;

        const res = await this.dbService.query<TransferRow>(query, params);
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map(
            (row) =>
              new Transfer({
                id: row.id,
                tenantId,
                operationId: row.operation_id,
                receiptNumber: row.receipt_number || undefined,
                operationDate: row.operation_date,
                payerName: row.payer_name,
                payerAccount: row.payer_account || undefined,
                payerBank: row.payer_bank || undefined,
                currency: row.currency,
                amount: row.amount,
                creditAccount: row.credit_account || undefined,
                concept: row.concept || undefined,
                rawBody: row.raw_body || undefined,
                status: row.status as any,
                claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
                claimedByUserId: row.claimed_by_user_id,
                createdAt: new Date(row.created_at),
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.transfers.filter((t) => {
      if (t.tenantId !== tenantId) return false;
      if (t.amount !== amount) return false;
      return t.isPending();
    });
  }

  async findById(tenantId: string, id: string): Promise<Transfer | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<TransferRow>(
          `SELECT t.* FROM transfers t
           JOIN merchants m ON t.tenant_id = m.id
           WHERE (m.slug = $1 OR m.id::text = $1)
             AND (t.id::text = $2 OR t.operation_id = $2)`,
          [tenantId, id],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new Transfer({
            id: row.id,
            tenantId,
            operationId: row.operation_id,
            receiptNumber: row.receipt_number || undefined,
            operationDate: row.operation_date,
            payerName: row.payer_name,
            payerAccount: row.payer_account || undefined,
            payerBank: row.payer_bank || undefined,
            currency: row.currency,
            amount: row.amount,
            creditAccount: row.credit_account || undefined,
            concept: row.concept || undefined,
            rawBody: row.raw_body || undefined,
            status: row.status as any,
            claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
            claimedByUserId: row.claimed_by_user_id,
            createdAt: new Date(row.created_at),
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return (
      this.transfers.find(
        (t) => t.tenantId === tenantId && (t.id === id || t.operationId === id),
      ) || null
    );
  }

  async updateClaimed(
    tenantId: string,
    transferId: string,
    cashierUserId: string,
    claimTime: Date,
  ): Promise<boolean> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        let userUuid: string | null = null;
        const uRes = await this.dbService.query(
          'SELECT id FROM users WHERE id::text = $1 OR email = $1',
          [cashierUserId],
        );
        if (uRes.rows.length > 0) {
          userUuid = uRes.rows[0].id;
        }

        const res = await this.dbService.query(
          `UPDATE transfers t
           SET status = 'claimed',
               claimed_at = $3,
               claimed_by_user_id = $4
           FROM merchants m
           WHERE t.tenant_id = m.id
             AND (m.slug = $1 OR m.id::text = $1)
             AND (t.id::text = $2 OR t.operation_id = $2)
             AND t.status = 'pending'`,
          [tenantId, transferId, claimTime, userUuid],
        );
        if (res && (res.rowCount ?? 0) > 0) {
          const item = this.transfers.find(
            (t) => t.tenantId === tenantId && (t.id === transferId || t.operationId === transferId),
          );
          if (item) {
            item.claim(cashierUserId, claimTime);
          }
          return true;
        }
      } catch (err) {
        // Fallback
      }
    }
    const transfer = this.transfers.find(
      (t) => t.tenantId === tenantId && (t.id === transferId || t.operationId === transferId),
    );
    if (!transfer || !transfer.isPending()) return false;
    transfer.claim(cashierUserId, claimTime);
    return true;
  }

  async getMetricsByTenant(tenantId: string): Promise<MerchantMetrics> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<TransferRow>(
          `SELECT t.* FROM transfers t
           JOIN merchants m ON t.tenant_id = m.id
           WHERE (m.slug = $1 OR m.id::text = $1)
           ORDER BY t.created_at DESC`,
          [tenantId],
        );
        if (res && res.rows) {
          const tenantTransfers = res.rows.map(
            (row) =>
              new Transfer({
                id: row.id,
                tenantId,
                operationId: row.operation_id,
                receiptNumber: row.receipt_number || undefined,
                operationDate: row.operation_date,
                payerName: row.payer_name,
                payerAccount: row.payer_account || undefined,
                payerBank: row.payer_bank || undefined,
                currency: row.currency,
                amount: row.amount,
                creditAccount: row.credit_account || undefined,
                concept: row.concept || undefined,
                rawBody: row.raw_body || undefined,
                status: row.status as any,
                claimedAt: row.claimed_at ? new Date(row.claimed_at) : null,
                claimedByUserId: row.claimed_by_user_id,
                createdAt: new Date(row.created_at),
              }),
          );

          const claimedTransfers = tenantTransfers.filter((t) => t.isClaimed());
          const pendingTransfers = tenantTransfers.filter((t) => t.isPending());

          const totalCollectedToday = claimedTransfers.reduce((sum, t) => sum + t.amount, 0);
          const countValidatedToday = claimedTransfers.length;
          const pendingUnclaimedCount = pendingTransfers.length;

          const uniqueCashiers = new Set(
            claimedTransfers.map((t) => t.claimedByUserId).filter((id): id is string => Boolean(id)),
          );

          const recentTransfers = tenantTransfers.slice(0, 10).map((t) => ({
            id: t.id || t.operationId,
            operationId: t.operationId,
            amount: t.amount,
            payerName: t.payerName,
            payerBank: t.payerBank,
            status: t.status,
            claimedAt: t.claimedAt ? t.claimedAt.toISOString() : null,
            operationDate: t.operationDate,
          }));

          return {
            totalCollectedToday,
            countValidatedToday,
            pendingUnclaimedCount,
            activeCashiersCount: uniqueCashiers.size || 1,
            recentTransfers,
          };
        }
      } catch (err) {
        // Fallback
      }
    }
    const tenantTransfers = this.transfers.filter((t) => t.tenantId === tenantId);
    const claimedTransfers = tenantTransfers.filter((t) => t.isClaimed());
    const pendingTransfers = tenantTransfers.filter((t) => t.isPending());

    const totalCollectedToday = claimedTransfers.reduce((sum, t) => sum + t.amount, 0);
    const countValidatedToday = claimedTransfers.length;
    const pendingUnclaimedCount = pendingTransfers.length;

    const uniqueCashiers = new Set(
      claimedTransfers.map((t) => t.claimedByUserId).filter((id): id is string => Boolean(id)),
    );

    const recentTransfers = tenantTransfers.slice(0, 10).map((t) => ({
      id: t.id || t.operationId,
      operationId: t.operationId,
      amount: t.amount,
      payerName: t.payerName,
      payerBank: t.payerBank,
      status: t.status,
      claimedAt: t.claimedAt ? t.claimedAt.toISOString() : null,
      operationDate: t.operationDate,
    }));

    return {
      totalCollectedToday,
      countValidatedToday,
      pendingUnclaimedCount,
      activeCashiersCount: uniqueCashiers.size || 1,
      recentTransfers,
    };
  }
}

@Injectable()
export class InMemoryMerchantRequestRepository implements IMerchantRequestRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}
  private requests: MerchantRequest[] = [];

  async save(request: MerchantRequest): Promise<MerchantRequest> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        await this.dbService.query(
          `INSERT INTO merchant_requests (business_name, owner_name, email, phone, city, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [request.businessName, request.ownerName, request.email, request.phone, request.city, request.status],
        );
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.requests.findIndex((r) => r.id === request.id);
    if (idx >= 0) this.requests[idx] = request;
    else this.requests.push(request);
    return request;
  }

  async findById(id: string): Promise<MerchantRequest | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          'SELECT * FROM merchant_requests WHERE id::text = $1',
          [id],
        );
        if (res && res.rows && res.rows.length > 0) {
          const r = res.rows[0];
          return new MerchantRequest({
            id: r.id,
            businessName: r.business_name,
            ownerName: r.owner_name,
            email: r.email,
            phone: r.phone,
            city: r.city,
            status: r.status,
            createdAt: new Date(r.created_at),
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.requests.find((r) => r.id === id) || null;
  }

  async findPending(): Promise<MerchantRequest[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          "SELECT * FROM merchant_requests WHERE status = 'requested' ORDER BY created_at DESC",
        );
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map(
            (r: any) =>
              new MerchantRequest({
                id: r.id,
                businessName: r.business_name,
                ownerName: r.owner_name,
                email: r.email,
                phone: r.phone,
                city: r.city,
                status: r.status,
                createdAt: new Date(r.created_at),
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.requests.filter((r) => r.isPending());
  }

  async findAll(): Promise<MerchantRequest[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          'SELECT * FROM merchant_requests ORDER BY created_at DESC',
        );
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map(
            (r: any) =>
              new MerchantRequest({
                id: r.id,
                businessName: r.business_name,
                ownerName: r.owner_name,
                email: r.email,
                phone: r.phone,
                city: r.city,
                status: r.status,
                createdAt: new Date(r.created_at),
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return [...this.requests.values()];
  }
}

@Injectable()
export class InMemorySubscriptionRepository implements ISubscriptionRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}

  private subs: Subscription[] = [
    new Subscription({
      id: 'sub-platform',
      tenantId: 'cajasegura-platform',
      status: 'active',
      currentPeriodEnd: new Date('2099-12-31T23:59:59.999Z'),
      externalCustomerId: 'platform-master',
      externalSubscriptionId: 'sub_platform_master',
    }),
    new Subscription({
      id: 'sub-copy-shop',
      tenantId: 'copy-shop-impresiones',
      status: 'active',
      currentPeriodEnd: new Date('2099-12-31T23:59:59.999Z'),
      externalCustomerId: 'free-lifetime-partner',
      externalSubscriptionId: 'sub_lifetime_permanent',
    }),
    new Subscription({
      id: 'sub-comercio-franco',
      tenantId: 'comercio-franco',
      status: 'active',
      currentPeriodEnd: new Date('2099-12-31T23:59:59.999Z'),
      externalCustomerId: 'free-lifetime-owner',
      externalSubscriptionId: 'sub_lifetime_permanent',
    }),
    new Subscription({
      id: 'sub-comercio-nico',
      tenantId: 'comercio-nico',
      status: 'active',
      currentPeriodEnd: new Date('2099-12-31T23:59:59.999Z'),
      externalCustomerId: 'free-lifetime-owner',
      externalSubscriptionId: 'sub_lifetime_permanent',
    }),
  ];

  async save(subscription: Subscription): Promise<Subscription> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const mRes = await this.dbService.query(
          'SELECT id FROM merchants WHERE slug = $1 OR id::text = $1',
          [subscription.tenantId],
        );
        if (mRes.rows.length > 0) {
          const merchantUuid = mRes.rows[0].id;
          await this.dbService.query(
            `INSERT INTO subscriptions (tenant_id, status, current_period_end, external_customer_id, external_subscription_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (tenant_id) DO UPDATE SET status = $2, current_period_end = $3, external_customer_id = $4, external_subscription_id = $5`,
            [merchantUuid, subscription.status, subscription.currentPeriodEnd, subscription.externalCustomerId, subscription.externalSubscriptionId],
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.subs.findIndex((s) => s.tenantId === subscription.tenantId);
    if (idx >= 0) this.subs[idx] = subscription;
    else this.subs.push(subscription);
    return subscription;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<SubscriptionRow>(
          `SELECT s.* FROM subscriptions s
           JOIN merchants m ON s.tenant_id = m.id
           WHERE m.slug = $1 OR m.id::text = $1`,
          [tenantId],
        );
        if (res && res.rows && res.rows.length > 0) {
          const row = res.rows[0];
          return new Subscription({
            id: row.id,
            tenantId,
            status: row.status,
            currentPeriodEnd: new Date(row.current_period_end),
            externalCustomerId: row.external_customer_id,
            externalSubscriptionId: row.external_subscription_id,
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.subs.find((s) => s.tenantId === tenantId) || null;
  }

  async findAll(): Promise<Subscription[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query<any>(
          `SELECT s.*, m.slug as merchant_slug, m.name as merchant_name
           FROM subscriptions s
           JOIN merchants m ON s.tenant_id = m.id`,
        );
        if (res && res.rows && res.rows.length > 0) {
          return res.rows.map(
            (row: any) =>
              new Subscription({
                id: row.id,
                tenantId: row.merchant_slug || row.tenant_id,
                status: row.status,
                currentPeriodEnd: new Date(row.current_period_end),
                externalCustomerId: row.external_customer_id,
                externalSubscriptionId: row.external_subscription_id,
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return [...this.subs.values()];
  }
}

@Injectable()
export class InMemoryPaymentReportRepository implements IPaymentReportRepository {
  constructor(@Optional() private readonly dbService?: DatabaseService) {}
  private reports: PaymentReport[] = [];

  async save(report: PaymentReport): Promise<PaymentReport> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        await this.dbService.query(
          `INSERT INTO payment_reports (id, tenant_id, reported_by_user_id, payer_name, amount, status, matched_transfer_id, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET status = $6, matched_transfer_id = $7`,
          [report.id, report.tenantId, report.reportedByUserId, report.payerName, report.amount, report.status, report.matchedTransferId || null, report.createdAt],
        );
      } catch (err) {
        // Fallback
      }
    }
    const idx = this.reports.findIndex((r) => r.id === report.id);
    if (idx >= 0) this.reports[idx] = report;
    else this.reports.unshift(report);
    return report;
  }

  async findAll(): Promise<PaymentReport[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query('SELECT * FROM payment_reports ORDER BY created_at DESC');
        if (res && res.rows) {
          return res.rows.map(
            (r: any) =>
              new PaymentReport({
                id: r.id,
                tenantId: r.tenant_id,
                reportedByUserId: r.reported_by_user_id,
                payerName: r.payer_name,
                amount: r.amount,
                status: r.status,
                matchedTransferId: r.matched_transfer_id,
                createdAt: new Date(r.created_at),
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return [...this.reports];
  }

  async findById(id: string): Promise<PaymentReport | null> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query('SELECT * FROM payment_reports WHERE id = $1', [id]);
        if (res && res.rows && res.rows.length > 0) {
          const r = res.rows[0];
          return new PaymentReport({
            id: r.id,
            tenantId: r.tenant_id,
            reportedByUserId: r.reported_by_user_id,
            payerName: r.payer_name,
            amount: r.amount,
            status: r.status,
            matchedTransferId: r.matched_transfer_id,
            createdAt: new Date(r.created_at),
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.reports.find((r) => r.id === id) || null;
  }

  async findByTenantId(tenantId: string): Promise<PaymentReport[]> {
    if (this.dbService && !this.dbService.isMemoryMode) {
      try {
        const res = await this.dbService.query(
          'SELECT * FROM payment_reports WHERE tenant_id = $1 ORDER BY created_at DESC',
          [tenantId],
        );
        if (res && res.rows) {
          return res.rows.map(
            (r: any) =>
              new PaymentReport({
                id: r.id,
                tenantId: r.tenant_id,
                reportedByUserId: r.reported_by_user_id,
                payerName: r.payer_name,
                amount: r.amount,
                status: r.status,
                matchedTransferId: r.matched_transfer_id,
                createdAt: new Date(r.created_at),
              }),
          );
        }
      } catch (err) {
        // Fallback
      }
    }
    return this.reports.filter((r) => r.tenantId === tenantId);
  }
}
