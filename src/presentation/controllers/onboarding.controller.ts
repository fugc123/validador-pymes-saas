import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SubmitMerchantRequestUseCase } from '../../core/application/use-cases/onboarding/submit-merchant-request.use-case';
import { ApproveMerchantRequestUseCase } from '../../core/application/use-cases/onboarding/approve-merchant-request.use-case';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

export class SubmitMerchantRequestDto {
  businessName!: string;
  ownerName!: string;
  email!: string;
  phone!: string;
  city!: string;
}

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly submitUseCase: SubmitMerchantRequestUseCase,
    private readonly approveUseCase: ApproveMerchantRequestUseCase,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  async submitRequest(@Body() dto: SubmitMerchantRequestDto) {
    return this.submitUseCase.execute(dto);
  }

  @Post('superadmin/merchant-requests/:id/approve')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async approveRequest(@Param('id') requestId: string) {
    return this.approveUseCase.execute({ requestId });
  }
}
