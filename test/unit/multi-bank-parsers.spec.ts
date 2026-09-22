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

  it('8. Universal SIPAP Parser extracts Vanessa Ojeda 48.000 Gs transfer in multiple formats', () => {
    const text1 = 'Transferencia recibida por Gs. 48.000 de Vanessa Ojeda. Operación: 987654';
    const parsed1 = factory.parse(text1);
    expect(parsed1).not.toBeNull();
    expect(parsed1?.amount).toBe(48000);
    expect(parsed1?.payerName).toBe('VANESSA OJEDA');
    expect(parsed1?.operationId).toBe('987654');

    const text2 = '¡Recibiste una transferencia!\nDe: Vanessa Ojeda\nMonto: Gs. 48.000\nComprobante: OP-887766';
    const parsed2 = factory.parse(text2);
    expect(parsed2).not.toBeNull();
    expect(parsed2?.amount).toBe(48000);
    expect(parsed2?.payerName).toBe('VANESSA OJEDA');
    expect(parsed2?.operationId).toBe('OP-887766');

    const text3 = 'Aviso de transferencia SIPAP\nCliente pagador: Vanessa Ojeda\nImporte de la operación: 48.000 Gs.\nNro. de Operación: 554433';
    const parsed3 = factory.parse(text3);
    expect(parsed3).not.toBeNull();
    expect(parsed3?.amount).toBe(48000);
    expect(parsed3?.payerName).toBe('VANESSA OJEDA');
    expect(parsed3?.operationId).toBe('554433');
  });

  it('9. Universal SIPAP Parser handles comma thousands separator (PYG 45,000 / PYG 48,000)', () => {
    const rawItauEmailSnippet = 'Transferencia SIPAP\nEnviado por: Vanessa Ojeda\n\tPYG 45,000\nNro. Comprobante: 112233';
    const parsed = factory.parse(rawItauEmailSnippet);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(45000);
    expect(parsed?.payerName).toBe('VANESSA OJEDA');
    expect(parsed?.operationId).toBe('112233');

    const rawItau48k = 'Transferencia SIPAP\nCliente Pagador: Vanessa Ojeda\n\tPYG 48,000\nNro. de operación: 998877';
    const parsed48 = factory.parse(rawItau48k);
    expect(parsed48).not.toBeNull();
    expect(parsed48?.amount).toBe(48000);
    expect(parsed48?.payerName).toBe('VANESSA OJEDA');
    expect(parsed48?.operationId).toBe('998877');
  });

  it('10. Familiar Parser correctly parses real Banco Familiar transfer notification', () => {
    const realFamiliarEmail = `TRANSFERENCIA DE OTRAS ENTIDADES RECIBIDA
Hemos registrado la siguiente operación de transferencia
Nro. de Operación: \t702676268
Referencia: \tBSUDPYPX22092661200061270778
Fecha y hora de Operación: \t22/09/2026 17:10:17
Entidad Pagadora: \tSUDAMERIS BANK SAECA
Cliente Pagador: \tGIRALA CRISTALDO FRANCO URIEL
Nro. de Cuenta del Pagador: \t******3001
Moneda y Monto: \tPYG 1.000
Entidad Beneficiaria: \tBANCO FAMILIAR S.A.E.C.A.
Cliente Beneficiario: \tCESAR FABIAN MORALES MALDONADO
Nro. de Cuenta del Beneficiario: \t81844155
Razón de comunicación: \tTransferencia acreditada en cuenta.
Comentario del cliente: \t
Te recordamos que nuestro Centro de Atención al Cliente se encuentra a tu entera disposición; ante cualquier duda o consulta, podés llamar gratuítamente al 0800 11 33 22 desde tu línea baja o desde tu celular al *3322`;

    const parsed = factory.parse(realFamiliarEmail);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(1000);
    expect(parsed?.currency).toBe('PYG');
    expect(parsed?.operationId).toBe('702676268');
    expect(parsed?.receiptNumber).toBe('BSUDPYPX22092661200061270778');
    expect(parsed?.payerName).toBe('GIRALA CRISTALDO FRANCO URIEL');
    expect(parsed?.payerBank).toBe('SUDAMERIS BANK SAECA');
    expect(parsed?.operationDate).toBe('22/09/2026 17:10:17');
  });

  it('11. Universal Parser extracts Tigo Money transfer with natural language layout', () => {
    const tigoEmail = `Tigo Money - Notificación de Envío
¡Recibiste dinero en tu billetera!
Recibiste Gs. 50.000 de JUAN CARLOS GOMEZ
Transacción N°: TM-88997711
Fecha: 22/09/2026 14:15:00`;

    const parsed = factory.parse(tigoEmail);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(50000);
    expect(parsed?.payerName).toBe('JUAN CARLOS GOMEZ');
    expect(parsed?.operationId).toBe('TM-88997711');
    expect(parsed?.payerBank).toBe('Tigo Money');
  });

  it('12. Universal Parser extracts Personal Pay / Billetera Personal transfer', () => {
    const personalEmail = `Personal Pay - Transferencia Acreditada
¡Te enviaron dinero!
Monto: 35.000 Gs.
Enviado por: MARIA ELENA BOGADO
Comprobante: PP-443322
Fecha: 22/09/2026 16:30`;

    const parsed = factory.parse(personalEmail);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(35000);
    expect(parsed?.payerName).toBe('MARIA ELENA BOGADO');
    expect(parsed?.operationId).toBe('PP-443322');
    expect(parsed?.payerBank).toBe('Personal Pay');
  });

  it('13. Universal Parser extracts Mango / Wally digital wallet notification', () => {
    const mangoEmail = `¡Cobraste con Mango!
Monto recibido: Gs. 120.000
De: CARLOS ALBERTO BENITEZ
ID de operación: MNG-998877
Fecha y hora: 22/09/2026 18:05:12`;

    const parsed = factory.parse(mangoEmail);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(120000);
    expect(parsed?.payerName).toBe('CARLOS ALBERTO BENITEZ');
    expect(parsed?.operationId).toBe('MNG-998877');
    expect(parsed?.payerBank).toBe('Mango');
  });

  it('14. Universal Parser extracts Tu Financiera / Cooperativa transfer', () => {
    const financieraEmail = `Aviso de Transferencia Recibida - Tu Financiera
Operación Nro: TF-55443322
Titular Ordenante: ANDREA SOLEDAD DUARTE
Importe: Gs. 250.000
Fecha: 22/09/2026 12:00:00`;

    const parsed = factory.parse(financieraEmail);
    expect(parsed).not.toBeNull();
    expect(parsed?.amount).toBe(250000);
    expect(parsed?.payerName).toBe('ANDREA SOLEDAD DUARTE');
    expect(parsed?.operationId).toBe('TF-55443322');
    expect(parsed?.payerBank).toBe('Tu Financiera');
  });
});
