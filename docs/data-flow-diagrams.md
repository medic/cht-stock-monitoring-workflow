# CHT Stock Monitoring Workflow - Data Flow Diagrams

This document provides visual representations of how data flows through the CHT Stock Monitoring Workflow system. Each diagram illustrates a specific workflow or process within the stock management system.

## Table of Contents

1. [Stock Count Flow](#1-stock-count-flow)
2. [Stock Supply Flow](#2-stock-supply-flow)
3. [Stock Return Flow](#3-stock-return-flow)
4. [Consumption Flow](#4-consumption-flow)
5. [Overall Data Flow](#5-overall-data-flow)

---

## 1. Stock Count Flow

The Stock Count workflow allows health workers to record their current stock levels. This serves as the baseline for all subsequent stock calculations.

```mermaid
flowchart TD
    subgraph User["Health Worker"]
        A[Open Stock Count Form]
    end

    subgraph Form["stock_count Form"]
        B[Select Items by Category]
        C[Enter Quantity for Each Item]
        D{Item has Set/Unit?}
        E[Enter as SET/UNIT format]
        F[Enter as Integer]
        G[Calculate Total Count]
        H[Display Summary]
    end

    subgraph Output["Form Output"]
        I[item_availables calculated]
        J[Form Submitted]
    end

    subgraph ContactSummary["Contact Summary"]
        K[stock_monitoring_ITEM_qty updated]
        L[Baseline for future calculations]
    end

    A --> B
    B --> C
    C --> D
    D -->|Yes| E
    D -->|No| F
    E --> G
    F --> G
    G --> H
    H --> I
    I --> J
    J --> K
    K --> L
```

### Key Points

- Stock count can be triggered as an **action form** (manual) or as a **task** (scheduled)
- Supports categorization of items for easier navigation
- Items can be counted in sets (e.g., boxes) plus loose units
- The formula for set/unit items: `total = (sets * set_count) + units`
- Stock count values become the baseline (`item_availables`) for all subsequent calculations

---

## 2. Stock Supply Flow

The Stock Supply workflow handles the complete chain of issuing stock from a supervisor to a health worker, with optional confirmation and discrepancy resolution.

```mermaid
flowchart TD
    subgraph Supervisor["Supervisor Actions"]
        A[Open Stock Supply Form]
        B[Select Recipient Place]
        C[Select Items to Supply]
        D[Enter Quantities]
        E[Submit Supply Form]
    end

    subgraph SupplyDoc["Additional Document Created"]
        F[stock_supply_doc generated]
        G{Confirmation Required?}
    end

    subgraph NoConfirm["Direct Supply Path"]
        H[Items added to CHW stock]
        I[Items deducted from Supervisor stock]
    end

    subgraph WithConfirm["Confirmation Path"]
        J[Task: Stock Received appears for CHW]
        K[CHW opens stock_received form]
        L{Quantities Match?}
    end

    subgraph Confirmed["Quantities Confirmed"]
        M[item_confirmed = item_received]
        N[Stock updated for CHW]
    end

    subgraph Discrepancy["Discrepancy Resolution"]
        O[CHW enters actual received qty]
        P[item_real_qty recorded]
        Q[Task: Discrepancy Resolution for Supervisor]
        R[Supervisor opens discrepancy form]
        S[Supervisor enters final qty]
        T[descrepancy_doc created]
        U[Stock adjusted for both parties]
    end

    A --> B --> C --> D --> E
    E --> F --> G
    G -->|No| H --> I
    G -->|Yes| J --> K --> L
    L -->|Yes| M --> N
    L -->|No| O --> P --> Q --> R --> S --> T --> U
```

### Form Chain Details

| Step | Form Name | Actor | Output Field |
|------|-----------|-------|--------------|
| 1 | `stock_supply` | Supervisor | `item_supply` |
| 2 | `stock_supply_doc` | System | Additional doc with `item_in` |
| 3 | `stock_received` | CHW | `item_confirmed` |
| 4 | `stock_discrepancy_resolution` | Supervisor | `item_in` (adjustment) |
| 5 | `descrepancy_doc` | System | `item_out` (correction) |

### Stock Calculations

- **Supervisor stock**: Decreases by `item_supply` when supply is issued
- **CHW stock**: Increases by `item_confirmed` (if confirmation active) or `item_in` (if direct)
- **Discrepancy adjustment**: `item_out = item_received - item_confirmed`

---

## 3. Stock Return Flow

The Stock Return workflow handles items being returned from a health worker back to the supervisor, with confirmation of receipt.

```mermaid
flowchart TD
    subgraph CHW["CHW Actions"]
        A[Open Stock Return Form]
        B[Select Items to Return]
        C[Select Return Reason]
        D{Other Reason?}
        E[Enter Custom Reason]
        F[Enter Return Quantity]
        G[View Before/After Stock]
        H[Submit Return Form]
    end

    subgraph ReturnOutput["Return Form Output"]
        I[item_out calculated]
        J[CHW stock reduced immediately]
    end

    subgraph SupervisorTask["Supervisor Confirmation"]
        K[Task: Stock Returned appears]
        L[Supervisor opens stock_returned form]
        M{Quantity Matches?}
    end

    subgraph Match["Quantities Match"]
        N[item_in = item_return]
        O[Supervisor stock increased]
    end

    subgraph NoMatch["Quantity Mismatch"]
        P[Supervisor enters actual received qty]
        Q[sm---stock_returned doc created]
        R[item_return_difference calculated]
        S[CHW stock adjusted by difference]
        T[Supervisor stock = actual received]
    end

    A --> B --> C --> D
    D -->|Yes| E --> F
    D -->|No| F
    F --> G --> H --> I --> J
    J --> K --> L --> M
    M -->|Yes| N --> O
    M -->|No| P --> Q --> R --> S --> T
```

### Return Reasons

The system supports predefined return reasons:
- Expired stock
- Damaged items
- Excess inventory
- Other (with free text)

### Stock Adjustments

| Scenario | CHW Stock | Supervisor Stock |
|----------|-----------|------------------|
| Return submitted | -`item_out` | No change yet |
| Confirmed (match) | No change | +`item_return` |
| Confirmed (mismatch) | +`item_return_difference` | +`item_received_qty` |

---

## 4. Consumption Flow

The Consumption flow tracks how stock items are used through clinical forms and manual logging.

```mermaid
flowchart TD
    subgraph Sources["Consumption Sources"]
        A[Clinical Forms]
        B[Stock Logs Form]
    end

    subgraph Clinical["Clinical Form Processing"]
        C[Patient Assessment Form]
        D[Prescription/Treatment]
        E[Items Used Recorded]
        F[prescription_summary doc created]
        G[item_used_in_FORMNAME field]
    end

    subgraph StockLogs["Manual Stock Logs"]
        H[Open stock_logs form]
        I[Select Date within 7 days]
        J[Select Items by Category]
        K[Enter Received Quantity]
        L[Enter Returned Quantity]
        M[item_received / item_returned]
    end

    subgraph Calculation["Stock Calculation"]
        N[Contact Summary Calculation]
        O[getItemCountFromLastStockCount]
        P{Report Type?}
    end

    subgraph Adjustments["Stock Adjustments"]
        Q[prescription_summary: SUBTRACT used items]
        R[stock_logs: ADD received, SUBTRACT returned]
        S[Final stock_monitoring_ITEM_qty]
    end

    A --> C --> D --> E --> F --> G
    B --> H --> I --> J --> K --> L --> M
    G --> N
    M --> N
    N --> O --> P
    P -->|prescription_summary| Q
    P -->|stock_logs| R
    Q --> S
    R --> S
```

### Clinical Form Integration

When clinical forms use stock items:
1. Form must include item usage fields
2. System creates `prescription_summary` additional document
3. Field format: `item_used_in_FORMNAME`
4. Items are automatically deducted from stock

### Stock Logs Form

The `stock_logs` form allows manual recording of:
- **Received items**: Items received outside the normal supply chain
- **Returned items**: Items returned or used outside clinical forms

Constraints:
- Date must be within the last 7 days
- Date cannot be in the future

---

## 5. Overall Data Flow

This comprehensive diagram shows how all forms and documents interact to maintain accurate stock levels in the contact-summary.

```mermaid
flowchart TD
    subgraph Baseline["Baseline Establishment"]
        SC[stock_count Form]
        SC --> |item_availables| BASE[Baseline Stock Level]
    end

    subgraph Inbound["Stock Inbound"]
        SS[stock_supply Form]
        SSD[stock_supply_doc]
        SR[stock_received Form]
        SL_R[stock_logs: received]
        STR[stock_returned Form]
        STRD[sm---stock_returned doc]

        SS --> SSD
        SSD --> |item_in| CALC
        SR --> |item_confirmed| CALC
        SL_R --> |item_received| CALC
        STR --> STRD
        STRD --> |item_return_difference| CALC
    end

    subgraph Outbound["Stock Outbound"]
        PS[prescription_summary]
        RET[stock_return Form]
        SL_T[stock_logs: returned]
        DIS[stock_discrepancy_resolution]
        DISD[descrepancy_doc]

        PS --> |item_used_in_FORM| CALC
        RET --> |item_out| CALC
        SL_T --> |item_returned| CALC
        DIS --> DISD
        DISD --> |item_out| CALC
    end

    subgraph Adjustments["Corrections"]
        DIS_IN[discrepancy: item_in]
        DIS_IN --> CALC
    end

    subgraph Calculation["Contact Summary Calculation"]
        BASE --> CALC[getItemCountFromLastStockCount]
        CALC --> |Processes all reports| FILTER[Filter reports since last stock_count]
        FILTER --> SWITCH{Form Type Switch}
    end

    subgraph FormProcessing["Form-specific Processing"]
        SWITCH --> |stock_supply_doc| ADD1[+ item_in]
        SWITCH --> |stock_received| ADD2[+ item_confirmed]
        SWITCH --> |stock_logs| ADD3[+ received - returned]
        SWITCH --> |prescription_summary| SUB1[- item_used]
        SWITCH --> |stock_return| SUB2[- item_out]
        SWITCH --> |descrepancy_doc| ADJ1[+ item_out correction]
        SWITCH --> |stock_returned| ADJ2[+ item_in]
        SWITCH --> |sm---stock_returned| ADJ3[+ item_return_difference]
        SWITCH --> |discrepancy_resolution| ADJ4[+ item_in adjustment]
    end

    subgraph Output["Final Output"]
        ADD1 --> TOTAL[stock_monitoring_ITEM_qty]
        ADD2 --> TOTAL
        ADD3 --> TOTAL
        SUB1 --> TOTAL
        SUB2 --> TOTAL
        ADJ1 --> TOTAL
        ADJ2 --> TOTAL
        ADJ3 --> TOTAL
        ADJ4 --> TOTAL
    end
```

### Document Types Summary

| Document | Form Constant | Purpose | Effect on Stock |
|----------|--------------|---------|-----------------|
| `stock_supply_doc` | `SUPPLY_ADDITIONAL_DOC` | Records items supplied to CHW | +items (if no confirmation) |
| `prescription_summary` | `FORM_ADDITIONAL_DOC_NAME` | Records items used in clinical forms | -items |
| `descrepancy_doc` | `DISCREPANCY_ADD_DOC` | Records supply discrepancy adjustments | +/- correction |
| `sm---stock_returned` | `RETURNED_ADD_DOC` | Records return quantity differences | + difference back to CHW |

### Stock Calculation Algorithm

The `getItemCountFromLastStockCount` function in `common.js` performs the following:

1. **Find baseline**: Get the most recent `stock_count` report
2. **Filter reports**: Get all relevant reports since the stock count
3. **Process each report**: Apply form-specific calculations
4. **Aggregate**: Sum all additions and subtractions
5. **Output**: Final quantity stored as `stock_monitoring_ITEM_qty`

```
Final Stock = Baseline (stock_count)
            + Supplies received (stock_supply_doc, stock_received)
            + Stock logs received
            + Return differences (sm---stock_returned)
            + Discrepancy adjustments
            - Items used (prescription_summary)
            - Items returned (stock_return)
            - Stock logs returned
```

### Consumption Tracking

The `getItemsConsumption` function calculates item consumption over a period:

1. **Period**: Can be `week` or `month`
2. **Lookback**: Examines reports from the past 3 periods
3. **Sources counted**:
   - `prescription_summary`: Items used in clinical forms
   - `stock_supply`: Items supplied (adds to consumption tracking)
   - `discrepancy_resolution`: Adjustments (subtracts from consumption)
   - `stock_returned`: Items returned (subtracts from consumption)

---

## Form Relationships

```mermaid
graph LR
    subgraph Level1["Supervisor Level"]
        SS[stock_supply]
        SDR[stock_discrepancy_resolution]
        SRET[stock_returned]
        SC1[stock_count]
    end

    subgraph Level2["CHW Level"]
        SR[stock_received]
        SRET2[stock_return]
        SL[stock_logs]
        SO[stock_order]
        SC2[stock_count]
        CF[Clinical Forms]
    end

    subgraph AdditionalDocs["System-Generated Documents"]
        SSD[stock_supply_doc]
        DD[descrepancy_doc]
        RD[sm---stock_returned]
        PS[prescription_summary]
    end

    SS -->|creates| SSD
    SS -->|triggers task| SR
    SR -->|if discrepancy| SDR
    SDR -->|creates| DD
    SRET2 -->|triggers task| SRET
    SRET -->|if discrepancy| RD
    CF -->|creates| PS
    SO -->|may trigger| SS
```

---

## Configuration Dependencies

The workflows depend on configuration settings in the stock monitoring config:

| Feature | Config Path | Required For |
|---------|-------------|--------------|
| Stock Count | `features.stock_count` | Baseline establishment |
| Stock Supply | `features.stock_supply` | Item distribution |
| Supply Confirmation | `features.stock_supply.confirm_supply.active` | Two-step supply verification |
| Discrepancy Resolution | `features.stock_supply.discrepancy` | Supply mismatch handling |
| Stock Return | `features.stock_return` | Item return workflow |
| Return Confirmation | `features.stock_return.confirmation` | Return verification |
| Stock Logs | `features.stock_logs` | Manual consumption tracking |
| Stock Order | `features.stock_order` | Order request workflow |

---

## Notes

- All stock quantities are stored and calculated in base units
- Set/unit items are converted to base units using: `total = sets * set_count + units`
- The contact-summary recalculates stock on every report sync
- Historical reports are filtered based on the most recent stock count date
- All timestamps use the Luxon library for consistent date handling
