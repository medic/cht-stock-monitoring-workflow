# Stock return

The stock return feature allows you to create a stock return form for _Level 1_ and a stock return confirmation task for _Level 2_.

## Inputs

- Stock Return Form Name: The name/ID of the stock return form.
- Stock Return Form Title: The title of the stock return form.
- Stock Return Confirmation Form Name: The name/ID of the stock return confirmation form.
- Stock Return Confirmation Form Title: The title of the stock return confirmation form.

## Results

When the stock return form is submitted by _Level 1_, a Stock Return Confirmation task is automatically created for _Level 2_. The confirmation task will appear in the profile for _Level 2_ users so they can confirm the return of stock.

## Data

When the stock return confirmation task is completed, the document contains the following information:

- Item ID: The identifier of the returned item.
- Returned Quantity: The quantity of item returned.
- Reason for Return: The reason why the item is being returned.
- Return Date: The date the item was returned.
- Required Action: The action required to process the stock return, for example, restock or dispose of the item.
