import { UnauthorizedException } from '@nestjs/common';
import { ITokenService, TokenPurpose } from '../../ports/auth.ports';

/**
 * Verifies the bearer credential authorizing a tenant-selection or
 * tenant-switch request. The token must be signed and unexpired
 * (verification throws otherwise), purpose-typed for exactly this
 * operation, and issued for the user the request claims.
 * Every failure is a 401 so callers can never proceed unauthenticated.
 */
export function verifyTokenForUser(
  tokenService: ITokenService,
  token: string | undefined,
  purpose: TokenPurpose,
  userId: string,
): void {
  if (!token) {
    throw new UnauthorizedException('Authentication token is required');
  }

  let payload: { purpose?: TokenPurpose; userId?: string } | undefined;
  try {
    payload = tokenService.verifyToken<{ purpose?: TokenPurpose; userId?: string }>(token);
  } catch {
    payload = undefined;
  }

  if (!payload || payload.purpose !== purpose) {
    throw new UnauthorizedException(
      'Authentication token is invalid, expired, or not valid for this operation',
    );
  }

  if (payload.userId !== userId) {
    throw new UnauthorizedException('Authentication token subject does not match the requested user');
  }
}
