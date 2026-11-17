import { RejectMerchantRequestUseCase } from "./core/application/use-cases/onboarding/reject-merchant-request.use-case";
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

// Controllers
import { AuthController } from './presentation/controllers/auth.controller';
import { WebhookController } from './presentation/controllers/webhook.controller';
import { CashierController } from './presentation/controllers/cashier.controller';
import { OnboardingController } from './presentation/controllers/onboarding.controller';
import { MerchantController } from './presentation/controllers/merchant.controller';
import { SubscriptionController } from './presentation/controllers/subscription.controller';
import { CatalogController, PublicCatalogController } from './presentation/controllers/catalog.controller';
import { LoyaltyController, PublicLoyaltyController } from './presentation/controllers/loyalty.controller';
import { SifenController } from './presentation/controllers/sifen.controller';

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
import { CreateFreeMerchantUseCase } from './core/application/use-cases/onboarding/create-free-merchant.use-case';
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
import { CatalogRepository } from './infrastructure/repositories/catalog.repository';
import { LoyaltyRepository } from './infrastructure/repositories/loyalty.repository';
import { SifenRepository } from './infrastructure/repositories/sifen.repository';
import { FactufyAdapter } from './infrastructure/sifen/factufy.adapter';

import { AuthMiddleware } from './presentation/middlewares/auth.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 180,
      },
    ]),
    DatabaseModule,
  ],
  controllers: [
    AuthController,
    WebhookController,
    CashierController,
    OnboardingController,
    MerchantController,
    SubscriptionController,
    CatalogController,
    PublicCatalogController,
    LoyaltyController,
    PublicLoyaltyController,
    SifenController,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
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
    RejectMerchantRequestUseCase,
    CreateFreeMerchantUseCase,
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
    { provide: 'ICatalogRepository', useClass: CatalogRepository },
    { provide: 'ILoyaltyRepository', useClass: LoyaltyRepository },
    { provide: 'ISifenRepository', useClass: SifenRepository },
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
    CatalogRepository,
    LoyaltyRepository,
    SifenRepository,
    FactufyAdapter,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
