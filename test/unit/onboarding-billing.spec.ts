import { ConflictException, NotFoundException } from '@nestjs/common';
import { SubmitMerchantRequestUseCase } from '../../src/core/application/use-cases/onboarding/submit-merchant-request.use-case';
import { ApproveMerchantRequestUseCase } from '../../src/core/application/use-cases/onboarding/approve-merchant-request.use-case';
import { SubscriptionBillingUseCase } from '../../src/core/application/use-cases/billing/subscription-billing.use-case';
import { MerchantRequest } from '../../src/core/domain/entities/merchant-request.entity';
import { Subscription } from '../../src/core/domain/entities/subscription.entity';
import {
  IMerchantRequestRepository,
  ISubscriptionRepository,
} from '../../src/core/application/ports/onboarding.ports';
import {
  IMerchantRepository,
  IUserRepository,
  IMembershipRepository,
} from '../../src/core/application/ports/auth.ports';

describe('Merchant Onboarding & Subscription Billing Lifecycle (T11, T12)', () => {
  let mockRequestRepo: jest.Mocked<IMerchantRequestRepository>;
  let mockMerchantRepo: jest.Mocked<IMerchantRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockMembershipRepo: jest.Mocked<IMembershipRepository>;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;

  beforeEach(() => {
    mockRequestRepo = {
      save: jest.fn().mockImplementation(async (r) => r),
      findById: jest.fn(),
      findPending: jest.fn(),
      findAll: jest.fn(),
    };
    mockMerchantRepo = {
      save: jest.fn().mockImplementation(async (m) => m),
      findById: jest.fn(),
      findBySlug: jest.fn(),
    };
    mockUserRepo = {
      save: jest.fn().mockImplementation(async (u) => u),
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    mockMembershipRepo = {
      save: jest.fn().mockImplementation(async (mem) => mem),
      findActiveByUser: jest.fn(),
      findByUserAndMerchant: jest.fn(),
    };
    mockSubRepo = {
      save: jest.fn().mockImplementation(async (s) => s),
      findByTenantId: jest.fn(),
      findAll: jest.fn(),
    };
  });

  describe('SubmitMerchantRequestUseCase (US-ONB-01)', () => {
    it('Scenario 1: Creates new merchant application in requested status', async () => {
      const useCase = new SubmitMerchantRequestUseCase(mockRequestRepo);
      const result = await useCase.execute({
        businessName: 'Farmacia San Cayetano',
        ownerName: 'Juan Duarte',
        email: 'juan@farmacia.com',
        phone: '+595981112233',
        city: 'Asuncion',
      });

      expect(result.status).toBe('requested');
      expect(result.businessName).toBe('Farmacia San Cayetano');
      expect(mockRequestRepo.save).toHaveBeenCalled();
    });
  });

  describe('ApproveMerchantRequestUseCase & Automated Provisioning', () => {
    it('Scenario 2: Provisions merchant, user, owner membership and 7-day trial in 1 action', async () => {
      const pendingReq = new MerchantRequest({
        id: 'req-001',
        businessName: 'Farmacia San Cayetano',
        ownerName: 'Juan Duarte',
        email: 'juan@farmacia.com',
        phone: '+595981112233',
        city: 'Asuncion',
      });
      mockRequestRepo.findById.mockResolvedValue(pendingReq);
      mockMerchantRepo.findBySlug.mockResolvedValue(null);
      mockUserRepo.findByEmail.mockResolvedValue(null);

      const useCase = new ApproveMerchantRequestUseCase(
        mockRequestRepo,
        mockMerchantRepo,
        mockUserRepo,
        mockMembershipRepo,
        mockSubRepo,
      );

      const result = await useCase.execute({ requestId: 'req-001' });

      expect(result.merchantSlug).toBe('farmacia-san-cayetano');
      expect(result.webhookSecret).toHaveLength(64); // 32 bytes hex
      expect(result.subscriptionStatus).toBe('trial');
      expect(pendingReq.status).toBe('approved');
      expect(mockMerchantRepo.save).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockMembershipRepo.save).toHaveBeenCalled();
      expect(mockSubRepo.save).toHaveBeenCalled();
    });

    it('Rejects approval if application already approved', async () => {
      const approvedReq = new MerchantRequest({
        id: 'req-002',
        businessName: 'Store',
        ownerName: 'Owner',
        email: 'owner@store.com',
        phone: '123',
        city: 'Asuncion',
        status: 'approved',
      });
      mockRequestRepo.findById.mockResolvedValue(approvedReq);

      const useCase = new ApproveMerchantRequestUseCase(
        mockRequestRepo,
        mockMerchantRepo,
        mockUserRepo,
        mockMembershipRepo,
        mockSubRepo,
      );

      await expect(useCase.execute({ requestId: 'req-002' })).rejects.toThrow(ConflictException);
    });
  });

  describe('SubscriptionBillingUseCase ($15/mo Lifecycle - FSM 3.2)', () => {
    it('Transitions trial -> active on payment confirmation', async () => {
      const existingTrial = new Subscription({
        id: 'sub-001',
        tenantId: 'merchant-123',
        status: 'trial',
        currentPeriodEnd: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      });
      mockSubRepo.findByTenantId.mockResolvedValue(existingTrial);

      const billingUseCase = new SubscriptionBillingUseCase(mockSubRepo);
      const result = await billingUseCase.confirmPayment({
        tenantId: 'merchant-123',
        externalSubscriptionId: 'sub_stripe_abc123',
        daysDuration: 30,
      });

      expect(result.status).toBe('active');
      expect(result.isActive).toBe(true);
      expect(result.isTrial).toBe(false);
      expect(mockSubRepo.save).toHaveBeenCalled();
    });

    it('Transitions active -> past_due on payment failure event', async () => {
      const existingActive = new Subscription({
        id: 'sub-001',
        tenantId: 'merchant-123',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      });
      mockSubRepo.findByTenantId.mockResolvedValue(existingActive);

      const billingUseCase = new SubscriptionBillingUseCase(mockSubRepo);
      const result = await billingUseCase.markPastDue('merchant-123');

      expect(result.status).toBe('past_due');
      expect(result.isActive).toBe(false);
    });
  });
});
