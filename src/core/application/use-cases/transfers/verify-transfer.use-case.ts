import { Injectable, Inject } from '@nestjs/common';
import { ITransferRepository } from '../../ports/transfer.ports';
import { Transfer } from '../../../domain/entities/transfer.entity';

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

function buildFoundOutput(transfers: Transfer[]): VerifyTransferOutput {
  return {
    found: true,
    status: 'pending',
    transfers: transfers.map((t) => ({
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

@Injectable()
export class VerifyTransferUseCase {
  constructor(@Inject('ITransferRepository') private readonly transferRepo: ITransferRepository) {}

  async execute(input: VerifyTransferInput): Promise<VerifyTransferOutput> {
    const maxAgeMinutes = input.maxAgeMinutes ?? 45;
    const now = new Date();
    const identifier = input.payerFilter?.trim() ?? '';

    // A cashier lookup always carries an identifier: amount-only search is not
    // permitted, and an empty/whitespace identifier must short-circuit before
    // any repository method is invoked.
    if (identifier.length === 0) {
      return {
        found: false,
        status: 'not_found',
        transfers: [],
        message:
          'Debe indicar el nombre del pagador o la referencia SIPAP/operación junto con el monto para buscar la transferencia.',
      };
    }

    // Candidate retrieval: tenant-scoped, exact amount, pending only — one
    // fetch for both matching passes. The identifier deliberately never
    // reaches SQL: the shared repository's optional `payer_name ILIKE`
    // prefilter cannot express the diacritic-insensitive, non-contiguous word
    // match below and would hide every row whose payer name does not contain a
    // pasted operation/receipt reference. Retrieval is broader, but a transfer
    // is returned only after the identifier matches here.
    const candidates = (
      await this.transferRepo.findPendingByAmountAndPayer(input.tenantId, input.amount)
    ).filter((t) => !t.isExpired(maxAgeMinutes, now));

    // Pass 1: existing payer-name word matching (diacritic-insensitive).
    const queryWords = removeDiacritics(identifier.toLowerCase())
      .split(/\s+/)
      .filter((w) => w.length > 0);
    const matchedByName = candidates.filter((t) => {
      const normalizedName = removeDiacritics(t.payerName.toLowerCase());
      return queryWords.every((word) => normalizedName.includes(word));
    });

    if (matchedByName.length > 0) {
      return buildFoundOutput(matchedByName);
    }

    // Pass 2: the payer name was unavailable or did not match, so fall back to
    // an exact, case-insensitive match against the SIPAP operation id or
    // receipt number.
    const identifierLower = identifier.toLowerCase();
    const matchedByReference = candidates.filter(
      (t) =>
        t.operationId.toLowerCase() === identifierLower ||
        (t.receiptNumber ?? '').toLowerCase() === identifierLower,
    );

    if (matchedByReference.length > 0) {
      return buildFoundOutput(matchedByReference);
    }

    return {
      found: false,
      status: 'not_found',
      transfers: [],
      message:
        'No se encontró ninguna transferencia pendiente que coincida con ese monto y con el nombre o la referencia indicados en la ventana de 45 minutos.',
    };
  }
}
