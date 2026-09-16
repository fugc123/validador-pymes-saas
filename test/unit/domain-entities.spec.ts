import {
  Merchant,
  User,
  MerchantMembership,
  Transfer,
  Subscription,
  MerchantRequest,
} from '../../src/core/domain/entities';
import {
  TransferAlreadyClaimedException,
  TransferExpiredException,
  InvalidAmountException,
  InvalidMembershipRoleException,
  InvalidMerchantRequestStateException,
  DomainException,
} from '../../src/core/domain/exceptions';

describe('Domain Entities & Invariants (T02)', () => {
  describe('Transfer Entity & Anti-Replay Invariants', () => {
    const validProps = {
      tenantId: 'tenant-123',
      operationId: '45601',
      operationDate: '16/09/2026 14:30',
      payerName: 'ALEJANDRA CHENA',
      amount: 26000,
      currency: 'PYG',
    };

    it('should create a valid transfer in pending status', () => {
      const transfer = new Transfer(validProps);
      expect(transfer.tenantId).toBe('tenant-123');
      expect(transfer.operationId).toBe('45601');
      expect(transfer.amount).toBe(26000);
      expect(transfer.isPending()).toBe(true);
      expect(transfer.isClaimed()).toBe(false);
      expect(transfer.claimedAt).toBeNull();
    });

    it('should reject non-positive or non-integer amounts', () => {
      expect(() => new Transfer({ ...validProps, amount: 0 })).toThrow(InvalidAmountException);
      expect(() => new Transfer({ ...validProps, amount: -5000 })).toThrow(InvalidAmountException);
      expect(() => new Transfer({ ...validProps, amount: 26000.5 })).toThrow(InvalidAmountException);
    });

    it('should successfully transition from pending to claimed', () => {
      const transfer = new Transfer(validProps);
      const cashierId = 'user-cashier-1';
      const claimTime = new Date();

      transfer.claim(cashierId, claimTime);

      expect(transfer.isClaimed()).toBe(true);
      expect(transfer.status).toBe('claimed');
      expect(transfer.claimedByUserId).toBe(cashierId);
      expect(transfer.claimedAt).toEqual(claimTime);
    });

    it('should enforce Article II Anti-Replay Invariant: throw if claimed twice', () => {
      const transfer = new Transfer(validProps);
      transfer.claim('cashier-1');

      expect(() => transfer.claim('cashier-2')).toThrow(TransferAlreadyClaimedException);
    });

    it('should throw TransferExpiredException if transfer is older than 45 minutes', () => {
      const oldDate = new Date(Date.now() - 50 * 60 * 1000); // 50 mins ago
      const transfer = new Transfer({
        ...validProps,
        createdAt: oldDate,
      });

      expect(transfer.isExpired(45)).toBe(true);
      expect(() => transfer.claim('cashier-1')).toThrow(TransferExpiredException);
    });
  });

  describe('Merchant Membership & Multi-Tenant Roles (ADR-008)', () => {
    it('should create a valid merchant membership for OWNER', () => {
      const membership = new MerchantMembership({
        userId: 'user-1',
        merchantId: 'store-a',
        role: 'MERCHANT_OWNER',
      });
      expect(membership.isOwner()).toBe(true);
      expect(membership.isCashier()).toBe(false);
      expect(membership.isActive).toBe(true);
    });

    it('should create a valid merchant membership for CASHIER', () => {
      const membership = new MerchantMembership({
        userId: 'user-1',
        merchantId: 'store-b',
        role: 'CASHIER',
      });
      expect(membership.isOwner()).toBe(false);
      expect(membership.isCashier()).toBe(true);
    });

    it('should reject invalid roles', () => {
      expect(
        () =>
          new MerchantMembership({
            userId: 'user-1',
            merchantId: 'store-a',
            role: 'SUPER_ADMIN' as any,
          }),
      ).toThrow(InvalidMembershipRoleException);
    });

    it('should handle activation and deactivation', () => {
      const membership = new MerchantMembership({
        userId: 'user-1',
        merchantId: 'store-a',
        role: 'CASHIER',
      });
      membership.deactivate();
      expect(membership.isActive).toBe(false);
      expect(membership.isCashier()).toBe(false);

      membership.activate();
      expect(membership.isActive).toBe(true);
      expect(membership.isCashier()).toBe(true);
    });
  });

  describe('Merchant Entity', () => {
    it('should create a valid merchant', () => {
      const merchant = new Merchant({
        name: 'Kiosko San Roque',
        slug: 'kiosko-san-roque',
        webhookSecret: 'super-secret-webhook-key-12345',
      });
      expect(merchant.name).toBe('Kiosko San Roque');
      expect(merchant.slug).toBe('kiosko-san-roque');
      expect(merchant.isActive()).toBe(true);
    });

    it('should reject invalid slug formats', () => {
      expect(
        () =>
          new Merchant({
            name: 'Store',
            slug: 'Invalid Slug With Spaces!',
            webhookSecret: 'super-secret-webhook-key-12345',
          }),
      ).toThrow(DomainException);
    });

    it('should handle suspend and activate lifecycle', () => {
      const merchant = new Merchant({
        name: 'Store',
        slug: 'store-a',
        webhookSecret: 'super-secret-webhook-key-12345',
      });
      merchant.suspend();
      expect(merchant.isActive()).toBe(false);
      expect(merchant.status).toBe('suspended');

      merchant.activate();
      expect(merchant.isActive()).toBe(true);
      expect(merchant.status).toBe('active');
    });
  });

  describe('User Entity', () => {
    it('should create a valid user with normalized email', () => {
      const user = new User({
        email: 'Franco@Gmail.com  ',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz12345',
        fullName: 'Franco Galeano',
      });
      expect(user.email).toBe('franco@gmail.com');
      expect(user.fullName).toBe('Franco Galeano');
      expect(user.isSuperAdmin).toBe(false);
    });

    it('should promote and revoke superadmin status', () => {
      const user = new User({
        email: 'admin@system.com',
        passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz12345',
        fullName: 'Platform Admin',
      });
      user.promoteToSuperAdmin();
      expect(user.isSuperAdmin).toBe(true);

      user.revokeSuperAdmin();
      expect(user.isSuperAdmin).toBe(false);
    });
  });

  describe('Subscription Entity ($15/mo Lifecycle)', () => {
    it('should initialize in trial status and compute active status correctly', () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const sub = new Subscription({
        tenantId: 'tenant-1',
        currentPeriodEnd: futureDate,
      });
      expect(sub.isTrial()).toBe(true);
      expect(sub.isActive()).toBe(true);
    });

    it('should report inactive when expired or cancelled', () => {
      const pastDate = new Date(Date.now() - 1000);
      const sub = new Subscription({
        tenantId: 'tenant-1',
        currentPeriodEnd: pastDate,
      });
      expect(sub.isActive()).toBe(false);

      sub.activate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
      expect(sub.isActive()).toBe(true);

      sub.cancel();
      expect(sub.isActive()).toBe(false);
    });
  });

  describe('MerchantRequest Entity (Onboarding Flow)', () => {
    it('should handle request lifecycle: requested -> approved', () => {
      const req = new MerchantRequest({
        businessName: 'Farmacia Central',
        ownerName: 'Juan Perez',
        email: 'juan@farmacia.com',
        phone: '+595981123456',
        city: 'Asuncion',
      });
      expect(req.isPending()).toBe(true);
      req.approve();
      expect(req.status).toBe('approved');
      expect(() => req.reject()).toThrow(InvalidMerchantRequestStateException);
    });
  });
});
