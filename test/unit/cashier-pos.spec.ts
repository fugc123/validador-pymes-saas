import { ConflictException, NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import * as path from 'path';
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

  const referenceTransfer = new Transfer({
    id: 'transfer-004',
    tenantId: 'tenant-100',
    operationId: 'SIP-998877',
    receiptNumber: 'RC-5521',
    operationDate: '21/09/2026',
    payerName: 'JUAN PEREZ',
    amount: 30000,
    status: 'pending',
  });

  beforeEach(() => {
    mockTransferRepo = {
      save: jest.fn(),
      findByTenantAndOperationId: jest.fn(),
      findPendingByAmountAndPayer: jest.fn(),
      findById: jest.fn(),
      updateClaimed: jest.fn(),
      getMetricsByTenant: jest.fn(),
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

    it('Scenario 1c: Matches multi-word non-contiguous query ("Alann Arce" vs "ALANN RODRIGO ARCE RODRIGUEZ")', async () => {
      const multiWordTransfer = new Transfer({
        id: 'transfer-003',
        tenantId: 'tenant-100',
        operationId: '76820403',
        operationDate: '20/09/2026',
        payerName: 'ALANN RODRIGO ARCE RODRIGUEZ',
        amount: 1,
        status: 'pending',
      });
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([multiWordTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 1,
        payerFilter: 'alann arce',
      });

      expect(result.found).toBe(true);
      expect(result.transfers[0].payerName).toBe('ALANN RODRIGO ARCE RODRIGUEZ');
    });

    it('Scenario 1d: Empty/whitespace identifier performs an amount-only lookup and returns every in-window match', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([samplePending]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 26000,
        payerFilter: '   ',
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].payerName).toBe('ALEJANDRA CHENA');
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledTimes(1);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledWith(
        'tenant-100',
        26000,
      );
    });

    it('Scenario 1e: Amount-only request returns all in-window pending matches for the exact amount', async () => {
      const secondPending = new Transfer({
        id: 'transfer-002',
        tenantId: 'tenant-100',
        operationId: '45602',
        operationDate: '16/09/2026 15:00',
        payerName: 'CARLOS LOPEZ',
        amount: 26000,
        status: 'pending',
      });
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([samplePending, secondPending]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({ tenantId: 'tenant-100', amount: 26000 });

      expect(result.found).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transfers).toHaveLength(2);
      expect(result.transfers.map((t) => t.id)).toEqual(['transfer-001', 'transfer-002']);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledTimes(1);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledWith(
        'tenant-100',
        26000,
      );
    });

    it('Scenario 1f: Falls back to an exact case-insensitive operationId match when the payer name does not match', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([referenceTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 30000,
        payerFilter: 'sIp-998877',
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transfers).toHaveLength(1);
      expect(result.transfers[0].operationId).toBe('SIP-998877');
      // One candidate fetch with tenant + amount only: the identifier must
      // never become the repository's payer_name ILIKE SQL prefilter.
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledTimes(1);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenNthCalledWith(
        1,
        'tenant-100',
        30000,
      );
    });

    it('Scenario 1g: Falls back to an exact case-insensitive receiptNumber match', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([referenceTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 30000,
        payerFilter: 'rc-5521',
      });

      expect(result.found).toBe(true);
      expect(result.status).toBe('pending');
      expect(result.transfers[0].receiptNumber).toBe('RC-5521');
    });

    it('Scenario 1h: Reference match is exact, not a substring', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([referenceTransfer]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 30000,
        payerFilter: '99887',
      });

      expect(result.found).toBe(false);
      expect(result.status).toBe('not_found');
      expect(result.transfers).toHaveLength(0);
    });

    it('Scenario 1i: Payer-name match wins without a second (reference) lookup', async () => {
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValueOnce([samplePending]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({
        tenantId: 'tenant-100',
        amount: 26000,
        payerFilter: 'Chena',
      });

      expect(result.found).toBe(true);
      expect(result.transfers[0].payerName).toBe('ALEJANDRA CHENA');
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalledTimes(1);
    });

    it('Scenario 2: Amount-only match items expose safe structured fields only', async () => {
      const withExtras = new Transfer({
        id: 'transfer-005',
        tenantId: 'tenant-100',
        operationId: '778899',
        receiptNumber: 'RC-7788',
        operationDate: '16/09/2026 16:00',
        payerName: 'CLIENTE SIPAP',
        payerBank: 'Banco UENO',
        concept: 'PRUEBA SISTEMA',
        amount: 15000,
        status: 'pending',
        payerAccount: '123456789',
        creditAccount: '987654321',
        rawBody: 'SECRET EMAIL BODY',
      });
      mockTransferRepo.findPendingByAmountAndPayer.mockResolvedValue([withExtras]);
      const useCase = new VerifyTransferUseCase(mockTransferRepo);

      const result = await useCase.execute({ tenantId: 'tenant-100', amount: 15000 });

      expect(result.found).toBe(true);
      const item = result.transfers[0];
      expect(item.payerName).toBe('CLIENTE SIPAP');
      expect(item.payerBank).toBe('Banco UENO');
      expect(item.operationId).toBe('778899');
      expect(item.receiptNumber).toBe('RC-7788');
      expect(item.amount).toBe(15000);
      expect(item.currency).toBe('PYG');
      expect(item.operationDate).toBe('16/09/2026 16:00');
      expect(item.createdAt).toBeInstanceOf(Date);
      expect(item.concept).toBe('PRUEBA SISTEMA');
      expect(item).not.toHaveProperty('rawBody');
      expect(item).not.toHaveProperty('payerAccount');
      expect(item).not.toHaveProperty('creditAccount');
      expect(JSON.stringify(result)).not.toContain('SECRET EMAIL BODY');
      expect(JSON.stringify(result)).not.toContain('123456789');
      expect(JSON.stringify(result)).not.toContain('987654321');
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
        payerFilter: 'Lopez',
      });

      expect(result.found).toBe(false);
      expect(result.transfers).toHaveLength(0);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalled();
    });

    it('Scenario 3b: Amount-only request excludes transfers outside the 45-minute window', async () => {
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

      const result = await useCase.execute({ tenantId: 'tenant-100', amount: 10000 });

      expect(result.found).toBe(false);
      expect(result.status).toBe('not_found');
      expect(result.transfers).toHaveLength(0);
      expect(mockTransferRepo.findPendingByAmountAndPayer).toHaveBeenCalled();
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

describe('Cashier verification UI copy and amount-only selection', () => {
  const rootDir = path.resolve(__dirname, '../..');
  const read = (relativePath: string) => readFileSync(path.join(rootDir, relativePath), 'utf8');
  const posSource = read('client/src/portals/pos/FastPosScreen.tsx');
  const ownerSource = read('client/src/portals/owner/OwnerDashboard.tsx');

  it('POS screen makes the payer identifier optional and renders a selectable list for amount-only matches', () => {
    expect(posSource).toContain('Nombre del Pagador o Referencia');
    expect(posSource).toContain('(Opcional)');
    expect(posSource).not.toContain('Apellido del Pagador');
    expect(posSource).not.toContain('if (!payerFilter) return;');
    expect(posSource).not.toContain('|| !payerName.trim()');
    expect(posSource).toContain('matchCandidates');
    expect(posSource).toContain('Múltiples transferencias');
    expect(posSource).toContain('Nro. Comprobante');
    expect(posSource).toContain('Concepto');
  });

  it('Owner validation input makes the payer identifier optional and renders a selectable list for amount-only matches', () => {
    expect(ownerSource).toContain('Nombre del Pagador o Referencia');
    expect(ownerSource).toContain('(Opcional)');
    expect(ownerSource).not.toContain('if (!payerFilter) return;');
    expect(ownerSource).not.toContain('|| !validationPayerName.trim()');
    expect(ownerSource).toContain('validationCandidates');
  });
});
