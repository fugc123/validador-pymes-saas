import { SubscriptionController } from '../../src/presentation/controllers/subscription.controller';
import { SubscriptionBillingUseCase } from '../../src/core/application/use-cases/billing/subscription-billing.use-case';
import { InMemoryMerchantRepository, InMemorySubscriptionRepository, InMemoryPaymentReportRepository, InMemoryTransferRepository } from '../../src/infrastructure/repositories/in-memory.repositories';

describe('SubscriptionController', () => {
  let controller: SubscriptionController;
  let subRepo: InMemorySubscriptionRepository;
  let merchantRepo: InMemoryMerchantRepository;
  let paymentReportRepo: InMemoryPaymentReportRepository;
  let transferRepo: InMemoryTransferRepository;
  let billingUseCase: SubscriptionBillingUseCase;

  beforeEach(async () => {
    subRepo = new InMemorySubscriptionRepository();
    merchantRepo = new InMemoryMerchantRepository();
    paymentReportRepo = new InMemoryPaymentReportRepository();
    transferRepo = new InMemoryTransferRepository();
    billingUseCase = new SubscriptionBillingUseCase(subRepo);
    controller = new SubscriptionController(billingUseCase, subRepo, merchantRepo, paymentReportRepo, transferRepo);
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

  it('should allow owner to report a payment and allow superadmin to auto-validate via incoming SIPAP transfer', async () => {
    // 1. Owner reports payment
    const ownerReq = { user: { tenantId: 'kiosko-san-roque', id: 'usr-franco-1' } };
    const report = await controller.reportPayment(ownerReq, { payerName: 'Franco Galeano' });

    expect(report.tenantId).toBe('kiosko-san-roque');
    expect(report.payerName).toBe('Franco Galeano');
    expect(report.status).toBe('pending');
    expect(report.amount).toBe(150000);

    // 2. Before transfer arrives, validation fails gracefully
    const adminReq = { user: { id: 'usr-admin-1', role: 'SUPER_ADMIN' } };
    const failRes = await controller.validatePaymentReport(adminReq, report.id);
    expect(failRes.matched).toBe(false);

    // 3. Transfer arrives to Franco's alias account (cajasegura-platform)
    await controller.simulateIncomingTransfer({ payerName: 'FRANCO GALEANO' });

    // 4. Validate again -> matches and auto-extends subscription +30 days
    const successRes = await controller.validatePaymentReport(adminReq, report.id);
    expect(successRes.matched).toBe(true);
    expect(successRes.report?.status).toBe('matched');

    // 5. Subscription is now active
    const subStatus = await controller.getStatus(ownerReq);
    expect(subStatus.status).toBe('active');
    expect(subStatus.isTrial).toBe(false);
  });
});
