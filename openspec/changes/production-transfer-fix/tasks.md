# Tasks: Production Transfer Fix

## Task 1: Fix webhook configuration (BLOCKING)
- [ ] Verify BASE_API_URL in deployed GAS script points to real server
- [ ] Verify MERCHANT_SLUG matches DB merchant slug
- [ ] Verify WEBHOOK_SECRET matches DB webhook_secret
- [ ] Verify merchant status is active
- [ ] Verify GAS time-driven trigger is running
- [ ] Test: send a transfer email and confirm it appears in web app
- **Issue:** #20
- **Priority:** CRITICAL — blocks everything else

## Task 2: Add direction detection to parsers
- [ ] Add `direction` field to Transfer entity (received/sent enum)
- [ ] Add direction detection to UniversalSipapParser
- [ ] Add direction detection to all bank-specific parsers
- [ ] Add database migration for direction column
- [ ] Write unit tests for received/sent detection
- [ ] Exclude sent transfers from cashier search results
- [ ] Exclude sent transfers from owner dashboard results
- **Issue:** #17
- **Priority:** HIGH

## Task 3: Broaden Gmail search query
- [ ] Add "transferencias" (plural) to GAS search query
- [ ] Add "recibida", "has recibido", "te transfirió" to query
- [ ] Test with real transfer emails from different banks
- [ ] Verify no performance regression in GAS execution
- **Issue:** #18
- **Priority:** MEDIUM

## Task 4: Cashier selectable match list
- [ ] Remove empty-identifier short-circuit in VerifyTransferUseCase
- [ ] Return all pending matches when no identifier provided
- [ ] Update FastPosScreen to show selectable list
- [ ] Display: payerName, payerBank, operationId, receiptNumber, operationDate
- [ ] Wire cashier selection to claim flow
- [ ] Write unit tests for amount-only search
- [ ] Write unit tests for list selection and claim
- **Issue:** #19
- **Priority:** HIGH

## Dependencies
- Task 1 must complete before testing Tasks 2-4 in production
- Task 2 and Task 3 can proceed in parallel after Task 1
- Task 4 depends on Task 2 (direction field needed for filtering)
