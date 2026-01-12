-- =============================================================================
-- sm_current_stock.sql
-- CHT Stock Monitoring Workflow - Current Stock Levels View
-- =============================================================================
--
-- Purpose:
--   Calculates the current stock levels for each item at each facility by:
--   1. Finding the most recent stock count (baseline) for each item/facility
--   2. Adding all subsequent inbound transactions (qty_in)
--   3. Subtracting all subsequent outbound transactions (qty_out)
--
-- Dependencies:
--   - sm_transactions view (must be created first)
--
-- Output Columns:
--   - facility_id: ID of the facility (place)
--   - item_code: Stock item code/name
--   - current_qty: Calculated current stock quantity
--   - last_count_date: Date of the most recent stock count
--   - last_count_qty: Quantity from the most recent stock count
--   - total_qty_in: Total inbound quantity since last count
--   - total_qty_out: Total outbound quantity since last count
--   - last_transaction_date: Date of the most recent transaction
--   - transaction_count: Number of transactions since last count
--
-- Calculation Logic:
--   current_qty = last_count_qty + total_qty_in - total_qty_out
--
-- Usage:
--   Use this view to get real-time stock levels, identify facilities
--   with low stock, and track stock movements over time.
--
-- =============================================================================

CREATE OR REPLACE VIEW sm_current_stock AS

WITH last_stock_counts AS (
    -- Find the most recent stock count for each facility/item combination
    SELECT DISTINCT ON (facility_id, item_code)
        facility_id,
        item_code,
        qty_in AS count_qty,
        reported_date AS count_date,
        doc_id AS count_doc_id
    FROM
        sm_transactions
    WHERE
        is_count = true
        AND facility_id IS NOT NULL
        AND item_code IS NOT NULL
    ORDER BY
        facility_id,
        item_code,
        reported_date DESC
),

transactions_since_count AS (
    -- Get all non-count transactions after the last stock count
    SELECT
        t.facility_id,
        t.item_code,
        t.qty_in,
        t.qty_out,
        t.reported_date,
        t.doc_id,
        t.form_type,
        lc.count_date,
        lc.count_qty
    FROM
        sm_transactions t
    INNER JOIN
        last_stock_counts lc
        ON t.facility_id = lc.facility_id
        AND t.item_code = lc.item_code
    WHERE
        t.is_count = false
        AND t.reported_date > lc.count_date
),

aggregated_movements AS (
    -- Aggregate all movements since last count
    SELECT
        facility_id,
        item_code,
        SUM(qty_in) AS total_qty_in,
        SUM(qty_out) AS total_qty_out,
        MAX(reported_date) AS last_transaction_date,
        COUNT(*) AS transaction_count
    FROM
        transactions_since_count
    GROUP BY
        facility_id,
        item_code
)

SELECT
    lc.facility_id,
    lc.item_code,
    -- Calculate current quantity: last count + inbound - outbound
    GREATEST(
        0,
        lc.count_qty + COALESCE(am.total_qty_in, 0) - COALESCE(am.total_qty_out, 0)
    ) AS current_qty,
    lc.count_date AS last_count_date,
    lc.count_qty AS last_count_qty,
    COALESCE(am.total_qty_in, 0) AS total_qty_in,
    COALESCE(am.total_qty_out, 0) AS total_qty_out,
    COALESCE(am.last_transaction_date, lc.count_date) AS last_transaction_date,
    COALESCE(am.transaction_count, 0) AS transaction_count,
    -- Raw calculated value (can be negative if data issues)
    lc.count_qty + COALESCE(am.total_qty_in, 0) - COALESCE(am.total_qty_out, 0) AS raw_calculated_qty
FROM
    last_stock_counts lc
LEFT JOIN
    aggregated_movements am
    ON lc.facility_id = am.facility_id
    AND lc.item_code = am.item_code
ORDER BY
    lc.facility_id,
    lc.item_code;

-- =============================================================================
-- Alternative view for facilities without any stock counts
-- This captures items that only have transaction records but no baseline count
-- =============================================================================

CREATE OR REPLACE VIEW sm_current_stock_all AS

WITH all_facility_items AS (
    -- Get all unique facility/item combinations from all transactions
    SELECT DISTINCT
        facility_id,
        item_code
    FROM
        sm_transactions
    WHERE
        facility_id IS NOT NULL
        AND item_code IS NOT NULL
),

last_stock_counts AS (
    -- Find the most recent stock count for each facility/item combination
    SELECT DISTINCT ON (facility_id, item_code)
        facility_id,
        item_code,
        qty_in AS count_qty,
        reported_date AS count_date
    FROM
        sm_transactions
    WHERE
        is_count = true
        AND facility_id IS NOT NULL
    ORDER BY
        facility_id,
        item_code,
        reported_date DESC
),

all_transactions_agg AS (
    -- Aggregate all transactions (for items without counts)
    SELECT
        facility_id,
        item_code,
        SUM(qty_in) AS total_qty_in,
        SUM(qty_out) AS total_qty_out,
        MIN(reported_date) AS first_transaction_date,
        MAX(reported_date) AS last_transaction_date,
        COUNT(*) AS transaction_count
    FROM
        sm_transactions
    WHERE
        is_count = false
    GROUP BY
        facility_id,
        item_code
),

transactions_since_count AS (
    -- Aggregate transactions after last count (for items with counts)
    SELECT
        t.facility_id,
        t.item_code,
        SUM(t.qty_in) AS total_qty_in,
        SUM(t.qty_out) AS total_qty_out,
        MAX(t.reported_date) AS last_transaction_date,
        COUNT(*) AS transaction_count
    FROM
        sm_transactions t
    INNER JOIN
        last_stock_counts lc
        ON t.facility_id = lc.facility_id
        AND t.item_code = lc.item_code
    WHERE
        t.is_count = false
        AND t.reported_date > lc.count_date
    GROUP BY
        t.facility_id,
        t.item_code
)

SELECT
    afi.facility_id,
    afi.item_code,
    CASE
        WHEN lc.count_date IS NOT NULL THEN
            -- Has stock count: use count + subsequent movements
            GREATEST(0, lc.count_qty + COALESCE(tsc.total_qty_in, 0) - COALESCE(tsc.total_qty_out, 0))
        ELSE
            -- No stock count: use all transactions (qty_in - qty_out)
            GREATEST(0, COALESCE(ata.total_qty_in, 0) - COALESCE(ata.total_qty_out, 0))
    END AS current_qty,
    lc.count_date AS last_count_date,
    lc.count_qty AS last_count_qty,
    CASE
        WHEN lc.count_date IS NOT NULL THEN COALESCE(tsc.total_qty_in, 0)
        ELSE COALESCE(ata.total_qty_in, 0)
    END AS total_qty_in,
    CASE
        WHEN lc.count_date IS NOT NULL THEN COALESCE(tsc.total_qty_out, 0)
        ELSE COALESCE(ata.total_qty_out, 0)
    END AS total_qty_out,
    COALESCE(
        CASE
            WHEN lc.count_date IS NOT NULL THEN tsc.last_transaction_date
            ELSE ata.last_transaction_date
        END,
        lc.count_date
    ) AS last_transaction_date,
    CASE
        WHEN lc.count_date IS NOT NULL THEN COALESCE(tsc.transaction_count, 0)
        ELSE COALESCE(ata.transaction_count, 0)
    END AS transaction_count,
    CASE
        WHEN lc.count_date IS NOT NULL THEN true
        ELSE false
    END AS has_baseline_count
FROM
    all_facility_items afi
LEFT JOIN
    last_stock_counts lc
    ON afi.facility_id = lc.facility_id
    AND afi.item_code = lc.item_code
LEFT JOIN
    transactions_since_count tsc
    ON afi.facility_id = tsc.facility_id
    AND afi.item_code = tsc.item_code
LEFT JOIN
    all_transactions_agg ata
    ON afi.facility_id = ata.facility_id
    AND afi.item_code = ata.item_code
ORDER BY
    afi.facility_id,
    afi.item_code;

-- =============================================================================
-- Index recommendations for performance:
-- CREATE INDEX idx_sm_transactions_facility_item ON sm_transactions(facility_id, item_code);
-- CREATE INDEX idx_sm_transactions_is_count ON sm_transactions(is_count) WHERE is_count = true;
-- CREATE INDEX idx_sm_transactions_reported ON sm_transactions(reported_date);
-- =============================================================================
