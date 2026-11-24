import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  decryptSecretAtRest,
  encryptSecretAtRest,
} from '../../src/core/application/utils/secret-crypto';
import { generateKudePdfBuffer } from '../../src/core/application/utils/kude-pdf';
import { SifenRepository } from '../../src/infrastructure/repositories/sifen.repository';
import { SifenController } from '../../src/presentation/controllers/sifen.controller';

describe('Security Hardening, Demo Bootstrap & SIFEN Onboarding', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  describe('Secret Encryption At Rest (AES-256-GCM)', () => {
    it('encrypts and decrypts Factufy secrets with enc:v1 prefix and detects tampering', () => {
      process.env.SECRET_ENCRYPTION_KEY = 'synthetic-unit-test-master-key-32b';
      const plainSecret = 'sec_test_synthetic_secret_xyz';

      const encrypted = encryptSecretAtRest(plainSecret);
      expect(encrypted).toBeTruthy();
      expect(encrypted!.startsWith('enc:v1:')).toBe(true);
      expect(encrypted).not.toContain(plainSecret);

      // Idempotent if already encrypted
      expect(encryptSecretAtRest(encrypted)).toBe(encrypted);

      // Roundtrip decryption
      expect(decryptSecretAtRest(encrypted)).toBe(plainSecret);

      // Tampering authTag or ciphertext must throw
      const parts = encrypted!.split(':');
      const tamperedData = parts[4].slice(0, -2) + (parts[4].endsWith('aa') ? 'bb' : 'aa');
      const tampered = [parts[0], parts[1], parts[2], parts[3], tamperedData].join(':');
      expect(() => decryptSecretAtRest(tampered)).toThrow();

      // Legacy plaintext values remain readable for seamless migration
      expect(decryptSecretAtRest('legacy_unencrypted_value')).toBe('legacy_unencrypted_value');
      expect(decryptSecretAtRest(null)).toBeNull();
    });

    it('persists encrypted factufy_client_secret when saving config to PostgreSQL', async () => {
      process.env.SECRET_ENCRYPTION_KEY = 'synthetic-unit-test-master-key-32b';
      const capturedQueries: Array<{ sql: string; params: any[] }> = [];
      const mockDbService: any = {
        isMemoryMode: false,
        query: jest.fn(async (sql: string, params: any[] = []) => {
          capturedQueries.push({ sql, params });
          if (sql.includes('FROM subscriptions')) {
            return {
              rows: [
                {
                  tenant_id: 'vip-store',
                  external_customer_id: 'free-lifetime-partner',
                  external_subscription_id: 'sub_lifetime_permanent',
                  current_period_end: new Date('2099-12-31T23:59:59Z'),
                },
              ],
            };
          }
          return { rows: [] };
        }),
      };

      const repo = new SifenRepository(mockDbService);
      await repo.upsertConfig('vip-store', {
        ruc: '80012345',
        dv: '5',
        razonSocial: 'VIP STORE E.A.S.',
        provider: 'factufy',
        factufyClientId: 'cli_test_synthetic_001',
        factufyClientSecret: 'sec_test_synthetic_secret_xyz',
        timbrado: '17560102',
      });

      const insertCall = capturedQueries.find((q) => q.sql.includes('INSERT INTO sifen_configs'));
      expect(insertCall).toBeDefined();
      const encryptedParam = insertCall!.params.find(
        (p) => typeof p === 'string' && p.startsWith('enc:v1:'),
      );
      expect(encryptedParam).toBeDefined();
      expect(insertCall!.params).not.toContain('sec_test_synthetic_secret_xyz');
      expect(decryptSecretAtRest(encryptedParam)).toBe('sec_test_synthetic_secret_xyz');
    });
  });

  describe('Production Demo Env Bootstrap (FACTUFY_DEMO_*)', () => {
    it('auto-approves and enables Factufy on startup when FACTUFY_DEMO_* env vars are set', async () => {
      process.env.SECRET_ENCRYPTION_KEY = 'synthetic-unit-test-master-key-32b';
      process.env.FACTUFY_DEMO_TENANT = 'demo-tenant-test';
      process.env.FACTUFY_DEMO_CLIENT_ID = 'cli_test_synthetic_001';
      process.env.FACTUFY_DEMO_CLIENT_SECRET = 'sec_test_synthetic_secret_xyz';
      process.env.FACTUFY_DEMO_BRANCH_CODE = '002';
      process.env.FACTUFY_DEMO_POS_CODE = '003';
      process.env.FACTUFY_DEMO_RUC = '80023017';
      process.env.FACTUFY_DEMO_TIMBRADO = '17560102';
      process.env.FACTUFY_DEMO_RAZON_SOCIAL = 'DEMO SYNTHETIC E.A.S.';

      const repo = new SifenRepository();
      await repo.onModuleInit();

      expect(await repo.isEligibleFreeMerchant('demo-tenant-test')).toBe(true);
      const req = await repo.getOnboardingRequest('demo-tenant-test');
      expect(req?.status).toBe('approved');

      const config = await repo.getConfigByTenant('demo-tenant-test');
      expect(config).toBeDefined();
      expect(config!.enabled).toBe(true);
      expect(config!.provider).toBe('factufy');
      expect(config!.factufyClientId).toBe('cli_test_synthetic_001');
      expect(config!.factufyClientSecret).toBe('sec_test_synthetic_secret_xyz');
      expect(config!.factufyBranchCode).toBe('002');
      expect(config!.factufyPosCode).toBe('003');
      expect(config!.timbrado).toBe('17560102');
    });
  });

  describe('Merchant SIFEN Onboarding Request & Approval Flow', () => {
    it('keeps non-lifetime merchant blocked until request is submitted and approved by SuperAdmin', async () => {
      const mockSubs = {
        findAll: async () => [
          {
            tenantId: 'paid-kiosk-py',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
            externalCustomerId: 'manual',
            externalSubscriptionId: 'sub_paid_1',
          },
        ],
        findByTenantId: async (t: string) =>
          t === 'paid-kiosk-py'
            ? {
                tenantId: 'paid-kiosk-py',
                status: 'active',
                currentPeriodEnd: new Date(Date.now() + 30 * 86400_000),
              }
            : null,
      } as any;

      const mockMerchants = {
        findById: async (id: string) => ({
          id,
          name: 'Kiosco Paid PY',
          slug: id,
        }),
      } as any;

      const repo = new SifenRepository(undefined, mockSubs, mockMerchants);

      // Initially not eligible
      expect(await repo.isEligibleFreeMerchant('paid-kiosk-py')).toBe(false);

      // Reject invalid timbrado
      await expect(
        repo.submitOnboardingRequest('paid-kiosk-py', {
          ruc: '80055511',
          razonSocial: 'KIOSCO TEST E.A.S.',
          timbrado: '1234',
        }),
      ).rejects.toThrow(BadRequestException);

      // Valid submission -> pending, still ineligible until approved
      const pending = await repo.submitOnboardingRequest('paid-kiosk-py', {
        ruc: '80055511',
        razonSocial: 'KIOSCO TEST E.A.S.',
        timbrado: '17551122',
        establecimiento: '001',
        puntoExpedicion: '002',
        requestedByUserId: 'owner-1',
      });
      expect(pending.status).toBe('pending');
      expect(pending.dv).toHaveLength(1);
      expect(await repo.isEligibleFreeMerchant('paid-kiosk-py')).toBe(false);

      // SuperAdmin approves -> eligible & draft Factufy config pre-filled
      const approved = await repo.approveOnboardingRequest('paid-kiosk-py', 'superadmin-1');
      expect(approved.status).toBe('approved');
      expect(await repo.isEligibleFreeMerchant('paid-kiosk-py')).toBe(true);

      const draftConfig = await repo.getConfigByTenant('paid-kiosk-py');
      expect(draftConfig).toBeDefined();
      expect(draftConfig!.enabled).toBe(false);
      expect(draftConfig!.provider).toBe('factufy');
      expect(draftConfig!.ruc).toBe('80055511');
      expect(draftConfig!.timbrado).toBe('17551122');

      const allEligible = await repo.listFreeMerchantsWithSifenStatus();
      const found = allEligible.find((m) => m.tenantId === 'paid-kiosk-py');
      expect(found).toBeDefined();
      expect(found!.isLifetime).toBe(false);
      expect(found!.ruc).toBe('80055511');
    });
  });

  describe('SifenController PDF Download Security Guards', () => {
    const validCdc = '01800123456001001000000122026010112345678901';

    it('rejects malformed or path-traversal CDC values with BadRequestException', async () => {
      const repo = new SifenRepository();
      const controller = new SifenController(repo, { findById: async () => null } as any);
      const mockRes: any = { setHeader: jest.fn(), send: jest.fn() };
      const req: any = { user: { tenantId: 'tenant-a', userId: 'cashier-1' } };

      await expect(controller.downloadInvoicePdf(req, '../etc/passwd', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.downloadInvoicePdf(req, '12345', mockRes)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        controller.downloadInvoicePdf(req, validCdc.slice(0, 43) + 'x', mockRes),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects valid 44-digit CDC owned by a different tenant with NotFoundException', async () => {
      const repo = new SifenRepository();
      jest.spyOn(repo, 'findInvoiceByCdc').mockResolvedValue(null);

      const controller = new SifenController(repo, { findById: async () => null } as any);
      const mockRes: any = { setHeader: jest.fn(), send: jest.fn() };
      const req: any = { user: { tenantId: 'tenant-other', userId: 'cashier-2' } };

      await expect(controller.downloadInvoicePdf(req, validCdc, mockRes)).rejects.toThrow(
        NotFoundException,
      );
      expect(repo.findInvoiceByCdc).toHaveBeenCalledWith('tenant-other', validCdc);
    });

    it('generates a valid native %PDF-1.4 KuDE document buffer as fallback', () => {
      const pdf = generateKudePdfBuffer({
        id: 'sifen-inv-fallback-1',
        tenantId: 'tenant-local',
        saleId: 'sale-1',
        cdc: validCdc,
        numeroDocumento: '001-001-0000003',
        timbrado: '12560102',
        environment: 'test',
        receptorRuc: '80023017',
        receptorDv: '5',
        receptorNombre: 'INFOZOOM SRL',
        condicionVenta: 'CONTADO',
        totalAmount: 110000,
        iva10Amount: 10000,
        xmlPayload: '<rDE/>',
        qrUrl: 'https://ekuatia.set.gov.py/consultas-test/qr?Id=' + validCdc,
        status: 'GENERATED',
        responseMessage: 'Documento Electrónico DE generado',
        createdAt: new Date('2026-11-24T17:50:00Z'),
      });

      const asLatin1 = pdf.toString('latin1');
      expect(asLatin1.startsWith('%PDF-1.4\n')).toBe(true);
      expect(asLatin1).toContain('001-001-0000003');
      expect(asLatin1).toContain('INFOZOOM SRL');
      expect(asLatin1.trimEnd().endsWith('%%EOF')).toBe(true);
    });

    it('reconciles async Factufy jobId CDC lazily when initial PDF request fails on provisional CDC', async () => {
      const provisionalCdc = '01800123450001001000000322026112415056834325';
      const authorizedCdc = '01800230175001001000000322026112415056834999';

      const repo = new SifenRepository();
      const fakeInvoice: any = {
        id: 'inv-async-3',
        tenantId: 'tenant-factufy',
        saleId: 'sale-3',
        cdc: provisionalCdc,
        numeroDocumento: '001-001-0000003',
        timbrado: '12560102',
        environment: 'test',
        receptorRuc: '44444401',
        receptorDv: '0',
        receptorNombre: 'SIN NOMBRE',
        condicionVenta: 'CONTADO',
        totalAmount: 50000,
        iva10Amount: 4545,
        xmlPayload: '<rDE/>',
        qrUrl: 'https://ekuatia.set.gov.py/consultas-test/qr',
        status: 'GENERATED',
        responseMessage: 'Enviado a Factufy',
        factufyJobId: 'job-async-003',
        createdAt: new Date(),
      };
      jest.spyOn(repo, 'findInvoiceByCdc').mockResolvedValue(fakeInvoice);
      jest.spyOn(repo, 'updateInvoiceCdc').mockResolvedValue(undefined);
      jest.spyOn(repo, 'getConfigByTenant').mockResolvedValue({
        tenantId: 'tenant-factufy',
        enabled: true,
        environment: 'test',
        provider: 'factufy',
        factufyClientId: 'cli_test_synthetic_001',
        factufyClientSecret: 'sec_test_synthetic_secret',
        factufyBranchCode: '001',
        factufyPosCode: '001',
      } as any);

      const officialPdfBytes = Buffer.from('%PDF-1.4\nofficial-factufy\n%%EOF', 'latin1');
      const mockAdapter: any = {
        downloadPdf: jest.fn(async (_creds: any, reqCdc: string) => {
          if (reqCdc === provisionalCdc) {
            throw new Error('Provisional CDC not found at Factufy');
          }
          return officialPdfBytes;
        }),
        resolveJobCdc: jest.fn(async () => ({ cdc: authorizedCdc, approved: true })),
      };

      const controller = new SifenController(repo, { findById: async () => null } as any, mockAdapter);
      const mockRes: any = { setHeader: jest.fn(), send: jest.fn((b) => b) };
      const req: any = { user: { tenantId: 'tenant-factufy', userId: 'cashier-1' } };

      const returned = await controller.downloadInvoicePdf(req, provisionalCdc, mockRes, '1');
      expect(mockAdapter.resolveJobCdc).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'cli_test_synthetic_001' }),
        'job-async-003',
        4,
        400,
      );
      expect(repo.updateInvoiceCdc).toHaveBeenCalledWith(
        'tenant-factufy',
        'inv-async-3',
        authorizedCdc,
        'APPROVED',
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="Factura-001-001-0000003.pdf"',
      );
      expect(returned).toBe(officialPdfBytes);
    });

    it('falls back to native KuDE PDF when provider is local_mock or upstream Factufy PDF fails', async () => {
      const repo = new SifenRepository();
      const localInvoice: any = {
        id: 'inv-local-4',
        tenantId: 'tenant-local-only',
        saleId: null,
        cdc: validCdc,
        numeroDocumento: '001-001-0000004',
        timbrado: '12560102',
        environment: 'test',
        receptorRuc: '44444401',
        receptorDv: '0',
        receptorNombre: 'CONSUMIDOR FINAL',
        condicionVenta: 'CONTADO',
        totalAmount: 25000,
        iva10Amount: 2273,
        xmlPayload: '<rDE/>',
        qrUrl: 'https://ekuatia.set.gov.py/consultas-test/qr',
        status: 'GENERATED',
        responseMessage: 'Local DE',
        createdAt: new Date(),
      };
      jest.spyOn(repo, 'findInvoiceByCdc').mockResolvedValue(localInvoice);
      jest.spyOn(repo, 'getConfigByTenant').mockResolvedValue({
        tenantId: 'tenant-local-only',
        enabled: true,
        environment: 'test',
        provider: 'local_mock',
        ruc: '80012345',
        dv: '5',
        razonSocial: 'COMERCIO LOCAL E.A.S.',
        direccion: 'Asunción',
        telefono: '021000',
      } as any);

      const controller = new SifenController(repo, { findById: async () => null } as any);
      const mockRes: any = { setHeader: jest.fn(), send: jest.fn((b) => b) };
      const req: any = { user: { tenantId: 'tenant-local-only', userId: 'cashier-1' } };

      const buf: Buffer = await controller.downloadInvoicePdf(req, validCdc, mockRes);
      expect(Buffer.isBuffer(buf)).toBe(true);
      expect(buf.toString('latin1').startsWith('%PDF-1.4\n')).toBe(true);
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'inline; filename="Factura-001-001-0000004.pdf"',
      );
    });
  });
});
