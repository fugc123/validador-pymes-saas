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
  NotFoundException,
  Param,
} from '@nestjs/common';
import { IsNotEmpty, IsString } from 'class-validator';
import { SubscriptionBillingUseCase } from '../../core/application/use-cases/billing/subscription-billing.use-case';
import { ISubscriptionRepository, IPaymentReportRepository, PaymentReport } from '../../core/application/ports/onboarding.ports';
import { IMerchantRepository } from '../../core/application/ports/auth.ports';
import { ITransferRepository } from '../../core/application/ports/transfer.ports';
import { Transfer } from '../../core/domain/entities/transfer.entity';
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

export class ReportPaymentDto {
  @IsString()
  @IsNotEmpty()
  payerName!: string;
}

export class SimulateTransferDto {
  @IsString()
  @IsNotEmpty()
  payerName!: string;
}

@Controller('subscription')
export class SubscriptionController {
  constructor(
    private readonly subscriptionBillingUseCase: SubscriptionBillingUseCase,
    @Inject('ISubscriptionRepository')
    private readonly subscriptionRepository: ISubscriptionRepository,
    @Inject('IMerchantRepository')
    private readonly merchantRepository: IMerchantRepository,
    @Inject('IPaymentReportRepository')
    private readonly paymentReportRepo: IPaymentReportRepository,
    @Inject('ITransferRepository')
    private readonly transferRepo: ITransferRepository,
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

  @Post('report-payment')
  @Roles('MERCHANT_OWNER')
  @UseGuards(RolesGuard)
  async reportPayment(@Req() req: any, @Body() dto: ReportPaymentDto) {
    const tenantId = req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const report = new PaymentReport({
      tenantId,
      reportedByUserId: userId,
      payerName: dto.payerName.trim(),
      amount: 150000,
    });
    return this.paymentReportRepo.save(report);
  }

  @Get('payment-reports')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async listPaymentReports() {
    const reports = await this.paymentReportRepo.findAll();
    return Promise.all(
      reports.map(async (report) => {
        const merchant = await this.merchantRepository.findById(report.tenantId);
        return {
          ...report,
          merchantName: merchant?.name || report.tenantId,
        };
      })
    );
  }

  @Post('validate-payment-report/:id')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async validatePaymentReport(@Req() req: any, @Param('id') reportId: string) {
    const report = await this.paymentReportRepo.findById(reportId);
    if (!report) {
      throw new NotFoundException('Payment report not found');
    }
    
    if (report.status === 'matched') {
      return { matched: true, message: 'Este pago ya fue validado y acreditado previamente.', report };
    }

    const pendingTransfers = await this.transferRepo.findPendingByAmountAndPayer('cajasegura-platform', report.amount);
    const repPayer = report.payerName.toLowerCase().trim();
    
    const matchedTr = pendingTransfers.find((trPayerObj) => {
      const trPayer = trPayerObj.payerName.toLowerCase().trim();
      return trPayer.includes(repPayer) || repPayer.includes(trPayer);
    });

    if (matchedTr) {
      const transferIdToUpdate = matchedTr.id || matchedTr.operationId;
      const adminId = req.user?.id || 'admin';
      
      await this.transferRepo.updateClaimed('cajasegura-platform', transferIdToUpdate, adminId, new Date());
      
      report.status = 'matched';
      report.matchedTransferId = transferIdToUpdate;
      await this.paymentReportRepo.save(report);
      
      await this.subscriptionBillingUseCase.confirmPayment({ tenantId: report.tenantId, daysDuration: 30 });
      
      return {
        matched: true,
        message: `Transferencia SIPAP de Gs. 150.000 confirmada de "${matchedTr.payerName}". Se acreditó automáticamente 1 mes más (+30 días).`,
        report,
        transfer: matchedTr,
      };
    } else {
      return {
        matched: false,
        message: `Aún no se detectó una transferencia pendiente de Gs. 150.000 a nombre de "${report.payerName}" en tu cuenta de Franco Girala (Alias: 5644334).`,
      };
    }
  }

  @Post('simulate-incoming-transfer')
  @Roles('SUPER_ADMIN')
  @UseGuards(RolesGuard)
  async simulateIncomingTransfer(@Body() dto: SimulateTransferDto) {
    const transfer = new Transfer({
      id: `tr-sipap-${Date.now()}`,
      tenantId: 'cajasegura-platform',
      operationId: `SIPAP-${Math.floor(100000 + Math.random() * 900000)}`,
      operationDate: `Hoy ${new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' })}`,
      payerName: dto.payerName.toUpperCase().trim(),
      payerBank: 'Banco Itaú',
      amount: 150000,
      status: 'pending',
    });
    await this.transferRepo.save(transfer);
    return { success: true, transfer };
  }
}
