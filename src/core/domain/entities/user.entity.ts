import { DomainException } from '../exceptions';

export interface UserProps {
  id?: string;
  email: string;
  passwordHash: string;
  fullName: string;
  isSuperAdmin?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  public readonly id?: string;
  public readonly email: string;
  public passwordHash: string;
  public fullName: string;
  private _isSuperAdmin: boolean;
  public readonly createdAt: Date;
  public updatedAt: Date;

  constructor(props: UserProps) {
    if (!props.email || !props.email.includes('@')) {
      throw new DomainException(`Invalid user email: ${props.email}`);
    }
    if (!props.passwordHash || props.passwordHash.length < 10) {
      throw new DomainException('Password hash is required and must be valid');
    }
    if (!props.fullName || props.fullName.trim().length === 0) {
      throw new DomainException('Full name is required');
    }

    this.id = props.id;
    this.email = props.email.toLowerCase().trim();
    this.passwordHash = props.passwordHash;
    this.fullName = props.fullName.trim();
    this._isSuperAdmin = props.isSuperAdmin ?? false;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  get isSuperAdmin(): boolean {
    return this._isSuperAdmin;
  }

  promoteToSuperAdmin(): void {
    this._isSuperAdmin = true;
    this.updatedAt = new Date();
  }

  revokeSuperAdmin(): void {
    this._isSuperAdmin = false;
    this.updatedAt = new Date();
  }

  updatePassword(newHash: string): void {
    if (!newHash || newHash.length < 10) {
      throw new DomainException('New password hash must be valid');
    }
    this.passwordHash = newHash;
    this.updatedAt = new Date();
  }
}
