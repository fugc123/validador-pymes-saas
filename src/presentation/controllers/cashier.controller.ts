import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { VerifyTransferUseCase } from '../../core/application/use-cases/transfers/verify-transfer.use-case';
import { ClaimTransferUseCase } from '../../core/application/use-cases/transfers/claim-transfer.use-case';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';

export class VerifyTransferDto {
  @IsNumber()
  @IsNotEmpty()
  amount!: number;

  @IsOptional()
  @IsString()
  payerFilter?: string;
}

export class ClaimTransferDto {
  @IsString()
  @IsNotEmpty()
  transferId!: string;
}

@Controller('cashier/transfers')
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class CashierController {
  constructor(
    private readonly verifyUseCase: VerifyTransferUseCase,
    private readonly claimUseCase: ClaimTransferUseCase,
  ) {}

  @Post('verify')
  @Roles('CASHIER', 'MERCHANT_OWNER')
  @HttpCode(HttpStatus.OK)
  async verifyTransfer(@Body() dto: VerifyTransferDto) {
    const tenantId = TenantContext.getTenantId();
    return this.verifyUseCase.execute({
      tenantId,
      amount: dto.amount,
      payerFilter: dto.payerFilter,
    });
  }

  @Post('claim')
  @Roles('CASHIER', 'MERCHANT_OWNER')
  @HttpCode(HttpStatus.OK)
  async claimTransfer(@Body() dto: ClaimTransferDto) {
    const tenantId = TenantContext.getTenantId();
    const cashierUserId = TenantContext.getUserId();

    return this.claimUseCase.execute({
      tenantId,
      transferId: dto.transferId,
      cashierUserId,
    });
  }
}
