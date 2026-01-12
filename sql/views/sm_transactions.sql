-- =============================================================================
-- sm_transactions.sql
-- CHT Stock Monitoring Workflow - Stock Transactions View
-- =============================================================================
--
-- Purpose:
--   Transforms the wide-format CouchDB stock data into a normalized long format
--   for easier querying and analysis. Extracts item quantities from various
--   stock monitoring forms and normalizes them into a consistent structure.
--
-- Source Forms and Field Patterns:
--   - stock_count: {item_name}_availables (qty_in = count, qty_out = 0, is_count = true)
--   - stock_supply: {item_name}_supply (qty_in)
--   - stock_supply_doc: {item_name}_in (qty_in from supply confirmation)
--   - stock_received: {item_name}_confirmed (qty_in)
--   - stock_order: {item_name}_ordered (qty_in expected)
--   - stock_order_supply: {item_name}_in (qty_in from order fulfillment)
--   - stock_return: {item_name}_out (qty_out)
--   - stock_returned: {item_name}_out (qty_out confirmed)
--   - stock_discrepancy: {item_name}_in (adjustment qty_in)
--   - descrepancy_doc: {item_name}_out (adjustment qty_out)
--   - stock_logs: {item_name}_received (qty_in), {item_name}_returned (qty_out)
--
-- Output Columns:
--   - doc_id: CouchDB document ID
--   - form_type: Form identifier (e.g., 'stock_count', 'stock_supply')
--   - item_code: Stock item code/name
--   - qty_in: Quantity received/counted in
--   - qty_out: Quantity issued/returned out
--   - reported_date: Timestamp when the form was reported
--   - facility_id: ID of the facility (place) where transaction occurred
--   - is_count: Boolean flag indicating if this is a stock count (baseline)
--
-- Usage:
--   This view serves as the foundation for stock level calculations,
--   transaction history, and audit trails.
--
-- =============================================================================

CREATE OR REPLACE VIEW sm_transactions AS

-- Stock Count transactions (baseline counts)
-- Field pattern: {item_name}_availables
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_availables$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id',
        doc.contact->>'parent'
    ) AS facility_id,
    true AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_count%'
    AND key LIKE '%_availables'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Supply transactions (items supplied/issued)
-- Field pattern: {item_name}_supply
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_supply$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.fields->>'supply_place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_supply%'
    AND doc.form NOT LIKE '%stock_supply_doc%'
    AND doc.form NOT LIKE '%stock_order_supply%'
    AND key LIKE '%_supply'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Supply Doc transactions (supply document - qty in to recipient)
-- Field pattern: {item_name}_in
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_in$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form = 'stock_supply_doc'
    AND key LIKE '%_in'
    AND key NOT IN ('created_from', 'logged_in')
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Received/Confirmed transactions
-- Field pattern: {item_name}_confirmed
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_confirmed$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_received%'
    AND key LIKE '%_confirmed'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Order transactions (items ordered - pending receipt)
-- Field pattern: {item_name}_ordered
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_ordered$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_order%'
    AND doc.form NOT LIKE '%stock_order_supply%'
    AND key LIKE '%_ordered'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Order Supply transactions (order fulfillment - qty in)
-- Field pattern: {item_name}_in
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_in$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_order_supply%'
    AND key LIKE '%_in'
    AND key NOT IN ('created_from', 'logged_in')
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Return transactions (items returned out from facility)
-- Field pattern: {item_name}_out
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_out$', '') AS item_code,
    0 AS qty_in,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_return%'
    AND doc.form NOT LIKE '%stock_returned%'
    AND key LIKE '%_out'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Returned confirmation transactions (returned items confirmed out)
-- Field pattern: {item_name}_out
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_out$', '') AS item_code,
    0 AS qty_in,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_returned%'
    AND key LIKE '%_out'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Discrepancy transactions (adjustment qty in)
-- Field pattern: {item_name}_in
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_in$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.fields->>'level_1_place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_discrepancy%'
    AND key LIKE '%_in'
    AND key NOT IN ('created_from', 'logged_in')
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Discrepancy Doc transactions (adjustment qty out)
-- Note: 'descrepancy_doc' spelling is intentional for backward compatibility
-- Field pattern: {item_name}_out
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_out$', '') AS item_code,
    0 AS qty_in,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_out,
    COALESCE(doc.reported_date, doc.fields->>'reported_date')::timestamp AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form = 'descrepancy_doc'
    AND key LIKE '%_out'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Logs - Received quantities
-- Field pattern: {item_name}_received
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_received$', '') AS item_code,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_in,
    0 AS qty_out,
    COALESCE(
        (doc.fields->>'reported_date')::timestamp,
        doc.reported_date
    ) AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_logs%'
    AND key LIKE '%_received'
    AND key NOT IN ('date_received')
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL

UNION ALL

-- Stock Logs - Returned quantities
-- Field pattern: {item_name}_returned
SELECT
    doc._id AS doc_id,
    doc.form AS form_type,
    regexp_replace(key, '_returned$', '') AS item_code,
    0 AS qty_in,
    COALESCE((doc.fields->>key)::numeric, 0) AS qty_out,
    COALESCE(
        (doc.fields->>'reported_date')::timestamp,
        doc.reported_date
    ) AS reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    false AS is_count
FROM
    couchdb doc,
    jsonb_object_keys(doc.fields) AS key
WHERE
    doc.type = 'data_record'
    AND doc.form LIKE '%stock_logs%'
    AND key LIKE '%_returned'
    AND doc.fields->>key IS NOT NULL
    AND (doc.fields->>key)::numeric IS NOT NULL;

-- =============================================================================
-- Index recommendations for performance:
-- CREATE INDEX idx_couchdb_form ON couchdb(form) WHERE type = 'data_record';
-- CREATE INDEX idx_couchdb_reported_date ON couchdb(reported_date);
-- CREATE INDEX idx_couchdb_fields_place ON couchdb((fields->>'place_id'));
-- =============================================================================
