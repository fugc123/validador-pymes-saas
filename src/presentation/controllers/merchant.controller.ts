import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GetMerchantMetricsUseCase } from '../../core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';
import { TenantGuard } from '../guards/tenant.guard';
import { TenantContextInterceptor } from '../interceptors/tenant-context.interceptor';
import { TenantContext } from '../interceptors/tenant-context.service';

@Controller('merchant')
@UseGuards(RolesGuard, TenantGuard)
@UseInterceptors(TenantContextInterceptor)
export class MerchantController {
  constructor(
    private readonly getMetricsUseCase: GetMerchantMetricsUseCase,
  ) {}

  @Get('metrics')
  @Roles('MERCHANT_OWNER', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  async getMetrics() {
    const tenantId = TenantContext.getTenantId();
    return this.getMetricsUseCase.execute(tenantId);
  }
}
