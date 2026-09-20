import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { SubmitMerchantRequestUseCase } from '../../core/application/use-cases/onboarding/submit-merchant-request.use-case';
import { ApproveMerchantRequestUseCase } from '../../core/application/use-cases/onboarding/approve-merchant-request.use-case';
import { CreateFreeMerchantUseCase } from '../../core/application/use-cases/onboarding/create-free-merchant.use-case';
import { IMerchantRequestRepository } from '../../core/application/ports/onboarding.ports';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

export class SubmitMerchantRequestDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsNotEmpty()
  phone!: string;

  @IsString()
  @IsNotEmpty()
  city!: string;
}

export class CreateFreeMerchantDto {
  @IsString()
  @IsNotEmpty()
  businessName!: string;

  @IsString()
  @IsNotEmpty()
  ownerName!: string;

  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  city?: string;
}

@Controller('onboarding')
export class OnboardingController {
  constructor(
    private readonly submitUseCase: SubmitMerchantRequestUseCase,
    private readonly approveUseCase: ApproveMerchantRequestUseCase,
    private readonly createFreeMerchantUseCase: CreateFreeMerchantUseCase,
    @Inject('IMerchantRequestRepository')
    private readonly requestRepo: IMerchantRequestRepository,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  async submitRequest(@Body() dto: SubmitMerchantRequestDto) {
    return this.submitUseCase.execute(dto);
  }

  @Post('superadmin/create-free-merchant')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.CREATED)
  async createFreeMerchant(@Body() dto: CreateFreeMerchantDto) {
    return this.createFreeMerchantUseCase.execute(dto);
  }

  @Post('superadmin/merchant-requests/:id/approve')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  @HttpCode(HttpStatus.OK)
  async approveRequest(@Param('id') requestId: string) {
    return this.approveUseCase.execute({ requestId });
  }

  @Get('superadmin/merchant-requests')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async listRequests() {
    return this.requestRepo.findAll();
  }
}
