import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { GetMerchantMetricsUseCase } from '../../core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';
import {
  IMembershipRepository,
  IUserRepository,
  IPasswordHasher,
} from '../../core/application/ports/auth.ports';
import { User } from '../../core/domain/entities/user.entity';
import { MerchantMembership } from '../../core/domain/entities/merchant-membership.entity';

export class CreateCashierDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;
}

@Controller('merchant')
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class MerchantController {
  constructor(
    private readonly getMetricsUseCase: GetMerchantMetricsUseCase,
    @Inject('IMembershipRepository')
    private readonly membershipRepo: IMembershipRepository,
    @Inject('IUserRepository')
    private readonly userRepo: IUserRepository,
    @Inject('IPasswordHasher')
    private readonly passwordHasher: IPasswordHasher,
  ) {}

  @Get('metrics')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    const tenantId = TenantContext.getTenantId();
    return this.getMetricsUseCase.execute(tenantId);
  }

  @Get('cashiers')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getCashiers() {
    const tenantId = TenantContext.getTenantId();
    return this.membershipRepo.findMembersByMerchant(tenantId);
  }

  @Post('cashiers')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async addCashier(@Body() dto: CreateCashierDto) {
    const tenantId = TenantContext.getTenantId();
    const cleanEmail = dto.email.toLowerCase().trim();
    const passwordHash = await this.passwordHasher.hash(dto.password.trim());

    let user = await this.userRepo.findByEmail(cleanEmail);
    if (!user) {
      user = new User({
        email: cleanEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        isSuperAdmin: false,
      });
      user = await this.userRepo.save(user);
    } else {
      user.updatePassword(passwordHash);
      user = await this.userRepo.save(user);
    }

    const userId = user.id || `usr-${Date.now()}`;

    let membership = await this.membershipRepo.findByUserAndMerchant(userId, tenantId, 'CASHIER');
    if (!membership) {
      membership = new MerchantMembership({
        id: `mem-${Date.now()}`,
        userId,
        merchantId: tenantId,
        role: 'CASHIER',
        isActive: true,
      });
      (membership as any).userEmail = user.email;
      (membership as any).userFullName = user.fullName;
      membership = await this.membershipRepo.save(membership);
    } else {
      membership.activate();
      (membership as any).userEmail = user.email;
      (membership as any).userFullName = user.fullName;
      membership = await this.membershipRepo.save(membership);
    }

    return {
      id: membership.id,
      userId: user.id,
      merchantId: tenantId,
      role: membership.role,
      isActive: membership.isActive,
      createdAt: membership.createdAt,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        isSuperAdmin: user.isSuperAdmin,
      },
    };
  }

  @Delete('cashiers/:id')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async removeCashier(@Param('id') membershipId: string) {
    await this.membershipRepo.deleteMembership(membershipId);
    return { success: true };
  }
}
