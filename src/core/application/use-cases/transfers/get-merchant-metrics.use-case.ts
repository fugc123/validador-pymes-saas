import { Inject, Injectable } from '@nestjs/common';
import { ITransferRepository, MerchantMetrics } from '../../ports/transfer.ports';

@Injectable()
export class GetMerchantMetricsUseCase {
  constructor(
    @Inject('ITransferRepository')
    private readonly transferRepository: ITransferRepository,
  ) {}

  async execute(tenantId: string): Promise<MerchantMetrics> {
    return this.transferRepository.getMetricsByTenant(tenantId);
  }
}
