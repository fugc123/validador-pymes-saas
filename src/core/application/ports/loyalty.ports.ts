import { CatalogThemePalette } from './catalog.ports';

export type LoyaltyCouponStatus = 'available' | 'redeemed';

export interface LoyaltyProgram {
  tenantId: string;
  isEnabled: boolean;
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UpsertLoyaltyProgramInput {
  tenantId: string;
  isEnabled: boolean;
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription?: string | null;
}

export interface LoyaltyCoupon {
  id: string;
  tenantId: string;
  cardId: string;
  code: string;
  rewardTitle: string;
  status: LoyaltyCouponStatus;
  issuedAt: Date;
  redeemedAt: Date | null;
}

export interface LoyaltyCard {
  id: string;
  tenantId: string;
  customerPhone: string;
  customerName: string | null;
  cardToken: string;
  stampsCount: number;
  totalVisits: number;
  lastVisitAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  coupons: LoyaltyCoupon[];
}

export interface RecordVisitResult {
  programEnabled: boolean;
  stampsRequired: number;
  rewardTitle: string;
  card: LoyaltyCard | null;
  couponEarned: LoyaltyCoupon | null;
}

export interface PublicLoyaltyCardView {
  merchantName: string;
  merchantSlug: string;
  theme: CatalogThemePalette;
  stampsRequired: number;
  rewardTitle: string;
  rewardDescription: string | null;
  card: {
    customerName: string | null;
    customerPhoneMasked: string;
    stampsCount: number;
    totalVisits: number;
    lastVisitAt: Date | null;
    coupons: LoyaltyCoupon[];
  };
}

export interface ILoyaltyRepository {
  getProgram(tenantId: string): Promise<LoyaltyProgram>;
  upsertProgram(input: UpsertLoyaltyProgramInput): Promise<LoyaltyProgram>;
  recordVisitByPhone(
    tenantId: string,
    customerPhone: string,
    customerName?: string | null,
    forceEvenIfDisabled?: boolean,
  ): Promise<RecordVisitResult>;
  listCardsByTenant(tenantId: string, limit?: number): Promise<LoyaltyCard[]>;
  findCardByPhone(tenantId: string, customerPhone: string): Promise<LoyaltyCard | null>;
  getPublicCardByToken(cardToken: string): Promise<PublicLoyaltyCardView | null>;
  redeemCoupon(tenantId: string, couponId: string): Promise<LoyaltyCoupon | null>;
}
