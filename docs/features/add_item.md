# Adding item

Allows the developer to add items.

## Item creation

### Inputs

1. Category: Add/Select Item Category
2. Item ID (use in database. Must be as a programming variable)
3. Item display name
4. Box information if item is boxed   
  4.1. Quantity per box   
  4.2. Box display name 
5. Item unit display name
6. Alarm quantity: Used to attract the user's attention
7. Danger quantity: Allows you to create an out of stock task
8. Maximum quantity: The user should not be able to order more than that.

## Add item in a form:

### Inputs

1. Select form
2. Deduction condition: (Under what condition is there deduction in the form)
3. Type of deduction: 
    - Manual: The user will enter the quantity. A field will be displayed at the end of the form  
    - Reference: The value of an existing field in the form will be used.   
      - Name of the referenced field
    - Automatic:
      - Form: Deduction form with the quantity to be deducted
