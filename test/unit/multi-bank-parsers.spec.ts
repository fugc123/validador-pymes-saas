import { BankParserFactory } from '../../src/infrastructure/parsers/bank-parser.factory';
import { ItauParaguayParser } from '../../src/infrastructure/parsers/itau-paraguay.parser';
import { GnbParaguayParser } from '../../src/infrastructure/parsers/gnb-paraguay.parser';
import { UenoBankParser } from '../../src/infrastructure/parsers/ueno-bank.parser';
import { FamiliarBankParser } from '../../src/infrastructure/parsers/familiar-bank.parser';
import { AtlasBankParser } from '../../src/infrastructure/parsers/atlas-bank.parser';
import { ContinentalBankParser } from '../../src/infrastructure/parsers/continental-bank.parser';

describe('Multi-Bank Parsers Suite (6 Banks - T07)', () => {
  const factory = new BankParserFactory();

  const itauEmail = `A continuación el detalle de la operación:
Nro. de operación: 	COMAPYPAARES260914370460000640061
Fecha y hora de operación: 	14/09/2026 10:17:26
Cliente Pagador: 	MIA FIORELLA GIMENEZ AQUINO
Nro. de cuenta del pagador: 	0000000619411905
Entidad pagadora: 	UENO BANK S.A.
Moneda y Monto: 	PYG 45,000
Nro. de cuenta crédito: 	720805917
Nro. comprobante: 	8351454
Concepto de la Transferencia: 	/BNF/
Estado: 	Transferencia acreditada en cuenta`;

  const gnbEmail = `Transferencia Interbancaria Recibida:
Estimado cliente, se le informa que se ha registrado un crédito a su cuenta por la siguiente operación:
N° Comprobante: 	001000400059002576067420260914
Referencia: 	COMAPYPAARES260914728770001549990
Fecha y hora: 	14/09/26 20:14
Enviado por: 	DA EL YANG PARK
Entidad Pagadora: 	UENO BANK S.A
N° Cuenta Pagador: 	0000000619739898
Importe: 	PYG 120000
Cuenta crédito: 	0000013132236001
Comentario: 	Pago de servicios`;

  const uenoEmail = `Recibiste una transferencia
Podés visualizar el detalle de la operación desde los movimientos de tu app.
Monto Gs. 152.000
Titular cuenta débito FRANCO URIEL GIRALA CRISTALDO
Entidad débito UENO BANK S.A.
Beneficiario FRANCO URIEL GIRALA CRISTALDO
Nro. de transacción 6693320
Fecha y hora transferencia 07/07/2026 22:18:54 h`;

  const familiarEmail = `Aviso de Transferencia SIPAP Recibida:
Nro. de Operación: 	FAM987654321
Nro. Comprobante: 	COM-FAM-1122
Titular Ordenante: 	RODRIGO RAMON BENITEZ
Banco Origen: 	BANCO FAMILIAR
Importe: 	Gs. 85.000
Fecha y Hora: 	15/09/2026 11:20:00`;

  const atlasEmail = `Aviso de Crédito por Transferencia SIPAP:
Referencia SIPAP: 	ATLAS-OP-443322
Nro. de Comprobante: 	ATL998811
Ordenante: 	LOURDES BEATRIZ CARDOZO
Banco Débito: 	BANCO ATLAS
Monto: 	35.000 Gs
Fecha: 	16/09/2026 09:15`;

  const continentalEmail = `Acreditación de Transferencia SIPAP / SPI:
Nro. Referencia: 	CONT-REF-887766
Comprobante: 	CONT-COMP-5544
Remitente: 	MARCOS ANTONIO VILLALBA
Banco Remitente: 	BANCO CONTINENTAL
Monto Acreditado: 	Gs. 210.000
Fecha/Hora: 	14/09/2026 18:45:10`;

  it('1. Itaú Parser extracts amount 45.000 and payer', () => {
    const parser = new ItauParaguayParser();
    expect(parser.canParse(itauEmail)).toBe(true);
    const res = parser.parse(itauEmail);
    expect(res?.amount).toBe(45000);
    expect(res?.payerName).toBe('MIA FIORELLA GIMENEZ AQUINO');
    expect(res?.operationId).toBe('COMAPYPAARES260914370460000640061');
  });

  it('2. GNB Parser extracts amount 120.000 and payer', () => {
    const parser = new GnbParaguayParser();
    expect(parser.canParse(gnbEmail)).toBe(true);
    const res = parser.parse(gnbEmail);
    expect(res?.amount).toBe(120000);
    expect(res?.payerName).toBe('DA EL YANG PARK');
  });

  it('3. UENO Parser extracts amount 152.000 and payer', () => {
    const parser = new UenoBankParser();
    expect(parser.canParse(uenoEmail)).toBe(true);
    const res = parser.parse(uenoEmail);
    expect(res?.amount).toBe(152000);
    expect(res?.payerName).toBe('FRANCO URIEL GIRALA CRISTALDO');
  });

  it('4. Familiar Parser extracts amount 85.000 and payer', () => {
    const parser = new FamiliarBankParser();
    expect(parser.canParse(familiarEmail)).toBe(true);
    const res = parser.parse(familiarEmail);
    expect(res?.amount).toBe(85000);
    expect(res?.payerName).toBe('RODRIGO RAMON BENITEZ');
    expect(res?.operationId).toBe('FAM987654321');
  });

  it('5. Atlas Parser extracts amount 35.000 and payer', () => {
    const parser = new AtlasBankParser();
    expect(parser.canParse(atlasEmail)).toBe(true);
    const res = parser.parse(atlasEmail);
    expect(res?.amount).toBe(35000);
    expect(res?.payerName).toBe('LOURDES BEATRIZ CARDOZO');
  });

  it('6. Continental Parser extracts amount 210.000 and payer', () => {
    const parser = new ContinentalBankParser();
    expect(parser.canParse(continentalEmail)).toBe(true);
    const res = parser.parse(continentalEmail);
    expect(res?.amount).toBe(210000);
    expect(res?.payerName).toBe('MARCOS ANTONIO VILLALBA');
  });

  it('7. BankParserFactory routes all 6 banks accurately', () => {
    expect(factory.parse(itauEmail)?.amount).toBe(45000);
    expect(factory.parse(gnbEmail)?.amount).toBe(120000);
    expect(factory.parse(uenoEmail)?.amount).toBe(152000);
    expect(factory.parse(familiarEmail)?.amount).toBe(85000);
    expect(factory.parse(atlasEmail)?.amount).toBe(35000);
    expect(factory.parse(continentalEmail)?.amount).toBe(210000);
  });
});
