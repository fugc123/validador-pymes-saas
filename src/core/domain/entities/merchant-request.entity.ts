import { InvalidMerchantRequestStateException } from '../exceptions';

export type MerchantRequestStatus = 'requested' | 'approved' | 'rejected';

export interface MerchantRequestProps {
  id?: string;
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
  status?: MerchantRequestStatus;
  createdAt?: Date;
}

export class MerchantRequest {
  public readonly id?: string;
  public readonly businessName: string;
  public readonly ownerName: string;
  public readonly email: string;
  public readonly phone: string;
  public readonly city: string;
  private _status: MerchantRequestStatus;
  public readonly createdAt: Date;

  constructor(props: MerchantRequestProps) {
    if (!props.businessName || props.businessName.trim().length === 0) {
      throw new InvalidMerchantRequestStateException('businessName is required');
    }
    if (!props.ownerName || props.ownerName.trim().length === 0) {
      throw new InvalidMerchantRequestStateException('ownerName is required');
    }
    if (!props.email || !props.email.includes('@')) {
      throw new InvalidMerchantRequestStateException(`Invalid email: ${props.email}`);
    }
    if (!props.phone || props.phone.trim().length === 0) {
      throw new InvalidMerchantRequestStateException('phone is required');
    }
    if (!props.city || props.city.trim().length === 0) {
      throw new InvalidMerchantRequestStateException('city is required');
    }

    this.id = props.id;
    this.businessName = props.businessName.trim();
    this.ownerName = props.ownerName.trim();
    this.email = props.email.toLowerCase().trim();
    this.phone = props.phone.trim();
    this.city = props.city.trim();
    this._status = props.status ?? 'requested';
    this.createdAt = props.createdAt ?? new Date();
  }

  get status(): MerchantRequestStatus {
    return this._status;
  }

  isPending(): boolean {
    return this._status === 'requested';
  }

  approve(): void {
    if (this._status !== 'requested') {
      throw new InvalidMerchantRequestStateException(
        `Cannot approve request in status '${this._status}'. Must be 'requested'`,
      );
    }
    this._status = 'approved';
  }

  reject(): void {
    if (this._status !== 'requested') {
      throw new InvalidMerchantRequestStateException(
        `Cannot reject request in status '${this._status}'. Must be 'requested'`,
      );
    }
    this._status = 'rejected';
  }
}
