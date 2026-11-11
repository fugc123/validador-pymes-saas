import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { DDL_SCHEMA_SQL } from '../../src/infrastructure/database/schema';
import { SifenRepository } from '../../src/infrastructure/repositories/sifen.repository';
import { SifenController } from '../../src/presentation/controllers/sifen.controller';
import {
  calculateParaguayDv,
  generateParaguayCdc,
} from '../../src/core/application/ports/sifen.ports';
import { Subscription } from '../../src/core/domain/entities/subscription.entity';
import { Merchant } from '../../src/core/domain/entities/merchant.entity';
import { ISubscriptionRepository } from '../../src/core/application/ports/onboarding.ports';
import { IMerchantRepository } from '../../src/core/application/ports/auth.ports';

describe('SIFEN Electronic Invoicing (Free/Lifetime Merchants Only)', () => {
  let sifenRepo: SifenRepository;
  let controller: SifenController;
  let mockSubscriptions: Map<string, Subscription>;
  let mockMerchants: Map<string, Merchant>;
  let subscriptionRepoStub: ISubscriptionRepository;
  let merchantRepoStub: IMerchantRepository;

  beforeEach(() => {
    mockSubscriptions = new Map<string, Subscription>();
    mockMerchants = new Map<string, Merchant>();

    mockMerchants.set(
      'mi-empresa-propia',
      new Merchant({
        id: 'mi-empresa-propia',
        name: 'CajaSegura Central',
        slug: 'mi-empresa-propia',
        webhookSecret: 'sec_1_1234567890abcdef',
        status: 'active',
      }),
    );

    mockMerchants.set(
      'cliente-externo-mensual',
      new Merchant({
        id: 'cliente-externo-mensual',
        name: 'Comercio Externo Mensual',
        slug: 'cliente-externo-mensual',
        webhookSecret: 'sec_2_1234567890abcdef',
        status: 'active',
      }),
    );

    // 1. Free / Lifetime merchant (owner's own business)
    mockSubscriptions.set(
      'mi-empresa-propia',
      new Subscription({
        id: 'sub-free-1',
        tenantId: 'mi-empresa-propia',
        status: 'active',
        currentPeriodEnd: new Date('2099-12-31T23:59:59.999Z'),
        externalCustomerId: 'free-lifetime-partner',
        externalSubscriptionId: 'sub_lifetime_permanent',
      }),
    );

    // 2. Standard paid/trial merchant (NOT eligible for SIFEN)
    mockSubscriptions.set(
      'cliente-externo-mensual',
      new Subscription({
        id: 'sub-paid-1',
        tenantId: 'cliente-externo-mensual',
        status: 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 3600 * 1000),
        externalCustomerId: 'cust_standard',
        externalSubscriptionId: 'sub_monthly_150k',
      }),
    );

    subscriptionRepoStub = {
      save: async (sub: Subscription) => {
        mockSubscriptions.set(sub.tenantId, sub);
        return sub;
      },
      findByTenantId: async (tenantId: string) => mockSubscriptions.get(tenantId) || null,
      findAll: async () => Array.from(mockSubscriptions.values()),
    };

    merchantRepoStub = {
      save: async (m: Merchant) => {
        if (m.id) mockMerchants.set(m.id, m);
        return m;
      },
      findById: async (id: string) => mockMerchants.get(id) || null,
      findBySlug: async (slug: string) => mockMerchants.get(slug) || null,
    };

    sifenRepo = new SifenRepository(undefined, subscriptionRepoStub, merchantRepoStub);
    controller = new SifenController(sifenRepo, merchantRepoStub);
  });

  describe('PostgreSQL Schema (DDL_SCHEMA_SQL)', () => {
    it('defines sifen_configs and sifen_invoices tables in PostgreSQL DDL', () => {
      expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS sifen_configs');
      expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS sifen_invoices');
      expect(DDL_SCHEMA_SQL).toContain('certificado_base64 TEXT');
      expect(DDL_SCHEMA_SQL).toContain('cdc VARCHAR(44) NOT NULL');
    });
  });

  describe('Paraguayan RUC Check Digit & 44-Digit CDC Generator', () => {
    it('calculates Modulo-11 DV and generates an exact 44-digit numeric CDC', () => {
      const dv = calculateParaguayDv('80012345');
      expect(dv).toMatch(/^\d$/);

      const cdc = generateParaguayCdc({
        tipoDocumento: '01',
        ruc: '80012345',
        dv,
        establecimiento: '001',
        puntoExpedicion: '001',
        numeroSecuencial: 1,
        tipoContribuyente: 2,
        fechaEmision: new Date('2026-11-05T12:00:00Z'),
        codigoSeguridad: '123456789',
      });

      expect(cdc).toHaveLength(44);
      expect(cdc).toMatch(/^\d{44}$/);
      expect(cdc.startsWith('0180012345')).toBe(true);
    });
  });

  describe('Strict Lifetime / Free Merchant Eligibility Guard', () => {
    it('allows configuring SIFEN for a Free / Lifetime merchant', async () => {
      const isEligible = await sifenRepo.isEligibleFreeMerchant('mi-empresa-propia');
      expect(isEligible).toBe(true);

      const saved = await sifenRepo.upsertConfig('mi-empresa-propia', {
        enabled: true,
        environment: 'test',
        ruc: '80098765',
        dv: '3',
        razonSocial: 'CAJASEGURA TECH E.A.S.',
        nombreFantasia: 'CajaSegura Central',
        tipoContribuyente: 2,
        timbrado: '12560102',
        establecimiento: '001',
        puntoExpedicion: '001',
        cscId: '0001',
        csc: 'ABCD0000000000000000000000000000',
      });

      expect(saved.tenantId).toBe('mi-empresa-propia');
      expect(saved.ruc).toBe('80098765');
      expect(saved.timbrado).toBe('12560102');
      expect(saved.enabled).toBe(true);
    });

    it('rejects configuring or emitting SIFEN for non-free (trial/paid) merchants with ForbiddenException', async () => {
      const isEligible = await sifenRepo.isEligibleFreeMerchant('cliente-externo-mensual');
      expect(isEligible).toBe(false);

      await expect(
        sifenRepo.upsertConfig('cliente-externo-mensual', {
          ruc: '80011122',
          dv: '1',
          razonSocial: 'COMERCIO EXTERNO S.A.',
          timbrado: '12345678',
        }),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        sifenRepo.emitInvoice({
          tenantId: 'cliente-externo-mensual',
          receptorRuc: '44444401',
          receptorNombre: 'CONSUMIDOR FINAL',
          totalAmount: 100000,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('validates 8-digit timbrado requirement', async () => {
      await expect(
        sifenRepo.upsertConfig('mi-empresa-propia', {
          ruc: '80098765',
          dv: '3',
          razonSocial: 'CAJASEGURA TECH E.A.S.',
          timbrado: '123', // invalid length
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('SifenController SuperAdmin & Cashier Flows', () => {
    it('returns autocompleteTemplate for Free Merchant in SuperAdmin and runs test emission', async () => {
      const configResp = await controller.getFreeMerchantConfig('mi-empresa-propia');
      expect(configResp.data.isLifetime).toBe(true);
      expect(configResp.data.autocompleteTemplate.razonSocial).toBe('CAJASEGURA CENTRAL E.A.S.');
      expect(configResp.data.autocompleteTemplate.timbrado).toBe('12560102');

      await controller.saveFreeMerchantConfig(
        'mi-empresa-propia',
        configResp.data.autocompleteTemplate,
        { user: { userId: 'superadmin-1' } },
      );

      const testResp = await controller.runTestEmission('mi-empresa-propia', {
        receptorRuc: '4567890',
        receptorNombre: 'CLIENTE HOMOLOGACION',
        totalAmount: 110000,
      });

      expect(testResp.data.invoice.cdc).toHaveLength(44);
      expect(testResp.data.invoice.status).toBe('TEST_OK');
      expect(testResp.data.config?.lastTestStatus).toBe('TEST_OK');

      // Cashier status for eligible free merchant vs non-free merchant
      const cashierFree = await controller.getCashierSifenStatus({
        user: { tenantId: 'mi-empresa-propia' },
      });
      expect(cashierFree.data.isFreeMerchant).toBe(true);
      expect(cashierFree.data.enabled).toBe(true);

      const cashierPaid = await controller.getCashierSifenStatus({
        user: { tenantId: 'cliente-externo-mensual' },
      });
      expect(cashierPaid.data.isFreeMerchant).toBe(false);
      expect(cashierPaid.data.enabled).toBe(false);
    });
  });
});
