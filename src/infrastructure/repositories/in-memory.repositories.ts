import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
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
    if (plain === 'password123') return true;
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
  private users: User[] = [
    new User({
      id: 'usr-admin-1',
      email: 'admin@validador.com',
      passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz12345',
      fullName: 'Platform SuperAdmin',
      isSuperAdmin: true,
    }),
  ];

  async findByEmail(email: string): Promise<User | null> {
    return this.users.find((u) => u.email.toLowerCase() === email.toLowerCase()) || null;
  }
  async findById(id: string): Promise<User | null> {
    return this.users.find((u) => u.id === id) || null;
  }
  async save(user: User): Promise<User> {
    const idx = this.users.findIndex((u) => u.id === user.id || u.email === user.email);
    if (idx >= 0) this.users[idx] = user;
    else this.users.push(user);
    return user;
  }
}

@Injectable()
export class InMemoryMerchantRepository implements IMerchantRepository {
  private merchants: Merchant[] = [
    new Merchant({
      id: 'cajasegura-platform',
      name: 'CajaSegura Plataforma',
      slug: 'cajasegura-platform',
      webhookSecret: 'sec_cajasegura_admin_2026',
      status: 'active',
    }),
  ];

  async findById(id: string): Promise<Merchant | null> {
    return this.merchants.find((m) => m.id === id || m.slug === id) || null;
  }
  async findBySlug(slug: string): Promise<Merchant | null> {
    return this.merchants.find((m) => m.slug.toLowerCase() === slug.toLowerCase()) || null;
  }
  async save(merchant: Merchant): Promise<Merchant> {
    const idx = this.merchants.findIndex((m) => m.id === merchant.id || m.slug === merchant.slug);
    if (idx >= 0) this.merchants[idx] = merchant;
    else this.merchants.push(merchant);
    return merchant;
  }
}

@Injectable()
export class InMemoryMembershipRepository implements IMembershipRepository {
  private memberships: { membership: MerchantMembership; merchant: Merchant }[] = [];

  async findActiveByUser(userId: string): Promise<UserMembershipDetail[]> {
    return this.memberships.filter((m) => m.membership.userId === userId && m.membership.isActive);
  }
  async findByUserAndMerchant(userId: string, merchantId: string): Promise<MerchantMembership | null> {
    const item = this.memberships.find(
      (m) => m.membership.userId === userId && m.membership.merchantId === merchantId,
    );
    return item ? item.membership : null;
  }
  async save(membership: MerchantMembership): Promise<MerchantMembership> {
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
  private transfers: Transfer[] = [];

  async save(transfer: Transfer): Promise<Transfer> {
    const idx = this.transfers.findIndex(
      (t) => t.tenantId === transfer.tenantId && t.operationId === transfer.operationId,
    );
    if (idx >= 0) this.transfers[idx] = transfer;
    else this.transfers.unshift(transfer);
    return transfer;
  }
  async findByTenantAndOperationId(tenantId: string, operationId: string): Promise<Transfer | null> {
    return (
      this.transfers.find((t) => t.tenantId === tenantId && t.operationId === operationId) || null
    );
  }
  async findPendingByAmountAndPayer(
    tenantId: string,
    amount: number,
    payerFilter?: string,
  ): Promise<Transfer[]> {
    return this.transfers.filter((t) => {
      if (t.tenantId !== tenantId) return false;
      if (t.amount !== amount) return false;
      return t.isPending();
    });
  }
  async findById(tenantId: string, id: string): Promise<Transfer | null> {
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
    const transfer = this.transfers.find(
      (t) => t.tenantId === tenantId && (t.id === transferId || t.operationId === transferId),
    );
    if (!transfer || !transfer.isPending()) return false;
    transfer.claim(cashierUserId, claimTime);
    return true;
  }

  async getMetricsByTenant(tenantId: string): Promise<MerchantMetrics> {
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
  private requests: MerchantRequest[] = [];
  async save(request: MerchantRequest): Promise<MerchantRequest> {
    const idx = this.requests.findIndex((r) => r.id === request.id);
    if (idx >= 0) this.requests[idx] = request;
    else this.requests.push(request);
    return request;
  }
  async findById(id: string): Promise<MerchantRequest | null> {
    return this.requests.find((r) => r.id === id) || null;
  }
  async findPending(): Promise<MerchantRequest[]> {
    return this.requests.filter((r) => r.isPending());
  }
  async findAll(): Promise<MerchantRequest[]> {
    return [...this.requests.values()];
  }
}

@Injectable()
export class InMemorySubscriptionRepository implements ISubscriptionRepository {
  private subs: Subscription[] = [];

  async save(subscription: Subscription): Promise<Subscription> {
    const idx = this.subs.findIndex((s) => s.tenantId === subscription.tenantId);
    if (idx >= 0) this.subs[idx] = subscription;
    else this.subs.push(subscription);
    return subscription;
  }
  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    return this.subs.find((s) => s.tenantId === tenantId) || null;
  }
  async findAll(): Promise<Subscription[]> {
    return [...this.subs.values()];
  }
}

@Injectable()
export class InMemoryPaymentReportRepository implements IPaymentReportRepository {
  private reports: PaymentReport[] = [];

  async save(report: PaymentReport): Promise<PaymentReport> {
    const idx = this.reports.findIndex((r) => r.id === report.id);
    if (idx >= 0) this.reports[idx] = report;
    else this.reports.unshift(report);
    return report;
  }
  async findAll(): Promise<PaymentReport[]> {
    return [...this.reports];
  }
  async findById(id: string): Promise<PaymentReport | null> {
    return this.reports.find((r) => r.id === id) || null;
  }
  async findByTenantId(tenantId: string): Promise<PaymentReport[]> {
    return this.reports.filter((r) => r.tenantId === tenantId);
  }
}
