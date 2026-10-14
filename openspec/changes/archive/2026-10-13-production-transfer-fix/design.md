# Design: Production Transfer Fix

## Architecture

### Direction Detection
- Add `direction: 'received' | 'sent'` field to Transfer entity
- Parsers detect direction from email content using keyword matching
- Received keywords: "transferencia recibida", "acreditada", "has recibido", "te transfirió"
- Sent keywords: "transferencia realizada", "enviaste", "has enviado"
- Default to 'received' when direction cannot be determined (safe default)

### Gmail Search Query
- Expand query to include: "transferencias" (plural), "recibida", "has recibido", "te transfirió"
- Keep OR logic and label exclusion
- Query: `("itau" OR "itaú" OR "gnb" OR "ueno" OR "familiar" OR "atlas" OR "continental" OR "sipap" OR "transferencia" OR "transferencias" OR "recibida" OR "acreditada" OR "has recibido" OR "te transfirió") -label:SIPAP_Validador`

### Cashier Match List
- Remove empty-identifier short-circuit in VerifyTransferUseCase
- When no identifier: return all pending matches for exact amount within 45-min window
- When identifier present: keep existing name/reference matching
- Frontend: render selectable list with all disambiguating fields
- Claim flow unchanged: cashier selects transfer by ID

### Webhook Configuration
- Verify BASE_API_URL, MERCHANT_SLUG, WEBHOOK_SECRET in deployed GAS script
- No code changes needed if configuration is correct
- If values are wrong, update Script Properties in GAS

## Data Model Changes
- Transfer entity: add `direction` field (enum: received, sent)
- Database: add `direction` column to transfers table
- Default value: 'received' for backward compatibility

## API Changes
- VerifyTransferUseCase response: return array of matches (already does)
- No new endpoints needed

## Files to Modify
- `src/core/domain/entities/transfer.entity.ts` — add direction field
- `src/infrastructure/parsers/universal-sipap.parser.ts` — detect direction
- `src/infrastructure/parsers/*.ts` — add direction detection to all parsers
- `src/core/application/use-cases/transfers/verify-transfer.use-case.ts` — remove empty-identifier block
- `client/src/portals/pos/FastPosScreen.tsx` — selectable list UI
- `google-apps-script/code.gs` — expand search query
- Database migration: add direction column
