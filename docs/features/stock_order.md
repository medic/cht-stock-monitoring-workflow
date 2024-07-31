# Stock order

This feature allows you to have an action form to order a stock of products at a defined level of the hierarchy (from a level N, the order being addressed to a level N+1).

By defining this feature, we define information about the Stock Supply feature, a task that is triggered at level N+1 once the stock order form is submitted.

## Inputs

1. Actors selection
2. Form ID:
3. Form display name
4. Enabling the Stock Shipment Confirmation feature
5. Stock Supply form ID
6. Stock Supply form display name

## Results

These forms will be generated:
- Stock Order Form (Action)
- Stock Delivery Form (Task)

## Data:

When the stock order form is completed, the document contains a group named *out* containing all the products with the stock ordered as follows:

```json
  "out": {
    "<item_1_id>_ordered": "20",
    "<item_2_id>_ordered": "0",
	 // other items
}
```
