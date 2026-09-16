# ADR-005: Multi-Bank Parsing Strategy (Itaú, GNB, UENO, Familiar, Atlas, Continental)

- **Status**: `Accepted`
- **Date**: 2026-09-15
- **Deciders**: Technical Lead, Senior Architect
- **Consulted**: Core Engineers

---

## Context and Problem Statement

Merchants in Paraguay receive interbank SIPAP transfers from customer accounts across multiple entities:
- **Banco Itaú Paraguay**
- **Banco GNB Paraguay**
- **UENO Bank S.A.**
- **Banco Familiar S.A.E.C.A.**
- **Banco Atlas S.A.**
- **Banco Continental S.A.E.C.A.**

Banks format notification emails inconsistently. Moreover, email content varies depending on whether:
1. The email is a direct system notification from the bank.
2. The email is forwarded (`Fwd:`, `RV:`) from the owner's personal address or another mailbox.
3. The content is formatted as HTML table, raw plaintext, or tab-delimited text.

A rigid parser causes ingestion failures (e.g. failing on `Debitado de:` vs `Cliente Pagador:` or `Monto de la transferencia:` vs `Moneda y Monto:`).

---

## Decision Outcome

**Chosen Solution: Strategy Pattern via `BankParserFactory` with Multi-Heuristic Normalization.**

```
                         [Incoming Email Body]
                                   │
                                   ▼
                       [BankParserFactory]
                                   │
      ┌──────────────┬─────────────┼─────────────┬──────────────┬──────────────┐
      │              │             │             │              │              │
      ▼              ▼             ▼             ▼              ▼              ▼
[ItauParser]   [GnbParser]   [UenoParser] [FamiliarParser] [AtlasParser] [ContinentalParser]
```

### Parser Specifications & Bank Signatures:

| Bank Entity | Detection Signatures | Key Extracted Fields |
|---|---|---|
| **Banco Itaú Paraguay** | `itau`, `itaú`, `acreditada en cuenta`, `Aviso de transferencia recibida`, `Debitado de:` | Operation ID (`COMAPYPAARES...` or `45601`), Amount (`PYG`), Payer Name, Receipt (`7008` / `8351454`). |
| **Banco GNB Paraguay** | `banco gnb`, `Transferencia Interbancaria Recibida`, `Entidad Pagadora:` | 30-digit receipt, SIPAP reference, Amount (`PYG`), Payer Name. |
| **UENO Bank** | `ueno bank`, `Recibiste una transferencia`, `Titular cuenta débito:` | Transaction ID (e.g. `6693320`), Amount (`Gs.`), Payer Name. |
| **Banco Familiar** | `banco familiar`, `FAMIPYPAARES...`, `Acreditación SIPAP` | Operation ID (`FAMIPYPAARES...`), Amount, Payer Name, Receipt. |
| **Banco Atlas** | `banco atlas`, `Crédito por transferencia`, `ATLAPYPAARES...` | Operation ID, Amount, Payer Name. |
| **Banco Continental** | `banco continental`, `Transferencia Recibida SIPAP` | Comprobante, Amount, Payer Name. |

### Normalization Pipeline:

1. **Pre-Processing (HTML Stripping & Character Unescaping)**:
   - Convert HTML table tags (`<tr>`, `<td>`, `<p>`, `<br>`) to clean semantic newlines and tabs (`\n`, `\t`).
   - Decode HTML entities (`&nbsp;`, `&amp;`, `&quot;`).
2. **Flexible Multi-Label Regex Matching**:
   - Payer matching: `/(?:Cliente\s*Pagador|Debitado\s*de|Enviado\s*por|Titular\s*cuenta\s*d[eé]bito|Ordenante):\s*([^\r\n]+)/i`
   - Amount matching: `/(?:Moneda\s*y\s*Monto|Monto\s*de\s*la\s*transferencia|Monto\s*Gs\.?|Importe|Monto):\s*([^\r\n]+)/i`
   - Operation/Voucher matching: `/(?:Nro\.?\s*de\s*operaci[oó]n|Nro\.?\s*comprobante|Nro\.?\s*de\s*transacci[oó]n|Referencia):\s*([A-Za-z0-9]+)/i`
3. **Currency & Integer Sanitization**:
   - All amounts in Guaraníes (`PYG`) are strictly parsed as integers without decimal loss (`Math.round` or regex digit extraction).
   - Dollar amounts (`USD`) are normalized to cents.

---

## Consequences

### Positive:
- New bank parsers can be added simply by implementing `IBankParser` and registering with `BankParserFactory` (Open/Closed Principle).
- Unbreakable parsing across direct, forwarded, or mobile-app-generated notification emails.
