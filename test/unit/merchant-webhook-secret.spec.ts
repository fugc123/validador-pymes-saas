/**
 * Owner-authorized retrieval of the persisted merchant webhook secret.
 *
 * The endpoint must return exactly the stored `webhookSecret` for the active
 * tenant (never a value derived from the tenant slug), fail closed when the
 * tenant has no persisted merchant, deny cashiers through the real `@Roles`
 * metadata, and reject requests that carry another tenant id.
 */

import 'reflect-metadata';
import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { MerchantController } from '../../src/presentation/controllers/merchant.controller';
import { GetMerchantMetricsUseCase } from '../../src/core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { RolesGuard } from '../../src/presentation/guards/roles.guard';
import { TenantGuard } from '../../src/presentation/guards/tenant.guard';
import { TenantContext } from '../../src/presentation/interceptors/tenant-context.service';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import {
  InMemoryMerchantRepository,
  InMemoryMembershipRepository,
  InMemoryPasswordHasher,
  InMemoryTransferRepository,
  InMemoryUserRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';

describe('MerchantController - Owner webhook secret endpoint', () => {
  let controller: MerchantController;
  let merchantRepo: InMemoryMerchantRepository;
  let getTenantId: jest.SpyInstance;

  const ALPHA_SECRET = 'alpha-stored-secret-3f9a1c5e7b2d4806';
  const BETA_SECRET = 'beta-stored-secret-9d4e2a7f1c6b5038';

  beforeEach(async () => {
    merchantRepo = new InMemoryMerchantRepository();
    await merchantRepo.save(
      new Merchant({
        id: 'tenant-alpha',
        name: 'Tenant Alpha',
        slug: 'tenant-alpha',
        webhookSecret: ALPHA_SECRET,
        status: 'active',
      }),
    );
    await merchantRepo.save(
      new Merchant({
        id: 'tenant-beta',
        name: 'Tenant Beta',
        slug: 'tenant-beta',
        webhookSecret: BETA_SECRET,
        status: 'active',
      }),
    );

    controller = new MerchantController(
      new GetMerchantMetricsUseCase(new InMemoryTransferRepository()),
      new InMemoryMembershipRepository(),
      new InMemoryUserRepository(),
      new InMemoryPasswordHasher(),
      merchantRepo,
    );

    getTenantId = jest.spyOn(TenantContext, 'getTenantId').mockReturnValue('tenant-alpha');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the persisted secret for the active tenant, never a slug-derived value', async () => {
    const res = await controller.getWebhookSecret();

    expect(res.webhookSecret).toBe(ALPHA_SECRET);
    expect(res.webhookSecret).not.toBe('sec_tenant_alpha_pos');
    expect(res.webhookSecret).not.toBe('sec_tenant-alpha_pos');
  });

  it('scopes the response to the active tenant context', async () => {
    getTenantId.mockReturnValue('tenant-beta');

    const res = await controller.getWebhookSecret();

    expect(res.webhookSecret).toBe(BETA_SECRET);
    expect(res.webhookSecret).not.toBe(ALPHA_SECRET);
  });

  it('fails closed when the active tenant has no persisted merchant', async () => {
    getTenantId.mockReturnValue('ghost-tenant');

    await expect(controller.getWebhookSecret()).rejects.toThrow(NotFoundException);
  });

  it('denies with a deliberate 403 when there is no active tenant context and never reads the merchant repository', async () => {
    // Exercise the real TenantContext (superadmin session without an active
    // tenant): no store, so `getTenantId()` has nothing to resolve.
    getTenantId.mockRestore();
    const findById = jest.spyOn(merchantRepo, 'findById');

    const denial = await controller.getWebhookSecret().then(
      () => null,
      (error: unknown) => error,
    );

    expect(denial).toBeInstanceOf(ForbiddenException);
    expect((denial as ForbiddenException).getStatus()).toBe(403);
    expect(findById).not.toHaveBeenCalled();
  });

  describe('authorization', () => {
    const rolesGuard = new RolesGuard(new Reflector());
    const tenantGuard = new TenantGuard();

    const contextFor = (
      user: Record<string, unknown>,
      params: Record<string, string> = {},
      body: Record<string, unknown> = {},
    ) =>
      ({
        getHandler: () => MerchantController.prototype.getWebhookSecret,
        getClass: () => MerchantController,
        switchToHttp: () => ({ getRequest: () => ({ user, params, body }) }),
      }) as unknown as ExecutionContext;

    it('denies a cashier', () => {
      expect(() =>
        rolesGuard.canActivate(contextFor({ role: 'CASHIER', tenantId: 'tenant-alpha' })),
      ).toThrow(ForbiddenException);
    });

    it('allows the merchant owner', () => {
      expect(
        rolesGuard.canActivate(contextFor({ role: 'MERCHANT_OWNER', tenantId: 'tenant-alpha' })),
      ).toBe(true);
    });

    it('rejects a request carrying another tenant id', () => {
      const ctx = contextFor(
        { role: 'MERCHANT_OWNER', tenantId: 'tenant-alpha' },
        { tenantId: 'tenant-beta' },
      );

      expect(() => tenantGuard.canActivate(ctx)).toThrow(ForbiddenException);
    });
  });
});
