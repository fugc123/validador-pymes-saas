# Spec: Gmail Search Query

## Requirement
The Gmail search query must capture any email mentioning transfers in subject or body, including plural forms and received-transfer keywords.

## Scenarios

### Plural "transferencias" is captured
- **Given** an email with subject "Transferencias realizadas"
- **When** the GAS script runs its search
- **Then** the email is found and processed

### Received-transfer keywords are captured
- **Given** an email with "has recibido una transferencia" in the body
- **When** the GAS script runs its search
- **Then** the email is found and processed

### Already-labeled messages are excluded
- **Given** an email already labeled SIPAP_Validador
- **When** the GAS script runs its search
- **Then** the email is NOT returned by the search
