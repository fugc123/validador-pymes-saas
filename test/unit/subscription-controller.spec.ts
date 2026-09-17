import { SubscriptionController } from '../../src/presentation/controllers/subscription.controller';
import { SubscriptionBillingUseCase } from '../../src/core/application/use-cases/billing/subscription-billing.use-case';
import { InMemoryMerchantRepository, InMemorySubscriptionRepository } from '../../src/infrastructure/repositories/in-memory.repositories';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let subRepo: InMemorySubscriptionRepository;
  let merchantRepo: InMemoryMerchantRepository;
  let billingUseCase: SubscriptionBillingUseCase;

  beforeEach(async () => {
    subRepo = new InMemorySubscriptionRepository();
    merchantRepo = new InMemoryMerchantRepository();
    billingUseCase = new SubscriptionBillingUseCase(subRepo);
    controller = new SubscriptionController(billingUseCase, subRepo, merchantRepo);
  });

  it('should return subscription status with daysRemaining for a tenant', async () => {
    const req = { user: { tenantId: 'kiosko-san-roque' } };
    const res = await controller.getStatus(req);

    expect(res.tenantId).toBe('kiosko-san-roque');
    expect(res.status).toBe('trial');
    expect(res.isActive).toBe(true);
    expect(res.daysRemaining).toBeGreaterThanOrEqual(1);
  });

  it('should confirm payment and extend period by 30 days', async () => {
    const res = await controller.confirmPayment({ tenantId: 'kiosko-san-roque' });

    expect(res.status).toBe('active');
    expect(res.isActive).toBe(true);
    expect(res.isTrial).toBe(false);
  });

  it('should mark tenant subscription as past_due', async () => {
    const res = await controller.markPastDue({ tenantId: 'kiosko-san-roque' });

    expect(res.status).toBe('past_due');
    expect(res.isActive).toBe(false);
  });

  it('should list all subscriptions with merchant names and days remaining', async () => {
    const list = await controller.listAll();

    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBeGreaterThanOrEqual(1);
    const item = list.find((s) => s.tenantId === 'kiosko-san-roque');
    expect(item).toBeDefined();
    expect(item?.merchantName).toBe('Kiosko San Roque');
  });
});
