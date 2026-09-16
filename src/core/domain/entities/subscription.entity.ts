import { InvalidSubscriptionStateException } from '../exceptions';

export type SubscriptionStatus = 'trial' | 'active' | 'past_due' | 'cancelled';

export interface SubscriptionProps {
  id?: string;
  tenantId: string;
  status?: SubscriptionStatus;
  currentPeriodEnd: Date;
  externalCustomerId?: string | null;
  externalSubscriptionId?: string | null;
  createdAt?: Date;
}

export class Subscription {
  public readonly id?: string;
  public readonly tenantId: string;
  private _status: SubscriptionStatus;
  public currentPeriodEnd: Date;
  public externalCustomerId?: string | null;
  public externalSubscriptionId?: string | null;
  public readonly createdAt: Date;

  constructor(props: SubscriptionProps) {
    if (!props.tenantId) {
      throw new InvalidSubscriptionStateException('tenantId is required for subscription');
    }
    if (!props.currentPeriodEnd) {
      throw new InvalidSubscriptionStateException('currentPeriodEnd date is required');
    }

    this.id = props.id;
    this.tenantId = props.tenantId;
    this._status = props.status ?? 'trial';
    this.currentPeriodEnd = props.currentPeriodEnd;
    this.externalCustomerId = props.externalCustomerId ?? null;
    this.externalSubscriptionId = props.externalSubscriptionId ?? null;
    this.createdAt = props.createdAt ?? new Date();
  }

  get status(): SubscriptionStatus {
    return this._status;
  }

  isActive(now: Date = new Date()): boolean {
    if (this._status === 'cancelled') return false;
    if (this._status === 'past_due') return false;
    return this.currentPeriodEnd.getTime() > now.getTime();
  }

  isTrial(): boolean {
    return this._status === 'trial';
  }

  activate(newPeriodEnd: Date, externalSubId?: string): void {
    this._status = 'active';
    this.currentPeriodEnd = newPeriodEnd;
    if (externalSubId) {
      this.externalSubscriptionId = externalSubId;
    }
  }

  markPastDue(): void {
    this._status = 'past_due';
  }

  cancel(): void {
    this._status = 'cancelled';
  }
}
