import { BadRequestException, ConflictException, Inject, Injectable, Optional } from '@nestjs/common';
import { randomBytes, randomUUID } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { LoyaltyCardRow, LoyaltyCouponRow, LoyaltyProgramRow } from '../database/schema';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import { ALLOWED_CATALOG_THEMES, CatalogThemePalette } from '../../core/application/ports/catalog.ports';
import {
  ILoyaltyRepository,
  LoyaltyCard,
  LoyaltyCoupon,
  LoyaltyProgram,
  PublicLoyaltyCardView,
  RecordVisitResult,
  UpsertLoyaltyProgramInput,
} from '../../core/application/ports/loyalty.ports';

@Injectable()
export class LoyaltyRepository implements ILoyaltyRepository {
  private programs = new Map<string, LoyaltyProgram>();
  private cards: LoyaltyCard[] = [];

  constructor(
    @Optional() private readonly dbService?: DatabaseService,
    @Optional()
    @Inject('IMerchantRepository')
    private readonly merchantRepo?: IMerchantRepository,
  ) {}

  private isDbActive(): boolean {
    return Boolean(this.dbService && !this.dbService.isMemoryMode);
  }

  private normalizePhone(phone: string): string {
    const digits = (phone || '').replace(/\D/g, '');
    if (digits.length < 6) {
      throw new BadRequestException('Ingresá un número de teléfono válido (mínimo 6 dígitos).');
    }
    return digits;
  }

  private maskPhone(digits: string): string {
    if (digits.length <= 4) return digits;
    return `***${digits.slice(-4)}`;
  }

  private defaultProgram(tenantId: string): LoyaltyProgram {
    const now = new Date();
    return {
      tenantId,
      isEnabled: false,
      stampsRequired: 10,
      rewardTitle: '1 Premio Gratis',
      rewardDescription: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private mapProgramRow(row: LoyaltyProgramRow): LoyaltyProgram {
    return {
      tenantId: row.tenant_id,
      isEnabled: Boolean(row.is_enabled),
      stampsRequired: Number(row.stamps_required || 10),
      rewardTitle: row.reward_title,
      rewardDescription: row.reward_description,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  private mapCouponRow(row: LoyaltyCouponRow): LoyaltyCoupon {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      cardId: row.card_id,
      code: row.code,
      rewardTitle: row.reward_title,
      status: row.status === 'redeemed' ? 'redeemed' : 'available',
      issuedAt: new Date(row.issued_at),
      redeemedAt: row.redeemed_at ? new Date(row.redeemed_at) : null,
    };
  }

  private mapCardRow(row: LoyaltyCardRow, coupons: LoyaltyCoupon[] = []): LoyaltyCard {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      customerPhone: row.customer_phone,
      customerName: row.customer_name,
      cardToken: row.card_token,
      stampsCount: Number(row.stamps_count || 0),
      totalVisits: Number(row.total_visits || 0),
      lastVisitAt: row.last_visit_at ? new Date(row.last_visit_at) : null,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      coupons,
    };
  }

  async getProgram(tenantId: string): Promise<LoyaltyProgram> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<LoyaltyProgramRow>(
        `SELECT * FROM loyalty_programs WHERE tenant_id = $1`,
        [tenantId],
      );
      if (res.rows && res.rows.length > 0) {
        return this.mapProgramRow(res.rows[0]);
      }
      return this.defaultProgram(tenantId);
    }

    return this.programs.get(tenantId) || this.defaultProgram(tenantId);
  }

  async upsertProgram(input: UpsertLoyaltyProgramInput): Promise<LoyaltyProgram> {
    const stampsRequired = Math.min(50, Math.max(2, Math.floor(Number(input.stampsRequired || 10))));
    const rewardTitle = (input.rewardTitle || '').trim() || '1 Premio Gratis';
    const rewardDescription = input.rewardDescription ? input.rewardDescription.trim() : null;
    const now = new Date();

    if (this.isDbActive()) {
      const res = await this.dbService!.query<LoyaltyProgramRow>(
        `INSERT INTO loyalty_programs (tenant_id, is_enabled, stamps_required, reward_title, reward_description, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (tenant_id) DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           stamps_required = EXCLUDED.stamps_required,
           reward_title = EXCLUDED.reward_title,
           reward_description = EXCLUDED.reward_description,
           updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [input.tenantId, Boolean(input.isEnabled), stampsRequired, rewardTitle, rewardDescription, now, now],
      );
      return this.mapProgramRow(res.rows[0]);
    }

    const existing = this.programs.get(input.tenantId);
    const updated: LoyaltyProgram = {
      tenantId: input.tenantId,
      isEnabled: Boolean(input.isEnabled),
      stampsRequired,
      rewardTitle,
      rewardDescription,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
    };
    this.programs.set(input.tenantId, updated);
    return updated;
  }

  async recordVisitByPhone(
    tenantId: string,
    rawPhone: string,
    customerName?: string | null,
    forceEvenIfDisabled = false,
  ): Promise<RecordVisitResult> {
    const program = await this.getProgram(tenantId);
    if (!program.isEnabled && !forceEvenIfDisabled) {
      return {
        programEnabled: false,
        stampsRequired: program.stampsRequired,
        rewardTitle: program.rewardTitle,
        card: null,
        couponEarned: null,
      };
    }

    const phone = this.normalizePhone(rawPhone);
    const cleanName = customerName ? customerName.trim() : null;
    const now = new Date();

    if (this.isDbActive()) {
      let cardRow: LoyaltyCardRow | null = null;
      const existingRes = await this.dbService!.query<LoyaltyCardRow>(
        `SELECT * FROM loyalty_cards WHERE tenant_id = $1 AND customer_phone = $2`,
        [tenantId, phone],
      );

      if (existingRes.rows && existingRes.rows.length > 0) {
        cardRow = existingRes.rows[0];
      } else {
        const newId = `lyc-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`;
        const newToken = randomBytes(16).toString('hex');
        const ins = await this.dbService!.query<LoyaltyCardRow>(
          `INSERT INTO loyalty_cards (id, tenant_id, customer_phone, customer_name, card_token, stamps_count, total_visits, last_visit_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 0, 0, $6, $6, $6)
           RETURNING *`,
          [newId, tenantId, phone, cleanName, newToken, now],
        );
        cardRow = ins.rows[0];
      }

      let nextStamps = Number(cardRow.stamps_count || 0) + 1;
      const nextTotal = Number(cardRow.total_visits || 0) + 1;
      let couponEarned: LoyaltyCoupon | null = null;

      if (nextStamps >= program.stampsRequired) {
        nextStamps = nextStamps - program.stampsRequired;
        const couponId = `cup-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`;
        const code = `CUP-${randomBytes(3).toString('hex').toUpperCase()}`;
        const cupRes = await this.dbService!.query<LoyaltyCouponRow>(
          `INSERT INTO loyalty_coupons (id, tenant_id, card_id, code, reward_title, status, issued_at)
           VALUES ($1, $2, $3, $4, $5, 'available', $6)
           RETURNING *`,
          [couponId, tenantId, cardRow.id, code, program.rewardTitle, now],
        );
        couponEarned = this.mapCouponRow(cupRes.rows[0]);
      }

      const updRes = await this.dbService!.query<LoyaltyCardRow>(
        `UPDATE loyalty_cards
         SET stamps_count = $1,
             total_visits = $2,
             customer_name = COALESCE($3, customer_name),
             last_visit_at = $4,
             updated_at = $4
         WHERE tenant_id = $5 AND id = $6
         RETURNING *`,
        [nextStamps, nextTotal, cleanName, now, tenantId, cardRow.id],
      );

      const couponsRes = await this.dbService!.query<LoyaltyCouponRow>(
        `SELECT * FROM loyalty_coupons WHERE tenant_id = $1 AND card_id = $2 ORDER BY issued_at DESC`,
        [tenantId, cardRow.id],
      );
      const coupons = (couponsRes.rows || []).map((r) => this.mapCouponRow(r));
      return {
        programEnabled: true,
        stampsRequired: program.stampsRequired,
        rewardTitle: program.rewardTitle,
        card: this.mapCardRow(updRes.rows[0], coupons),
        couponEarned,
      };
    }

    let card = this.cards.find((c) => c.tenantId === tenantId && c.customerPhone === phone);
    if (!card) {
      card = {
        id: `lyc-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`,
        tenantId,
        customerPhone: phone,
        customerName: cleanName,
        cardToken: randomBytes(16).toString('hex'),
        stampsCount: 0,
        totalVisits: 0,
        lastVisitAt: now,
        createdAt: now,
        updatedAt: now,
        coupons: [],
      };
      this.cards.push(card);
    } else if (cleanName) {
      card.customerName = cleanName;
    }

    card.stampsCount += 1;
    card.totalVisits += 1;
    card.lastVisitAt = now;
    card.updatedAt = now;

    let couponEarned: LoyaltyCoupon | null = null;
    if (card.stampsCount >= program.stampsRequired) {
      card.stampsCount -= program.stampsRequired;
      couponEarned = {
        id: `cup-${randomUUID().slice(0, 8)}-${Date.now().toString(36)}`,
        tenantId,
        cardId: card.id,
        code: `CUP-${randomBytes(3).toString('hex').toUpperCase()}`,
        rewardTitle: program.rewardTitle,
        status: 'available',
        issuedAt: now,
        redeemedAt: null,
      };
      card.coupons.unshift(couponEarned);
    }

    return {
      programEnabled: true,
      stampsRequired: program.stampsRequired,
      rewardTitle: program.rewardTitle,
      card: { ...card, coupons: [...card.coupons] },
      couponEarned,
    };
  }

  async listCardsByTenant(tenantId: string, limit = 100): Promise<LoyaltyCard[]> {
    if (this.isDbActive()) {
      const res = await this.dbService!.query<LoyaltyCardRow>(
        `SELECT * FROM loyalty_cards WHERE tenant_id = $1 ORDER BY updated_at DESC LIMIT $2`,
        [tenantId, limit],
      );
      const rows = res.rows || [];
      if (rows.length === 0) return [];
      const cardIds = rows.map((r) => r.id);
      const cupRes = await this.dbService!.query<LoyaltyCouponRow>(
        `SELECT * FROM loyalty_coupons WHERE tenant_id = $1 AND card_id = ANY($2) ORDER BY issued_at DESC`,
        [tenantId, cardIds],
      );
      const byCard = new Map<string, LoyaltyCoupon[]>();
      for (const cr of cupRes.rows || []) {
        const list = byCard.get(cr.card_id) || [];
        list.push(this.mapCouponRow(cr));
        byCard.set(cr.card_id, list);
      }
      return rows.map((r) => this.mapCardRow(r, byCard.get(r.id) || []));
    }

    return this.cards
      .filter((c) => c.tenantId === tenantId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
      .slice(0, limit);
  }

  async findCardByPhone(tenantId: string, rawPhone: string): Promise<LoyaltyCard | null> {
    const phone = this.normalizePhone(rawPhone);
    if (this.isDbActive()) {
      const res = await this.dbService!.query<LoyaltyCardRow>(
        `SELECT * FROM loyalty_cards WHERE tenant_id = $1 AND customer_phone = $2`,
        [tenantId, phone],
      );
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      const cupRes = await this.dbService!.query<LoyaltyCouponRow>(
        `SELECT * FROM loyalty_coupons WHERE tenant_id = $1 AND card_id = $2 ORDER BY issued_at DESC`,
        [tenantId, row.id],
      );
      return this.mapCardRow(
        row,
        (cupRes.rows || []).map((r) => this.mapCouponRow(r)),
      );
    }

    return this.cards.find((c) => c.tenantId === tenantId && c.customerPhone === phone) || null;
  }

  async getPublicCardByToken(cardToken: string): Promise<PublicLoyaltyCardView | null> {
    const cleanToken = (cardToken || '').trim();
    if (!cleanToken) return null;

    let card: LoyaltyCard | null = null;
    let merchantName = 'Comercio';
    let merchantSlug = '';
    let theme: CatalogThemePalette = 'emerald';

    if (this.isDbActive()) {
      const res = await this.dbService!.query<LoyaltyCardRow>(
        `SELECT * FROM loyalty_cards WHERE card_token = $1`,
        [cleanToken],
      );
      if (!res.rows || res.rows.length === 0) return null;
      const row = res.rows[0];
      const cupRes = await this.dbService!.query<LoyaltyCouponRow>(
        `SELECT * FROM loyalty_coupons WHERE tenant_id = $1 AND card_id = $2 ORDER BY issued_at DESC`,
        [row.tenant_id, row.id],
      );
      card = this.mapCardRow(
        row,
        (cupRes.rows || []).map((r) => this.mapCouponRow(r)),
      );

      const mRes = await this.dbService!.query<{
        name: string;
        slug: string;
        catalog_theme?: string;
      }>(
        `SELECT name, slug, catalog_theme FROM merchants WHERE (slug = $1 OR id::text = $1) AND status = 'active' LIMIT 1`,
        [row.tenant_id],
      );
      if (!mRes.rows || mRes.rows.length === 0) return null;
      merchantName = mRes.rows[0].name;
      merchantSlug = mRes.rows[0].slug;
      theme = ALLOWED_CATALOG_THEMES.includes(mRes.rows[0].catalog_theme as CatalogThemePalette)
        ? (mRes.rows[0].catalog_theme as CatalogThemePalette)
        : 'emerald';
    } else {
      card = this.cards.find((c) => c.cardToken === cleanToken) || null;
      if (!card) return null;
      if (this.merchantRepo) {
        const m = await this.merchantRepo.findBySlug(card.tenantId);
        if (m) {
          merchantName = m.name;
          merchantSlug = m.slug;
        }
      }
    }

    const program = await this.getProgram(card.tenantId);
    return {
      merchantName,
      merchantSlug,
      theme,
      stampsRequired: program.stampsRequired,
      rewardTitle: program.rewardTitle,
      rewardDescription: program.rewardDescription,
      card: {
        customerName: card.customerName,
        customerPhoneMasked: this.maskPhone(card.customerPhone),
        stampsCount: card.stampsCount,
        totalVisits: card.totalVisits,
        lastVisitAt: card.lastVisitAt,
        coupons: card.coupons,
      },
    };
  }

  async redeemCoupon(tenantId: string, couponId: string): Promise<LoyaltyCoupon | null> {
    const now = new Date();
    if (this.isDbActive()) {
      const upd = await this.dbService!.query<LoyaltyCouponRow>(
        `UPDATE loyalty_coupons
         SET status = 'redeemed', redeemed_at = $1
         WHERE tenant_id = $2 AND id = $3 AND status = 'available'
         RETURNING *`,
        [now, tenantId, couponId],
      );
      if (upd.rows && upd.rows.length > 0) {
        return this.mapCouponRow(upd.rows[0]);
      }
      const existing = await this.dbService!.query<LoyaltyCouponRow>(
        `SELECT * FROM loyalty_coupons WHERE tenant_id = $1 AND id = $2`,
        [tenantId, couponId],
      );
      if (!existing.rows || existing.rows.length === 0) return null;
      throw new ConflictException('Este cupón ya fue canjeado anteriormente.');
    }

    for (const c of this.cards) {
      if (c.tenantId !== tenantId) continue;
      const cup = c.coupons.find((cp) => cp.id === couponId);
      if (cup) {
        if (cup.status === 'redeemed') {
          throw new ConflictException('Este cupón ya fue canjeado anteriormente.');
        }
        cup.status = 'redeemed';
        cup.redeemedAt = now;
        return cup;
      }
    }
    return null;
  }
}
