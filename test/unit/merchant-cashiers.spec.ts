import { MerchantController } from '../../src/presentation/controllers/merchant.controller';
import { GetMerchantMetricsUseCase } from '../../src/core/application/use-cases/transfers/get-merchant-metrics.use-case';
import {
  InMemoryMembershipRepository,
  InMemoryUserRepository,
  InMemoryPasswordHasher,
  InMemoryTransferRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';
import { TenantContext } from '../../src/presentation/interceptors/tenant-context.service';

describe('MerchantController - Cashiers', () => {
  let controller: MerchantController;
  let membershipRepo: InMemoryMembershipRepository;
  let userRepo: InMemoryUserRepository;
  let passwordHasher: InMemoryPasswordHasher;
  let transferRepo: InMemoryTransferRepository;
  let getMetricsUseCase: GetMerchantMetricsUseCase;

  beforeEach(() => {
    membershipRepo = new InMemoryMembershipRepository();
    userRepo = new InMemoryUserRepository();
    passwordHasher = new InMemoryPasswordHasher();
    transferRepo = new InMemoryTransferRepository();
    getMetricsUseCase = new GetMerchantMetricsUseCase(transferRepo);

    controller = new MerchantController(
      getMetricsUseCase,
      membershipRepo,
      userRepo,
      passwordHasher,
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
});
