import { LoyaltyRepository } from '../../src/infrastructure/repositories/loyalty.repository';
import { DDL_SCHEMA_SQL } from '../../src/infrastructure/database/schema';

describe('Digital Loyalty Cards & Coupons (Rondafy-style)', () => {
  let loyaltyRepo: LoyaltyRepository;

  beforeEach(() => {
    loyaltyRepo = new LoyaltyRepository();
  });

  it('defines PostgreSQL tables for loyalty_programs, loyalty_cards, and loyalty_coupons', () => {
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS loyalty_programs');
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS loyalty_cards');
    expect(DDL_SCHEMA_SQL).toContain('CREATE TABLE IF NOT EXISTS loyalty_coupons');
  });

  it('skips auto-stamping when loyalty program is disabled', async () => {
    const res = await loyaltyRepo.recordVisitByPhone('cafe-central', '0981 123 456', 'Ana');
    expect(res.programEnabled).toBe(false);
    expect(res.card).toBeNull();
    expect(res.couponEarned).toBeNull();
  });

  it('normalizes phone numbers, increments stamps, and issues a coupon at threshold', async () => {
    await loyaltyRepo.upsertProgram({
      tenantId: 'cafe-central',
      isEnabled: true,
      stampsRequired: 3,
      rewardTitle: '1 Café Gratis',
      rewardDescription: 'Válido para cualquier café mediano',
    });

    const v1 = await loyaltyRepo.recordVisitByPhone('cafe-central', '0981 123 456', 'Ana');
    expect(v1.programEnabled).toBe(true);
    expect(v1.card?.stampsCount).toBe(1);
    expect(v1.card?.totalVisits).toBe(1);
    expect(v1.couponEarned).toBeNull();

    // Same number without spaces matches same card
    const v2 = await loyaltyRepo.recordVisitByPhone('cafe-central', '0981123456');
    expect(v2.card?.id).toBe(v1.card?.id);
    expect(v2.card?.stampsCount).toBe(2);

    // 3rd visit completes 3/3 -> generates coupon & resets stampsCount to 0
    const v3 = await loyaltyRepo.recordVisitByPhone('cafe-central', '0981123456');
    expect(v3.card?.stampsCount).toBe(0);
    expect(v3.card?.totalVisits).toBe(3);
    expect(v3.couponEarned).not.toBeNull();
    expect(v3.couponEarned?.status).toBe('available');
    expect(v3.couponEarned?.rewardTitle).toBe('1 Café Gratis');
    expect(v3.couponEarned?.code).toMatch(/^CUP-[A-F0-9]{6}$/);

    // Public view via unguessable token masks phone & shows coupon
    const publicView = await loyaltyRepo.getPublicCardByToken(v3.card!.cardToken);
    expect(publicView).not.toBeNull();
    expect(publicView?.card.customerPhoneMasked).toBe('***3456');
    expect(publicView?.card.coupons).toHaveLength(1);
  });

  it('redeems coupons once and enforces tenant isolation', async () => {
    await loyaltyRepo.upsertProgram({
      tenantId: 'barberia-vip',
      isEnabled: true,
      stampsRequired: 2,
      rewardTitle: 'Corte Gratis',
    });

    await loyaltyRepo.recordVisitByPhone('barberia-vip', '0971555666', 'Carlos');
    const v2 = await loyaltyRepo.recordVisitByPhone('barberia-vip', '0971555666', 'Carlos');
    const couponId = v2.couponEarned!.id;

    // Another tenant cannot list or redeem
    expect(await loyaltyRepo.listCardsByTenant('otro-local')).toHaveLength(0);
    expect(await loyaltyRepo.redeemCoupon('otro-local', couponId)).toBeNull();

    // Owner tenant redeems successfully
    const redeemed = await loyaltyRepo.redeemCoupon('barberia-vip', couponId);
    expect(redeemed?.status).toBe('redeemed');

    // Double redemption rejected
    await expect(loyaltyRepo.redeemCoupon('barberia-vip', couponId)).rejects.toThrow(/ya fue canjeado/i);
  });
});
