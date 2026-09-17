import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { SubscriptionBillingUseCase } from '../../core/application/use-cases/billing/subscription-billing.use-case';
import { ISubscriptionRepository } from '../../core/application/ports/onboarding.ports';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

export class ConfirmPaymentDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

export class MarkPastDueDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionBillingUseCase: SubscriptionBillingUseCase,
    @Inject('ISubscriptionRepository')
    private readonly subscriptionRepository: ISubscriptionRepository,
    @Inject('IMerchantRepository')
    private readonly merchantRepository: IMerchantRepository,
  ) {}

  @Get('status')
  @Roles('CASHIER', 'MERCHANT_OWNER', 'SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async getStatus(@Req() req: any) {
    const tenantId = req.user.tenantId;
    const status = await this.subscriptionBillingUseCase.getStatus(tenantId);
    
    const now = new Date();
    const daysRemaining = Math.max(0, Math.ceil((status.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      ...status,
      daysRemaining,
    };
  }

  @Post('confirm-payment')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async confirmPayment(@Body() dto: ConfirmPaymentDto) {
    return this.subscriptionBillingUseCase.confirmPayment({ tenantId: dto.tenantId, daysDuration: 30 });
  }

  @Post('mark-past-due')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async markPastDue(@Body() dto: MarkPastDueDto) {
    return this.subscriptionBillingUseCase.markPastDue(dto.tenantId);
  }

  @Get('all')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async listAll() {
    const subscriptions = await this.subscriptionRepository.findAll();
    
    const now = new Date();
    const result = await Promise.all(
      subscriptions.map(async (sub) => {
        const merchant = await this.merchantRepository.findById(sub.tenantId);
        const daysRemaining = Math.max(0, Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        
        return {
          tenantId: sub.tenantId,
          merchantName: merchant?.name || 'Unknown',
          status: sub.status,
          isActive: sub.isActive(),
          isTrial: sub.isTrial(),
          currentPeriodEnd: sub.currentPeriodEnd,
          daysRemaining,
        };
      })
    );
    
    return result;
  }
}
