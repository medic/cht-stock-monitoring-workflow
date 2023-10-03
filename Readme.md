# `@medic/cht-stock-monitoring-workflow`

Is a useful package that is designed to help you help you save time in adding stock monitoring workflows to an existing [CHT](https://github.com/medic/cht-core) application.

# Installation

To install the stock monitoring package in an existing CHT application: 

1. Open the CHT application in your desired IDE
2. Open the terminal in your working directory
3. Run below command

```shell
npm install @medic/cht-stock-monitoring-workflow
```

# Features

Stock monitoring brings these features to your CHT application 

<ul>
  <li>Stock count</li>
  <li>Stock Supply</li>
  <li>Stock Supply Confirmation</li>
  <li>Stock Discrepancy Resolution</li>
  <li>Stock Return</li>
  <li>Stock Return Confirmation</li>
  <li>Stock Order</li>
  <li>Stock Order Supply</li>
  <li>Stock Out Task</li>
  <li>Stock count contact summary</li>
    <li>Stock logs</li>
</ul>

# Known issues

After adding an item, or any other action that update the existing forms, this form may be broken. To fix it, you need to try to repair manually by opening it with excel.

# Initialization

```shell
cht-stock-monitoring-workflow init
```

  Initialize the project and create a file with name `stock-monitoring.config.json`. This add by default the stock count form empty and update the cht app messages.

## Question parameters

| Name                          | Type                                                       | Description                                                                                                                                                           | Required                         |
| ----------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| `monitoring_type`           | `2_levels` or `3_levels`                               | Stock monitoring type. 2 levels means monitoring between a supervisor (level 2) and a chw (level 1). 3 levels add a Health center levels feature like `Stock order` | true                             |
| `levels[x]contact_type`     | `string`                                                 | Contact type of each level (c52_supervisor or c52_supervisor)                                                                                                         | true                             |
| `useItemCategory`           | `boolean`                                                | Whether to categorize items or not                                                                                                                                    | true                             |
| `stock_count.form_name`     | `string`                                                 | ID of the stock count form name (will be the form and properties file name alse)                                                                                      | true                             |
| `stock_count.contact_types` | `string`                                                 | For which contacts types to display the stock account                                                                                                                 | true                             |
| `stock_count.type`          | `action` or `task`                                     | If stock count form is an action of task.                                                                                                                             | true                             |
| `stock_count.frequency`     | `end_of_week` or `middle_of_month` or `end_of_month` | If stock_count.type = task, display the task at the end of each week (end_of_week), middle of each month (middle_of_month) or end of each month                       | true, if stock_count.type = task |
| `stock_count.title[lang]`   | `string`                                                 | Stock count form title in each cht app languages                                                                                                                      | true                             |

## Results

1. File `stock-monitoring.config.json`: It is the most important change in the projet. This can regenarate all the stock monitoring changes in the app
2. Stock count form and properties file
3. `translations-[lang].properties` updated with new strings

**Note:** Stock monitoring starts with a stock count. It means that without stock count report stock status won't be display on contact summary

# Add item

```shell
cht-stock-monitoring-workflow add item
```

Add item in an existing form

## Questions parameters

| Name                           | Type                               | Description                                                                                                                | Required |
| ------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------- |
| `categoy.name`               | `string`                         | The item category name (It is possible to select an existing category)                                                     | true     |
| `category.label[lang]`       | `string`                         | The category label in each app language                                                                                    | true     |
| `category.description[lang]` | `string`                         | The category description in each app language                                                                              | true     |
| `item.name`                  | `string`                         | The item name                                                                                                              | true     |
| `item.label[lang]`           | `string`                         | The item label in each app language                                                                                        | true     |
| `item.unit `                 | `string`                         | The item unit                                                                                                              | true     |
| `item.warning_total`         | `number`                         | Item total will be displayed in orange in total <= item.warning_total and total > item.danger_total                        | true     |
| `item.danger_total`          | `number`                         | Item total will be displayed in red in total <= item.danger_total                                                          | true     |
| `item[form].deduced_type`    | `by_user` or `custom_formular` | Whether user enter the quantity used (by_user) or it's calculated using the form values (custom_formular)                  | true     |
| `item[form].formular`        | `string`                         | If `deduced_type = by_user`, it's the field `relevant` and field `calculation` if `deduced_type = custom_formular` | true     |

# Add features

```shell
cht-stock-monitoring-workflow add feature
```

## Stock Logs

Create a stock form for level 3

### Questions parameters

| Name            | Type       | Description                 | Required |
| --------------- | ---------- | --------------------------- | -------- |
| `form_name`   | `string` | The stock logs form name/ID | true     |
| `title[lang]` | `string` | The stock logs form title   | true     |

## Stock Supply

1. Create a stock supply form for level 2
2. Create a supply confirmation task for level 1 when level 2 submit a stock supply form
3. If there is a difference between supplied quantity and received quantity a stock discrepancy resolution task will be create for level 2

### Questions parameters

| Name                           | Type              | Description                                                                                | Required                               |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------ | -------------------------------------- |
| `form_name`                  | `string`        | The stock supply form name/ID                                                              | true                                   |
| `title[lang]`                | `string`        | The stock supply form title                                                                | true                                   |
| `confirm_supply.active`      | `yes` or `no` | If stock supply need confirmation. If not quantities will be deducted without confirmation | true                                   |
| `confirm_supply.form_name`   | `string`        | The confirmation form name                                                                 | true, if confirm_supply.active = 'yes' |
| `confirm_supply.title[lang]` | `string`        | The confirmation form title                                                                | true, if confirm_supply.active = 'yes' |
| `discrepancy.form_name`      | `string`        | The discrepancy resolution form name                                                       | true, if confirm_supply.active = 'yes' |
| `discrepancy.title[lang]`    | `string`        | The discrepancy resolution form title                                                      | true, if confirm_supply.active = 'yes' |

## Stock Return

1. Create a stock return form for level 1
2. Create a stock return confirmation task for level 2

### Questions parameters

| Name                         | Type       | Description                   | Required |
| ---------------------------- | ---------- | ----------------------------- | -------- |
| `form_name`                | `string` | The stock return form name/ID | true     |
| `title[lang]`              | `string` | The stock return form title   | true     |
| `confirmation.form_name`   | `string` | The confirmation form name    | true     |
| `confirmation.title[lang]` | `string` | The confirmation form title   | true     |

## Stock Order

1. Create a stock order form for level 2
2. Create a stock order supply task for level 3
3. Follow the Stock Supply steps

### Questions parameters

| Name                         | Type       | Description                  | Required |
| ---------------------------- | ---------- | ---------------------------- | -------- |
| `form_name`                | `string` | The stock order form name/ID | true     |
| `title[lang]`              | `string` | The stock order form title   | true     |
| `stock_supply.form_name`   | `string` | The supply form name         | true     |
| `stock_supply.title[lang]` | `string` | The supply form title        | true     |

## Stock Out

Create a stock Out task for level 2 if level 1 has low stock

### Questions parameters

| Name            | Type                                  | Description                                                                                                                                      | Required |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `form_name`   | `string`                            | The stock out form name/ID                                                                                                                       | true     |
| `title[lang]` | `string`                            | The stock order form title                                                                                                                       | true     |
| `formular`    | `item_danger_qty` or `weekly_qty` | if weekly_qty, there is low stock if stock count < 2 * estimated weekly consumption. Else, there is low stock if stock count < item.danger_total | true     |
