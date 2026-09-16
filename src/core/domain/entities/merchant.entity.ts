import { DomainException } from '../exceptions';

export type MerchantStatus = 'active' | 'suspended' | 'pending';

export interface MerchantProps {
  id?: string;
  name: string;
  slug: string;
  webhookSecret: string;
  status?: MerchantStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Merchant {
  public readonly id?: string;
  public name: string;
  public readonly slug: string;
  public webhookSecret: string;
  private _status: MerchantStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: MerchantProps) {
    if (!props.name || props.name.trim().length === 0) {
      throw new DomainException('Merchant name cannot be empty');
    }
    if (!props.slug || !/^[a-z0-9-]+$/.test(props.slug)) {
      throw new DomainException(`Invalid merchant slug: ${props.slug}. Must be lowercase alphanumeric with hyphens`);
    }
    if (!props.webhookSecret || props.webhookSecret.length < 16) {
      throw new DomainException('Webhook secret must be at least 16 characters long');
    }

    this.id = props.id;
    this.name = props.name.trim();
    this.slug = props.slug.toLowerCase().trim();
    this.webhookSecret = props.webhookSecret;
    this._status = props.status ?? 'active';
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  get status(): MerchantStatus {
    return this._status;
  }

  isActive(): boolean {
    return this._status === 'active';
  }

  suspend(): void {
    if (this._status === 'suspended') {
      throw new DomainException('Merchant is already suspended');
    }
    this._status = 'suspended';
    this.updatedAt = new Date();
  }

  activate(): void {
    if (this._status === 'active') {
      throw new DomainException('Merchant is already active');
    }
    this._status = 'active';
    this.updatedAt = new Date();
  }

  rotateWebhookSecret(newSecret: string): void {
    if (!newSecret || newSecret.length < 16) {
      throw new DomainException('New webhook secret must be at least 16 characters long');
    }
    this.webhookSecret = newSecret;
    this.updatedAt = new Date();
  }
}
