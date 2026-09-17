import { Transfer } from '../../domain/entities/transfer.entity';

export interface MerchantMetrics {
  totalCollectedToday: number;
  countValidatedToday: number;
  pendingUnclaimedCount: number;
  activeCashiersCount: number;
  recentTransfers: Array<{
    id: string;
    operationId: string;
    amount: number;
    payerName: string;
    payerBank?: string;
    status: string;
    claimedAt: string | null;
    operationDate: string;
  }>;
}

export interface ITransferRepository {
  save(transfer: Transfer): Promise<Transfer>;
  findByTenantAndOperationId(tenantId: string, operationId: string): Promise<Transfer | null>;
  findPendingByAmountAndPayer(tenantId: string, amount: number, payerFilter?: string): Promise<Transfer[]>;
  findById(tenantId: string, id: string): Promise<Transfer | null>;
  updateClaimed(tenantId: string, transferId: string, cashierUserId: string, claimTime: Date): Promise<boolean>;
  getMetricsByTenant(tenantId: string): Promise<MerchantMetrics>;
}

