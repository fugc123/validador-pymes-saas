import { FactufyAdapter } from '../../src/infrastructure/sifen/factufy.adapter';
import { calculateStoreMonthlyCostPyg } from '../../src/core/application/ports/auth.ports';
import { IngestWebhookUseCase } from '../../src/core/application/use-cases/ingest-webhook.use-case';
import { ClaimTransferUseCase } from '../../src/core/application/use-cases/transfers/claim-transfer.use-case';
import {
  InMemoryMembershipRepository,
  InMemoryMerchantRepository,
  InMemoryTransferRepository,
} from '../../src/infrastructure/repositories/in-memory.repositories';
import { BankParserFactory } from '../../src/infrastructure/parsers/bank-parser.factory';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import { MerchantMembership } from '../../src/core/domain/entities/merchant-membership.entity';

describe('Factufy Adapter, Branch Pricing & Multi-Store Anti-Replay', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('authenticates with dynamic Factufy credentials, consults RUC, and sends invoices', async () => {
    const fetchMock = jest.fn(async (url: string) => {
      if (url.endsWith('/auth/token')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ accessToken: 'jwt_test_token_123' }),
        } as any;
      }
      if (url.includes('/invoices/ruc/80023017')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ ruc: '80023017', dv: '5', razonSocial: 'EMPRESA DEMO S.A.' }),
        } as any;
      }
      if (url.endsWith('/invoices')) {
        return {
          ok: true,
          status: 201,
          json: async () => ({
            cdc: '01800169514002009006034812024021211620704833',
            jobId: 'job-factufy-99',
            message: 'Enviado a SIFEN',
          }),
        } as any;
      }
      return { ok: false, status: 404, json: async () => ({}) } as any;
    });
    global.fetch = fetchMock as any;

    const adapter = new FactufyAdapter();
    const creds = {
      clientId: 'cli_test_mock_123',
      clientSecret: 'sec_test_mock_456',
      branchCode: '002',
      posCode: '001',
    };

    const rucRes = await adapter.consultRuc(creds, '80023017-5');
    expect(rucRes).toEqual({ ruc: '80023017', dv: '5', razonSocial: 'EMPRESA DEMO S.A.' });

    const emitRes = await adapter.sendInvoice(creds, {
      externalId: 'CS-TEST-1',
      fechaEmisionIso: '2026-11-16T12:00:00',
      receptorRuc: '80023017',
      receptorDv: '5',
      receptorNombre: 'EMPRESA DEMO S.A.',
      condicionVenta: 'CONTADO',
      totalAmount: 150000,
      items: [{ descripcion: 'Servicio Demo', cantidad: 1, precioUnitario: 150000, ivaTasa: 10 }],
    });

    expect(emitRes.cdc).toBe('01800169514002009006034812024021211620704833');
    expect(emitRes.jobId).toBe('job-factufy-99');
    expect(emitRes.status).toBe('APPROVED');
    // Token should have been cached across consultRuc + sendInvoice (only 1 /auth/token call)
    const authCalls = fetchMock.mock.calls.filter((c) => String(c[0]).endsWith('/auth/token'));
    expect(authCalls).toHaveLength(1);
  });

  it('calculates monthly cost: 5 free branches per store, +Gs. 50.000 per extra branch after 5th', () => {
    expect(calculateStoreMonthlyCostPyg(0).totalMonthlyPyg).toBe(150000);
    expect(calculateStoreMonthlyCostPyg(5)).toMatchObject({
      basePyg: 150000,
      freeBranchesLimit: 5,
      activeBranchesCount: 5,
      extraBranchesCount: 0,
      extraBranchesPyg: 0,
      totalMonthlyPyg: 150000,
    });
    expect(calculateStoreMonthlyCostPyg(6)).toMatchObject({
      extraBranchesCount: 1,
      extraBranchesPyg: 50000,
      totalMonthlyPyg: 200000,
    });
    expect(calculateStoreMonthlyCostPyg(8)).toMatchObject({
      extraBranchesCount: 3,
      extraBranchesPyg: 150000,
      totalMonthlyPyg: 300000,
    });
  });

  it('replicates shared Google Apps Script transfers across owner stores and enforces cross-store anti-replay', async () => {
    const merchantRepo = new InMemoryMerchantRepository();
    const membershipRepo = new InMemoryMembershipRepository();
    const transferRepo = new InMemoryTransferRepository();
    const parserFactory = new BankParserFactory();

    const kiosco = await merchantRepo.save(
      new Merchant({
        id: 'kiosco-owner',
        name: 'Mi Kiosco',
        slug: 'kiosco-owner',
        webhookSecret: 'sec_kiosco_shared_1234567890',
        status: 'active',
      }),
    );
    const imprenta = await merchantRepo.save(
      new Merchant({
        id: 'imprenta-owner',
        name: 'Mi Imprenta',
        slug: 'imprenta-owner',
        webhookSecret: 'sec_imprenta_own_1234567890',
        status: 'active',
      }),
    );

    const ownerUserId = 'usr-multi-owner-1';
    const m1 = new MerchantMembership({
      id: 'mem-kiosco-1',
      userId: ownerUserId,
      merchantId: kiosco.id!,
      role: 'MERCHANT_OWNER',
      isActive: true,
    });
    (m1 as any).merchantName = kiosco.name;
    (m1 as any).merchantSlug = kiosco.slug;
    await membershipRepo.save(m1);

    const m2 = new MerchantMembership({
      id: 'mem-imprenta-1',
      userId: ownerUserId,
      merchantId: imprenta.id!,
      role: 'MERCHANT_OWNER',
      isActive: true,
    });
    (m2 as any).merchantName = imprenta.name;
    (m2 as any).merchantSlug = imprenta.slug;
    await membershipRepo.save(m2);

    const ingestUseCase = new IngestWebhookUseCase(
      merchantRepo,
      transferRepo,
      parserFactory,
      membershipRepo,
    );
    const claimUseCase = new ClaimTransferUseCase(transferRepo, membershipRepo);

    const ingestResult = await ingestUseCase.execute({
      tenantSlug: 'kiosco-owner',
      secretHeader: 'sec_kiosco_shared_1234567890',
      text: 'Recibiste una transferencia de Gs. 85.000 de CARLOS LOPEZ via UENO BANK S.A. Nro de Operacion: 77889900 Fecha: 16/11/2026',
    });

    expect(ingestResult.status).toBe('created');

    // Replicated to sibling store (Mi Imprenta)
    const kioscoTr = await transferRepo.findByTenantAndOperationId('kiosco-owner', '77889900');
    const imprentaTr = await transferRepo.findByTenantAndOperationId('imprenta-owner', '77889900');
    expect(kioscoTr?.status).toBe('pending');
    expect(imprentaTr?.status).toBe('pending');

    // Claiming in Mi Kiosco automatically blocks claiming the same transfer in Mi Imprenta
    const claimRes = await claimUseCase.execute({
      tenantId: 'kiosco-owner',
      transferId: kioscoTr!.id!,
      cashierUserId: 'usr-cashier-kiosco',
    });
    expect(claimRes.status).toBe('claimed');

    await expect(
      claimUseCase.execute({
        tenantId: 'imprenta-owner',
        transferId: imprentaTr!.id!,
        cashierUserId: 'usr-cashier-imprenta',
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
