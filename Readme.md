# `@medic/cht-stock-monitoring-workflow`

Is a useful tool that is designed to help you save time in adding stock monitoring workflow to an existing [CHT](https://github.com/medic/cht-core) application.

# Installation

To add the stock monitoring package in an existing CHT application:

1. Clone your CHT application
2. Open the CHT application in your desired IDE
3. Open the terminal in your working directory
4. Run below command

```shell
npm install @medic/cht-stock-monitoring-workflow
```

# Features

This tool enables you to add comprehensive stock monitoring workflows to your existing CHT (Community Health Toolkit) application. The following features are included:

<ul>
  <li>Stock Count: Monitor stock quantities</li>
  <li>Stock Supply: Manage the supply of stock items</li>
  <li>Stock Supply Confirmation: Confirm stock supplies</li>
  <li>Stock Discrepancy Resolution: Resolve discrepancies in stock counts</li>
  <li>Stock Return: Handle stock returns</li>
  <li>Stock Return Confirmation: Confirm stock returns</li>
  <li>Stock Order: Place stock orders</li>
  <li>Stock Order Supply: Fulfill stock orders</li>
  <li>Stock Out Task: Triggered for low stock situations</li>
  <li>Stock count contact summary: Display stock count summaries for contacts</li>
  <li>Stock logs: Create stock-related logs</li>
</ul>

> [!NOTE]
> For more details please check features documentation here: [docs/features](docs/features)

# Known issues

After adding an item, or any other action that update the existing forms, this form may be broken. To fix it, you need to try to repair manually by opening it with excel.

# Initialization

To initialize the stock monitoring workflow in your CHT application project, run:

```shell
npx cht-stock-monitoring-workflow init
```

The above command generates a default configuration for the stock count form in a config file named `stock-monitoring.config.json` in your CHT application directory and updates translation messages files accordingly.

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

To add an item to an existing form, use:

```shell
npx cht-stock-monitoring-workflow add item
```

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

To add features, use:

```shell
npx cht-stock-monitoring-workflow add feature
```

> [!NOTE]
> For more details about available features please check features documentation here: [docs/features](docs/features)

## Stock Logs

Create a stock form for level 3

### Questions parameters

| Name            | Type       | Description                 | Required |
| --------------- | ---------- | --------------------------- | -------- |
| `form_name`   | `string` | The stock logs form name/ID | true     |
| `title[lang]` | `string` | The stock logs form title   | true     |

# Development

### Commit format
The commit format should follow this [conventional-changelog angular preset](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular).

# Copyright

Copyright 2013-2024 Medic Mobile, Inc. <hello@medic.org>

# License

The software is provided under AGPL-3.0. Contributions to this project are accepted under the same license.
=======

| Name            | Type                                  | Description                                                                                                                                      | Required |
| --------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `form_name`   | `string`                            | The stock out form name/ID                                                                                                                       | true     |
| `title[lang]` | `string`                            | The stock order form title                                                                                                                       | true     |
| `formular`    | `item_danger_qty` or `weekly_qty` | if weekly_qty, there is low stock if stock count < 2 * estimated weekly consumption. Else, there is low stock if stock count < item.danger_total | true     |

# Task configuration

To incorporate stock monitoring configurations into the `task.js` file, follow these steps:

1. Import the necessary configurations from the `stock-monitoring.config.json` file:

   ```javascript
   const configs = require('./stock-monitoring.config.json');
   ```
2. Import the `getStockMonitoringTasks` function from the `@medic/cht-stock-monitoring-workflow` package:

   ```javascript
   const { getStockMonitoringTasks } = require('@medic/cht-stock-monitoring-workflow');
   ```
3. Export the `getStockMonitoringTasks` function with the provided configurations:

   ```javascript
   module.exports = [
     ...getStockMonitoringTasks(configs)
   ];
   ```

# Summary contact configuration

To include stock monitoring configurations in the `contact-summary.template.js` file, proceed as follows:

1. Import the required configurations from the `stock-monitoring.config.json` file:

   ```javascript
   const configs = require('./stock-monitoring.config.json');
   ```
2. Import the `getStockMonitoringSummaryCards` function from the `@medic/cht-stock-monitoring-workflow` package:

   ```javascript
   const { getStockMonitoringSummaryCards } = require('@medic/cht-stock-monitoring-workflow');
   ```
3. Export the `getStockMonitoringSummaryCards` function and generate the cards using the configurations and reports:

   ```javascript
   const cards = [
     ...getStockMonitoringSummaryCards(configs, reports)
   ];
   ```

**Note:**

1. Make sure to upload settings after updating configuration files.
2. Perform an upload and conversion of forms after making changes to the forms.
3. To regenerate forms, use the following command:

   ```shell
   npx cht-stock-monitoring-workflow build
   ```
