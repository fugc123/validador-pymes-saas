import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Controllers
import { AuthController } from './presentation/controllers/auth.controller';
import { WebhookController } from './presentation/controllers/webhook.controller';
import { CashierController } from './presentation/controllers/cashier.controller';
import { OnboardingController } from './presentation/controllers/onboarding.controller';
import { MerchantController } from './presentation/controllers/merchant.controller';
import { SubscriptionController } from './presentation/controllers/subscription.controller';

// Use Cases
import { LoginUseCase } from './core/application/use-cases/auth/login.use-case';
import { SelectTenantUseCase } from './core/application/use-cases/auth/select-tenant.use-case';
import { SwitchTenantUseCase } from './core/application/use-cases/auth/switch-tenant.use-case';
import { IngestWebhookUseCase } from './core/application/use-cases/ingest-webhook.use-case';
import { VerifyTransferUseCase } from './core/application/use-cases/transfers/verify-transfer.use-case';
import { ClaimTransferUseCase } from './core/application/use-cases/transfers/claim-transfer.use-case';
import { GetMerchantMetricsUseCase } from './core/application/use-cases/transfers/get-merchant-metrics.use-case';
import { SubmitMerchantRequestUseCase } from './core/application/use-cases/onboarding/submit-merchant-request.use-case';
import { ApproveMerchantRequestUseCase } from './core/application/use-cases/onboarding/approve-merchant-request.use-case';
import { SubscriptionBillingUseCase } from './core/application/use-cases/billing/subscription-billing.use-case';

// Infrastructure
import { DatabaseModule } from './infrastructure/database/database.module';
import { BankParserFactory } from './infrastructure/parsers/bank-parser.factory';
import {
  InMemoryUserRepository,
  InMemoryMerchantRepository,
  InMemoryMembershipRepository,
  InMemoryPasswordHasher,
  InMemoryTokenService,
  InMemoryTransferRepository,
  InMemoryMerchantRequestRepository,
  InMemorySubscriptionRepository,
  InMemoryPaymentReportRepository,
} from './infrastructure/repositories/in-memory.repositories';

import { AuthMiddleware } from './presentation/middlewares/auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
  ],
  controllers: [
    AuthController,
    WebhookController,
    CashierController,
    OnboardingController,
    MerchantController,
    SubscriptionController,
  ],
  providers: [
    BankParserFactory,
    // Use Cases
    LoginUseCase,
    SelectTenantUseCase,
    SwitchTenantUseCase,
    IngestWebhookUseCase,
    VerifyTransferUseCase,
    ClaimTransferUseCase,
    GetMerchantMetricsUseCase,
    SubmitMerchantRequestUseCase,
    ApproveMerchantRequestUseCase,
    SubscriptionBillingUseCase,
    // Repository Ports Implementations
    { provide: 'IUserRepository', useClass: InMemoryUserRepository },
    { provide: 'IMerchantRepository', useClass: InMemoryMerchantRepository },
    { provide: 'IMembershipRepository', useClass: InMemoryMembershipRepository },
    { provide: 'IPasswordHasher', useClass: InMemoryPasswordHasher },
    { provide: 'ITokenService', useClass: InMemoryTokenService },
    { provide: 'ITransferRepository', useClass: InMemoryTransferRepository },
    { provide: 'IMerchantRequestRepository', useClass: InMemoryMerchantRequestRepository },
    { provide: 'ISubscriptionRepository', useClass: InMemorySubscriptionRepository },
    { provide: 'IPaymentReportRepository', useClass: InMemoryPaymentReportRepository },
    // Concrete classes bindings
    InMemoryUserRepository,
    InMemoryMerchantRepository,
    InMemoryMembershipRepository,
    InMemoryPasswordHasher,
    InMemoryTokenService,
    InMemoryTransferRepository,
    InMemoryMerchantRequestRepository,
    InMemorySubscriptionRepository,
    InMemoryPaymentReportRepository,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
