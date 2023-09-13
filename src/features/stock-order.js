const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Workbook } = require('exceljs');
const { getTranslations, getRowWithValueAtPosition, getDefaultSurveyLabels, buildRowValues, addCategoryItemsToChoice, getSheetGroupBeginEnd } = require('../common');

/**
 * This function takes a header, a list of languages, a list of messages, a selection field name, and a list of items, and
 * returns a list of item rows, which can be used to construct a stock order form.
 * @param {string[]} header
 * @param {string[]} languages
 * @param {object} messages
 * @param {string} selectionFieldName
 * @param {object[]} items
 * @returns {object[]} itemRows
 * @example
 * getItemRows(header, languages, messages, 'list_items_selected', items)
 * returns [
 *   [
 *     { type: 'begin group', name: '___item1', relevant: 'selected(${list_items_selected}, 'item1')', label::en: 'Item 1', label::sw: 'Bidhaa 1' },
 *     { type: 'note', name: 'item1_before', label::en: 'Quantity before: ${item1_current}', label::sw: 'Idadi kabla: ${item1_current}' },
 *     { type: 'decimal', name: 'item1_order_qty', required: 'yes', constraint: '. > 0', default: 0, label::en: 'Quantity ordered', label::sw: 'Idadi iliyotolewa' },
 *     { type: 'calculate', name: 'item1_after', calculation: '${item1_current} + if(${item1_order_qty} != '',${item1_order_qty},0)' },
 *     { type: 'note', name: 'item1_after_note', label::en: 'Quantity after: ${item1_after}', label::sw: 'Idadi baada: ${item1_after}' },
 *     { type: 'end group' },
 *   ],
 *   [
 *     { type: 'begin group', name: '___item2', relevant: 'selected(${list_items_selected}, 'item2')', label::en: 'Item 2', label::sw: 'Bidhaa 2' },
 *     { type: 'note', name: 'item2_before', label::en: 'Quantity before: ${item2_current}', label::sw: 'Idadi kabla: ${item2_current}' },
 *     { type: 'decimal', name: 'item2_order_qty', required: 'yes', constraint: '. > 0', default: 0, label::en: 'Quantity ordered', label::sw: 'Idadi iliyotolewa' },
 *     { type: 'calculate', name: 'item2_after', calculation: '${item2_current} + if(${item2_order_qty} != '',${item2_order_qty},0)' },
 *     { type: 'note', name: 'item2_after_note', label::en: 'Quantity after: ${item2_after}', label::sw: 'Idadi baada: ${item2_after}' },
 *     { type: 'end group' },
 *   ],
 * ]
 **/
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
  const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 0);
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
  const nameColumnIndex = header.indexOf('name');
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', nameColumnIndex);
  const contactTypeRow = [
    buildRowValues(header, {
      type: 'hidden',
      name: 'contact_type',
      appearance: 'hidden',
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
    }),
  ];
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactTypeRow,
    'i+'
  );

  const rows = items.map((item) => {
    // Get stock count from summary
    return buildRowValues(header, {
      type: 'calculate',
      name: `${item.name}_current`,
      default: 0,
      calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
    });
  });
  const [placeIdPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 1);

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
  const expression = orderConfigs.actors.map((actor) => `contact.contact_type === '${actor.place_type}' && user.role === '${actor.role}'`).join(' || ');
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

/**
 * Get stock order configs
 * @param {Object} languages
 * @returns {Object} configs
 * @returns {String} configs.form_name
 * @returns {Object} configs.title
 * @returns {String} configs.title.en
 * @returns {String} configs.title.fr
 **/
const getStockOrderConfigs = async ({
  languages, levels
}) => {
  const actors = [levels[1]];
  if (levels[3]) {
    actors.push(levels[2]);
  }

  const configs = await inquirer.prompt([
    {
      type: 'checkbox',
      name: 'actors',
      message: 'Select the actors',
      choices: actors.map((actor) => {
        return {
          name: actor.role,
          value: actor,
        };
      }),
    },
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock order form ID',
      default: 'stock_order',
      validate: (input) => {
        if (!input) {
          return 'Please enter a valid form ID';
        }
        return true;
      }
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock order form title in ${language}`,
      default: 'Stock Order',
      validate: (input) => {
        if (!input) {
          return `Please enter a valid form title in ${language}`;
        }
        return true;
      }
    })),
    {
      type: 'input',
      name: 'stock_supply.form_name',
      message: 'Enter stock order supply form ID',
      default: 'stock_order_supply',
      validate: (input) => {
        if (!input) {
          return 'Please enter a valid form ID';
        }
        return true;
      }
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `stock_supply.title.${language}`,
      message: `Enter stock order supply form title in ${language}`,
      default: 'Stock Order Supply',
      validate: (input) => {
        if (!input) {
          return `Please enter a valid form title in ${language}`;
        }
        return true;
      }
    }))
  ]);

  return configs;
};

module.exports = {
  getStockOrderConfigs,
  updateStockOrder,
};
