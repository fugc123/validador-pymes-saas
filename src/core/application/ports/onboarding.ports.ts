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

export interface PaymentReportProps {
  id?: string;
  tenantId: string;
  reportedByUserId: string;
  payerName: string;
  amount?: number;
  status?: 'pending' | 'matched' | 'rejected';
  matchedTransferId?: string | null;
  createdAt?: Date;
}

export class PaymentReport {
  public readonly id: string;
  public readonly tenantId: string;
  public readonly reportedByUserId: string;
  public readonly payerName: string;
  public readonly amount: number;
  public status: 'pending' | 'matched' | 'rejected';
  public matchedTransferId?: string | null;
  public readonly createdAt: Date;

  constructor(props: PaymentReportProps) {
    this.id = props.id || `rep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    this.tenantId = props.tenantId;
    this.reportedByUserId = props.reportedByUserId;
    this.payerName = props.payerName;
    this.amount = props.amount ?? 150000;
    this.status = props.status ?? 'pending';
    this.matchedTransferId = props.matchedTransferId ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }
}

export interface IPaymentReportRepository {
  save(report: PaymentReport): Promise<PaymentReport>;
  findAll(): Promise<PaymentReport[]>;
  findById(id: string): Promise<PaymentReport | null>;
  findByTenantId(tenantId: string): Promise<PaymentReport[]>;
}
