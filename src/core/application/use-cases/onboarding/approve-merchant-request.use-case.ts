import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { IMerchantRequestRepository, ISubscriptionRepository } from '../../ports/onboarding.ports';
import { IMerchantRepository, IUserRepository, IMembershipRepository } from '../../ports/auth.ports';
import { Merchant } from '../../../domain/entities/merchant.entity';
import { User } from '../../../domain/entities/user.entity';
import { MerchantMembership } from '../../../domain/entities/merchant-membership.entity';
import { Subscription } from '../../../domain/entities/subscription.entity';

export interface ApproveMerchantRequestInput {
  requestId: string;
}

export interface ApproveMerchantRequestOutput {
  merchantId: string;
  merchantSlug: string;
  webhookSecret: string;
  ownerUserId: string;
  ownerEmail: string;
  subscriptionStatus: string;
  trialExpiresAt: Date;
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
export class ApproveMerchantRequestUseCase {
  constructor(
    private readonly requestRepo: IMerchantRequestRepository,
    private readonly merchantRepo: IMerchantRepository,
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  async execute(input: ApproveMerchantRequestInput): Promise<ApproveMerchantRequestOutput> {
    const request = await this.requestRepo.findById(input.requestId);
    if (!request) {
      throw new NotFoundException(`Merchant application '${input.requestId}' not found`);
    }

    if (!request.isPending()) {
      throw new ConflictException(
        `Application '${input.requestId}' cannot be approved: already in status '${request.status}'`,
      );
    }

    // 1. Generate Merchant
    const baseSlug = slugify(request.businessName);
    const existingMerchant = await this.merchantRepo.findBySlug(baseSlug);
    const finalSlug = existingMerchant ? `${baseSlug}-${Date.now().toString().slice(-4)}` : baseSlug;
    const webhookSecret = crypto.randomBytes(32).toString('hex');

    const merchant = new Merchant({
      id: `merchant-${Date.now()}`,
      name: request.businessName,
      slug: finalSlug,
      webhookSecret,
      status: 'active',
    });
    const savedMerchant = await this.merchantRepo.save(merchant);

    // 2. Create or find User
    let user = await this.userRepo.findByEmail(request.email);
    if (!user) {
      user = new User({
        id: `user-${Date.now()}`,
        email: request.email,
        passwordHash: '$2a$10$temporaryRandomHashProvisioned12345',
        fullName: request.ownerName,
      });
      user = await this.userRepo.save(user);
    }

    // 3. Create MerchantMembership (MERCHANT_OWNER)
    const membership = new MerchantMembership({
      id: `mem-${Date.now()}`,
      userId: user.id!,
      merchantId: savedMerchant.id!,
      role: 'MERCHANT_OWNER',
      isActive: true,
    });
    await this.membershipRepo.save(membership);

    // 4. Activate 7-Day Free Trial Subscription
    const trialExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const subscription = new Subscription({
      id: `sub-${Date.now()}`,
      tenantId: savedMerchant.id!,
      status: 'trial',
      currentPeriodEnd: trialExpiresAt,
    });
    await this.subscriptionRepo.save(subscription);

    // 5. Mark Application Approved
    request.approve();
    await this.requestRepo.save(request);

    return {
      merchantId: savedMerchant.id!,
      merchantSlug: savedMerchant.slug,
      webhookSecret,
      ownerUserId: user.id!,
      ownerEmail: user.email,
      subscriptionStatus: 'trial',
      trialExpiresAt,
    };
  }
}
