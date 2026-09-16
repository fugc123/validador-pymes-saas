import { ForbiddenException, NotFoundException, Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  IMerchantRepository,
  IMembershipRepository,
  ITokenService,
} from '../../ports/auth.ports';

export interface SwitchTenantInput {
  userId: string;
  targetTenantId: string;
}

export interface SwitchTenantOutput {
  accessToken: string;
  activeTenant: {
    tenantId: string;
    merchantName: string;
    role: string;
  };
}

@Injectable()
export class SwitchTenantUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    @Inject('IMembershipRepository') private readonly membershipRepo: IMembershipRepository,
    @Inject('ITokenService') private readonly tokenService: ITokenService,
  ) {}

  async execute(input: SwitchTenantInput): Promise<SwitchTenantOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const merchant = await this.merchantRepo.findById(input.targetTenantId);
    if (!merchant || !merchant.isActive()) {
      throw new ForbiddenException('Target organization is inactive or not found');
    }

    const membership = await this.membershipRepo.findByUserAndMerchant(input.userId, input.targetTenantId);
    if (!membership || !membership.isActive) {
      throw new ForbiddenException('No active membership in this organization');
    }

    const accessToken = this.tokenService.signScopedToken({
      userId: user.id!,
      email: user.email,
      tenantId: merchant.id!,
      role: membership.role,
      isSuperAdmin: user.isSuperAdmin,
    });

    return {
      accessToken,
      activeTenant: {
        tenantId: merchant.id!,
        merchantName: merchant.name,
        role: membership.role,
      },
    };
  }
}
