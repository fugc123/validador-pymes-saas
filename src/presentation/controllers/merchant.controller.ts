import {
  BadRequestException,
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

/** Single source for the cashier password rule: DTO boundary and controller guard. */
const MIN_PASSWORD_LENGTH = 6;

export class CreateCashierDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(MIN_PASSWORD_LENGTH)
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
    // The ValidationPipe enforces the DTO shape; this guard also catches
    // whitespace-only input so a new account can never get a weak password.
    const password = (dto.password ?? '').trim();
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      );
    }
    const cleanEmail = dto.email.toLowerCase().trim();

    let user = await this.userRepo.findByEmail(cleanEmail);
    if (!user) {
      const passwordHash = await this.passwordHasher.hash(password);
      user = new User({
        email: cleanEmail,
        passwordHash,
        fullName: dto.fullName.trim(),
        isSuperAdmin: false,
      });
      user = await this.userRepo.save(user);
    }
    // Existing accounts keep their credentials: the owner only links a membership.

    const userId = user.id || `usr-${Date.now()}`;

    // Look up any membership for this tenant so re-adding never creates a
    // duplicate row nor downgrades an existing role.
    let membership = await this.membershipRepo.findByUserAndMerchant(userId, tenantId);
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
    } else if (!membership.isActive) {
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
