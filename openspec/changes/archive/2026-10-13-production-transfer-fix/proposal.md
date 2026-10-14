# Proposal: Production Transfer Fix

## Problem
Transfers from different banks are not appearing in the web app. The system must also distinguish received transfers (relevant) from sent transfers (not relevant). Cashiers need to see all amount matches and select the correct one.

## Goals
- Fix production ingestion so transfers appear in the web app
- Filter received vs sent transfers
- Broaden Gmail search query for transfer variants
- Show selectable list of matches to cashier

## Approach
1. Diagnose and fix webhook configuration (BASE_API_URL, MERCHANT_SLUG, WEBHOOK_SECRET)
2. Add direction detection (received/sent) to parsers
3. Expand Gmail search query with received-transfer keywords
4. Return all amount matches with disambiguating data for cashier selection

## Linked Issues
- #20: fix(webhook): diagnose and fix production ingestion failure
- #17: feat(transfers): filter received vs sent transfers
- #18: feat(gmail): broaden transfer email search query
- #19: feat(cashier): show selectable list of amount matches

## Out of Scope
- Deployed Apps Script deployment
- Historical data migration
- New bank parsers
