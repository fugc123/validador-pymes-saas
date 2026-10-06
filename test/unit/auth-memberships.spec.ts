import { UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { LoginUseCase } from '../../src/core/application/use-cases/auth/login.use-case';
import { SelectTenantUseCase } from '../../src/core/application/use-cases/auth/select-tenant.use-case';
import { SwitchTenantUseCase } from '../../src/core/application/use-cases/auth/switch-tenant.use-case';
import { AuthController } from '../../src/presentation/controllers/auth.controller';
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
import { InMemoryMembershipRepository } from '../../src/infrastructure/repositories/in-memory.repositories';
import { DatabaseService } from '../../src/infrastructure/database/database.service';

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
      findMembersByMerchant: jest.fn(),
      deleteMembership: jest.fn(),
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
    /** Wires the happy path so the only reason a test fails is its token assertion. */
    const primeSelectionHappyPath = () => {
      mockUserRepo.findById.mockResolvedValue(sampleUser);
      mockMerchantRepo.findById.mockResolvedValue(storeB);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(
        new MerchantMembership({
          userId: 'user-001',
          merchantId: 'store-b',
          role: 'CASHIER',
        }),
      );
    };

    it('Scenario 3: Successfully select store and issue scoped JWT', async () => {
      primeSelectionHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-001',
        purpose: 'tenant_selection',
      });

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      const result = await useCase.execute({
        userId: 'user-001',
        tenantId: 'store-b',
        token: 'valid.temp.selection.jwt',
      });

      expect(result.accessToken).toBe('mock.scoped.jwt');
      expect(result.activeTenant.tenantId).toBe('store-b');
      expect(result.activeTenant.role).toBe('CASHIER');
    });

    it('Scenario 4: Rejects unauthorized store selection with ForbiddenException', async () => {
      primeSelectionHappyPath();
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(null); // No membership
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-001',
        purpose: 'tenant_selection',
      });

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          tenantId: 'store-b',
          token: 'valid.temp.selection.jwt',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a tenant selection without any token (401)', async () => {
      primeSelectionHappyPath();

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({ userId: 'user-001', tenantId: 'store-b' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.verifyToken).not.toHaveBeenCalled();
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired selection token (401)', async () => {
      primeSelectionHappyPath();
      mockTokenService.verifyToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          tenantId: 'store-b',
          token: 'tampered.selection.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects an access-purpose token on tenant selection (401)', async () => {
      primeSelectionHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-001',
        purpose: 'access',
      });

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          tenantId: 'store-b',
          token: 'valid.scoped.access.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects a selection token issued for a different user (401)', async () => {
      primeSelectionHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-999',
        purpose: 'tenant_selection',
      });

      const useCase = new SelectTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          tenantId: 'store-b',
          token: 'other.user.temp.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });
  });

  describe('SwitchTenantUseCase', () => {
    /** Wires the happy path so the only reason a test fails is its token assertion. */
    const primeSwitchHappyPath = () => {
      mockUserRepo.findById.mockResolvedValue(sampleUser);
      mockMerchantRepo.findById.mockResolvedValue(storeA);
      mockMembershipRepo.findByUserAndMerchant.mockResolvedValue(
        new MerchantMembership({
          userId: 'user-001',
          merchantId: 'store-a',
          role: 'MERCHANT_OWNER',
        }),
      );
    };

    it('should switch between stores if membership exists', async () => {
      primeSwitchHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-001',
        purpose: 'access',
      });

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      const result = await useCase.execute({
        userId: 'user-001',
        targetTenantId: 'store-a',
        token: 'valid.scoped.access.jwt',
      });
      expect(result.accessToken).toBe('mock.scoped.jwt');
      expect(result.activeTenant.role).toBe('MERCHANT_OWNER');
      // Membership authorization is preserved: the repository is still consulted.
      expect(mockMembershipRepo.findByUserAndMerchant).toHaveBeenCalledWith(
        'user-001',
        'store-a',
        undefined,
      );
    });

    it('rejects a tenant switch without any token (401)', async () => {
      primeSwitchHappyPath();

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({ userId: 'user-001', targetTenantId: 'store-a' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects an invalid or expired access token on tenant switch (401)', async () => {
      primeSwitchHappyPath();
      mockTokenService.verifyToken.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          targetTenantId: 'store-a',
          token: 'tampered.access.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects a temporary selection token on tenant switch (401)', async () => {
      primeSwitchHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-001',
        purpose: 'tenant_selection',
      });

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          targetTenantId: 'store-a',
          token: 'valid.temp.selection.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });

    it('rejects an access token issued for a different user (401)', async () => {
      primeSwitchHappyPath();
      mockTokenService.verifyToken.mockReturnValue({
        userId: 'user-999',
        purpose: 'access',
      });

      const useCase = new SwitchTenantUseCase(
        mockUserRepo,
        mockMerchantRepo,
        mockMembershipRepo,
        mockTokenService,
      );

      await expect(
        useCase.execute({
          userId: 'user-001',
          targetTenantId: 'store-a',
          token: 'other.user.access.jwt',
        }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokenService.signScopedToken).not.toHaveBeenCalled();
    });
  });

  describe('AuthController authorization header forwarding', () => {
    const loginUseCase = { execute: jest.fn() };
    const selectUseCase = { execute: jest.fn().mockResolvedValue({ accessToken: 'scoped' }) };
    const switchUseCase = { execute: jest.fn().mockResolvedValue({ accessToken: 'scoped' }) };
    const controller = new AuthController(
      loginUseCase as unknown as LoginUseCase,
      selectUseCase as unknown as SelectTenantUseCase,
      switchUseCase as unknown as SwitchTenantUseCase,
    );

    it('forwards the bearer token to tenant selection', async () => {
      await controller.selectTenant(
        { userId: 'user-001', tenantId: 'store-b' },
        'Bearer temp-selection-jwt',
      );

      expect(selectUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-001',
        tenantId: 'store-b',
        token: 'temp-selection-jwt',
      });
    });

    it('forwards the bearer token to tenant switching', async () => {
      await controller.switchTenant(
        { userId: 'user-001', targetTenantId: 'store-a' },
        'Bearer scoped-access-jwt',
      );

      expect(switchUseCase.execute).toHaveBeenCalledWith({
        userId: 'user-001',
        targetTenantId: 'store-a',
        token: 'scoped-access-jwt',
      });
    });
  });
});

describe('Membership repository - tenant-scoped deletion (trust boundary)', () => {
  const newMembership = (id: string, merchantId: string) =>
    new MerchantMembership({
      id,
      userId: `usr-${id}`,
      merchantId,
      role: 'CASHIER',
      isActive: true,
    });

  /** Stands in for PostgreSQL: records the SQL/params and replays a canned result. */
  const fakeDbService = (result: { rows: unknown[]; rowCount?: number }) => {
    const db = new DatabaseService({ get: () => undefined } as any);
    db.isMemoryMode = false;
    const query = jest.fn().mockResolvedValue(result);
    (db as any).query = query;
    return { db, query };
  };

  it('memory mode deletes a membership only when it belongs to the given tenant', async () => {
    const repo = new InMemoryMembershipRepository();
    await repo.save(newMembership('mem-same', 'store-a'));
    await repo.save(newMembership('mem-other', 'store-b'));

    expect(await repo.deleteMembership('store-a', 'mem-same')).toBe(true);
    expect(await repo.deleteMembership('store-a', 'mem-other')).toBe(false);

    expect((await repo.findMembersByMerchant('store-a')).some((m) => m.id === 'mem-same')).toBe(false);
    expect((await repo.findMembersByMerchant('store-b')).some((m) => m.id === 'mem-other')).toBe(true);
  });

  it('database mode scopes the DELETE to both the membership id and its owning merchant', async () => {
    const { db, query } = fakeDbService({ rows: [], rowCount: 0 });
    const repo = new InMemoryMembershipRepository(db);

    expect(await repo.deleteMembership('store-a', 'mem-1')).toBe(false);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('DELETE FROM merchant_memberships');
    expect(sql).toMatch(/WHERE[\s\S]*merchant_id/);
    expect(params).toEqual(['mem-1', 'store-a']);
  });

  it('database mode reports a deleted same-tenant row as true', async () => {
    const { db } = fakeDbService({ rows: [{ id: 'mem-1' }], rowCount: 1 });
    const repo = new InMemoryMembershipRepository(db);

    expect(await repo.deleteMembership('store-a', 'mem-1')).toBe(true);
  });
});
