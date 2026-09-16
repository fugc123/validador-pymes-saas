import { Injectable } from '@nestjs/common';
import { IMerchantRequestRepository } from '../../ports/onboarding.ports';
import { MerchantRequest } from '../../../domain/entities/merchant-request.entity';

export interface SubmitMerchantRequestInput {
  businessName: string;
  ownerName: string;
  email: string;
  phone: string;
  city: string;
}

export interface SubmitMerchantRequestOutput {
  requestId: string;
  status: string;
  businessName: string;
  message: string;
}

@Injectable()
export class SubmitMerchantRequestUseCase {
  constructor(private readonly requestRepo: IMerchantRequestRepository) {}

  async execute(input: SubmitMerchantRequestInput): Promise<SubmitMerchantRequestOutput> {
    const request = new MerchantRequest({
      id: `req-${Date.now()}`,
      businessName: input.businessName,
      ownerName: input.ownerName,
      email: input.email,
      phone: input.phone,
      city: input.city,
      status: 'requested',
    });

    const saved = await this.requestRepo.save(request);

    return {
      requestId: saved.id!,
      status: saved.status,
      businessName: saved.businessName,
      message: 'Application received successfully. SuperAdmin approval pending.',
    };
  }
}
