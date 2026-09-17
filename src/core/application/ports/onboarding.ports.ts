import { MerchantRequest } from '../../domain/entities/merchant-request.entity';
import { Subscription } from '../../domain/entities/subscription.entity';

export interface IMerchantRequestRepository {
  save(request: MerchantRequest): Promise<MerchantRequest>;
  findById(id: string): Promise<MerchantRequest | null>;
  findPending(): Promise<MerchantRequest[]>;
  findAll(): Promise<MerchantRequest[]>;
}

export interface ISubscriptionRepository {
  save(subscription: Subscription): Promise<Subscription>;
  findByTenantId(tenantId: string): Promise<Subscription | null>;
  findAll(): Promise<Subscription[]>;
}
