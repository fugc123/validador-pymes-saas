import { ForbiddenException, NotFoundException, Injectable, Inject } from '@nestjs/common';
import {
  IUserRepository,
  IMerchantRepository,
  IMembershipRepository,
  ITokenService,
} from '../../ports/auth.ports';

export interface SelectTenantInput {
  userId: string;
  tenantId: string;
}

export interface SelectTenantOutput {
  accessToken: string;
  activeTenant: {
    tenantId: string;
    merchantName: string;
    role: string;
  };
}

@Injectable()
export class SelectTenantUseCase {
  constructor(
    @Inject('IUserRepository') private readonly userRepo: IUserRepository,
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    @Inject('IMembershipRepository') private readonly membershipRepo: IMembershipRepository,
    @Inject('ITokenService') private readonly tokenService: ITokenService,
  ) {}

  async execute(input: SelectTenantInput): Promise<SelectTenantOutput> {
    const user = await this.userRepo.findById(input.userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const merchant = await this.merchantRepo.findById(input.tenantId);
    if (!merchant || !merchant.isActive()) {
      throw new ForbiddenException('Target merchant organization is not active or does not exist');
    }

    const membership = await this.membershipRepo.findByUserAndMerchant(input.userId, input.tenantId);
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
