import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { IMerchantRepository } from '../ports/auth.ports';
import { ITransferRepository } from '../ports/transfer.ports';
import { BankParserFactory } from '../../../infrastructure/parsers/bank-parser.factory';
import { Transfer } from '../../domain/entities/transfer.entity';

export interface IngestWebhookInput {
  tenantSlug: string;
  secretHeader?: string;
  text: string;
  html?: string;
  subject?: string;
}

export interface IngestWebhookOutput {
  status: 'created' | 'already_exists';
  operationId: string;
  id?: string;
  amount: number;
  message?: string;
}

@Injectable()
export class IngestWebhookUseCase {
  private readonly logger = new Logger(IngestWebhookUseCase.name);

  constructor(
    @Inject('IMerchantRepository') private readonly merchantRepo: IMerchantRepository,
    @Inject('ITransferRepository') private readonly transferRepo: ITransferRepository,
    private readonly parserFactory: BankParserFactory,
  ) {}

  async execute(input: IngestWebhookInput): Promise<IngestWebhookOutput> {
    const merchant = await this.merchantRepo.findBySlug(input.tenantSlug.toLowerCase().trim());
    if (!merchant) {
      throw new NotFoundException(`Merchant tenant '${input.tenantSlug}' not found`);
    }

    // Article I & IV: Secret verification with constant-time comparison
    if (!input.secretHeader) {
      throw new UnauthorizedException('Missing webhook secret header');
    }

    const expectedBuffer = Buffer.from(merchant.webhookSecret, 'utf-8');
    const receivedBuffer = Buffer.from(input.secretHeader, 'utf-8');

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    if (!merchant.isActive()) {
      throw new ForbiddenException('Merchant store is currently inactive or suspended');
    }

    // Parse bank email notification - try plain text first (cleanest), then html, then subject + text
    let parsed = null;
    if (input.text) {
      parsed = this.parserFactory.parse(input.text);
    }
    if (!parsed && input.html) {
      parsed = this.parserFactory.parse(input.html);
    }
    if (!parsed && input.subject) {
      const combined = `${input.subject}\n${input.text || ''}`;
      parsed = this.parserFactory.parse(combined);
    }

    if (!parsed) {
      this.logger.warn(
        `Failed to parse transfer for tenant '${input.tenantSlug}'. Subject: "${input.subject}". Text snippet: "${input.text?.slice(0, 300)}"`
      );
      throw new BadRequestException('Unable to extract valid transfer details from email body');
    }

    this.logger.log(
      `Successfully parsed transfer for tenant '${input.tenantSlug}': OpId=${parsed.operationId}, Amount=${parsed.amount}, Payer=${parsed.payerName}, Bank=${parsed.payerBank}`
    );

    const tenantId = merchant.id!;

    // Article IV Webhook Idempotency check: (tenant_id, operation_id)
    const existing = await this.transferRepo.findByTenantAndOperationId(tenantId, parsed.operationId);
    if (existing) {
      return {
        status: 'already_exists',
        operationId: existing.operationId,
        id: existing.id,
        amount: existing.amount,
        message: 'Duplicate transfer notification ignored idempotently',
      };
    }

    const transfer = new Transfer({
      id: `tr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      tenantId,
      operationId: parsed.operationId,
      receiptNumber: parsed.receiptNumber,
      operationDate: parsed.operationDate,
      payerName: parsed.payerName,
      payerAccount: parsed.payerAccount ?? undefined,
      payerBank: parsed.payerBank ?? undefined,
      currency: parsed.currency,
      amount: parsed.amount,
      creditAccount: parsed.creditAccount ?? undefined,
      concept: parsed.concept ?? undefined,
      rawBody: input.text,
      status: 'pending',
    });

    const saved = await this.transferRepo.save(transfer);

    return {
      status: 'created',
      operationId: saved.operationId,
      id: saved.id,
      amount: saved.amount,
    };
  }
}
