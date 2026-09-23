import { Injectable, Inject } from '@nestjs/common';
import { ITransferRepository } from '../../ports/transfer.ports';

export interface VerifyTransferInput {
  tenantId: string;
  amount: number;
  payerFilter?: string;
  maxAgeMinutes?: number;
}

export interface TransferMatchItem {
  id: string;
  operationId: string;
  receiptNumber?: string;
  payerName: string;
  payerBank?: string;
  amount: number;
  currency: string;
  operationDate: string;
  createdAt: Date;
}

export interface VerifyTransferOutput {
  found: boolean;
  replayDetected?: boolean;
  status: 'pending' | 'already_claimed' | 'not_found';
  transfers: TransferMatchItem[];
  claimedAt?: Date | null;
  message?: string;
}

function removeDiacritics(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

@Injectable()
export class VerifyTransferUseCase {
  constructor(@Inject('ITransferRepository') private readonly transferRepo: ITransferRepository) {}

  async execute(input: VerifyTransferInput): Promise<VerifyTransferOutput> {
    const maxAgeMinutes = input.maxAgeMinutes ?? 45;
    const now = new Date();

    const pendingList = await this.transferRepo.findPendingByAmountAndPayer(
      input.tenantId,
      input.amount,
      input.payerFilter,
    );

    // Filter by max age
    const activePending = pendingList.filter((t) => !t.isExpired(maxAgeMinutes, now));

    if (activePending.length > 0) {
      let filtered = activePending;
      if (input.payerFilter && input.payerFilter.trim().length > 0) {
        const queryWords = removeDiacritics(input.payerFilter.toLowerCase().trim())
          .split(/\s+/)
          .filter((w) => w.length > 0);
        filtered = activePending.filter((t) => {
          const normalizedName = removeDiacritics(t.payerName.toLowerCase());
          return queryWords.every((word) => normalizedName.includes(word));
        });
      }

      if (filtered.length > 0) {
        return {
          found: true,
          status: 'pending',
          transfers: filtered.map((t) => ({
            id: t.id!,
            operationId: t.operationId,
            receiptNumber: t.receiptNumber,
            payerName: t.payerName,
            payerBank: t.payerBank,
            amount: t.amount,
            currency: t.currency,
            operationDate: t.operationDate,
            createdAt: t.createdAt,
          })),
        };
      }
    }

    return {
      found: false,
      status: 'not_found',
      transfers: [],
      message: 'No se encontró ninguna transferencia pendiente que coincida con ese monto y nombre en la ventana de 45 minutos.',
    };
  }
}
