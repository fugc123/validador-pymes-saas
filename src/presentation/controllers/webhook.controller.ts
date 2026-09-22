import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
} from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IngestWebhookUseCase } from '../../core/application/use-cases/ingest-webhook.use-case';

export class WebhookPayloadDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  date?: string;
}

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly ingestUseCase: IngestWebhookUseCase) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('tenantSlug') tenantSlug: string,
    @Headers('x-merchant-webhook-secret') secretHeader: string,
    @Body() payload: WebhookPayloadDto,
  ) {
    this.logger.log(
      `Received webhook for tenant='${tenantSlug}', subject='${payload.subject || 'N/A'}', textLength=${payload.text?.length || 0}, htmlLength=${payload.html?.length || 0}`,
    );

    const result = await this.ingestUseCase.execute({
      tenantSlug,
      secretHeader,
      text: payload.text,
      html: payload.html,
      subject: payload.subject,
    });

    return result;
  }
}
