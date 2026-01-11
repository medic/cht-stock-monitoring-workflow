-- =============================================================================
-- sm_doc_types.sql
-- CHT Stock Monitoring Workflow - Document Type Normalization View
-- =============================================================================
--
-- Purpose:
--   Normalizes document type names to handle legacy naming conventions,
--   typos, and variations in form names across different CHT deployments.
--   Maps old/variant names to standardized new names for consistent querying.
--
-- Background:
--   The CHT Stock Monitoring Workflow has evolved over time, and some
--   document type names were introduced with typos or inconsistent naming.
--   For backward compatibility, these original names are preserved in the
--   data, but this view provides a mapping to canonical names.
--
-- Key Mappings:
--   - 'descrepancy_doc' -> 'sm_discrepancy_doc' (typo preserved for compatibility)
--   - 'stock_supply_doc' -> 'sm_stock_supply_doc'
--   - 'sm---stock_returned' -> 'sm_stock_returned_doc'
--   - Various form name patterns normalized to 'sm_' prefix
--
-- Output Columns:
--   - original_form: The form name as stored in the document
--   - normalized_form: Standardized form name for querying
--   - form_category: High-level category (count, supply, order, return, etc.)
--   - direction: Stock movement direction (in, out, both, count)
--   - is_additional_doc: Whether this is an automatically generated document
--   - description: Human-readable description of the form type
--
-- Usage:
--   Join this view with transaction data to get consistent form type
--   categorization regardless of naming variations in the source data.
--
-- =============================================================================

CREATE OR REPLACE VIEW sm_doc_types AS

-- Define all known form types and their mappings
SELECT * FROM (
VALUES
    -- Stock Count forms
    ('stock_count', 'sm_stock_count', 'count', 'count', false,
     'Stock count form - captures current inventory levels as baseline'),

    -- Stock Supply forms (supplier issuing stock)
    ('stock_supply', 'sm_stock_supply', 'supply', 'out', false,
     'Stock supply form - supplier issues stock to facility'),
    ('stock_supply_doc', 'sm_stock_supply_doc', 'supply', 'in', true,
     'Stock supply document - auto-generated record of incoming stock'),

    -- Stock Received/Confirmation forms
    ('stock_received', 'sm_stock_received', 'supply', 'in', false,
     'Stock received form - facility confirms receipt of supplied stock'),

    -- Stock Discrepancy forms
    ('stock_discrepancy', 'sm_stock_discrepancy', 'discrepancy', 'in', false,
     'Stock discrepancy form - resolves differences between issued and received'),
    ('stock_discrepancy_resolution', 'sm_stock_discrepancy', 'discrepancy', 'in', false,
     'Stock discrepancy resolution form - alternate name for discrepancy form'),
    -- Note: 'descrepancy_doc' spelling is intentional for backward compatibility
    ('descrepancy_doc', 'sm_discrepancy_doc', 'discrepancy', 'out', true,
     'Discrepancy document - auto-generated adjustment record (legacy spelling)'),

    -- Stock Order forms
    ('stock_order', 'sm_stock_order', 'order', 'in', false,
     'Stock order form - facility orders stock from supplier'),
    ('stock_order_supply', 'sm_stock_order_supply', 'order', 'in', false,
     'Stock order supply form - supplier fulfills stock order'),

    -- Stock Return forms (facility returning stock)
    ('stock_return', 'sm_stock_return', 'return', 'out', false,
     'Stock return form - facility returns stock to supplier'),
    ('stock_returned', 'sm_stock_returned', 'return', 'out', false,
     'Stock returned form - supplier confirms receipt of returned stock'),
    ('sm---stock_returned', 'sm_stock_returned_doc', 'return', 'out', true,
     'Stock returned document - auto-generated return confirmation'),

    -- Stock Out forms (alerts/notifications)
    ('stock_out', 'sm_stock_out', 'alert', 'both', false,
     'Stock out form - records stock out situation/alert'),

    -- Stock Logs forms
    ('stock_logs', 'sm_stock_logs', 'logs', 'both', false,
     'Stock logs form - manual entry of received and returned quantities'),

    -- Prescription/Usage tracking (from form_update feature)
    ('prescription_summary', 'sm_prescription_summary', 'usage', 'out', true,
     'Prescription summary - auto-generated consumption record')

) AS t(original_form, normalized_form, form_category, direction, is_additional_doc, description);

-- =============================================================================
-- Mapping View - Join with actual documents
-- =============================================================================

CREATE OR REPLACE VIEW sm_documents_normalized AS
SELECT
    doc._id AS doc_id,
    doc.form AS original_form,
    COALESCE(dt.normalized_form, 'sm_' || doc.form) AS normalized_form,
    COALESCE(dt.form_category, 'unknown') AS form_category,
    COALESCE(dt.direction, 'unknown') AS direction,
    COALESCE(dt.is_additional_doc, false) AS is_additional_doc,
    dt.description AS form_description,
    doc.reported_date,
    COALESCE(
        doc.fields->>'place_id',
        doc.fields->>'supply_place_id',
        doc.fields->>'level_1_place_id',
        doc.contact->>'_id'
    ) AS facility_id,
    doc.fields->>'supplier_id' AS supplier_id,
    doc.contact->>'_id' AS contact_id,
    doc.fields AS fields
FROM
    couchdb doc
LEFT JOIN
    sm_doc_types dt ON doc.form = dt.original_form
WHERE
    doc.type = 'data_record'
    AND (
        doc.form LIKE '%stock%'
        OR doc.form LIKE '%descrepancy%'
        OR doc.form = 'prescription_summary'
    );

-- =============================================================================
-- Pattern-based Form Type Detection
-- For forms that may have custom prefixes/suffixes
-- =============================================================================

CREATE OR REPLACE VIEW sm_doc_types_detected AS
SELECT
    doc.form AS original_form,
    CASE
        -- Stock count patterns
        WHEN doc.form LIKE '%stock_count%' THEN 'sm_stock_count'
        WHEN doc.form LIKE '%stock%count%' THEN 'sm_stock_count'

        -- Stock supply patterns
        WHEN doc.form = 'stock_supply_doc' THEN 'sm_stock_supply_doc'
        WHEN doc.form LIKE '%stock_supply%' AND doc.form NOT LIKE '%doc%' THEN 'sm_stock_supply'

        -- Stock received patterns
        WHEN doc.form LIKE '%stock_received%' THEN 'sm_stock_received'
        WHEN doc.form LIKE '%confirm%supply%' THEN 'sm_stock_received'

        -- Discrepancy patterns (note the typo variant)
        WHEN doc.form = 'descrepancy_doc' THEN 'sm_discrepancy_doc'
        WHEN doc.form LIKE '%discrepancy%' THEN 'sm_stock_discrepancy'
        WHEN doc.form LIKE '%descrepancy%' THEN 'sm_stock_discrepancy'

        -- Order patterns
        WHEN doc.form LIKE '%order_supply%' THEN 'sm_stock_order_supply'
        WHEN doc.form LIKE '%stock_order%' THEN 'sm_stock_order'

        -- Return patterns
        WHEN doc.form = 'sm---stock_returned' THEN 'sm_stock_returned_doc'
        WHEN doc.form LIKE '%stock_returned%' THEN 'sm_stock_returned'
        WHEN doc.form LIKE '%stock_return%' THEN 'sm_stock_return'

        -- Stock out patterns
        WHEN doc.form LIKE '%stock_out%' THEN 'sm_stock_out'

        -- Stock logs patterns
        WHEN doc.form LIKE '%stock_log%' THEN 'sm_stock_logs'

        -- Prescription/usage patterns
        WHEN doc.form LIKE '%prescription%' THEN 'sm_prescription_summary'

        -- Default: add sm_ prefix
        ELSE 'sm_' || regexp_replace(doc.form, '^sm[-_]*', '')
    END AS normalized_form,
    CASE
        WHEN doc.form LIKE '%count%' THEN 'count'
        WHEN doc.form LIKE '%supply%' OR doc.form LIKE '%received%' THEN 'supply'
        WHEN doc.form LIKE '%order%' THEN 'order'
        WHEN doc.form LIKE '%return%' THEN 'return'
        WHEN doc.form LIKE '%discrepancy%' OR doc.form LIKE '%descrepancy%' THEN 'discrepancy'
        WHEN doc.form LIKE '%out%' THEN 'alert'
        WHEN doc.form LIKE '%log%' THEN 'logs'
        WHEN doc.form LIKE '%prescription%' THEN 'usage'
        ELSE 'other'
    END AS form_category,
    CASE
        -- Additional docs are auto-generated
        WHEN doc.form LIKE '%_doc' THEN true
        WHEN doc.form LIKE 'sm---%' THEN true
        WHEN doc.fields->>'created_from' IS NOT NULL THEN true
        ELSE false
    END AS is_additional_doc,
    COUNT(*) AS document_count,
    MIN(doc.reported_date) AS first_seen,
    MAX(doc.reported_date) AS last_seen
FROM
    couchdb doc
WHERE
    doc.type = 'data_record'
    AND (
        doc.form LIKE '%stock%'
        OR doc.form LIKE '%descrepancy%'
        OR doc.form = 'prescription_summary'
    )
GROUP BY
    doc.form
ORDER BY
    document_count DESC;

-- =============================================================================
-- Migration Helper View
-- Shows old form names that should be migrated (if needed)
-- =============================================================================

CREATE OR REPLACE VIEW sm_doc_types_migration_candidates AS
SELECT
    dt.original_form,
    dt.normalized_form,
    dt.form_category,
    dt.description,
    CASE
        -- Forms with typos or legacy naming
        WHEN dt.original_form = 'descrepancy_doc' THEN 'Legacy typo - keep for compatibility'
        WHEN dt.original_form LIKE 'sm---%' THEN 'Legacy separator format'
        WHEN dt.original_form != dt.normalized_form AND dt.original_form NOT LIKE 'sm_%' THEN 'Consider adding sm_ prefix'
        ELSE 'Standard naming'
    END AS migration_note,
    -- Check if this form type exists in the database
    EXISTS (
        SELECT 1 FROM couchdb WHERE form = dt.original_form LIMIT 1
    ) AS exists_in_database
FROM
    sm_doc_types dt
ORDER BY
    dt.form_category,
    dt.original_form;

-- =============================================================================
-- Form Direction Summary
-- Useful for understanding stock movement patterns
-- =============================================================================

CREATE OR REPLACE VIEW sm_form_directions AS
SELECT
    dt.form_category,
    dt.direction,
    array_agg(dt.original_form ORDER BY dt.original_form) AS form_types,
    COUNT(*) AS form_count
FROM
    sm_doc_types dt
GROUP BY
    dt.form_category,
    dt.direction
ORDER BY
    dt.form_category,
    dt.direction;

-- =============================================================================
-- Index recommendations for performance:
-- CREATE INDEX idx_couchdb_form_stock ON couchdb(form) WHERE form LIKE '%stock%';
-- CREATE INDEX idx_couchdb_type_data_record ON couchdb(type) WHERE type = 'data_record';
-- =============================================================================
