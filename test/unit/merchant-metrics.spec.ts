import { GetMerchantMetricsUseCase } from '../../src/core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { InMemoryTransferRepository } from '../../src/infrastructure/repositories/in-memory.repositories';
import { Transfer } from '../../src/core/domain/entities/transfer.entity';

describe('GetMerchantMetricsUseCase', () => {
  let transferRepo: InMemoryTransferRepository;
  let useCase: GetMerchantMetricsUseCase;

  beforeEach(() => {
    transferRepo = new InMemoryTransferRepository();
    useCase = new GetMerchantMetricsUseCase(transferRepo);
  });

  it('should calculate aggregated total collected and validated count accurately', async () => {
    // Initial transfer in sample is pending (amount: 26000)
    const initialMetrics = await useCase.execute('kiosko-san-roque');
    expect(initialMetrics.totalCollectedToday).toBe(0);
    expect(initialMetrics.pendingUnclaimedCount).toBe(1);

    // Save and claim a transfer
    const tr = new Transfer({
      id: 'tr-test-metrics-1',
      tenantId: 'kiosko-san-roque',
      operationId: 'OP-METRIC-1',
      operationDate: 'Hoy 15:00',
      payerName: 'MARIA LOPEZ',
      amount: 150000,
    });
    await transferRepo.save(tr);
    await transferRepo.updateClaimed('kiosko-san-roque', 'tr-test-metrics-1', 'cashier-user-1', new Date());

    const updated = await useCase.execute('kiosko-san-roque');
    expect(updated.totalCollectedToday).toBe(150000);
    expect(updated.countValidatedToday).toBe(1);
    expect(updated.activeCashiersCount).toBe(1);
    expect(updated.recentTransfers.length).toBeGreaterThan(0);
  });
});
