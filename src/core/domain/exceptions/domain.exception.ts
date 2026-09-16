export class DomainException extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class TransferAlreadyClaimedException extends DomainException {
  constructor(
    public readonly transferId: string,
    public readonly claimedAt?: Date,
    public readonly claimedByUserId?: string,
  ) {
    super(
      `Transfer ${transferId} has already been claimed at ${claimedAt ? claimedAt.toISOString() : 'unknown time'}` +
        (claimedByUserId ? ` by cashier ${claimedByUserId}` : ''),
    );
  }
}

export class TransferExpiredException extends DomainException {
  constructor(public readonly transferId: string, public readonly ageMinutes: number) {
    super(`Transfer ${transferId} is expired (${ageMinutes} minutes old) and cannot be claimed`);
  }
}

export class InvalidAmountException extends DomainException {
  constructor(public readonly amount: number) {
    super(`Transfer amount must be a positive integer in Guaranies (received: ${amount})`);
  }
}

export class InvalidMembershipRoleException extends DomainException {
  constructor(public readonly role: string) {
    super(`Invalid membership role: ${role}. Valid roles are MERCHANT_OWNER or CASHIER`);
  }
}

export class InvalidSubscriptionStateException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}

export class InvalidMerchantRequestStateException extends DomainException {
  constructor(message: string) {
    super(message);
  }
}
