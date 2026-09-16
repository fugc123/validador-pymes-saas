import { UnauthorizedException, ForbiddenException, Injectable } from '@nestjs/common';
import {
  IUserRepository,
  IMembershipRepository,
  IPasswordHasher,
  ITokenService,
} from '../../ports/auth.ports';

export interface LoginInput {
  email: string;
  password: string;
}

export interface LoginResultSingleTenant {
  requiresTenantSelection: false;
  accessToken: string;
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean };
  activeTenant: { tenantId: string; merchantName: string; role: string };
}

export interface LoginResultMultiTenant {
  requiresTenantSelection: true;
  tempToken: string;
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean };
  memberships: Array<{ tenantId: string; merchantName: string; role: string }>;
}

export interface LoginResultSuperAdmin {
  requiresTenantSelection: false;
  accessToken: string;
  user: { id: string; email: string; fullName: string; isSuperAdmin: boolean };
  activeTenant?: { role: 'SUPER_ADMIN' };
}

export type LoginOutput =
  | LoginResultSingleTenant
  | LoginResultMultiTenant
  | LoginResultSuperAdmin;

@Injectable()
export class LoginUseCase {
  constructor(
    private readonly userRepo: IUserRepository,
    private readonly membershipRepo: IMembershipRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly tokenService: ITokenService,
  ) {}

  async execute(input: LoginInput): Promise<LoginOutput> {
    const normalizedEmail = input.email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await this.passwordHasher.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const userId = user.id!;
    const memberships = await this.membershipRepo.findActiveByUser(userId);

    // SuperAdmin without store memberships fast-path
    if (user.isSuperAdmin && memberships.length === 0) {
      const accessToken = this.tokenService.signScopedToken({
        userId,
        email: user.email,
        role: 'SUPER_ADMIN',
        isSuperAdmin: true,
      });

      return {
        requiresTenantSelection: false,
        accessToken,
        user: { id: userId, email: user.email, fullName: user.fullName, isSuperAdmin: true },
        activeTenant: { role: 'SUPER_ADMIN' },
      };
    }

    if (memberships.length === 0) {
      throw new ForbiddenException('User has no active store memberships');
    }

    // Single Store Fast-Path (Scenario 1)
    if (memberships.length === 1) {
      const primary = memberships[0];
      const tenantId = primary.merchant.id!;
      const role = primary.membership.role;

      const accessToken = this.tokenService.signScopedToken({
        userId,
        email: user.email,
        tenantId,
        role,
        isSuperAdmin: user.isSuperAdmin,
      });

      return {
        requiresTenantSelection: false,
        accessToken,
        user: { id: userId, email: user.email, fullName: user.fullName, isSuperAdmin: user.isSuperAdmin },
        activeTenant: {
          tenantId,
          merchantName: primary.merchant.name,
          role,
        },
      };
    }

    // Multi-Store Selection (Scenario 2)
    const tempToken = this.tokenService.signTempToken({
      userId,
      email: user.email,
      isSuperAdmin: user.isSuperAdmin,
    });

    return {
      requiresTenantSelection: true,
      tempToken,
      user: { id: userId, email: user.email, fullName: user.fullName, isSuperAdmin: user.isSuperAdmin },
      memberships: memberships.map((m) => ({
        tenantId: m.merchant.id!,
        merchantName: m.merchant.name,
        role: m.membership.role,
      })),
    };
  }
}
