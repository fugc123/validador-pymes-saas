import { User } from '../../domain/entities/user.entity';
import { Merchant } from '../../domain/entities/merchant.entity';
import { MerchantMembership, MembershipRole } from '../../domain/entities/merchant-membership.entity';

export interface UserMembershipDetail {
  membership: MerchantMembership;
  merchant: Merchant;
}

export interface MerchantMemberDetail {
  id: string;
  userId: string;
  merchantId: string;
  role: MembershipRole;
  isActive: boolean;
  createdAt: Date;
  user: {
    id: string;
    email: string;
    fullName: string;
    isSuperAdmin: boolean;
  };
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  /** Create-only: inserting an existing id/email rejects with ConflictException (409). */
  save(user: User): Promise<User>;
}

export const BASE_STORE_MONTHLY_PYG = 150000;
export const FREE_BRANCHES_PER_STORE = 5;
export const EXTRA_BRANCH_MONTHLY_PYG = 50000;

export interface StorePricingBreakdown {
  basePyg: number;
  freeBranchesLimit: number;
  activeBranchesCount: number;
  extraBranchesCount: number;
  extraBranchesPyg: number;
  totalMonthlyPyg: number;
}

export function calculateStoreMonthlyCostPyg(activeBranchesCount: number): StorePricingBreakdown {
  const safeCount = Math.max(0, Math.floor(Number(activeBranchesCount) || 0));
  const extraBranchesCount = Math.max(0, safeCount - FREE_BRANCHES_PER_STORE);
  const extraBranchesPyg = extraBranchesCount * EXTRA_BRANCH_MONTHLY_PYG;
  return {
    basePyg: BASE_STORE_MONTHLY_PYG,
    freeBranchesLimit: FREE_BRANCHES_PER_STORE,
    activeBranchesCount: safeCount,
    extraBranchesCount,
    extraBranchesPyg,
    totalMonthlyPyg: BASE_STORE_MONTHLY_PYG + extraBranchesPyg,
  };
}

export interface MerchantBranch {
  id: string;
  tenantId: string;
  name: string;
  branchCode: string;
  posCode: string;
  address: string | null;
  isActive: boolean;
  createdAt: Date;
}

export interface CreateMerchantBranchInput {
  tenantId: string;
  name: string;
  branchCode?: string;
  posCode?: string;
  address?: string | null;
}

export interface IMerchantRepository {
  findById(id: string): Promise<Merchant | null>;
  findBySlug(slug: string): Promise<Merchant | null>;
  save(merchant: Merchant): Promise<Merchant>;
  listBranches?(tenantId: string): Promise<MerchantBranch[]>;
  createBranch?(input: CreateMerchantBranchInput): Promise<MerchantBranch>;
  deleteBranch?(tenantId: string, branchId: string): Promise<boolean>;
}

export interface IMembershipRepository {
  findActiveByUser(userId: string): Promise<UserMembershipDetail[]>;
  findByUserAndMerchant(userId: string, merchantId: string, role?: string): Promise<MerchantMembership | null>;
  findMembersByMerchant(merchantId: string): Promise<MerchantMemberDetail[]>;
  /** Deletes only a membership owned by `merchantId`; false when no same-tenant row matched. */
  deleteMembership(merchantId: string, membershipId: string): Promise<boolean>;
  save(membership: MerchantMembership): Promise<MerchantMembership>;
}

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export type TokenPurpose = 'access' | 'tenant_selection';

export interface ScopedTokenPayload {
  userId: string;
  email: string;
  tenantId?: string;
  role: 'SUPER_ADMIN' | MembershipRole;
  isSuperAdmin: boolean;
  /** Signed into the token; only 'access' purpose may authenticate requests. */
  purpose?: TokenPurpose;
}

export interface TempTokenPayload {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  /** Signed into the token; 'tenant_selection' purpose may not authenticate requests. */
  purpose?: TokenPurpose;
}

export interface ITokenService {
  signScopedToken(payload: ScopedTokenPayload): string;
  signTempToken(payload: TempTokenPayload): string;
  verifyToken<T = any>(token: string): T;
}
