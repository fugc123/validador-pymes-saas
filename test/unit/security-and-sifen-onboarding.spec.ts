import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  decryptSecretAtRest,
  encryptSecretAtRest,
} from '../../src/core/application/utils/secret-crypto';
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
  });
});
