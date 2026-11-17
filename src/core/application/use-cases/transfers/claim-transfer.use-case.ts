import {
  Injectable,
  Inject,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { IMembershipRepository } from '../../ports/auth.ports';
import { ITransferRepository } from '../../ports/transfer.ports';

export interface ClaimTransferInput {
  tenantId: string;
  transferId: string;
  cashierUserId: string;
  claimTimestamp?: Date;
}

export interface ClaimTransferOutput {
  status: 'claimed' | 'already_claimed';
  transferId: string;
  claimedAt: Date;
  claimedByUserId: string;
  message?: string;
}

@Injectable()
export class ClaimTransferUseCase {
  constructor(
    @Inject('ITransferRepository') private readonly transferRepo: ITransferRepository,
    @Optional()
    @Inject('IMembershipRepository')
    private readonly membershipRepo?: IMembershipRepository,
  ) {}

  async execute(input: ClaimTransferInput): Promise<ClaimTransferOutput> {
    const claimTime = input.claimTimestamp ?? new Date();

    // 1. Attempt Atomic SQL Update: WHERE id = $id AND tenant_id = $tenantId AND status = 'pending'
    const wasUpdated = await this.transferRepo.updateClaimed(
      input.tenantId,
      input.transferId,
      input.cashierUserId,
      claimTime,
    );

    if (wasUpdated) {
      // Cross-store anti-replay: mark matching operationId as claimed in sibling stores of the same owner
      if (this.membershipRepo) {
        try {
          const claimedTransfer = await this.transferRepo.findById(input.tenantId, input.transferId);
          if (claimedTransfer) {
            const members = await this.membershipRepo.findMembersByMerchant(input.tenantId);
            const owners = members.filter((m) => m.role === 'MERCHANT_OWNER' && m.isActive);
            const siblingIds = new Set<string>();
            for (const owner of owners) {
              const ownerStores = await this.membershipRepo.findActiveByUser(owner.userId);
              for (const st of ownerStores) {
                const sibId = st.merchant.id || st.merchant.slug;
                if (st.membership.role === 'MERCHANT_OWNER' && sibId && sibId !== input.tenantId) {
                  siblingIds.add(sibId);
                }
              }
            }
            for (const sibId of siblingIds) {
              const sibTransfer = await this.transferRepo.findByTenantAndOperationId(
                sibId,
                claimedTransfer.operationId,
              );
              if (sibTransfer && sibTransfer.id && sibTransfer.status === 'pending') {
                await this.transferRepo.updateClaimed(sibId, sibTransfer.id, input.cashierUserId, claimTime);
              }
            }
          }
        } catch {
          // Non-blocking after primary claim succeeds
        }
      }

      return {
        status: 'claimed',
        transferId: input.transferId,
        claimedAt: claimTime,
        claimedByUserId: input.cashierUserId,
      };
    }

    // 2. If 0 rows were updated, investigate state to enforce Article II Anti-Replay Guard
    const existing = await this.transferRepo.findById(input.tenantId, input.transferId);
    if (!existing) {
      throw new NotFoundException(`Transfer '${input.transferId}' not found in current organization`);
    }

    if (existing.isClaimed()) {
      throw new ConflictException({
        status: 'already_claimed',
        transferId: existing.id,
        operationId: existing.operationId,
        claimedAt: existing.claimedAt,
        claimedByUserId: existing.claimedByUserId,
        message: '⛔ NO entregar mercadería. Comprobante ya utilizado',
      });
    }

    if (existing.isExpired()) {
      throw new ConflictException({
        status: 'expired',
        transferId: existing.id,
        message: 'Transfer has expired (outside 45-minute retail window)',
      });
    }

    throw new ConflictException('Unable to claim transfer due to state conflict');
  }
}
