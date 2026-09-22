import { Injectable } from '@nestjs/common';
import { IBankParser, ParsedTransferData } from './parser.interface';
import { ItauParaguayParser } from './itau-paraguay.parser';
import { GnbParaguayParser } from './gnb-paraguay.parser';
import { UenoBankParser } from './ueno-bank.parser';
import { FamiliarBankParser } from './familiar-bank.parser';
import { AtlasBankParser } from './atlas-bank.parser';
import { ContinentalBankParser } from './continental-bank.parser';
import { UniversalSipapParser } from './universal-sipap.parser';

@Injectable()
export class BankParserFactory {
  private readonly specificParsers: IBankParser[] = [
    new ItauParaguayParser(),
    new GnbParaguayParser(),
    new UenoBankParser(),
    new FamiliarBankParser(),
    new AtlasBankParser(),
    new ContinentalBankParser(),
  ];

  private readonly universalParser = new UniversalSipapParser();

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;

    let bestCandidate: ParsedTransferData | null = null;

    // 1. Try bank-specific parsers first
    for (const parser of this.specificParsers) {
      if (parser.canParse(content)) {
        const result = parser.parse(content);
        if (result && result.amount > 0 && result.operationId) {
          // If this parser extracted a real payer name, return immediately
          if (
            result.payerName &&
            result.payerName !== 'DESCONOCIDO' &&
            result.payerName !== 'CLIENTE SIPAP'
          ) {
            return result;
          }
          if (!bestCandidate) {
            bestCandidate = result;
          }
        }
      }
    }

    // 2. Try the Universal Semantic Parser (handles billeteras, financieras, and rescues missing payer names)
    if (this.universalParser.canParse(content)) {
      const universalResult = this.universalParser.parse(content);
      if (universalResult && universalResult.amount > 0 && universalResult.operationId) {
        if (
          universalResult.payerName &&
          universalResult.payerName !== 'DESCONOCIDO' &&
          universalResult.payerName !== 'CLIENTE SIPAP'
        ) {
          if (bestCandidate) {
            return {
              ...bestCandidate,
              payerName: universalResult.payerName,
              payerBank:
                bestCandidate.payerBank && bestCandidate.payerBank !== 'SIPAP Paraguay'
                  ? bestCandidate.payerBank
                  : universalResult.payerBank,
            };
          }
          return universalResult;
        }
        if (!bestCandidate) {
          bestCandidate = universalResult;
        }
      }
    }

    // 3. Fallback: try all parsers without canParse filter
    if (!bestCandidate) {
      for (const parser of this.specificParsers) {
        const result = parser.parse(content);
        if (result && result.amount > 0 && result.operationId) {
          return result;
        }
      }
      const universalFallback = this.universalParser.parse(content);
      if (universalFallback && universalFallback.amount > 0 && universalFallback.operationId) {
        return universalFallback;
      }
    }

    return bestCandidate;
  }
}
