import { DomainException, InvalidMembershipRoleException } from '../exceptions';

export type MembershipRole = 'MERCHANT_OWNER' | 'CASHIER';

export interface MerchantMembershipProps {
  id?: string;
  userId: string;
  merchantId: string;
  role: MembershipRole;
  isActive?: boolean;
  createdAt?: Date;
}

export class MerchantMembership {
  public readonly id?: string;
  public readonly userId: string;
  public readonly merchantId: string;
  public readonly role: MembershipRole;
  private _isActive: boolean;
  public readonly createdAt: Date;

  constructor(props: MerchantMembershipProps) {
    if (!props.userId) {
      throw new DomainException('userId is required for membership');
    }
    if (!props.merchantId) {
      throw new DomainException('merchantId is required for membership');
    }
    if (props.role !== 'MERCHANT_OWNER' && props.role !== 'CASHIER') {
      throw new InvalidMembershipRoleException(props.role);
    }

    this.id = props.id;
    this.userId = props.userId;
    this.merchantId = props.merchantId;
    this.role = props.role;
    this._isActive = props.isActive ?? true;
    this.createdAt = props.createdAt ?? new Date();
  }

  get isActive(): boolean {
    return this._isActive;
  }

  isOwner(): boolean {
    return this.role === 'MERCHANT_OWNER' && this._isActive;
  }

  isCashier(): boolean {
    return this.role === 'CASHIER' && this._isActive;
  }

  deactivate(): void {
    this._isActive = false;
  }

  activate(): void {
    this._isActive = true;
  }
}
