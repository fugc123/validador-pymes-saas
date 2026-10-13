import { UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
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

  it('rejects slug-derived secrets that are not the exact stored value', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);
    mockTransferRepo.save.mockImplementation(async (t) => t);

    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    // Legacy derivation shortcuts that used to authenticate without ever
    // matching the persisted webhookSecret.
    const derivedSecrets = [
      'sec_kiosko-san-roque_pos',
      'sec_kiosko_san_roque_pos',
      'sec_kiosko_san_roque_anything',
    ];

    for (const secretHeader of derivedSecrets) {
      await expect(
        useCase.execute({
          tenantSlug: 'kiosko-san-roque',
          secretHeader,
          text: validSampleText,
        }),
      ).rejects.toThrow(UnauthorizedException);
    }

    expect(mockTransferRepo.save).not.toHaveBeenCalled();
  });

  it('rejects a prefix of the stored secret and other wrong-length values', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    const wrongLengthValues = [
      activeMerchant.webhookSecret.slice(0, 12),
      `${activeMerchant.webhookSecret}-extra-suffix`,
    ];

    for (const secretHeader of wrongLengthValues) {
      await expect(
        useCase.execute({
          tenantSlug: 'kiosko-san-roque',
          secretHeader,
          text: validSampleText,
        }),
      ).rejects.toThrow(UnauthorizedException);
    }
  });

  it('rejects a same-length value that differs from the stored secret', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    const mutated = `X${activeMerchant.webhookSecret.slice(1)}`;

    await expect(
      useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: mutated,
        text: validSampleText,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an empty or malformed (non-string) secret header', async () => {
    mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
    const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

    await expect(
      useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: '',
        text: validSampleText,
      }),
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: [activeMerchant.webhookSecret] as unknown as string,
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

  /**
   * TASK-03: received-only persistence. Sent, direction-unknown, and
   * unparseable notifications are acknowledged with a discarded outcome so
   * the webhook responds 2xx, GAS labels the message, and no retry loop
   * occurs. No TransferRepository.save may happen for discarded mail.
   * All fixtures are synthetic.
   */
  describe('Received-only direction enforcement (TASK-03)', () => {
    const itauSentEmail = `Comprobante de Transferencia Enviada
Has enviado una transferencia
Beneficiario: MARIA ELENA GOMEZ
Nro. de operación: 	ENV-998877
Fecha y hora de operación: 	14/09/2026 10:17:26
Moneda y Monto: 	PYG 45,000
Débito de tu cuenta: 	0000000619411905`;

    const unknownDirectionEmail = `Aviso de movimiento en su cuenta
Nro. de operación: 	OP-556677
Fecha y hora de operación: 	16/09/2026 09:15:00
Moneda y Monto: 	PYG 60.000
Estado: 	Procesado`;

    const unparseableEmail = 'Estimado cliente: su resumen mensual de cuenta ya está disponible.';

    it('discards a sent transfer notification without persisting it', async () => {
      mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
      mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

      const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

      const result = await useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: 'super-secret-crypto-key-1234567890',
        text: itauSentEmail,
      });

      expect(result.status).toBe('discarded');
      expect(result.reason).toBe('sent_transfer');
      expect(mockTransferRepo.save).not.toHaveBeenCalled();
      expect(mockTransferRepo.findByTenantAndOperationId).not.toHaveBeenCalled();
    });

    it('discards a direction-unknown notification without persisting it', async () => {
      mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
      mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

      const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

      const result = await useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: 'super-secret-crypto-key-1234567890',
        text: unknownDirectionEmail,
      });

      expect(result.status).toBe('discarded');
      expect(result.reason).toBe('unknown_direction');
      expect(result.operationId).toBe('OP-556677');
      expect(mockTransferRepo.save).not.toHaveBeenCalled();
      expect(mockTransferRepo.findByTenantAndOperationId).not.toHaveBeenCalled();
    });

    it('acknowledges unparseable mail as discarded instead of throwing 400', async () => {
      mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
      mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

      const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);

      const result = await useCase.execute({
        tenantSlug: 'kiosko-san-roque',
        secretHeader: 'super-secret-crypto-key-1234567890',
        text: unparseableEmail,
      });

      expect(result.status).toBe('discarded');
      expect(result.reason).toBe('unparseable_message');
      expect(mockTransferRepo.save).not.toHaveBeenCalled();
      expect(mockTransferRepo.findByTenantAndOperationId).not.toHaveBeenCalled();
    });

    it('still persists a positively identified received transfer', async () => {
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
      expect(mockTransferRepo.save).toHaveBeenCalledTimes(1);
    });

    describe('discard log privacy (TASK-03 correction)', () => {
      const privateSlug = 'kiosko-privado-xyz';

      const collectLogs = (logSpy: jest.SpyInstance, warnSpy: jest.SpyInstance): string =>
        [...logSpy.mock.calls, ...warnSpy.mock.calls]
          .map((call) => call.map((arg: unknown) => String(arg)).join(' '))
          .join('\n');

      it('sent-discard log contains no tenant slug, operation ID, or amount', async () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
        mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

        const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);
        const result = await useCase.execute({
          tenantSlug: privateSlug,
          secretHeader: 'super-secret-crypto-key-1234567890',
          text: itauSentEmail,
        });

        expect(result.status).toBe('discarded');
        const logged = collectLogs(logSpy, warnSpy);
        expect(logged).not.toContain(privateSlug);
        expect(logged).not.toContain('ENV-998877');
        expect(logged).not.toContain('45000');
        expect(logged).not.toContain('45,000');
        jest.restoreAllMocks();
      });

      it('unknown-direction log contains no tenant slug, operation ID, or amount', async () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
        mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

        const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);
        const result = await useCase.execute({
          tenantSlug: privateSlug,
          secretHeader: 'super-secret-crypto-key-1234567890',
          text: unknownDirectionEmail,
        });

        expect(result.status).toBe('discarded');
        const logged = collectLogs(logSpy, warnSpy);
        expect(logged).not.toContain(privateSlug);
        expect(logged).not.toContain('OP-556677');
        expect(logged).not.toContain('60000');
        expect(logged).not.toContain('60.000');
        jest.restoreAllMocks();
      });

      it('unparseable-message warn contains no tenant slug, subject, or body content', async () => {
        const logSpy = jest.spyOn(Logger.prototype, 'log');
        const warnSpy = jest.spyOn(Logger.prototype, 'warn');
        mockMerchantRepo.findBySlug.mockResolvedValue(activeMerchant);
        mockTransferRepo.findByTenantAndOperationId.mockResolvedValue(null);

        const useCase = new IngestWebhookUseCase(mockMerchantRepo, mockTransferRepo, parserFactory);
        const result = await useCase.execute({
          tenantSlug: privateSlug,
          secretHeader: 'super-secret-crypto-key-1234567890',
          text: unparseableEmail,
        });

        expect(result.status).toBe('discarded');
        const logged = collectLogs(logSpy, warnSpy);
        expect(logged).not.toContain(privateSlug);
        expect(logged).not.toContain('resumen mensual');
        expect(logged).not.toContain('Estimado cliente');
        jest.restoreAllMocks();
      });
    });
  });
});
