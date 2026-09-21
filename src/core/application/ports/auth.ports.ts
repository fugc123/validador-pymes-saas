import { User } from '../../domain/entities/user.entity';
import { Merchant } from '../../domain/entities/merchant.entity';
import { MerchantMembership, MembershipRole } from '../../domain/entities/merchant-membership.entity';

export interface UserMembershipDetail {
  membership: MerchantMembership;
  merchant: Merchant;
}

export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  save(user: User): Promise<User>;
}

export interface IMerchantRepository {
  findById(id: string): Promise<Merchant | null>;
  findBySlug(slug: string): Promise<Merchant | null>;
  save(merchant: Merchant): Promise<Merchant>;
}

export interface IMembershipRepository {
  findActiveByUser(userId: string): Promise<UserMembershipDetail[]>;
  findByUserAndMerchant(userId: string, merchantId: string, role?: string): Promise<MerchantMembership | null>;
  save(membership: MerchantMembership): Promise<MerchantMembership>;
}

export interface IPasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export interface ScopedTokenPayload {
  userId: string;
  email: string;
  tenantId?: string;
  role: 'SUPER_ADMIN' | MembershipRole;
  isSuperAdmin: boolean;
}

export interface TempTokenPayload {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
}

export interface ITokenService {
  signScopedToken(payload: ScopedTokenPayload): string;
  signTempToken(payload: TempTokenPayload): string;
  verifyToken<T = any>(token: string): T;
}
