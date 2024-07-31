# Inventory sending feature

This feature allows you to have an action form to Send a stock of items to a defined level of the hierarchy.
By defining this feature, you can enable the _Stock Supply Confirmation_ feature, a task that is triggered at the receiver level once the stock submission form is submitted. If during execution of the _Stock Supply Confirmation_ task a difference occurs between the stock sent and the stock received confirmed by the user, this triggers a Stock Conflict Resolution task at the level of the stock sender.

The _Stock Discrepancy Resolution_ is is only active when the _Stock Supply Confirmation_ feature has also been activated.

## Inputs

1. Form ID
2. Form display name
3. Enabling the Stock Supply Confirmation feature
4. Stock Supply Confirmation form ID:
5. Display name of the Stock Supply Confirmation form:
6. Stock Discrepancy Resolution Form ID:
7. Stock Discrepancy Resolution form display name:

## Results:

These forms will be generated:
- Stock submission form (Action)
- Stock Supply Confirmation Form (Task)
- Stock Discrepancy Resolution Form (Task)

## Data:

When the stock submission form is completed, the document contains a group named *out*
containing all items with stock sent as follows:

```json
  "out": {
    "item_1_id": "20",
    "item_2_id": "30",
    // other items
  }
```
