import { ConflictException, NotFoundException } from '@nestjs/common';
import { VerifyTransferUseCase } from '../../src/core/application/use-cases/transfers/verify-transfer.use-case';
import { ClaimTransferUseCase } from '../../src/core/application/use-cases/transfers/claim-transfer.use-case';
import { Transfer } from '../../src/core/domain/entities/transfer.entity';
import { ITransferRepository } from '../../src/core/application/ports/transfer.ports';

describe('Cashier Fast-POS & Anti-Replay Invariants (T09, T10)', () => {
  let mockTransferRepo: jest.Mocked<ITransferRepository>;

  const samplePending = new Transfer({
    id: 'transfer-001',
    tenantId: 'tenant-100',
    operationId: '45601',
    operationDate: '16/09/2026 14:30',
    payerName: 'ALEJANDRA CHENA',
    payerBank: 'Banco Itaú',
    amount: 26000,
    status: 'pending',
  });

  beforeEach(() => {
    mockTransferRepo = {
      save: jest.fn(),
      findByTenantAndOperationId: jest.fn(),
      findPendingByAmountAndPayer: jest.fn(),
      findById: jest.fn(),
      updateClaimed: jest.fn(),
    };
  });

  describe('VerifyTransferUseCase (US-POS-01)', () => {
    it('Scenario 1: Matches pending transfer by amount and partial name', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([samplePending]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 26000,
        payerFilter: 'Chena',
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].payerName).toBe('ALEJANDRA CHENA');
    });

    it('Scenario 1b: Matches despite diacritics / accents (Giménez vs GIMENEZ)', async () => {
      const accentedTransfer = new Transfer({
        id: 'transfer-002',
        tenantId: 'tenant-100',
        operationId: '45602',
        operationDate: '16/09/2026',
        payerName: 'MIA GIMENEZ',
        amount: 45000,
        status: 'pending',
      });
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([accentedTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 45000,
        payerFilter: 'Giménez',
      });

      expect(result.found).toBe(true);
      expect(result.transfers[0].payerName).toBe('MIA GIMENEZ');
    });

    it('Scenario 3: Transfer outside 45-minute window is not returned', async () => {
      const expiredTransfer = new Transfer({
        id: 'transfer-old',
        tenantId: 'tenant-100',
        operationId: '45699',
        operationDate: '16/09/2026',
        payerName: 'CARLOS LOPEZ',
        amount: 10000,
        status: 'pending',
        createdAt: new Date(Date.now() - 50 * 60 * 1000), // 50 mins ago
      });
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([expiredTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 10000,
      });

      expect(result.found).toBe(false);
      expect(result.transfers).toHaveLength(0);
    });
  });

  describe('ClaimTransferUseCase & Article II Anti-Replay', () => {
    it('Scenario 1: Successful atomic claim marks transfer claimed', async () => {
      mockTransferRepo.updateClaimed.mockResolvedValue(true);
      const useCase = new ClaimTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        transferId: 'transfer-001',
        cashierUserId: 'cashier-carlos',
      });

      expect(result.status).toBe('claimed');
      expect(result.transferId).toBe('transfer-001');
      expect(result.claimedByUserId).toBe('cashier-carlos');
    });

    it('Scenario 2: Anti-Replay Guard throws ConflictException with already_claimed message', async () => {
      mockTransferRepo.updateClaimed.mockResolvedValue(false); // Atomic lock failed
      const claimedTransfer = new Transfer({
        id: 'transfer-001',
        tenantId: 'tenant-100',
        operationId: '45601',
        operationDate: '16/09/2026',
        payerName: 'ALEJANDRA CHENA',
        amount: 26000,
        status: 'claimed',
        claimedAt: new Date(),
        claimedByUserId: 'cashier-carlos',
      });
      mockTransferRepo.findById.mockResolvedValue(claimedTransfer);

      const useCase = new ClaimTransferUseCase(mockTransferRepo);

      await expect(
        useCase.execute({
          tenantId: 'tenant-100',
          transferId: 'transfer-001',
          cashierUserId: 'cashier-ana',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('Throws NotFoundException if transfer does not exist in store tenant', async () => {
      mockTransferRepo.updateClaimed.mockResolvedValue(false);
      mockTransferRepo.findById.mockResolvedValue(null);

      const useCase = new ClaimTransferUseCase(mockTransferRepo);

      await expect(
        useCase.execute({
          tenantId: 'tenant-100',
          transferId: 'non-existent-transfer',
          cashierUserId: 'cashier-ana',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
