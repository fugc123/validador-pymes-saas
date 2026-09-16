import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { IngestWebhookUseCase } from '../../core/application/use-cases/ingest-webhook.use-case';

export class WebhookPayloadDto {
  text!: string;
  html?: string;
  subject?: string;
}

@Controller('webhook')
export class WebhookController {
  constructor(private readonly ingestUseCase: IngestWebhookUseCase) {}

  @Post(':tenantSlug')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('tenantSlug') tenantSlug: string,
    @Headers('x-merchant-webhook-secret') secretHeader: string,
    @Body() payload: WebhookPayloadDto,
  ) {
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
