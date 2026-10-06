import { BadRequestException } from '@nestjs/common';
import { MerchantController } from '../../src/presentation/controllers/merchant.controller';
import { GetMerchantMetricsUseCase } from '../../src/core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { User } from '../../src/core/domain/entities/user.entity';
import { MerchantMembership } from '../../src/core/domain/entities/merchant-membership.entity';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryPasswordHasher,
  InMemoryTransferRepository,
  InMemoryMerchantRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';
import { TenantContext } from '../../src/presentation/interceptors/tenant-context.service';

describe('MerchantController - Cashiers', () => {
  let controller: MerchantController;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let passwordHasher: InMemoryPasswordHasher;
  let transferRepo: InMemoryTransferRepository;
  let merchantRepo: InMemoryMerchantRepository;
  let getMetricsUseCase: GetMerchantMetricsUseCase;

  beforeEach(() => {
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    passwordHasher = new InMemoryPasswordHasher();
    transferRepo = new InMemoryTransferRepository();
    merchantRepo = new InMemoryMerchantRepository();
    getMetricsUseCase = new GetMerchantMetricsUseCase(transferRepo);

    controller = new MerchantController(
      getMetricsUseCase,
      membershipRepo,
      userRepo,
      passwordHasher,
      merchantRepo,
    );

    // Mock TenantContext
    TenantContext.run({ tenantId: 'test-tenant', role: 'MERCHANT_OWNER', userId: 'owner-1' }, () => {});
    jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('test-tenant');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should create a new cashier and save user and membership', async () => {
    const res = await controller.addCashier({
      fullName: 'Carlos Cajero',
      email: 'carlos@testcomercio.com',
      password: 'password123',
    });

    expect(res).toBeDefined();
    expect(res.role).toBe('CASHIER');
    expect(res.user.email).toBe('carlos@testcomercio.com');
    expect(res.user.fullName).toBe('Carlos Cajero');
    expect(res.isActive).toBe(true);

    // Verify cashier appears in getCashiers
    const list = await controller.getCashiers();
    expect(list.some((m) => m.user.email === 'carlos@testcomercio.com')).toBe(true);
  });

  it('should remove a cashier membership', async () => {
    const created = await controller.addCashier({
      fullName: 'Ana Cajera',
      email: 'ana@testcomercio.com',
      password: 'password123',
    });

    const deleteRes = await controller.removeCashier(created.id!);
    expect(deleteRes.success).toBe(true);

    const list = await controller.getCashiers();
    expect(list.some((m) => m.id === created.id)).toBe(false);
  });

  it('never overwrites an existing account password when the owner adds that email', async () => {
    const originalHash = await passwordHasher.hash('OriginalCashierPass1');
    await userRepo.save(
      new User({
        id: 'usr-existing-cashier',
        email: 'carlos@testcomercio.com',
        passwordHash: originalHash,
        fullName: 'Carlos Original',
      }),
    );

    const res = await controller.addCashier({
      fullName: 'Carlos Cajero',
      email: 'carlos@testcomercio.com',
      password: 'AttackerPassword1',
    });

    // The owner-authorized membership is still created...
    expect(res.role).toBe('CASHIER');
    expect(res.isActive).toBe(true);

    // ...but the pre-existing credentials are untouched.
    const stored = await userRepo.findByEmail('carlos@testcomercio.com');
    expect(await passwordHasher.compare('OriginalCashierPass1', stored!.passwordHash)).toBe(true);
    expect(await passwordHasher.compare('AttackerPassword1', stored!.passwordHash)).toBe(false);
  });

  it('adds the membership once and keeps the original password when adding the same cashier twice', async () => {
    await controller.addCashier({
      fullName: 'Ana Cajera',
      email: 'ana@testcomercio.com',
      password: 'FirstPass123',
    });
    await controller.addCashier({
      fullName: 'Ana Cajera',
      email: 'ana@testcomercio.com',
      password: 'SecondPass123',
    });

    const list = await controller.getCashiers();
    expect(list.filter((m) => m.user.email === 'ana@testcomercio.com')).toHaveLength(1);

    const stored = await userRepo.findByEmail('ana@testcomercio.com');
    expect(await passwordHasher.compare('FirstPass123', stored!.passwordHash)).toBe(true);
    expect(await passwordHasher.compare('SecondPass123', stored!.passwordHash)).toBe(false);
  });

  it('does not duplicate or downgrade an existing non-cashier membership for the tenant', async () => {
    await userRepo.save(
      new User({
        id: 'usr-owner-existing',
        email: 'owner@testcomercio.com',
        passwordHash: 'owner-password-hash-value',
        fullName: 'Owner User',
      }),
    );
    await membershipRepo.save(
      new MerchantMembership({
        id: 'mem-owner-test-tenant',
        userId: 'usr-owner-existing',
        merchantId: 'test-tenant',
        role: 'MERCHANT_OWNER',
        isActive: true,
      }),
    );

    await controller.addCashier({
      fullName: 'Owner User',
      email: 'owner@testcomercio.com',
      password: 'CashierRole1',
    });

    const entries = (await controller.getCashiers()).filter(
      (m) => m.userId === 'usr-owner-existing',
    );
    expect(entries).toHaveLength(1);
    expect(entries[0].role).toBe('MERCHANT_OWNER');
  });

  it('rejects a whitespace-only password at the boundary', async () => {
    await expect(
      controller.addCashier({
        fullName: 'Bad Password',
        email: 'badpass@testcomercio.com',
        password: '      ',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(await userRepo.findByEmail('badpass@testcomercio.com')).toBeNull();
  });
});
