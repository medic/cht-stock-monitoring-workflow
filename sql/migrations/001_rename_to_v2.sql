-- =============================================================================
-- CHT Stock Monitoring Workflow: V1 to V2 Migration Script
-- =============================================================================
-- Version: 1.0.0
-- Created: 2026-01-11
-- Purpose: Migrate existing deployments from v1 to v2 naming conventions
--
-- INSTRUCTIONS:
-- 1. Review this script and adjust table/column names to match your deployment
-- 2. Backup your database before running this migration
-- 3. Run this script in a transaction (BEGIN/COMMIT) for safety
-- 4. Verify data integrity after migration
--
-- ROLLBACK:
-- To rollback, drop the sm_v2 schema:
--   DROP SCHEMA IF EXISTS sm_v2 CASCADE;
-- =============================================================================

-- -----------------------------------------------------------------------------
-- SECTION 1: Create New Schema
-- -----------------------------------------------------------------------------
-- The sm_v2 schema provides a clean namespace for the new v2 naming conventions
-- while preserving the original v1 data for backwards compatibility.

CREATE SCHEMA IF NOT EXISTS sm_v2;

COMMENT ON SCHEMA sm_v2 IS 'Stock Monitoring v2 schema with updated naming conventions';


-- -----------------------------------------------------------------------------
-- SECTION 2: Create Transactions Table with V2 Naming
-- -----------------------------------------------------------------------------
-- This table consolidates all stock transactions with consistent field naming.
-- Field name transformations from v1 to v2:
--   - item___count       -> sm_quantity
--   - item___set         -> sm_set_quantity
--   - item___unit        -> sm_unit_quantity
--   - item_availables    -> sm_available_quantity
--   - item_supply        -> sm_supply_quantity
--   - item_received      -> sm_received_quantity
--   - item_returned      -> sm_returned_quantity
--   - item_discrepancy   -> sm_discrepancy_quantity

CREATE TABLE IF NOT EXISTS sm_v2.transactions (
    -- Primary identification
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    doc_id                  TEXT NOT NULL,
    form_type               TEXT NOT NULL,

    -- Transaction metadata
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reported_date           TIMESTAMPTZ,
    contact_id              TEXT,
    contact_name            TEXT,
    parent_id               TEXT,
    parent_name             TEXT,

    -- Item identification
    item_code               TEXT NOT NULL,
    item_name               TEXT,
    category                TEXT,

    -- Quantity fields (v2 naming convention with sm_ prefix)
    sm_quantity             NUMERIC DEFAULT 0,        -- Total quantity (from item___count)
    sm_set_quantity         NUMERIC DEFAULT 0,        -- Set quantity (from item___set)
    sm_unit_quantity        NUMERIC DEFAULT 0,        -- Unit quantity (from item___unit)
    sm_available_quantity   NUMERIC DEFAULT 0,        -- Available after transaction
    sm_supply_quantity      NUMERIC DEFAULT 0,        -- Quantity supplied
    sm_received_quantity    NUMERIC DEFAULT 0,        -- Quantity received
    sm_returned_quantity    NUMERIC DEFAULT 0,        -- Quantity returned
    sm_discrepancy_quantity NUMERIC DEFAULT 0,        -- Discrepancy amount
    sm_ordered_quantity     NUMERIC DEFAULT 0,        -- Quantity ordered

    -- Additional metadata
    notes                   TEXT,
    source_form_id          TEXT,                     -- Reference to original form
    migration_source        TEXT DEFAULT 'v1',        -- Track data origin

    -- Constraints
    CONSTRAINT valid_form_type CHECK (form_type IN (
        'stock_count',
        'stock_supply',
        'stock_received',
        'stock_discrepancy',
        'stock_return',
        'stock_returned',
        'stock_order',
        'stock_out'
    ))
);

COMMENT ON TABLE sm_v2.transactions IS 'Consolidated stock transactions with v2 naming conventions';
COMMENT ON COLUMN sm_v2.transactions.sm_quantity IS 'Total quantity from item___count field';
COMMENT ON COLUMN sm_v2.transactions.sm_set_quantity IS 'Set quantity from item___set field (for items sold in sets)';
COMMENT ON COLUMN sm_v2.transactions.sm_unit_quantity IS 'Unit quantity from item___unit field';
COMMENT ON COLUMN sm_v2.transactions.sm_available_quantity IS 'Available quantity after transaction';
COMMENT ON COLUMN sm_v2.transactions.migration_source IS 'Indicates data source: v1 for migrated data, v2 for new data';


-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_doc_id
    ON sm_v2.transactions(doc_id);

CREATE INDEX IF NOT EXISTS idx_transactions_form_type
    ON sm_v2.transactions(form_type);

CREATE INDEX IF NOT EXISTS idx_transactions_item_code
    ON sm_v2.transactions(item_code);

CREATE INDEX IF NOT EXISTS idx_transactions_reported_date
    ON sm_v2.transactions(reported_date);

CREATE INDEX IF NOT EXISTS idx_transactions_contact_id
    ON sm_v2.transactions(contact_id);


-- -----------------------------------------------------------------------------
-- SECTION 3: Create Document Type Mapping View
-- -----------------------------------------------------------------------------
-- This view maps old document names to new standardized names.
-- Use this view when querying data that may contain either naming convention.
--
-- Mappings:
--   'stock_supply_doc'      -> 'sm_supply_doc'       (supply additional doc)
--   'descrepancy_doc'       -> 'sm_discrepancy_doc'  (discrepancy additional doc)
--   'sm---stock_returned'   -> 'sm_returned_doc'     (returned additional doc)
--   'prescription_summary'  -> 'sm_prescription_doc' (prescription form doc)

CREATE OR REPLACE VIEW sm_v2.document_type_mapping AS
SELECT
    old_name,
    new_name,
    description
FROM (
    VALUES
        ('stock_supply_doc',     'sm_supply_doc',       'Additional document created during stock supply'),
        ('descrepancy_doc',      'sm_discrepancy_doc',  'Additional document for stock discrepancy (note: v1 misspelling preserved)'),
        ('sm---stock_returned',  'sm_returned_doc',     'Additional document for stock returned'),
        ('prescription_summary', 'sm_prescription_doc', 'Prescription summary document from form updates')
) AS mapping(old_name, new_name, description);

COMMENT ON VIEW sm_v2.document_type_mapping IS 'Maps v1 document type names to v2 standardized names';


-- -----------------------------------------------------------------------------
-- SECTION 4: Helper Functions for Migration
-- -----------------------------------------------------------------------------
-- These functions assist in transforming data between v1 and v2 conventions.

-- Function to translate document type names from v1 to v2
CREATE OR REPLACE FUNCTION sm_v2.translate_doc_type(v1_doc_type TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN CASE v1_doc_type
        WHEN 'stock_supply_doc'     THEN 'sm_supply_doc'
        WHEN 'descrepancy_doc'      THEN 'sm_discrepancy_doc'
        WHEN 'sm---stock_returned'  THEN 'sm_returned_doc'
        WHEN 'prescription_summary' THEN 'sm_prescription_doc'
        ELSE v1_doc_type  -- Return unchanged if not a known v1 type
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION sm_v2.translate_doc_type IS 'Translates v1 document type names to v2 naming convention';


-- Function to translate field names from v1 to v2
CREATE OR REPLACE FUNCTION sm_v2.translate_field_name(v1_field_name TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
    item_prefix TEXT;
BEGIN
    -- Handle item-specific field patterns
    -- Pattern: {item_name}___count -> sm_quantity
    -- Pattern: {item_name}___set   -> sm_set_quantity
    -- Pattern: {item_name}___unit  -> sm_unit_quantity
    -- Pattern: {item_name}_availables -> sm_available_quantity
    -- Pattern: {item_name}_supply -> sm_supply_quantity
    -- Pattern: {item_name}_received -> sm_received_quantity
    -- Pattern: {item_name}_returned -> sm_returned_quantity
    -- Pattern: {item_name}_discrepancy -> sm_discrepancy_quantity

    IF v1_field_name ~ '___count$' THEN
        RETURN 'sm_quantity';
    ELSIF v1_field_name ~ '___set$' THEN
        RETURN 'sm_set_quantity';
    ELSIF v1_field_name ~ '___unit$' THEN
        RETURN 'sm_unit_quantity';
    ELSIF v1_field_name ~ '_availables$' THEN
        RETURN 'sm_available_quantity';
    ELSIF v1_field_name ~ '_supply$' THEN
        RETURN 'sm_supply_quantity';
    ELSIF v1_field_name ~ '_received$' THEN
        RETURN 'sm_received_quantity';
    ELSIF v1_field_name ~ '_returned$' THEN
        RETURN 'sm_returned_quantity';
    ELSIF v1_field_name ~ '_discrepancy$' THEN
        RETURN 'sm_discrepancy_quantity';
    ELSE
        RETURN v1_field_name;  -- Return unchanged
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION sm_v2.translate_field_name IS 'Translates v1 field naming patterns to v2 conventions';


-- Function to extract item code from v1 field name
CREATE OR REPLACE FUNCTION sm_v2.extract_item_code(v1_field_name TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Remove known suffixes to extract item code
    IF v1_field_name ~ '___count$' THEN
        RETURN regexp_replace(v1_field_name, '___count$', '');
    ELSIF v1_field_name ~ '___set$' THEN
        RETURN regexp_replace(v1_field_name, '___set$', '');
    ELSIF v1_field_name ~ '___unit$' THEN
        RETURN regexp_replace(v1_field_name, '___unit$', '');
    ELSIF v1_field_name ~ '_availables$' THEN
        RETURN regexp_replace(v1_field_name, '_availables$', '');
    ELSIF v1_field_name ~ '_supply$' THEN
        RETURN regexp_replace(v1_field_name, '_supply$', '');
    ELSIF v1_field_name ~ '_received$' THEN
        RETURN regexp_replace(v1_field_name, '_received$', '');
    ELSIF v1_field_name ~ '_returned$' THEN
        RETURN regexp_replace(v1_field_name, '_returned$', '');
    ELSIF v1_field_name ~ '_discrepancy$' THEN
        RETURN regexp_replace(v1_field_name, '_discrepancy$', '');
    ELSE
        RETURN v1_field_name;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION sm_v2.extract_item_code IS 'Extracts the item code from a v1 field name by removing known suffixes';


-- -----------------------------------------------------------------------------
-- SECTION 5: Form Type Reference View
-- -----------------------------------------------------------------------------
-- This view provides a reference for all supported form types and their purposes.

CREATE OR REPLACE VIEW sm_v2.form_types AS
SELECT
    form_type,
    description,
    primary_quantity_field,
    creates_additional_doc
FROM (
    VALUES
        ('stock_count',       'Physical inventory count',                   'sm_quantity',            FALSE),
        ('stock_supply',      'Issue stock to lower-level facility',        'sm_supply_quantity',     TRUE),
        ('stock_received',    'Record stock received from supplier',        'sm_received_quantity',   FALSE),
        ('stock_discrepancy', 'Record stock discrepancy after verification','sm_discrepancy_quantity',TRUE),
        ('stock_return',      'Return stock to upper-level facility',       'sm_returned_quantity',   FALSE),
        ('stock_returned',    'Receive returned stock from lower facility', 'sm_returned_quantity',   TRUE),
        ('stock_order',       'Place order for stock replenishment',        'sm_ordered_quantity',    FALSE),
        ('stock_out',         'Record stock out event',                     'sm_quantity',            FALSE)
) AS types(form_type, description, primary_quantity_field, creates_additional_doc);

COMMENT ON VIEW sm_v2.form_types IS 'Reference view of all supported stock monitoring form types';


-- -----------------------------------------------------------------------------
-- SECTION 6: Migration Audit Log
-- -----------------------------------------------------------------------------
-- Track migration operations for auditing and troubleshooting.

CREATE TABLE IF NOT EXISTS sm_v2.migration_log (
    id              SERIAL PRIMARY KEY,
    migration_name  TEXT NOT NULL,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    records_migrated INTEGER DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending',
    error_message   TEXT,
    executed_by     TEXT DEFAULT current_user
);

COMMENT ON TABLE sm_v2.migration_log IS 'Audit log for tracking migration operations';

-- Insert migration record
INSERT INTO sm_v2.migration_log (migration_name, status, records_migrated)
VALUES ('001_rename_to_v2', 'completed', 0);


-- -----------------------------------------------------------------------------
-- MIGRATION COMPLETE
-- -----------------------------------------------------------------------------
--
-- Next Steps:
-- 1. Verify the schema was created: SELECT * FROM sm_v2.document_type_mapping;
-- 2. Test the translation functions:
--    SELECT sm_v2.translate_doc_type('stock_supply_doc');
--    SELECT sm_v2.translate_field_name('paracetamol___count');
--    SELECT sm_v2.extract_item_code('paracetamol_availables');
-- 3. Create data migration scripts specific to your deployment
-- 4. Update application code to use new field names
--
-- For questions or issues, refer to the CHT Stock Monitoring Workflow documentation.
-- =============================================================================
