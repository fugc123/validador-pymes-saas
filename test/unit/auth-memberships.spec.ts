import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { LoginUseCase } from '../../src/core/application/use-cases/auth/login.use-case';
import { SelectTenantUseCase } from '../../src/core/application/use-cases/auth/select-tenant.use-case';
import { SwitchTenantUseCase } from '../../src/core/application/use-cases/auth/switch-tenant.use-case';
import { User } from '../../src/core/domain/entities/user.entity';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import { MerchantMembership } from '../../src/core/domain/entities/merchant-membership.entity';
import {
  IUserRepository,
  IMerchantRepository,
  IMembershipRepository,
  IPasswordHasher,
  ITokenService,
} from '../../src/core/application/ports/auth.ports';

describe('Two-Stage Authentication & Multi-Tenant Memberships (T05)', () => {
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockMerchantRepo: jest.Mocked<IMerchantRepository>;
  let mockMembershipRepo: jest.Mocked<IMembershipRepository>;
  let mockPasswordHasher: jest.Mocked<IPasswordHasher>;
  let mockTokenService: jest.Mocked<ITokenService>;

  const sampleUser = new User({
    id: 'user-001',
    email: 'franco@gmail.com',
    passwordHash: '$2a$10$hashedPassword123',
    fullName: 'Franco Galeano',
  });

  const storeA = new Merchant({
    id: 'store-a',
    name: 'Kiosko San Roque',
    slug: 'kiosko-san-roque',
    webhookSecret: 'secret-webhook-key-12345',
  });

  const storeB = new Merchant({
    id: 'store-b',
    name: 'Boutique Asuncion',
    slug: 'boutique-asuncion',
    webhookSecret: 'secret-webhook-key-67890',
  });

  beforeEach(() => {
    mockUserRepo = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
    };
    mockMerchantRepo = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      save: jest.fn(),
    };
    mockMembershipRepo = {
      findActiveByUser: jest.fn(),
      findByUserAndMerchant: jest.fn(),
      save: jest.fn(),
    };
    mockPasswordHasher = {
      hash: jest.fn(),
      compare: jest.fn(),
    };
    mockTokenService = {
      signScopedToken: jest.fn().mockReturnValue('mock.scoped.jwt'),
      signTempToken: jest.fn().mockReturnValue('mock.temp.token'),
      verifyToken: jest.fn(),
    };
  });

  describe('LoginUseCase', () => {
    it('should throw UnauthorizedException on invalid credentials', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      const useCase = new LoginUseCase(mockUserRepo, mockMembershipRepo, mockPasswordHasher, mockTokenService);

      await expect(
        useCase.execute({ email: 'unknown@user.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('Scenario 1: Single Store Fast-Path returns scoped JWT directly', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(sampleUser);
      mockPasswordHasher.compare.mockResolvedValue(true);
      mockMembershipRepo.findActiveByUser.mockResolvedValue([
        {
          membership: new MerchantMembership({
            userId: 'user-001',
            merchantId: 'store-a',
            role: 'MERCHANT_OWNER',
          }),
          merchant: storeA,
        },
      ]);

      const useCase = new LoginUseCase(mockUserRepo, mockMembershipRepo, mockPasswordHasher, mockTokenService);
      const result = await useCase.execute({ email: 'franco@gmail.com', password: 'correct' });

      expect(result.requiresTenantSelection).toBe(false);
      if (!result.requiresTenantSelection && result.activeTenant && 'tenantId' in result.activeTenant) {
        expect(result.accessToken).toBe('mock.scoped.jwt');
        expect(result.activeTenant.tenantId).toBe('store-a');
        expect(result.activeTenant.role).toBe('MERCHANT_OWNER');
      }
      expect(mockTokenService.signScopedToken).toHaveBeenCalledWith({
        userId: 'user-001',
        email: 'franco@gmail.com',
        tenantId: 'store-a',
        role: 'MERCHANT_OWNER',
        isSuperAdmin: false,
      });
    });

    it('Scenario 2: Multi-Store Organization Selection returns temp token and store list', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(sampleUser);
      mockPasswordHasher.compare.mockResolvedValue(true);
      mockMembershipRepo.findActiveByUser.mockResolvedValue([
        {
          membership: new MerchantMembership({
            userId: 'user-001',
            merchantId: 'store-a',
            role: 'MERCHANT_OWNER',
          }),
          merchant: storeA,
        },
        {
          membership: new MerchantMembership({
            userId: 'user-001',
            merchantId: 'store-b',
            role: 'CASHIER',
          }),
          merchant: storeB,
        },
      ]);

      const useCase = new LoginUseCase(mockUserRepo, mockMembershipRepo, mockPasswordHasher, mockTokenService);
      const result = await useCase.execute({ email: 'franco@gmail.com', password: 'correct' });

      expect(result.requiresTenantSelection).toBe(true);
      if (result.requiresTenantSelection) {
        expect(result.tempToken).toBe('mock.temp.token');
        expect(result.memberships).toHaveLength(2);
        expect(result.memberships[0].tenantId).toBe('store-a');
        expect(result.memberships[0].role).toBe('MERCHANT_OWNER');
        expect(result.memberships[1].tenantId).toBe('store-b');
        expect(result.memberships[1].role).toBe('CASHIER');
      }
    });

    it('should throw ForbiddenException if user has 0 memberships and is not SuperAdmin', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(sampleUser);
      mockPasswordHasher.compare.mockResolvedValue(true);
      mockMembershipRepo.findActiveByUser.mockResolvedValue([]);

      const useCase = new LoginUseCase(mockUserRepo, mockMembershipRepo, mockPasswordHasher, mockTokenService);
      await expect(
        useCase.execute({ email: 'franco@gmail.com', password: 'correct' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SelectTenantUseCase', () => {
    it('Scenario 3: Successfully select store and issue scoped JWT', async () => {
      mockUserRepo.findById.mockResolvedValue(sampleUser);
      mockMerchantRepo.findById.mockResolvedValue(storeB);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(
        new MerchantMembership({
          userId: 'user-001',
          merchantId: 'store-b',
          role: 'CASHIER',
        }),
      );

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      const result = await useCase.execute({ userId: 'user-001', tenantId: 'store-b' });

      expect(result.accessToken).toBe('mock.scoped.jwt');
      expect(result.activeTenant.tenantId).toBe('store-b');
      expect(result.activeTenant.role).toBe('CASHIER');
    });

    it('Scenario 4: Rejects unauthorized store selection with ForbiddenException', async () => {
      mockUserRepo.findById.mockResolvedValue(sampleUser);
      mockMerchantRepo.findById.mockResolvedValue(storeB);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(null); // No membership

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({ userId: 'user-001', tenantId: 'store-b' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('SwitchTenantUseCase', () => {
    it('should switch between stores if membership exists', async () => {
      mockUserRepo.findById.mockResolvedValue(sampleUser);
      mockMerchantRepo.findById.mockResolvedValue(storeA);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(
        new MerchantMembership({
          userId: 'user-001',
          merchantId: 'store-a',
          role: 'MERCHANT_OWNER',
        }),
      );

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      const result = await useCase.execute({ userId: 'user-001', targetTenantId: 'store-a' });
      expect(result.accessToken).toBe('mock.scoped.jwt');
      expect(result.activeTenant.role).toBe('MERCHANT_OWNER');
    });
  });
});
