import {
  InvalidAmountException,
  TransferAlreadyClaimedException,
  TransferExpiredException,
} from '../exceptions';

export type TransferStatus = 'pending' | 'claimed' | 'expired';

export interface TransferProps {
  id?: string;
  tenantId: string;
  operationId: string;
  receiptNumber?: string;
  operationDate: string;
  payerName: string;
  payerAccount?: string;
  payerBank?: string;
  currency?: string;
  amount: number;
  creditAccount?: string;
  concept?: string;
  rawBody?: string;
  status?: TransferStatus;
  claimedAt?: Date | null;
  claimedByUserId?: string | null;
  createdAt?: Date;
}

export class Transfer {
  public readonly id?: string;
  public readonly tenantId: string;
  public readonly operationId: string;
  public readonly receiptNumber?: string;
  public readonly operationDate: string;
  public readonly payerName: string;
  public readonly payerAccount?: string;
  public readonly payerBank?: string;
  public readonly currency: string;
  public readonly amount: number;
  public readonly creditAccount?: string;
  public readonly concept?: string;
  public readonly rawBody?: string;
  private _status: TransferStatus;
  private _claimedAt?: Date | null;
  private _claimedByUserId?: string | null;
  public readonly createdAt: Date;

  constructor(props: TransferProps) {
    if (!props.tenantId) {
      throw new Error('Tenant ID is required for a transfer');
    }
    if (!props.operationId || props.operationId.trim().length === 0) {
      throw new Error('Operation ID is required');
    }
    if (typeof props.amount !== 'number' || !Number.isInteger(props.amount) || props.amount <= 0) {
      throw new InvalidAmountException(props.amount);
    }
    if (!props.payerName || props.payerName.trim().length === 0) {
      throw new Error('Payer name is required');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this.operationId = props.operationId.trim();
    this.receiptNumber = props.receiptNumber?.trim();
    this.operationDate = props.operationDate.trim();
    this.payerName = props.payerName.trim();
    this.payerAccount = props.payerAccount?.trim();
    this.payerBank = props.payerBank?.trim();
    this.currency = props.currency ?? 'PYG';
    this.amount = props.amount;
    this.creditAccount = props.creditAccount?.trim();
    this.concept = props.concept?.trim();
    this.rawBody = props.rawBody;
    this._status = props.status ?? 'pending';
    this._claimedAt = props.claimedAt ?? null;
    this._claimedByUserId = props.claimedByUserId ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  get status(): TransferStatus {
    return this._status;
  }

  get claimedAt(): Date | null | undefined {
    return this._claimedAt;
  }

  get claimedByUserId(): string | null | undefined {
    return this._claimedByUserId;
  }

  isClaimed(): boolean {
    return this._status === 'claimed';
  }

  isPending(): boolean {
    return this._status === 'pending';
  }

  isExpired(maxAgeMinutes = 45, referenceDate: Date = new Date()): boolean {
    if (this._status === 'expired') return true;
    if (this._status === 'claimed') return false;
    const diffMs = referenceDate.getTime() - this.createdAt.getTime();
    return diffMs > maxAgeMinutes * 60 * 1000;
  }

  claim(cashierUserId: string, claimTimestamp?: Date): void {
    if (this._status === 'claimed') {
      throw new TransferAlreadyClaimedException(
        this.id ?? this.operationId,
        this._claimedAt ?? undefined,
        this._claimedByUserId ?? undefined,
      );
    }
    if (this.isExpired()) {
      const ageMinutes = Math.round((new Date().getTime() - this.createdAt.getTime()) / (60 * 1000));
      throw new TransferExpiredException(this.id ?? this.operationId, ageMinutes);
    }

    this._status = 'claimed';
    this._claimedAt = claimTimestamp ?? new Date();
    this._claimedByUserId = cashierUserId;
  }

  markExpired(): void {
    if (this._status === 'claimed') {
      throw new Error('Cannot expire an already claimed transfer');
    }
    this._status = 'expired';
  }
}
