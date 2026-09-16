import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { LoginUseCase } from '../../core/application/use-cases/auth/login.use-case';
import { SelectTenantUseCase } from '../../core/application/use-cases/auth/select-tenant.use-case';
import { SwitchTenantUseCase } from '../../core/application/use-cases/auth/switch-tenant.use-case';

export class LoginDto {
  email!: string;
  password!: string;
}

export class SelectTenantDto {
  userId!: string;
  tenantId!: string;
}

export class SwitchTenantDto {
  userId!: string;
  targetTenantId!: string;
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
