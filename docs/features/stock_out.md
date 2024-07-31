# Stock out

The stock out feature allows you to create an stock out task for level 2 if level 1 has low stock.

## Inputs

1. Form Name: The name/ID of the stock out form.
2. Form Title: The title of the stock order form.
3. Formula:
    - If weekly_qty, there is low stock if the stock number is less than 2 times the estimated weekly consumption.
    - Otherwise, there is low stock if the stock count is less than item.danger_total.

## Results

When inventory for _Level 1_ reaches a *critical* level, a task is automatically created for _Level 2_ to ensure there is enough inventory to meet demand. The task will appear in _Level 2_ users' profile so they can take action to replenish inventory.

## Data:

When the stock out task is created, the document contains the following information:

- Item ID: The identifier of the item for which the stock out is reported.
- Stock Level: The current stock level of the item.
- Estimated Weekly Consumption: The estimated quantity of the item consumed each week.
- Stock out Quantity: The quantity of item needed to cover the stock out.
- Required Action: The action required to replenish stock, for example, placing an order or transferring stock from another location.

This information allows _Level 2_ users to understand the out-of-stock situation and take the necessary measures to restore stock within the necessary time frame.
