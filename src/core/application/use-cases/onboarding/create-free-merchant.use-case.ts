import {
  BadRequestException,
  ConflictException,
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

/** Mirrors the DTO boundary rule so no caller can provision a weaker password. */
const MIN_PASSWORD_LENGTH = 6;

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
    const rawPassword = input.password?.trim() ?? '';
    if (rawPassword.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }

    // Signup must never alter or link an already-registered account.
    const normalizedEmail = input.email.toLowerCase().trim();
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    if (existingUser) {
      throw new ConflictException('This email is already registered');
    }

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

    // 2. Create Owner User (a fresh account: existing emails were rejected above)
    const user = await this.userRepo.save(
      new User({
        email: normalizedEmail,
        passwordHash,
        fullName: input.ownerName,
        isSuperAdmin: false,
      }),
    );
    const userId = user.id || `usr-${Date.now()}`;

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
