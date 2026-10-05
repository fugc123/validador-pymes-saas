import 'reflect-metadata';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { validate } from 'class-validator';
import { SubmitMerchantRequestUseCase } from '../../src/core/application/use-cases/onboarding/submit-merchant-request.use-case';
import { ApproveMerchantRequestUseCase } from '../../src/core/application/use-cases/onboarding/approve-merchant-request.use-case';
import { SubscriptionBillingUseCase } from '../../src/core/application/use-cases/billing/subscription-billing.use-case';
import { MerchantRequest } from '../../src/core/domain/entities/merchant-request.entity';
import { Subscription } from '../../src/core/domain/entities/subscription.entity';
import { User } from '../../src/core/domain/entities/user.entity';
import {
  SubmitMerchantRequestDto,
  CreateFreeMerchantDto,
} from '../../src/presentation/controllers/onboarding.controller';
import {
  IMerchantRequestRepository,
  ISubscriptionRepository,
} from '../../src/core/application/ports/onboarding.ports';
import {
  IMerchantRepository,
  IUserRepository,
  IMembershipRepository,
  IPasswordHasher,
} from '../../src/core/application/ports/auth.ports';

describe('Merchant Onboarding & Subscription Billing Lifecycle (T11, T12)', () => {
  let mockRequestRepo: jest.Mocked<IMerchantRequestRepository>;
  let mockMerchantRepo: jest.Mocked<IMerchantRepository>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockMembershipRepo: jest.Mocked<IMembershipRepository>;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockPasswordHasher: jest.Mocked<IPasswordHasher>;

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
      findMembersByMerchant: jest.fn(),
      deleteMembership: jest.fn(),
    };
    mockSubRepo = {
      save: jest.fn().mockImplementation(async (s) => s),
      findByTenantId: jest.fn(),
      findAll: jest.fn(),
    };
    mockPasswordHasher = {
      hash: jest.fn().mockResolvedValue('hashed_test_password'),
      compare: jest.fn().mockResolvedValue(true),
    };
  });

  describe('SubmitMerchantRequestUseCase (US-ONB-01)', () => {
    it('Scenario 1: Creates new merchant, user, owner membership and 7-day trial immediately', async () => {
      mockMerchantRepo.findBySlug.mockResolvedValue(null);
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(null);

      const useCase = new SubmitMerchantRequestUseCase(
        mockRequestRepo,
        mockMerchantRepo,
        mockUserRepo,
        mockMembershipRepo,
        mockSubRepo,
        mockPasswordHasher,
      );
      const result = await useCase.execute({
        businessName: 'Farmacia San Cayetano',
        ownerName: 'Juan Duarte',
        email: 'juan@farmacia.com',
        password: 'securePassword123',
        phone: '+595981112233',
        city: 'Asuncion',
      });

      expect(result.status).toBe('approved');
      expect(result.businessName).toBe('Farmacia San Cayetano');
      expect(result.subscriptionStatus).toBe('trial');
      expect(mockPasswordHasher.hash).toHaveBeenCalledWith('securePassword123');
      expect(mockMerchantRepo.save).toHaveBeenCalled();
      expect(mockUserRepo.save).toHaveBeenCalled();
      expect(mockMembershipRepo.save).toHaveBeenCalled();
      expect(mockSubRepo.save).toHaveBeenCalled();
      expect(mockRequestRepo.save).toHaveBeenCalled();
    });

    it('Scenario 1b: Allows user to register with password and stores hashed credentials', async () => {
      let savedUser: any = null;
      mockMerchantRepo.findBySlug.mockResolvedValue(null);
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.save.mockImplementation(async (u: any) => {
        savedUser = u;
        return u;
      });
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(null);

      const useCase = new SubmitMerchantRequestUseCase(
        mockRequestRepo,
        mockMerchantRepo,
        mockUserRepo,
        mockMembershipRepo,
        mockSubRepo,
        mockPasswordHasher,
      );

      const result = await useCase.execute({
        businessName: 'Librería Central',
        ownerName: 'Marta Gómez',
        email: 'marta@libreria.com',
        password: 'myTrialSecret123',
        phone: '+595981998877',
        city: 'Asuncion',
      });

      expect(result.status).toBe('approved');
      expect(result.ownerEmail).toBe('marta@libreria.com');
      expect(savedUser).toBeDefined();
      expect(savedUser.email).toBe('marta@libreria.com');
      expect(savedUser.passwordHash).toBe('hashed_test_password');
    });

    it('rejects signup with an already-registered email (409) without touching the account', async () => {
      const existingUser = new User({
        id: 'usr-existing',
        email: 'taken@store.com',
        passwordHash: 'original-password-hash',
        fullName: 'Existing Owner',
      });
      mockUserRepo.findByEmail.mockResolvedValue(existingUser);

      const useCase = new SubmitMerchantRequestUseCase(
        mockRequestRepo,
        mockMerchantRepo,
        mockUserRepo,
        mockMembershipRepo,
        mockSubRepo,
        mockPasswordHasher,
      );

      await expect(
        useCase.execute({
          businessName: 'Duplicate Store',
          ownerName: 'New Owner',
          email: 'taken@store.com',
          password: 'NewSecret123',
          phone: '+595981000000',
          city: 'Asuncion',
        }),
      ).rejects.toThrow(ConflictException);

      // The existing account is never altered and no tenant is linked to it.
      expect(existingUser.passwordHash).toBe('original-password-hash');
      expect(mockUserRepo.save).not.toHaveBeenCalled();
      expect(mockMembershipRepo.save).not.toHaveBeenCalled();
      expect(mockMerchantRepo.save).not.toHaveBeenCalled();
      expect(mockSubRepo.save).not.toHaveBeenCalled();
      expect(mockRequestRepo.save).not.toHaveBeenCalled();
    });

    it.each([undefined, '', '   '])(
      'rejects password %p instead of falling back to a default',
      async (password) => {
        const useCase = new SubmitMerchantRequestUseCase(
          mockRequestRepo,
          mockMerchantRepo,
          mockUserRepo,
          mockMembershipRepo,
          mockSubRepo,
          mockPasswordHasher,
        );

        await expect(
          useCase.execute({
            businessName: 'No Password Store',
            ownerName: 'Owner',
            email: 'nopass@store.com',
            password,
            phone: '+595982000000',
            city: 'Asuncion',
          }),
        ).rejects.toThrow(BadRequestException);
        expect(mockPasswordHasher.hash).not.toHaveBeenCalled();
        expect(mockMerchantRepo.save).not.toHaveBeenCalled();
      },
    );
  });

  describe('Onboarding DTO password boundary', () => {
    const validBase = {
      businessName: 'Boundary Store',
      ownerName: 'Boundary Owner',
      email: 'boundary@store.com',
      phone: '+595983000000',
      city: 'Asuncion',
    };

    it('rejects a missing password on public onboarding', async () => {
      const dto = Object.assign(new SubmitMerchantRequestDto(), validBase);
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password')).toBe(true);
    });

    it('rejects a shorter-than-minimum password on public onboarding', async () => {
      const dto = Object.assign(new SubmitMerchantRequestDto(), validBase, { password: 'abc' });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'password' && e.constraints?.minLength)).toBe(true);
    });

    it('rejects missing and short passwords on superadmin free-merchant signup', async () => {
      const missing = Object.assign(new CreateFreeMerchantDto(), validBase);
      expect((await validate(missing)).some((e) => e.property === 'password')).toBe(true);

      const short = Object.assign(new CreateFreeMerchantDto(), validBase, { password: 'abc' });
      expect(
        (await validate(short)).some((e) => e.property === 'password' && e.constraints?.minLength),
      ).toBe(true);
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
