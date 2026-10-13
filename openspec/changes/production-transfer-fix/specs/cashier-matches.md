# Spec: Cashier Match List

## Requirement
When multiple pending transfers share the same amount, the cashier must see all matches with disambiguating data and select the correct one.

## Scenarios

### Multiple matches shown as list
- **Given** two pending transfers of Gs. 150.000 exist in the 45-minute window
- **When** the cashier searches by amount 150000
- **Then** both transfers are returned with payerName, payerBank, operationId, receiptNumber, operationDate

### Cashier selects and claims
- **Given** the cashier sees a list of matching transfers
- **When** the cashier taps one and confirms
- **Then** that specific transfer is claimed (atomic one-time claim)

### Empty identifier shows list
- **Given** the cashier enters only an amount with no identifier
- **When** the search executes
- **Then** all pending matches for that amount are returned (not not_found)

### Tenant scope preserved
- **Given** two merchants each have a pending transfer of the same amount
- **When** a cashier searches by amount
- **Then** only transfers belonging to the cashier's tenant are returned
