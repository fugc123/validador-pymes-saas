import { UnauthorizedException, NotFoundException } from '@nestjs/common';
import { IngestWebhookUseCase } from '../../src/core/application/use-cases/ingest-webhook.use-case';
import { BankParserFactory } from '../../src/infrastructure/parsers/bank-parser.factory';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import { Transfer } from '../../src/core/domain/entities/transfer.entity';
import { IMerchantRepository } from '../../src/core/application/ports/auth.ports';
import { ITransferRepository } from '../../src/core/application/ports/transfer.ports';

describe('Webhook Ingestion & Idempotency Pipeline (T08)', () => {
  let mockMerchantRepo: jest.Mocked<IMerchantRepository>;
  let mockTransferRepo: jest.Mocked<ITransferRepository>;
  const parserFactory = new BankParserFactory();

  const activeMerchant = new Merchant({
    id: 'merchant-uuid-1',
    name: 'Kiosko San Roque',
    slug: 'kiosko-san-roque',
    webhookSecret: 'super-secret-crypto-key-1234567890',
    status: 'active',
  });

  const validSampleText = `Recibiste una transferencia
Monto Gs. 50.000
Titular cuenta débito JUAN CARLOS DUARTE
Entidad débito UENO BANK S.A.
Nro. de transacción 99887766
Fecha y hora transferencia 16/09/2026 15:30:00 h`;

  beforeEach(() => {
    mockMerchantRepo = {
      findById: jest.fn(),
      findBySlug: jest.fn(),
      save: jest.fn(),
    };
    mockTransferRepo = {
      save: jest.fn(),
      findByTenantAndOperationId: jest.fn(),
      findPendingByAmountAndPayer: jest.fn(),
      findById: jest.fn(),
      updateClaimed: jest.fn(),
      getMetricsByTenant: jest.fn(),
    };
  });

  it('should reject missing or incorrect secret with UnauthorizedException', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    await expect(
      useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: 'wrong-secret-key-00000000000000000000',
        text: validSampleText,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('Scenario 1: Valid new transfer ingestion creates pending transfer', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);
    mockTransferRepo.save.mockImplementation(async (t) => t);

    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    const result = await useCase.execute({
      tenantSlug: 'kiosko-san-roque',
      secretHeader: 'super-secret-crypto-key-1234567890',
      text: validSampleText,
    });

    expect(result.status).toBe('created');
    expect(result.operationId).toBe('99887766');
    expect(result.amount).toBe(50000);
    expect(mockTransferRepo.save).toHaveBeenCalled();
  });

  it('Scenario 2: Duplicate ingestion returns already_exists without mutating state (Article IV)', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    const existingTransfer = new Transfer({
      id: 'existing-transfer-1',
      tenantId: 'merchant-uuid-1',
      operationId: '99887766',
      operationDate: '16/09/2026',
      payerName: 'JUAN CARLOS DUARTE',
      amount: 50000,
    });
    mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(existingTransfer);

    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    const result = await useCase.execute({
      tenantSlug: 'kiosko-san-roque',
      secretHeader: 'super-secret-crypto-key-1234567890',
      text: validSampleText,
    });

    expect(result.status).toBe('already_exists');
    expect(result.operationId).toBe('99887766');
    expect(result.message).toContain('Duplicate transfer notification ignored idempotently');
    expect(mockTransferRepo.save).not.toHaveBeenCalled();
  });
});
