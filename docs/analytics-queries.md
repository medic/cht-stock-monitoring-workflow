# Analytics Queries for CHT Stock Monitoring

This document provides ready-to-use PostgreSQL queries for common analytics needs in the CHT Stock Monitoring Workflow system. These queries are designed to work with the stock monitoring data synced to PostgreSQL via cht-sync.

## Schema Assumptions

All queries assume the following table structure:

```sql
-- Main transactions table
CREATE TABLE sm_transactions (
    doc_id TEXT PRIMARY KEY,
    form_type TEXT NOT NULL,
    item_code TEXT NOT NULL,
    qty_in INTEGER DEFAULT 0,
    qty_out INTEGER DEFAULT 0,
    reported_date TIMESTAMP NOT NULL,
    facility_id TEXT NOT NULL
);

-- Optional: Items reference table
CREATE TABLE sm_items (
    item_code TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    category TEXT,
    unit TEXT,
    warning_total INTEGER,
    danger_total INTEGER
);

-- Optional: Facilities reference table
CREATE TABLE sm_facilities (
    facility_id TEXT PRIMARY KEY,
    facility_name TEXT NOT NULL,
    parent_id TEXT,
    level INTEGER
);
```

---

## 1. Current Stock Levels

### 1.1 Stock by Facility

Returns the current stock balance for each item at each facility.

```sql
-- Current stock levels by facility
-- Calculates running balance as sum of all qty_in minus qty_out
SELECT
    t.facility_id,
    f.facility_name,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_in) AS total_received,
    SUM(t.qty_out) AS total_dispensed,
    SUM(t.qty_in) - SUM(t.qty_out) AS current_stock
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
GROUP BY t.facility_id, f.facility_name, t.item_code, i.label
ORDER BY f.facility_name, i.label;
```

### 1.2 Stock by Item (System-wide)

Returns aggregate stock levels across all facilities for each item.

```sql
-- System-wide stock levels by item
SELECT
    t.item_code,
    i.label AS item_name,
    i.category,
    COUNT(DISTINCT t.facility_id) AS facilities_with_stock,
    SUM(t.qty_in) AS total_received,
    SUM(t.qty_out) AS total_dispensed,
    SUM(t.qty_in) - SUM(t.qty_out) AS total_current_stock
FROM sm_transactions t
LEFT JOIN sm_items i ON t.item_code = i.item_code
GROUP BY t.item_code, i.label, i.category
ORDER BY i.category, i.label;
```

### 1.3 Low Stock Alerts

Identifies facilities with stock below warning or danger thresholds.

```sql
-- Low stock alerts: items below warning or danger thresholds
WITH current_stock AS (
    SELECT
        t.facility_id,
        t.item_code,
        SUM(t.qty_in) - SUM(t.qty_out) AS stock_balance
    FROM sm_transactions t
    GROUP BY t.facility_id, t.item_code
)
SELECT
    cs.facility_id,
    f.facility_name,
    cs.item_code,
    i.label AS item_name,
    cs.stock_balance,
    i.warning_total,
    i.danger_total,
    CASE
        WHEN cs.stock_balance <= i.danger_total THEN 'DANGER'
        WHEN cs.stock_balance <= i.warning_total THEN 'WARNING'
        ELSE 'OK'
    END AS alert_level
FROM current_stock cs
JOIN sm_items i ON cs.item_code = i.item_code
LEFT JOIN sm_facilities f ON cs.facility_id = f.facility_id
WHERE cs.stock_balance <= i.warning_total
ORDER BY
    CASE
        WHEN cs.stock_balance <= i.danger_total THEN 1
        ELSE 2
    END,
    f.facility_name,
    i.label;
```

### 1.4 Stock Status Summary Dashboard

Provides a summary count of items by alert status for each facility.

```sql
-- Stock status summary: count of items by alert level per facility
WITH current_stock AS (
    SELECT
        t.facility_id,
        t.item_code,
        SUM(t.qty_in) - SUM(t.qty_out) AS stock_balance
    FROM sm_transactions t
    GROUP BY t.facility_id, t.item_code
),
stock_status AS (
    SELECT
        cs.facility_id,
        cs.item_code,
        CASE
            WHEN cs.stock_balance <= COALESCE(i.danger_total, 0) THEN 'DANGER'
            WHEN cs.stock_balance <= COALESCE(i.warning_total, 0) THEN 'WARNING'
            ELSE 'OK'
        END AS alert_level
    FROM current_stock cs
    LEFT JOIN sm_items i ON cs.item_code = i.item_code
)
SELECT
    ss.facility_id,
    f.facility_name,
    COUNT(*) FILTER (WHERE alert_level = 'DANGER') AS danger_count,
    COUNT(*) FILTER (WHERE alert_level = 'WARNING') AS warning_count,
    COUNT(*) FILTER (WHERE alert_level = 'OK') AS ok_count,
    COUNT(*) AS total_items
FROM stock_status ss
LEFT JOIN sm_facilities f ON ss.facility_id = f.facility_id
GROUP BY ss.facility_id, f.facility_name
ORDER BY danger_count DESC, warning_count DESC;
```

---

## 2. Consumption Analysis

### 2.1 Weekly Consumption by Item

Calculates consumption (qty_out) aggregated by week.

```sql
-- Weekly consumption by item
SELECT
    DATE_TRUNC('week', t.reported_date) AS week_start,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_out) AS weekly_consumption,
    COUNT(DISTINCT t.facility_id) AS facilities_reporting
FROM sm_transactions t
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE t.qty_out > 0
GROUP BY DATE_TRUNC('week', t.reported_date), t.item_code, i.label
ORDER BY week_start DESC, weekly_consumption DESC;
```

### 2.2 Monthly Consumption by Item

Calculates consumption aggregated by month with year-over-year comparison.

```sql
-- Monthly consumption by item with trend
SELECT
    DATE_TRUNC('month', t.reported_date) AS month,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_out) AS monthly_consumption,
    LAG(SUM(t.qty_out)) OVER (
        PARTITION BY t.item_code
        ORDER BY DATE_TRUNC('month', t.reported_date)
    ) AS previous_month_consumption,
    ROUND(
        (SUM(t.qty_out) - LAG(SUM(t.qty_out)) OVER (
            PARTITION BY t.item_code
            ORDER BY DATE_TRUNC('month', t.reported_date)
        ))::NUMERIC / NULLIF(LAG(SUM(t.qty_out)) OVER (
            PARTITION BY t.item_code
            ORDER BY DATE_TRUNC('month', t.reported_date)
        ), 0) * 100, 2
    ) AS percent_change
FROM sm_transactions t
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE t.qty_out > 0
GROUP BY DATE_TRUNC('month', t.reported_date), t.item_code, i.label
ORDER BY month DESC, monthly_consumption DESC;
```

### 2.3 Consumption Trends Over Time

Shows rolling average consumption to identify trends.

```sql
-- Consumption trends: 4-week rolling average
WITH weekly_consumption AS (
    SELECT
        DATE_TRUNC('week', t.reported_date) AS week_start,
        t.item_code,
        SUM(t.qty_out) AS weekly_qty
    FROM sm_transactions t
    WHERE t.qty_out > 0
    GROUP BY DATE_TRUNC('week', t.reported_date), t.item_code
)
SELECT
    wc.week_start,
    wc.item_code,
    i.label AS item_name,
    wc.weekly_qty,
    ROUND(AVG(wc.weekly_qty) OVER (
        PARTITION BY wc.item_code
        ORDER BY wc.week_start
        ROWS BETWEEN 3 PRECEDING AND CURRENT ROW
    ), 2) AS rolling_4week_avg
FROM weekly_consumption wc
LEFT JOIN sm_items i ON wc.item_code = i.item_code
ORDER BY wc.item_code, wc.week_start DESC;
```

### 2.4 Top Consumed Items

Identifies the most consumed items over a specified period.

```sql
-- Top 10 consumed items in the last 30 days
SELECT
    t.item_code,
    i.label AS item_name,
    i.category,
    SUM(t.qty_out) AS total_consumption,
    COUNT(DISTINCT t.facility_id) AS facilities_consuming,
    COUNT(DISTINCT DATE_TRUNC('day', t.reported_date)) AS days_with_consumption
FROM sm_transactions t
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE t.qty_out > 0
  AND t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.item_code, i.label, i.category
ORDER BY total_consumption DESC
LIMIT 10;
```

### 2.5 Consumption by Facility

Shows consumption patterns broken down by facility.

```sql
-- Consumption by facility for the last 30 days
SELECT
    t.facility_id,
    f.facility_name,
    f.level AS facility_level,
    COUNT(DISTINCT t.item_code) AS items_consumed,
    SUM(t.qty_out) AS total_consumption,
    COUNT(DISTINCT DATE_TRUNC('day', t.reported_date)) AS active_days
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
WHERE t.qty_out > 0
  AND t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.facility_id, f.facility_name, f.level
ORDER BY total_consumption DESC;
```

---

## 3. Supply Chain Metrics

### 3.1 Supply Chain Flow (In vs Out)

Analyzes the balance between incoming and outgoing stock.

```sql
-- Supply chain flow: monthly in vs out comparison
SELECT
    DATE_TRUNC('month', t.reported_date) AS month,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_in) AS total_in,
    SUM(t.qty_out) AS total_out,
    SUM(t.qty_in) - SUM(t.qty_out) AS net_change,
    CASE
        WHEN SUM(t.qty_out) = 0 THEN NULL
        ELSE ROUND(SUM(t.qty_in)::NUMERIC / SUM(t.qty_out), 2)
    END AS supply_to_consumption_ratio
FROM sm_transactions t
LEFT JOIN sm_items i ON t.item_code = i.item_code
GROUP BY DATE_TRUNC('month', t.reported_date), t.item_code, i.label
ORDER BY month DESC, t.item_code;
```

### 3.2 Supply Chain Flow by Facility

Shows in/out balance at the facility level.

```sql
-- Supply chain flow by facility (last 30 days)
SELECT
    t.facility_id,
    f.facility_name,
    SUM(t.qty_in) AS total_received,
    SUM(t.qty_out) AS total_dispensed,
    SUM(t.qty_in) - SUM(t.qty_out) AS net_stock_change,
    COUNT(DISTINCT t.item_code) AS items_transacted,
    COUNT(t.doc_id) AS transaction_count
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
WHERE t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.facility_id, f.facility_name
ORDER BY net_stock_change DESC;
```

### 3.3 Discrepancy Rates

Analyzes stock discrepancies from stock count forms.

```sql
-- Discrepancy analysis from stock count forms
-- Assumes form_type contains 'stock_count' or 'discrepancy' for relevant forms
WITH stock_counts AS (
    SELECT
        t.facility_id,
        t.item_code,
        t.reported_date,
        t.qty_in AS counted_qty,
        -- Calculate expected stock at time of count
        (SELECT SUM(t2.qty_in) - SUM(t2.qty_out)
         FROM sm_transactions t2
         WHERE t2.facility_id = t.facility_id
           AND t2.item_code = t.item_code
           AND t2.reported_date < t.reported_date
        ) AS expected_qty
    FROM sm_transactions t
    WHERE t.form_type LIKE '%stock_count%'
       OR t.form_type LIKE '%discrepancy%'
)
SELECT
    sc.facility_id,
    f.facility_name,
    sc.item_code,
    i.label AS item_name,
    sc.reported_date,
    sc.expected_qty,
    sc.counted_qty,
    sc.counted_qty - COALESCE(sc.expected_qty, 0) AS discrepancy,
    CASE
        WHEN COALESCE(sc.expected_qty, 0) = 0 THEN NULL
        ELSE ROUND(
            ABS(sc.counted_qty - sc.expected_qty)::NUMERIC / sc.expected_qty * 100,
            2
        )
    END AS discrepancy_percent
FROM stock_counts sc
LEFT JOIN sm_facilities f ON sc.facility_id = f.facility_id
LEFT JOIN sm_items i ON sc.item_code = i.item_code
WHERE sc.counted_qty != COALESCE(sc.expected_qty, sc.counted_qty)
ORDER BY ABS(sc.counted_qty - COALESCE(sc.expected_qty, 0)) DESC;
```

### 3.4 Discrepancy Summary by Facility

Aggregates discrepancy metrics by facility.

```sql
-- Discrepancy summary by facility
WITH discrepancies AS (
    SELECT
        t.facility_id,
        t.item_code,
        ABS(t.qty_in - t.qty_out) AS discrepancy_qty
    FROM sm_transactions t
    WHERE t.form_type LIKE '%discrepancy%'
)
SELECT
    d.facility_id,
    f.facility_name,
    COUNT(*) AS discrepancy_count,
    SUM(d.discrepancy_qty) AS total_discrepancy_qty,
    ROUND(AVG(d.discrepancy_qty), 2) AS avg_discrepancy_qty,
    COUNT(DISTINCT d.item_code) AS items_with_discrepancies
FROM discrepancies d
LEFT JOIN sm_facilities f ON d.facility_id = f.facility_id
GROUP BY d.facility_id, f.facility_name
ORDER BY total_discrepancy_qty DESC;
```

### 3.5 Average Time to Receive Supplies

Calculates the time between order and receipt of supplies.

```sql
-- Average time to receive supplies
-- Assumes 'stock_order' and 'stock_received' form types exist
WITH orders AS (
    SELECT
        t.facility_id,
        t.item_code,
        t.doc_id AS order_doc_id,
        t.reported_date AS order_date,
        t.qty_out AS ordered_qty
    FROM sm_transactions t
    WHERE t.form_type LIKE '%stock_order%'
),
receipts AS (
    SELECT
        t.facility_id,
        t.item_code,
        t.reported_date AS receipt_date,
        t.qty_in AS received_qty
    FROM sm_transactions t
    WHERE t.form_type LIKE '%stock_received%'
)
SELECT
    o.facility_id,
    f.facility_name,
    o.item_code,
    i.label AS item_name,
    o.order_date,
    MIN(r.receipt_date) AS first_receipt_date,
    EXTRACT(DAY FROM MIN(r.receipt_date) - o.order_date) AS days_to_receive,
    o.ordered_qty,
    SUM(r.received_qty) AS total_received
FROM orders o
LEFT JOIN receipts r ON o.facility_id = r.facility_id
    AND o.item_code = r.item_code
    AND r.receipt_date >= o.order_date
LEFT JOIN sm_facilities f ON o.facility_id = f.facility_id
LEFT JOIN sm_items i ON o.item_code = i.item_code
GROUP BY o.facility_id, f.facility_name, o.item_code, i.label,
         o.order_date, o.ordered_qty, o.order_doc_id
HAVING MIN(r.receipt_date) IS NOT NULL
ORDER BY days_to_receive DESC;
```

### 3.6 Supply Lead Time Summary

Summarizes average lead times by facility and item.

```sql
-- Average supply lead time by facility
WITH order_receipt_pairs AS (
    SELECT
        o.facility_id,
        o.item_code,
        o.reported_date AS order_date,
        MIN(r.reported_date) AS receipt_date
    FROM sm_transactions o
    JOIN sm_transactions r ON o.facility_id = r.facility_id
        AND o.item_code = r.item_code
        AND r.reported_date > o.reported_date
        AND r.form_type LIKE '%stock_received%'
    WHERE o.form_type LIKE '%stock_order%'
    GROUP BY o.facility_id, o.item_code, o.reported_date, o.doc_id
)
SELECT
    orp.facility_id,
    f.facility_name,
    COUNT(*) AS completed_orders,
    ROUND(AVG(EXTRACT(DAY FROM orp.receipt_date - orp.order_date)), 1) AS avg_lead_time_days,
    MIN(EXTRACT(DAY FROM orp.receipt_date - orp.order_date)) AS min_lead_time_days,
    MAX(EXTRACT(DAY FROM orp.receipt_date - orp.order_date)) AS max_lead_time_days
FROM order_receipt_pairs orp
LEFT JOIN sm_facilities f ON orp.facility_id = f.facility_id
GROUP BY orp.facility_id, f.facility_name
ORDER BY avg_lead_time_days DESC;
```

---

## 4. Operational Reports

### 4.1 Stock Count Completion Rates

Tracks stock count form submissions by facility.

```sql
-- Stock count completion rates by facility (last 30 days)
WITH expected_counts AS (
    -- Assumes weekly stock counts are expected
    SELECT
        f.facility_id,
        f.facility_name,
        4 AS expected_count_submissions  -- 4 weeks in 30 days
    FROM sm_facilities f
),
actual_counts AS (
    SELECT
        t.facility_id,
        COUNT(DISTINCT DATE_TRUNC('week', t.reported_date)) AS weeks_with_count
    FROM sm_transactions t
    WHERE t.form_type LIKE '%stock_count%'
      AND t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY t.facility_id
)
SELECT
    ec.facility_id,
    ec.facility_name,
    ec.expected_count_submissions,
    COALESCE(ac.weeks_with_count, 0) AS actual_count_submissions,
    ROUND(
        COALESCE(ac.weeks_with_count, 0)::NUMERIC / ec.expected_count_submissions * 100,
        1
    ) AS completion_rate_percent
FROM expected_counts ec
LEFT JOIN actual_counts ac ON ec.facility_id = ac.facility_id
ORDER BY completion_rate_percent ASC;
```

### 4.2 Forms Submitted by Facility

Breaks down form submissions by type and facility.

```sql
-- Form submissions by facility and type (last 30 days)
SELECT
    t.facility_id,
    f.facility_name,
    t.form_type,
    COUNT(*) AS submission_count,
    COUNT(DISTINCT DATE_TRUNC('day', t.reported_date)) AS days_with_submissions,
    MIN(t.reported_date) AS first_submission,
    MAX(t.reported_date) AS last_submission
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
WHERE t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY t.facility_id, f.facility_name, t.form_type
ORDER BY f.facility_name, submission_count DESC;
```

### 4.3 Form Submission Trends

Shows daily and weekly trends in form submissions.

```sql
-- Daily form submission trends
SELECT
    DATE_TRUNC('day', t.reported_date) AS submission_date,
    t.form_type,
    COUNT(*) AS submissions,
    COUNT(DISTINCT t.facility_id) AS facilities_reporting
FROM sm_transactions t
WHERE t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', t.reported_date), t.form_type
ORDER BY submission_date DESC, submissions DESC;
```

### 4.4 Data Quality Checks

Identifies potential data quality issues.

```sql
-- Data quality check: Identify potential issues
SELECT
    'Negative stock balance' AS issue_type,
    t.facility_id,
    f.facility_name,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_in) - SUM(t.qty_out) AS stock_balance,
    NULL AS details
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
GROUP BY t.facility_id, f.facility_name, t.item_code, i.label
HAVING SUM(t.qty_in) - SUM(t.qty_out) < 0

UNION ALL

-- Unusually high single transactions
SELECT
    'High quantity transaction' AS issue_type,
    t.facility_id,
    f.facility_name,
    t.item_code,
    i.label AS item_name,
    GREATEST(t.qty_in, t.qty_out) AS stock_balance,
    t.doc_id AS details
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE t.qty_in > 1000 OR t.qty_out > 1000

UNION ALL

-- Missing item codes (transactions without matching items)
SELECT DISTINCT
    'Unknown item code' AS issue_type,
    t.facility_id,
    f.facility_name,
    t.item_code,
    NULL AS item_name,
    NULL AS stock_balance,
    NULL AS details
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE i.item_code IS NULL

ORDER BY issue_type, facility_name;
```

### 4.5 Inactive Facilities

Identifies facilities that have not reported recently.

```sql
-- Inactive facilities: No transactions in the last 14 days
SELECT
    f.facility_id,
    f.facility_name,
    f.level AS facility_level,
    MAX(t.reported_date) AS last_transaction_date,
    EXTRACT(DAY FROM CURRENT_TIMESTAMP - MAX(t.reported_date)) AS days_since_activity,
    COUNT(t.doc_id) AS total_transactions
FROM sm_facilities f
LEFT JOIN sm_transactions t ON f.facility_id = t.facility_id
GROUP BY f.facility_id, f.facility_name, f.level
HAVING MAX(t.reported_date) < CURRENT_DATE - INTERVAL '14 days'
    OR MAX(t.reported_date) IS NULL
ORDER BY last_transaction_date ASC NULLS FIRST;
```

### 4.6 Submission Frequency Analysis

Analyzes how often facilities submit forms.

```sql
-- Submission frequency analysis by facility
WITH daily_submissions AS (
    SELECT
        t.facility_id,
        DATE_TRUNC('day', t.reported_date) AS submission_day,
        COUNT(*) AS daily_count
    FROM sm_transactions t
    WHERE t.reported_date >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY t.facility_id, DATE_TRUNC('day', t.reported_date)
)
SELECT
    ds.facility_id,
    f.facility_name,
    COUNT(ds.submission_day) AS active_days,
    30 - COUNT(ds.submission_day) AS inactive_days,
    SUM(ds.daily_count) AS total_submissions,
    ROUND(AVG(ds.daily_count), 2) AS avg_submissions_per_active_day,
    ROUND(SUM(ds.daily_count)::NUMERIC / 30, 2) AS avg_submissions_per_day
FROM daily_submissions ds
LEFT JOIN sm_facilities f ON ds.facility_id = f.facility_id
GROUP BY ds.facility_id, f.facility_name
ORDER BY active_days DESC;
```

---

## 5. Additional Utility Queries

### 5.1 Transaction Audit Log

Provides a detailed view of recent transactions for auditing.

```sql
-- Recent transaction audit log
SELECT
    t.doc_id,
    t.form_type,
    t.facility_id,
    f.facility_name,
    t.item_code,
    i.label AS item_name,
    t.qty_in,
    t.qty_out,
    t.reported_date,
    DATE_TRUNC('day', t.reported_date) AS transaction_date
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
ORDER BY t.reported_date DESC
LIMIT 100;
```

### 5.2 Stock Snapshot at a Point in Time

Calculates stock levels as of a specific date.

```sql
-- Stock snapshot as of a specific date
-- Replace '2024-01-01' with desired date
SELECT
    t.facility_id,
    f.facility_name,
    t.item_code,
    i.label AS item_name,
    SUM(t.qty_in) - SUM(t.qty_out) AS stock_at_date
FROM sm_transactions t
LEFT JOIN sm_facilities f ON t.facility_id = f.facility_id
LEFT JOIN sm_items i ON t.item_code = i.item_code
WHERE t.reported_date <= '2024-01-01'::TIMESTAMP
GROUP BY t.facility_id, f.facility_name, t.item_code, i.label
ORDER BY f.facility_name, i.label;
```

### 5.3 Form Type Distribution

Shows the distribution of different form types in the system.

```sql
-- Form type distribution
SELECT
    t.form_type,
    COUNT(*) AS transaction_count,
    COUNT(DISTINCT t.facility_id) AS facilities_using,
    COUNT(DISTINCT t.item_code) AS items_affected,
    MIN(t.reported_date) AS first_occurrence,
    MAX(t.reported_date) AS last_occurrence
FROM sm_transactions t
GROUP BY t.form_type
ORDER BY transaction_count DESC;
```

---

## Notes

1. **Table/View Names**: These queries assume the base table is named `sm_transactions`. Adjust the table names according to your actual PostgreSQL schema created by cht-sync.

2. **Date Ranges**: Many queries use `CURRENT_DATE - INTERVAL '30 days'` for filtering. Adjust this interval based on your reporting needs.

3. **Performance**: For large datasets, consider:
   - Adding indexes on `facility_id`, `item_code`, `reported_date`, and `form_type`
   - Creating materialized views for frequently-run complex queries
   - Partitioning the transactions table by date

4. **Form Types**: The queries assume form types follow patterns like `stock_count`, `stock_order`, `stock_received`, `discrepancy`. Adjust the LIKE patterns to match your actual form type naming conventions.

5. **Thresholds**: Warning and danger thresholds are assumed to be stored in the `sm_items` table. If these are stored elsewhere or calculated differently, adjust the queries accordingly.

6. **Null Handling**: Queries include COALESCE and NULL checks to handle missing data gracefully. Review these for your specific data quality requirements.
