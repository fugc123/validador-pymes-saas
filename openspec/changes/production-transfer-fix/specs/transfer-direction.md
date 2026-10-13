# Spec: Transfer Direction Filtering

## Requirement
The system must distinguish received transfers (relevant for cashier verification) from sent transfers (not relevant).

## Scenarios

### Received transfer is captured
- **Given** an email arrives with "transferencia recibida" or "acreditada" or "te transfirió"
- **When** the parser processes the email
- **Then** the transfer is marked as `received` and appears in cashier search results

### Sent transfer is excluded
- **Given** an email arrives with "transferencia realizada" or "enviaste" or "has enviado"
- **When** the parser processes the email
- **Then** the transfer is marked as `sent` and does NOT appear in cashier search results

### Existing received transfers unchanged
- **Given** an email that currently parses successfully as a received transfer
- **When** the parser processes it after the change
- **Then** it still parses identically and appears in search results
