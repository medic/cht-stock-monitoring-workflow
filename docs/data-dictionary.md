# CHT Stock Monitoring Workflow - Data Dictionary

This document provides a comprehensive reference for all data structures, field naming conventions, and document types used in the CHT Stock Monitoring Workflow system.

## Table of Contents

- [Document Types](#document-types)
- [Field Reference](#field-reference)
- [Relationships](#relationships)
- [Naming Conventions](#naming-conventions)

---

## Document Types

The following document types are created by the stock monitoring workflow forms:

| Type | Description | Created By (Form) | Key Fields |
|------|-------------|-------------------|------------|
| `stock_count` | Records current stock levels at a location | Stock Count form | `{item}___count`, `{item}___set`, `{item}___unit`, `place_id`, `date_id` |
| `stock_supply` | Records stock issued to a lower-level facility | Stock Supply form | `supply_{item}`, `{item}___count`, `supply_place_id`, `user_contact_id` |
| `stock_supply_doc` | Additional document created when stock is supplied (for recipient tracking) | Stock Supply form, Stock Order Supply form | `{item}_in`, `place_id`, `supplier_id`, `need_confirmation` |
| `stock_received` | Confirms receipt of supplied stock | Stock Received form | `{item}_received`, `{item}_confirmed`, `{item}_real_qty`, `supplier_id`, `supply_doc_id` |
| `descrepancy_doc` | Records discrepancy resolution between issued and confirmed quantities (Note: intentionally misspelled for backward compatibility) | Stock Discrepancy Resolution form | `{item}_out`, `{item}_in`, `confirmation_id` |
| `stock_return` | Records stock returned from a lower-level facility | Stock Return form | `{item}_returned_qty`, `{item}___count`, `{item}_out`, `{item}_return_reason` |
| `sm---stock_returned` | Additional document created when returned stock is confirmed | Stock Returned form | `{item}_in`, `{item}_return_difference`, `return_id` |
| `stock_order` | Records a stock order request | Stock Order form | `{item}_order_qty`, `{item}___count`, `{item}_ordered`, `{item}_current`, `{item}_after` |
| `stock_order_supply` | Fulfills a stock order | Stock Order Supply form | `supply_{item}`, `{item}_supply`, `order_id`, `s_order_id` |
| `stock_logs` | Records consumption logs (received and returned items) | Stock Logs form | `{item}_received`, `{item}_returned`, `reported_date` |
| `stock_out` | Task form shown when stock is below threshold | Stock Out form | `{item}_at_hand`, `{item}_required` |

---

## Field Reference

### Triple Underscore Patterns (`___`)

These fields use triple underscores and are primarily used for set/unit calculations and computed values:

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `{item}___count` | calculate | All stock forms | Total quantity in base units (calculated from sets and units) | `paracetamol___count INTEGER` |
| `{item}___set` | calculate | Stock Count, Stock Supply, Stock Received, Stock Return, Stock Order, Stock Discrepancy | Number of complete sets (e.g., boxes of 10) | `paracetamol___set INTEGER` |
| `{item}___unit` | calculate | Stock Count, Stock Supply, Stock Received, Stock Return, Stock Order, Stock Discrepancy | Number of individual units beyond complete sets | `paracetamol___unit INTEGER` |
| `{item}___current___set` | calculate | Stock Order | Current stock quantity as sets | `paracetamol___current___set INTEGER` |
| `{item}___current___unit` | calculate | Stock Order | Current stock quantity as units | `paracetamol___current___unit INTEGER` |
| `{item}___after___set` | calculate | Stock Order | Projected stock quantity as sets after order | `paracetamol___after___set INTEGER` |
| `{item}___after___unit` | calculate | Stock Order | Projected stock quantity as units after order | `paracetamol___after___unit INTEGER` |
| `{item}__received___set` | calculate | Stock Received | Received quantity as sets | `paracetamol__received___set INTEGER` |
| `{item}__received___unit` | calculate | Stock Received | Received quantity as units | `paracetamol__received___unit INTEGER` |
| `{item}__return___set` | calculate | Stock Returned | Return quantity as sets | `paracetamol__return___set INTEGER` |
| `{item}__return___unit` | calculate | Stock Returned | Return quantity as units | `paracetamol__return___unit INTEGER` |
| `{item}__issued___set` | calculate | Stock Discrepancy | Issued quantity as sets | `paracetamol__issued___set INTEGER` |
| `{item}__issued___unit` | calculate | Stock Discrepancy | Issued quantity as units | `paracetamol__issued___unit INTEGER` |
| `{item}__confirmed___set` | calculate | Stock Discrepancy | Confirmed quantity as sets | `paracetamol__confirmed___set INTEGER` |
| `{item}__confirmed___unit` | calculate | Stock Discrepancy | Confirmed quantity as units | `paracetamol__confirmed___unit INTEGER` |
| `{item}_before___set` | calculate | Stock Return | Stock before return as sets | `paracetamol_before___set INTEGER` |
| `{item}_before___unit` | calculate | Stock Return | Stock before return as units | `paracetamol_before___unit INTEGER` |
| `{item}_after___set` | calculate | Stock Return | Stock after return as sets | `paracetamol_after___set INTEGER` |
| `{item}_after___unit` | calculate | Stock Return | Stock after return as units | `paracetamol_after___unit INTEGER` |
| `{item}_ordered___set` | calculate | Stock Order Supply | Ordered quantity as sets | `paracetamol_ordered___set INTEGER` |
| `{item}_ordered___unit` | calculate | Stock Order Supply | Ordered quantity as units | `paracetamol_ordered___unit INTEGER` |
| `{item}_at_hand___set` | calculate | Stock Out | Current stock at hand as sets | `paracetamol_at_hand___set INTEGER` |
| `{item}_at_hand___unit` | calculate | Stock Out | Current stock at hand as units | `paracetamol_at_hand___unit INTEGER` |
| `{item}_required___set` | calculate | Stock Out | Required stock level as sets | `paracetamol_required___set INTEGER` |
| `{item}_required___unit` | calculate | Stock Out | Required stock level as units | `paracetamol_required___unit INTEGER` |

### Input/Output Fields (`_in`, `_out`)

These fields track stock movement direction:

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `{item}_in` | calculate | Stock Supply Doc, Stock Returned Doc, Stock Discrepancy | Quantity added to recipient's stock | `paracetamol_in INTEGER` |
| `{item}_out` | calculate | Stock Return, Stock Discrepancy Doc | Quantity removed from location's stock | `paracetamol_out INTEGER` |

### Supply Fields (`supply_`)

Fields prefixed with `supply_` are used for stock issuance:

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `supply_{item}` | integer/string | Stock Supply, Stock Order Supply | Quantity being supplied (string format "sets/units" if isInSet) | `supply_paracetamol INTEGER` or `supply_paracetamol VARCHAR` |
| `{item}_supply` | calculate | Stock Supply, Stock Order Supply | Calculated total supply quantity in base units | `paracetamol_supply INTEGER` |
| `supply_place_id` | calculate | Stock Supply, Stock Order Supply, Stock Discrepancy | ID of the place receiving supply | `supply_place_id VARCHAR(255)` |
| `supplier_id` | calculate | Stock Supply Doc, Stock Returned Doc | ID of the user supplying stock | `supplier_id VARCHAR(255)` |
| `supply_doc_id` | hidden | Stock Received | Reference to the supply document being confirmed | `supply_doc_id VARCHAR(255)` |
| `supply_confirm_id` | hidden | Stock Discrepancy | Reference to the confirmation document | `supply_confirm_id VARCHAR(255)` |

### Quantity and State Fields

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `{item}_current` | calculate | Stock Supply, Stock Return, Stock Order | Current stock quantity from contact-summary | `paracetamol_current INTEGER` |
| `{item}_availables` | calculate | Stock Count | Available stock quantity | `paracetamol_availables INTEGER` |
| `{item}_received` | hidden/calculate | Stock Received, Stock Logs | Quantity received | `paracetamol_received INTEGER` |
| `{item}_confirmed` | calculate/hidden | Stock Received, Stock Discrepancy | Confirmed received quantity | `paracetamol_confirmed INTEGER` |
| `{item}_real_qty` | integer/string | Stock Received, Stock Discrepancy | Actual quantity received (when different from expected) | `paracetamol_real_qty INTEGER` |
| `{item}_qty` | decimal/string | Stock Discrepancy | Final resolved quantity | `paracetamol_qty DECIMAL` |
| `{item}_returned` | calculate | Stock Logs | Quantity returned in logs | `paracetamol_returned INTEGER` |
| `{item}_returned_qty` | integer/string | Stock Return | Quantity being returned | `paracetamol_returned_qty INTEGER` |
| `{item}_return` | hidden | Stock Returned | Return quantity from task | `paracetamol_return INTEGER` |
| `{item}_return_difference` | calculate | Stock Returned Doc | Difference between expected and actual return | `paracetamol_return_difference INTEGER` |
| `{item}_order_qty` | integer/string | Stock Order | Quantity being ordered | `paracetamol_order_qty INTEGER` |
| `{item}_ordered` | calculate/hidden | Stock Order, Stock Order Supply | Total ordered quantity | `paracetamol_ordered INTEGER` |
| `{item}_after` | calculate | Stock Return, Stock Order | Projected quantity after transaction | `paracetamol_after INTEGER` |
| `{item}_at_hand` | hidden | Stock Out | Current quantity at hand | `paracetamol_at_hand INTEGER` |
| `{item}_required` | hidden | Stock Out | Required/threshold quantity | `paracetamol_required INTEGER` |
| `have_receive_{item}_qty` | select_one | Stock Received, Stock Returned | Yes/No confirmation of receipt | `have_receive_paracetamol_qty VARCHAR(10)` |

### Return Reason Fields

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `{item}_return_reason` | select_multiple | Stock Return | Reason(s) for returning stock | `paracetamol_return_reason VARCHAR(255)` |
| `{item}_reason_note` | text | Stock Return | Additional notes when reason is "other" | `paracetamol_reason_note TEXT` |

### Selection and Category Fields

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `categories` | select_multiple | Stock Supply, Stock Return, Stock Order, Stock Logs | Selected item categories | `categories VARCHAR(255)` |
| `{category}_items_selected` | select_multiple | Stock Supply, Stock Return, Stock Order, Stock Logs | Items selected within a category | `medication_items_selected VARCHAR(255)` |
| `list_items_selected` | select_multiple | Stock Return, Stock Order, Stock Logs | Selected items (when not using categories) | `list_items_selected VARCHAR(255)` |
| `selected_items` | select_multiple | Stock Supply | Selected items for supply (non-category mode) | `selected_items VARCHAR(255)` |

### Reference and ID Fields

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `place_id` | calculate | All forms | ID of the place/facility | `place_id VARCHAR(255)` |
| `user_contact_id` | calculate | Stock Supply, Stock Order Supply, Stock Discrepancy, Stock Returned | ID of the user submitting the form | `user_contact_id VARCHAR(255)` |
| `level_1_place_id` | hidden | Stock Discrepancy, Stock Returned | ID of the level 1 place | `level_1_place_id VARCHAR(255)` |
| `order_id` | hidden | Stock Order Supply | ID of the order being fulfilled | `order_id VARCHAR(255)` |
| `s_order_id` | calculate | Stock Order Supply Doc | Reference to stock order | `s_order_id VARCHAR(255)` |
| `confirmation_id` | calculate | Stock Discrepancy Doc | Reference to confirmation | `confirmation_id VARCHAR(255)` |
| `return_id` | calculate | Stock Returned Doc | Reference to return document | `return_id VARCHAR(255)` |
| `stock_return_id` | hidden | Stock Returned | Reference to stock return form | `stock_return_id VARCHAR(255)` |
| `date_id` | hidden | Stock Count | Date identifier | `date_id VARCHAR(255)` |
| `created_from` | calculate | Additional docs | Reference to parent form | `created_from VARCHAR(255)` |

### Internal Prefixed Fields (`_` prefix)

Used in Stock Logs to avoid conflicts:

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `_{item}_received` | decimal | Stock Logs | Quantity received (input field) | `_paracetamol_received DECIMAL` |
| `_{item}_returned` | decimal | Stock Logs | Quantity returned (input field) | `_paracetamol_returned DECIMAL` |

### Document Metadata Fields

| Field Pattern | Type | Form(s) | Description | Example PostgreSQL Column |
|---------------|------|---------|-------------|---------------------------|
| `form` | calculate | Additional docs | Form type identifier | `form VARCHAR(50)` |
| `type` | calculate | Additional docs | Always "data_record" | `type VARCHAR(20)` |
| `content_type` | calculate | Additional docs | Always "xml" | `content_type VARCHAR(10)` |
| `need_confirmation` | calculate | Stock Supply Doc | Whether supply needs confirmation ("yes"/"no") | `need_confirmation VARCHAR(5)` |
| `contact._id` | calculate | Additional docs | Contact ID for the document | `contact__id VARCHAR(255)` |

---

## Relationships

The following table shows parent-child relationships between document types:

| Parent Document | Child Document | Link Field | Description |
|-----------------|----------------|------------|-------------|
| Stock Supply form | `stock_supply_doc` | `created_from` (db-doc-ref) | Supply triggers creation of recipient document |
| Stock Order Supply form | `stock_supply_doc` | `created_from` (db-doc-ref) | Order fulfillment creates supply document |
| `stock_supply_doc` | Stock Received form | `supply_doc_id` | Confirmation references supply document |
| Stock Received form | Stock Discrepancy task | `{item}_received`, `{item}_confirmed` | Discrepancy detected when quantities differ |
| Stock Discrepancy form | `descrepancy_doc` | `created_from` (db-doc-ref), `confirmation_id` | Resolution creates discrepancy document |
| Stock Return form | Stock Returned task | `{item}_out` (via task) | Return triggers confirmation task |
| Stock Returned form | `sm---stock_returned` | `created_from` (db-doc-ref), `return_id` | Confirmation creates returned document |
| Stock Order form | Stock Order Supply task | `{item}_ordered` (via task) | Order triggers supply task |
| Stock Count form | Contact Summary | `{item}___count` | Stock quantities populate contact summary |

---

## Naming Conventions

### Current Patterns (Note: Some inconsistencies exist)

1. **Triple Underscore (`___`)**: Used for calculated breakdown values
   - Format: `{item}___count`, `{item}___set`, `{item}___unit`
   - Also: `{item}___{context}___{breakdown}` (e.g., `{item}___current___set`)

2. **Double Underscore (`__`)**: Used in some received/return calculations
   - Format: `{item}__received___set`, `{item}__return___set`
   - Note: This is inconsistent with triple underscore pattern

3. **Prefix Patterns**:
   - `supply_`: Stock being issued (e.g., `supply_paracetamol`)
   - `_`: Internal fields in Stock Logs (e.g., `_paracetamol_received`)

4. **Suffix Patterns**:
   - `_in`: Stock incoming to a location
   - `_out`: Stock outgoing from a location
   - `_current`: Current stock level
   - `_after`: Projected stock after transaction
   - `_received`: Quantity received
   - `_confirmed`: Confirmed quantity
   - `_returned`: Returned quantity
   - `_ordered`: Ordered quantity
   - `_supply`: Supply calculation result
   - `_qty`: Quantity input/value
   - `_real_qty`: Actual quantity (when different from expected)

5. **Document Type Names**:
   - `stock_supply_doc`: Standard naming with underscore separator
   - `descrepancy_doc`: Intentional misspelling preserved for backward compatibility
   - `sm---stock_returned`: Uses triple hyphen prefix (inconsistent with other patterns)

### Group Naming

Groups in forms use the pattern `___{item}` (triple underscore prefix) to encapsulate item-specific fields:
```
begin group: ___paracetamol
  ... item fields ...
end group
```

### Contact Summary Integration

Stock quantities are exposed to contact summary using the pattern:
```
stock_monitoring_{item}_qty
```

Example: `instance('contact-summary')/context/stock_monitoring_paracetamol_qty`

---

## Notes on Data Types

### String vs Integer for Set/Unit Input

When an item uses sets (e.g., boxes of 10 tablets):
- Input fields use **string** type with format validation: `"^\\d+\\/\\d+$"` (e.g., "2/5" for 2 boxes and 5 units)
- Default value: `"0/0"`
- Calculated fields extract and compute: `{item}___set * set_count + {item}___unit = {item}___count`

When an item does not use sets:
- Input fields use **integer** or **decimal** type
- Default value: `0`
- Count field equals input: `{item}___count = {item}` or `{item}___count = {item}_qty`

### Boolean/Confirmation Fields

Yes/No confirmations use `select_one yes_no` type with values:
- `"yes"` - Confirmed/Affirmative
- `"no"` - Not confirmed/Negative

### Reference Fields

All reference/ID fields should be stored as `VARCHAR(255)` to accommodate CouchDB document IDs which are typically UUIDs.
