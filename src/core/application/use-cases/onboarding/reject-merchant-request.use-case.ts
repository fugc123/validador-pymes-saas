import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IMerchantRequestRepository } from '../../ports/onboarding.ports';
import { MerchantRequest } from '../../../domain/entities/merchant-request.entity';

@Injectable()
export class RejectMerchantRequestUseCase {
  constructor(
    @Inject('IMerchantRequestRepository')
    private readonly merchantRequestRepository: IMerchantRequestRepository,
  ) {}

  async execute(requestId: string, reason?: string): Promise<MerchantRequest> {
    const request = await this.merchantRequestRepository.findById(requestId);
    if (!request) {
      throw new NotFoundException(`Merchant request ${requestId} not found.`);
    }
    if (!request.isPending()) {
      throw new BadRequestException(`Only pending merchant requests can be rejected. Current status: ${request.status}`);
    }
    request.reject();
    return await this.merchantRequestRepository.save(request);
  }
}
