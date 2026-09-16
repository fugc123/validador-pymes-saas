import { Injectable } from '@nestjs/common';
import { IBankParser, ParsedTransferData } from './parser.interface';
import { ItauParaguayParser } from './itau-paraguay.parser';
import { GnbParaguayParser } from './gnb-paraguay.parser';
import { UenoBankParser } from './ueno-bank.parser';
import { FamiliarBankParser } from './familiar-bank.parser';
import { AtlasBankParser } from './atlas-bank.parser';
import { ContinentalBankParser } from './continental-bank.parser';

@Injectable()
export class BankParserFactory {
  private readonly parsers: IBankParser[] = [
    new ItauParaguayParser(),
    new GnbParaguayParser(),
    new UenoBankParser(),
    new FamiliarBankParser(),
    new AtlasBankParser(),
    new ContinentalBankParser(),
  ];

  parse(content: string): ParsedTransferData | null {
    if (!content) return null;

    for (const parser of this.parsers) {
      if (parser.canParse(content)) {
        const result = parser.parse(content);
        if (result && result.amount > 0 && result.operationId) {
          return result;
        }
      }
    }

    // Fallback: try all parsers regardless of canParse filter
    for (const parser of this.parsers) {
      const result = parser.parse(content);
      if (result && result.amount > 0 && result.operationId) {
        return result;
      }
    }

    return null;
  }
}
