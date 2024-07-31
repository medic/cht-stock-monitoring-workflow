# Stock count

The Stock Count feature allows you to record the available stock for all items. The feature must be available to any CHT user. The inventory can be done on a regular basis through an action or a task. The task can appear for a duration to be configured during the week. The inventory may or may not require validation. Validation may be necessary for one user and not for another.

## Inputs:

1. User Permission: The permission of the user accessing this feature.
2. Location: Place in the hierarchy where the stock will be displayed on the contact summary. The action will also be displayed based on user permission. The stock will be displayed with a _Card_ per category if the items are categorized.
3. Form ID
4. Form display name
5. Display type:
    - Action: The menu to save inventory will be available to the user at all times.
    - Task:
      - Every 2 weeks: A task will be created for this user every 2 weeks.
      - Monthly: A task will be created for this user every month

## Results

A form is generated and the action (Display type: Action), will be displayed at the level indicated with the display name of the form.

## Data

When the form is completed, the document contains a group named “out” with the list of items named as follows: `<ITEM_ID>_availables`
