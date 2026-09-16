import { Injectable, NotFoundException } from '@nestjs/common';
import { ISubscriptionRepository } from '../../ports/onboarding.ports';

export interface ConfirmPaymentInput {
  tenantId: string;
  externalSubscriptionId?: string;
  daysDuration?: number;
}

export interface SubscriptionStatusOutput {
  tenantId: string;
  status: 'trial' | 'active' | 'past_due' | 'cancelled';
  isActive: boolean;
  currentPeriodEnd: Date;
  isTrial: boolean;
}

@Injectable()
export class SubscriptionBillingUseCase {
  constructor(private readonly subscriptionRepo: ISubscriptionRepository) {}

  async getStatus(tenantId: string): Promise<SubscriptionStatusOutput> {
    const sub = await this.subscriptionRepo.findByTenantId(tenantId);
    if (!sub) {
      throw new NotFoundException(`No subscription found for tenant '${tenantId}'`);
    }

    return {
      tenantId: sub.tenantId,
      status: sub.status,
      isActive: sub.isActive(),
      currentPeriodEnd: sub.currentPeriodEnd,
      isTrial: sub.isTrial(),
    };
  }

  async confirmPayment(input: ConfirmPaymentInput): Promise<SubscriptionStatusOutput> {
    const sub = await this.subscriptionRepo.findByTenantId(input.tenantId);
    if (!sub) {
      throw new NotFoundException(`No subscription found for tenant '${input.tenantId}'`);
    }

    const durationDays = input.daysDuration ?? 30;
    const newPeriodEnd = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000);

    sub.activate(newPeriodEnd, input.externalSubscriptionId);
    const saved = await this.subscriptionRepo.save(sub);

    return {
      tenantId: saved.tenantId,
      status: saved.status,
      isActive: saved.isActive(),
      currentPeriodEnd: saved.currentPeriodEnd,
      isTrial: saved.isTrial(),
    };
  }

  async markPastDue(tenantId: string): Promise<SubscriptionStatusOutput> {
    const sub = await this.subscriptionRepo.findByTenantId(tenantId);
    if (!sub) {
      throw new NotFoundException(`No subscription found for tenant '${tenantId}'`);
    }

    sub.markPastDue();
    const saved = await this.subscriptionRepo.save(sub);

    return {
      tenantId: saved.tenantId,
      status: saved.status,
      isActive: saved.isActive(),
      currentPeriodEnd: saved.currentPeriodEnd,
      isTrial: saved.isTrial(),
    };
  }
}
