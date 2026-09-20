import { Injectable, Inject } from '@nestjs/common';
import * as crypto from 'crypto';
import { IMerchantRequestRepository, ISubscriptionRepository } from '../../ports/onboarding.ports';
import {
  IMerchantRepository,
  IUserRepository,
  IMembershipRepository,
  IPasswordHasher,
} from '../../ports/auth.ports';
import { MerchantRequest } from '../../../domain/entities/merchant-request.entity';
import { Merchant } from '../../../domain/entities/merchant.entity';
import { User } from '../../../domain/entities/user.entity';
import { MerchantMembership } from '../../../domain/entities/merchant-membership.entity';
import { Subscription } from '../../../domain/entities/subscription.entity';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export interface SubmitMerchantRequestInput {
  businessName: string;
  ownerName: string;
  email: string;
  password?: string;
  phone: string;
  city: string;
}

export interface SubmitMerchantRequestOutput {
  requestId: string;
  status: string;
  businessName: string;
  merchantId: string;
  merchantSlug: string;
  ownerUserId: string;
  ownerEmail: string;
  subscriptionStatus: string;
  trialExpiresAt: Date;
  message: string;
}

@Injectable()
export class SubmitMerchantRequestUseCase {
  constructor(
    @Inject('IMerchantRequestRepository') private readonly requestRepo: IMerchantRequestRepository,
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IMembershipRepository') private readonly membershipRepo: IMembershipRepository,
    @Inject('ISubscriptionRepository') private readonly subscriptionRepo: ISubscriptionRepository,
    @Inject('IPasswordHasher') private readonly passwordHasher: IPasswordHasher,
  ) {}

  async execute(input: SubmitMerchantRequestInput): Promise<SubmitMerchantRequestOutput> {
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
    const normalizedEmail = input.email.toLowerCase().trim();
    let user = await this.userRepo.findByEmail(normalizedEmail);
    let userId: string;

    if (!user) {
      userId = `usr-${Date.now()}`;
      user = new User({
        id: userId,
        email: normalizedEmail,
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

    // 4. Activate 7-Day Free Trial Subscription
    const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const subscription = new Subscription({
      id: `sub-${Date.now()}`,
      tenantId: merchantId,
      status: 'trial',
      currentPeriodEnd: trialExpiresAt,
      externalCustomerId: 'self-service-trial',
      externalSubscriptionId: `sub_trial_${merchantId}`,
    });
    await this.subscriptionRepo.save(subscription);

    // 5. Record MerchantRequest as approved for audit & metrics
    const request = new MerchantRequest({
      id: `req-${Date.now()}`,
      businessName: input.businessName,
      ownerName: input.ownerName,
      email: normalizedEmail,
      phone: input.phone,
      city: input.city,
      status: 'approved',
    });
    const savedRequest = await this.requestRepo.save(request);

    return {
      requestId: savedRequest.id!,
      status: 'approved',
      businessName: savedRequest.businessName,
      merchantId,
      merchantSlug: savedMerchant.slug,
      ownerUserId: userId,
      ownerEmail: user.email,
      subscriptionStatus: 'trial',
      trialExpiresAt,
      message: 'Comercio registrado y prueba gratuita de 7 días activada exitosamente.',
    };
  }
}
