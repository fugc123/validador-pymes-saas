import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { LoginUseCase } from '../../core/application/use-cases/auth/login.use-case';
import { SelectTenantUseCase } from '../../core/application/use-cases/auth/select-tenant.use-case';
import { SwitchTenantUseCase } from '../../core/application/use-cases/auth/switch-tenant.use-case';

export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}

export class SelectTenantDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

export class SwitchTenantDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  targetTenantId!: string;

  @IsOptional()
  @IsString()
  role?: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly selectTenantUseCase: SelectTenantUseCase,
    private readonly switchTenantUseCase: SwitchTenantUseCase,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.loginUseCase.execute(dto);
  }

  @Post('select-tenant')
  @HttpCode(HttpStatus.OK)
  async selectTenant(@Body() dto: SelectTenantDto) {
    return this.selectTenantUseCase.execute(dto);
  }

  @Post('switch-tenant')
  @HttpCode(HttpStatus.OK)
  async switchTenant(@Body() dto: SwitchTenantDto) {
    return this.switchTenantUseCase.execute(dto);
  }
}
