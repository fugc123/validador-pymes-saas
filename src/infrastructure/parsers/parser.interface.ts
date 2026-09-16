export interface ParsedTransferData {
  operationId: string;
  receiptNumber?: string;
  operationDate: string;
  payerName: string;
  payerAccount?: string | null;
  payerBank?: string | null;
  currency: string;
  amount: number;
  creditAccount?: string | null;
  concept?: string | null;
  rawText?: string;
}

export interface IBankParser {
  readonly bankName: string;
  canParse(content: string): boolean;
  parse(content: string): ParsedTransferData | null;
}
