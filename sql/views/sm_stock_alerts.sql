-- =============================================================================
-- sm_stock_alerts.sql
-- CHT Stock Monitoring Workflow - Stock Alerts View
-- =============================================================================
--
-- Purpose:
--   Generates stock level alerts by comparing current stock quantities
--   against configured thresholds (warning_total and danger_total).
--   Identifies facilities and items that need attention due to low stock.
--
-- Dependencies:
--   - sm_current_stock view (must be created first)
--   - Stock item configuration with threshold values
--
-- Alert Levels:
--   - 'danger': Stock is at or below danger_total threshold (critical)
--   - 'warning': Stock is at or below warning_total threshold (needs attention)
--   - 'ok': Stock is above warning threshold (healthy)
--   - 'stockout': Stock is zero (no stock available)
--
-- Output Columns:
--   - facility_id: ID of the facility (place)
--   - item_code: Stock item code/name
--   - current_qty: Current stock quantity
--   - warning_threshold: Warning threshold from item configuration
--   - danger_threshold: Danger threshold from item configuration
--   - alert_level: Calculated alert status
--   - days_of_stock: Estimated days of stock remaining (if consumption rate known)
--   - last_count_date: Date of most recent stock count
--   - needs_reorder: Boolean flag for items needing reorder
--
-- Usage:
--   Use this view to generate stock alert reports, trigger notifications,
--   and prioritize restocking activities.
--
-- Note:
--   The item thresholds should be stored in a configuration table or
--   extracted from the stock monitoring configuration. This view provides
--   a template that can be customized based on how thresholds are stored.
--
-- =============================================================================

-- First, create a helper view/table for item thresholds
-- This should be populated from your stock monitoring configuration
-- Uncomment and modify based on your threshold storage method

/*
CREATE TABLE IF NOT EXISTS sm_item_thresholds (
    item_code VARCHAR(100) PRIMARY KEY,
    item_label VARCHAR(255),
    category VARCHAR(100),
    warning_total NUMERIC DEFAULT 10,
    danger_total NUMERIC DEFAULT 5,
    unit_label VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
*/

-- Alternative: Extract thresholds from CouchDB configuration documents
CREATE OR REPLACE VIEW sm_item_thresholds_from_config AS
SELECT
    item->>'name' AS item_code,
    item->>'label' AS item_label,
    item->>'category' AS category,
    COALESCE((item->>'warning_total')::numeric, 10) AS warning_total,
    COALESCE((item->>'danger_total')::numeric, 5) AS danger_total,
    item->'unit'->>'label' AS unit_label
FROM
    couchdb doc,
    jsonb_array_elements(doc.items) AS item
WHERE
    doc.type = 'stock_monitoring_config'
    OR doc._id LIKE '%stock-monitoring-config%';

-- =============================================================================
-- Main Stock Alerts View
-- =============================================================================

CREATE OR REPLACE VIEW sm_stock_alerts AS

WITH stock_with_thresholds AS (
    SELECT
        cs.facility_id,
        cs.item_code,
        cs.current_qty,
        cs.last_count_date,
        cs.last_transaction_date,
        cs.total_qty_out,
        cs.transaction_count,
        -- Get thresholds (use defaults if not configured)
        COALESCE(th.warning_total, 10) AS warning_threshold,
        COALESCE(th.danger_total, 5) AS danger_threshold,
        th.item_label,
        th.category,
        th.unit_label
    FROM
        sm_current_stock cs
    LEFT JOIN
        sm_item_thresholds_from_config th
        ON cs.item_code = th.item_code
),

-- Calculate consumption rate and days of stock
stock_with_metrics AS (
    SELECT
        *,
        -- Calculate days since last count for consumption rate
        EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_count_date)) / 86400.0 AS days_since_count,
        -- Average daily consumption (if we have outbound transactions)
        CASE
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_count_date)) > 86400
            THEN total_qty_out / (EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_count_date)) / 86400.0)
            ELSE 0
        END AS avg_daily_consumption
    FROM
        stock_with_thresholds
)

SELECT
    facility_id,
    item_code,
    item_label,
    category,
    unit_label,
    current_qty,
    warning_threshold,
    danger_threshold,
    -- Determine alert level
    CASE
        WHEN current_qty = 0 THEN 'stockout'
        WHEN current_qty <= danger_threshold THEN 'danger'
        WHEN current_qty <= warning_threshold THEN 'warning'
        ELSE 'ok'
    END AS alert_level,
    -- Calculate priority (lower = more urgent)
    CASE
        WHEN current_qty = 0 THEN 1
        WHEN current_qty <= danger_threshold THEN 2
        WHEN current_qty <= warning_threshold THEN 3
        ELSE 4
    END AS alert_priority,
    -- Estimated days of stock remaining
    CASE
        WHEN avg_daily_consumption > 0 THEN
            ROUND(current_qty / avg_daily_consumption, 1)
        ELSE NULL
    END AS estimated_days_of_stock,
    avg_daily_consumption,
    -- Flag for items needing reorder
    CASE
        WHEN current_qty <= warning_threshold THEN true
        ELSE false
    END AS needs_reorder,
    -- Suggested reorder quantity (to reach 2x warning threshold)
    CASE
        WHEN current_qty <= warning_threshold THEN
            GREATEST(0, (warning_threshold * 2) - current_qty)
        ELSE 0
    END AS suggested_reorder_qty,
    last_count_date,
    last_transaction_date,
    -- Days since last stock count
    ROUND(days_since_count, 0) AS days_since_last_count,
    -- Flag stale counts (more than 30 days old)
    CASE
        WHEN days_since_count > 30 THEN true
        ELSE false
    END AS count_is_stale,
    CURRENT_TIMESTAMP AS alert_generated_at
FROM
    stock_with_metrics
ORDER BY
    alert_priority ASC,
    facility_id,
    item_code;

-- =============================================================================
-- Filtered Views for Common Alert Queries
-- =============================================================================

-- View for only items with active alerts (not 'ok')
CREATE OR REPLACE VIEW sm_stock_alerts_active AS
SELECT *
FROM sm_stock_alerts
WHERE alert_level != 'ok'
ORDER BY alert_priority ASC, facility_id, item_code;

-- View for stockouts only
CREATE OR REPLACE VIEW sm_stock_alerts_stockout AS
SELECT *
FROM sm_stock_alerts
WHERE alert_level = 'stockout'
ORDER BY facility_id, item_code;

-- View for danger level alerts
CREATE OR REPLACE VIEW sm_stock_alerts_danger AS
SELECT *
FROM sm_stock_alerts
WHERE alert_level IN ('stockout', 'danger')
ORDER BY alert_priority ASC, facility_id, item_code;

-- View summarizing alerts by facility
CREATE OR REPLACE VIEW sm_stock_alerts_by_facility AS
SELECT
    facility_id,
    COUNT(*) AS total_items,
    COUNT(*) FILTER (WHERE alert_level = 'stockout') AS stockout_count,
    COUNT(*) FILTER (WHERE alert_level = 'danger') AS danger_count,
    COUNT(*) FILTER (WHERE alert_level = 'warning') AS warning_count,
    COUNT(*) FILTER (WHERE alert_level = 'ok') AS ok_count,
    COUNT(*) FILTER (WHERE needs_reorder = true) AS items_need_reorder,
    COUNT(*) FILTER (WHERE count_is_stale = true) AS stale_count_items,
    MIN(alert_priority) AS highest_priority,
    MAX(alert_generated_at) AS last_generated
FROM
    sm_stock_alerts
GROUP BY
    facility_id
ORDER BY
    highest_priority ASC,
    stockout_count DESC,
    danger_count DESC;

-- View summarizing alerts by item across all facilities
CREATE OR REPLACE VIEW sm_stock_alerts_by_item AS
SELECT
    item_code,
    item_label,
    category,
    COUNT(DISTINCT facility_id) AS facility_count,
    COUNT(*) FILTER (WHERE alert_level = 'stockout') AS facilities_stockout,
    COUNT(*) FILTER (WHERE alert_level = 'danger') AS facilities_danger,
    COUNT(*) FILTER (WHERE alert_level = 'warning') AS facilities_warning,
    COUNT(*) FILTER (WHERE alert_level = 'ok') AS facilities_ok,
    SUM(current_qty) AS total_qty_all_facilities,
    AVG(current_qty) AS avg_qty_per_facility,
    SUM(suggested_reorder_qty) AS total_suggested_reorder
FROM
    sm_stock_alerts
GROUP BY
    item_code,
    item_label,
    category
ORDER BY
    facilities_stockout DESC,
    facilities_danger DESC,
    item_code;

-- =============================================================================
-- Utility function for custom threshold lookup
-- Uncomment if using a thresholds table
-- =============================================================================

/*
CREATE OR REPLACE FUNCTION get_item_threshold(
    p_item_code VARCHAR,
    p_threshold_type VARCHAR DEFAULT 'warning'
) RETURNS NUMERIC AS $$
DECLARE
    v_threshold NUMERIC;
BEGIN
    SELECT
        CASE p_threshold_type
            WHEN 'warning' THEN warning_total
            WHEN 'danger' THEN danger_total
            ELSE warning_total
        END
    INTO v_threshold
    FROM sm_item_thresholds
    WHERE item_code = p_item_code
    AND is_active = true;

    RETURN COALESCE(v_threshold,
        CASE p_threshold_type
            WHEN 'warning' THEN 10
            WHEN 'danger' THEN 5
            ELSE 10
        END
    );
END;
$$ LANGUAGE plpgsql;
*/

-- =============================================================================
-- Index recommendations for performance:
-- CREATE INDEX idx_sm_current_stock_facility ON sm_current_stock(facility_id);
-- CREATE INDEX idx_sm_current_stock_item ON sm_current_stock(item_code);
-- CREATE INDEX idx_sm_stock_alerts_level ON sm_stock_alerts(alert_level);
-- =============================================================================
