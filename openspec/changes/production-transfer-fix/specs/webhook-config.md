# Spec: Webhook Configuration

## Requirement
The deployed GAS script must have correct BASE_API_URL, MERCHANT_SLUG, and WEBHOOK_SECRET values matching the database.

## Scenarios

### Correct configuration ingests transfers
- **Given** BASE_API_URL points to the real server, MERCHANT_SLUG matches the DB, WEBHOOK_SECRET matches the DB
- **When** the GAS script sends a webhook request
- **Then** the request succeeds (HTTP 200) and the transfer is stored

### Incorrect secret returns 401
- **Given** WEBHOOK_SECRET does not match the DB
- **When** the GAS script sends a webhook request
- **Then** the request fails with HTTP 401 and the message is not labeled

### Inactive merchant returns 403
- **Given** the merchant status is not active
- **When** the GAS script sends a webhook request
- **Then** the request fails with HTTP 403
