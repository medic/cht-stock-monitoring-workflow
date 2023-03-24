const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Workbook } = require('exceljs');
const { getTranslations, getRowWithValueAtPosition, getDefaultSurveyLabels, buildRowValues, addCategoryItemsToChoice, getSheetGroupBeginEnd } = require('../utils');

function getItemRows(header, languages, messages, selectionFieldName, items) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: 'selected(${' + selectionFieldName + `}, '${item.name}')`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_before`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.qty_before'] + ': ${' + item.name + '_current}' }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `${item.name}_order_qty`,
        required: 'yes',
        constraint: '. > 0',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.qty_ordered'] }), {})
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: `${item.name}_after`,
        calculation: '${' + item.name + '_current} + if(${' + `${item.name}_order_qty} != '',` + '${' + `${item.name}_order_qty},0)`
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_after_note`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.qty_after'] + ': ${' + item.name + '_after}' }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

function addOrderSummaries(workSheet, languages, items, categories = []) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  let rows = [];
  if (categories.length > 0) {
    for (const category of categories) {
      rows.push(
        buildRowValues(header, {
          type: 'note',
          name: `${category.name}_summary`,
          appearance: 'h1 blue',
          relevant: 'selected(${categories}, ' + `'${category.name}')`,
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
        }),
        ...items.filter(it => it.category === category.name).map((item) => (buildRowValues(header, {
          type: 'note',
          name: `${item.name}_summary`,
          appearance: 'li',
          relevant: 'selected(${' + category.name + '_items_selected}, ' + `'${item.name}')`,
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.label[language]}: ` + '${' + `${item.name}_order_qty}` }), {})
        }))),
      );
    }
  } else {
    rows = items.map((item) => ({
      type: 'note',
      name: `${item.name}_summary`,
      appearance: 'li',
      relevant: 'selected(${list_items_selected}, ' + `'${item.name}')`,
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.name[language]}: ` + '${' + `${item.name}_order_qty}` }), {})
    }));
  }
  //Insert item
  workSheet.insertRows(
    end,
    rows,
    'i+'
  );
}

function addExportCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_ordered`, // Row name
      calculation: 'if(${' + `${item.name}_order_qty} != '',` + '${' + `${item.name}_order_qty},0)`
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

async function updateStockOrder(configs) {
  const processDir = process.cwd();
  const orderConfigs = configs.features.stock_order;
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  const { languages } = configs;
  const messages = getTranslations();

  const formPath = path.join(processDir, 'forms', 'app', `${orderConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), formPath);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(formPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  // Update survey columns
  const [labelColumns, hintColumns] = getDefaultSurveyLabels(
    'stock_order',
    messages,
    configs.languages,
  );
  // Add languages and hints columns
  const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 1);
  let lastColumnIndex = Object.keys(firstRowData).length;
  for (const labelColumn of labelColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = labelColumn;
    lastColumnIndex++;
  }
  for (const hintColumn of hintColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = hintColumn;
    lastColumnIndex++;
  }
  // Add choice filter column
  surveyWorkSheet.getColumn(lastColumnIndex + 1).values = ['choice_filter'];

  const header = surveyWorkSheet.getRow(1).values;
  header.shift();

  const rows = items.map((item) => {
    // Get stock count from summary
    return buildRowValues(header, {
      type: 'calculate',
      name: `${item.name}_current`,
      default: 0,
      calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
    });
  });
  const [placeIdPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);

  if (configs.useItemCategory) {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: `select_categories`,
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.select_category_label'] }), {})
      }),
      buildRowValues(header, {
        type: 'select_multiple categories',
        name: 'categories',
        required: 'yes',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.select_category'] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
      ...categories.map((category) => {
        return [
          buildRowValues(header, {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            relevant: 'selected(${categories}, ' + `'${category.name}')`,
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
          }),
          buildRowValues(header, {
            type: 'select_multiple items',
            required: 'yes',
            name: `${category.name}_items_selected`,
            choice_filter: `category_filter = '${category.name}'`,
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.select_items'] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            messages,
            `${category.name}_items_selected`,
            items.filter((item) => item.category === category.name),
          ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
          buildRowValues(header, {
            type: 'end group',
          }),
        ];
      }).reduce((prev, categoryRows) => ([...prev, ...categoryRows]), []),
    );
  } else {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: 'items_selection',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.items_selection'] }), {})
      }),
      buildRowValues(header, {
        type: 'select_multiple items',
        required: 'yes',
        name: 'list_items_selected',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.message.select_items'] }), {})
      }),
      ...getItemRows(
        header,
        languages,
        messages,
        'list_items_selected',
        items
      ),
      buildRowValues(header, {
        type: 'end group',
      }),
    );
  }
  surveyWorkSheet.insertRows(
    placeIdPosition + 1,
    rows,
    'i+'
  );

  addOrderSummaries(surveyWorkSheet, languages, items, configs.useItemCategory ? categories : []);
  addExportCalculation(surveyWorkSheet, items);
  addCategoryItemsToChoice(categories, items, choiceWorkSheet, languages);

  // SETTINGS
  settingWorkSheet.getRow(2).getCell(1).value = orderConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = orderConfigs.form_name;

  await workbook.xlsx.writeFile(formPath);

  // Add stock count form properties
  const expression = `user.parent.contact_type === '${configs.levels[2].place_type}' && contact.contact_type === '${configs.levels[2].place_type}'`;
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      expression,
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: orderConfigs.title[lang]
      };
    }),
  };
  const propertyPath = path.join(processDir, 'forms', 'app', `${orderConfigs.form_name}.properties.json`);
  fs.writeFileSync(propertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${orderConfigs.form_name} updated successfully`));
}

// @param {Object} configs - The configs object
// @param {Object} configs.languages - The languages object
// @returns {Object} - The stock order configs
async function getStockOrderConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock order form ID',
      default: 'stock_order'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock order form title in ${language}`,
      default: 'Stock Order'
    })),
    {
      type: 'input',
      name: 'stock_supply.form_name',
      message: 'Enter stock order supply form ID',
      default: 'stock_order_supply'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `stock_supply.title.${language}`,
      message: `Enter stock order supply form title in ${language}`,
      default: 'Stock Order Supply'
    }))
  ]);

  return configs;
}

module.exports = {
  getStockOrderConfigs,
  updateStockOrder,
};
