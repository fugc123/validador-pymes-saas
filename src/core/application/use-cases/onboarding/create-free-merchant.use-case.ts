import {
  Injectable,
  Inject,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { ISubscriptionRepository } from '../../ports/onboarding.ports';
import { IMerchantRepository, IUserRepository, IMembershipRepository, IPasswordHasher } from '../../ports/auth.ports';
import { Merchant } from '../../../domain/entities/merchant.entity';
import { User } from '../../../domain/entities/user.entity';
import { MerchantMembership } from '../../../domain/entities/merchant-membership.entity';
import { Subscription } from '../../../domain/entities/subscription.entity';

export interface CreateFreeMerchantInput {
  businessName: string;
  ownerName: string;
  email: string;
  password?: string;
  phone?: string;
  city?: string;
}

export interface CreateFreeMerchantOutput {
  merchantId: string;
  merchantName: string;
  merchantSlug: string;
  webhookSecret: string;
  ownerUserId: string;
  ownerEmail: string;
  ownerFullName: string;
  subscriptionStatus: string;
  isLifetime: boolean;
  expiresAt: Date;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

@Injectable()
export class CreateFreeMerchantUseCase {
  constructor(
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IMembershipRepository') private readonly membershipRepo: IMembershipRepository,
    @Inject('ISubscriptionRepository') private readonly subscriptionRepo: ISubscriptionRepository,
    @Inject('IPasswordHasher') private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: CreateFreeMerchantInput): Promise<CreateFreeMerchantOutput> {
    const rawPassword = input.password?.trim() || 'password123';
    const passwordHash = await this.passwordHasher.hash(rawPassword);

    // 1. Generate unique slug for Merchant
    const baseSlug = slugify(input.businessName) || `comercio-${Date.now().toString().slice(-4)}`;
    const existingMerchant = await this.merchantRepo.findBySlug(baseSlug);
    const finalSlug = existingMerchant ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
    const webhookSecret = `sec_${finalSlug.replace(/-/g, '_')}_${crypto.randomBytes(16).toString('hex')}`;

    const merchant = new Merchant({
      id: finalSlug,
      name: input.businessName,
      slug: finalSlug,
      webhookSecret,
      status: 'active',
    });
    const savedMerchant = await this.merchantRepo.save(merchant);
    const merchantId = savedMerchant.id || finalSlug;

    // 2. Find or Create Owner User
    let user = await this.userRepo.findByEmail(input.email);
    let userId: string;

    if (!user) {
      userId = `usr-${Date.now()}`;
      user = new User({
        id: userId,
        email: input.email.toLowerCase().trim(),
        passwordHash,
        fullName: input.ownerName,
        isSuperAdmin: false,
      });
      user = await this.userRepo.save(user);
    } else {
      userId = user.id || `usr-${Date.now()}`;
      user.updatePassword(passwordHash);
      await this.userRepo.save(user);
    }

    // 3. Create Owner Membership
    const existingMembership = await this.membershipRepo.findByUserAndMerchant(userId, merchantId);
    if (!existingMembership) {
      const membership = new MerchantMembership({
        id: `mem-${Date.now()}`,
        userId,
        merchantId,
        role: 'MERCHANT_OWNER',
        isActive: true,
      });
      await this.membershipRepo.save(membership);
    }

    // 4. Create Permanent Lifetime Free Subscription (Exp: Dec 31, 2099)
    const lifetimeExpiry = new Date('2099-12-31T23:59:59.999Z');
    const subscription = new Subscription({
      id: `sub-free-${Date.now()}`,
      tenantId: merchantId,
      status: 'active',
      currentPeriodEnd: lifetimeExpiry,
      externalCustomerId: 'free-lifetime-partner',
      externalSubscriptionId: 'sub_lifetime_permanent',
    });
    await this.subscriptionRepo.save(subscription);

    return {
      merchantId,
      merchantName: savedMerchant.name,
      merchantSlug: savedMerchant.slug,
      webhookSecret: savedMerchant.webhookSecret,
      ownerUserId: userId,
      ownerEmail: user.email,
      ownerFullName: user.fullName,
      subscriptionStatus: subscription.status,
      isLifetime: true,
      expiresAt: lifetimeExpiry,
    };
  }
}
