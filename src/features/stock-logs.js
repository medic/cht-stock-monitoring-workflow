const inquirer = require('inquirer');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const chalk = require('chalk');

const { getTranslations, buildRowValues, getRowWithValueAtPosition, addCategoryItemsToChoice, getSheetGroupBeginEnd } = require('../common');

function addStockLogCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_received`, // Row name
      calculation: '${' + `_${item.name}_received` + '}'
    })),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_returned`, // Row name
      calculation: '${' + `_${item.name}_returned` + '}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockLogSummaries(workSheet, languages, items, categories = [], messages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const rows = [];
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
        ...items.filter(it => it.category === category.name).map((item) => [
          buildRowValues(header, {
            type: 'note',
            name: `${item.name}_summary_received`,
            appearance: 'li',
            relevant: 'selected(${' + `${category.name}_items_selected` + `}, '${item.name}')`,
            ...languages.reduce((prev, language) => ({
              ...prev,
              [`label::${language}`]: messages[language]['stock_logs.message.item_qty_received'].replace('{{item}}', item.label[language]).replace('{{qty}}', '${' + item.name + '_received}')
            }), {})
          }),
          buildRowValues(header, {
            type: 'note',
            name: `${item.name}_summary_returned`,
            appearance: 'li',
            relevant: 'selected(${' + `${category.name}_items_selected` + `}, '${item.name}')`,
            ...languages.reduce((prev, language) => ({
              ...prev,
              [`label::${language}`]: messages[language]['stock_logs.message.item_qty_returned'].replace('{{item}}', item.label[language]).replace('{{qty}}', '${' + item.name + '_returned}')
            }), {})
          }),
        ]).reduce((prev, next) => ([...prev, ...next]), []),
      );
    }
  } else {
    rows.push(
      ...items.map((item) => [
        buildRowValues(header, {
          type: 'note',
          name: `${item.name}_summary_received`,
          appearance: 'li',
          relevant: 'selected(${' + `list_items_selected}, '${item.name}')`,
          ...languages.reduce((prev, language) => ({
            ...prev,
            [`label::${language}`]: messages[language]['stock_logs.message.item_qty_received'].replace('{{item}}', item.label[language]).replace('{{qty}}', '${' + item.name + '_received}'),
          }), {})
        }),
        buildRowValues(header, {
          type: 'note',
          name: `${item.name}_summary_returned`,
          appearance: 'li',
          relevant: 'selected(${' + `list_items_selected}, '${item.name}')`,
          ...languages.reduce((prev, language) => ({
            ...prev,
            [`label::${language}`]: messages[language]['stock_logs.message.item_qty_returned'].replace('{{item}}', item.label[language]).replace('{{qty}}', '${' + item.name + '_returned}')
          }), {})
        }),
      ]).reduce((prev, next) => ([...prev, ...next]), []),
    );
  }
  //Insert item
  workSheet.insertRows(
    end,
    rows,
    'i+'
  );
}

function getItemRows(header, languages, selectionFieldName, items, messages) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: 'selected(${' + selectionFieldName + `}, '${item.name}')`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `_${item.name}_received`,
        required: 'yes',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.item_received'].replace('{{item}}', item.label[language]) }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `_${item.name}_returned`,
        required: 'yes',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.item_returned'].replace('{{item}}', item.label[language]) }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

async function updateStockLogs(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_logs;
  const { languages } = configs;
  const messages = getTranslations();
  const formPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.xlsx`);
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), formPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(formPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');
  
  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of configs.languages) {
    labelColumns.push(
      [
        `label::${language}`,
        'Patient',
        'Source',
        'Source ID',
        'NO_LABEL',
        'NO_LABEL',
        '',
        'NO_LABEL',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(6).fill(''),
        messages[language]['stock_logs.message.summary_header'],
        messages[language]['stock_logs.message.submit_note'],
        messages[language]['stock_logs.message.summary_note'],
        ...Array(2).fill(''),
        'NO_LABEL',
      ]
    );
    hintColumns.push(
      [
        `hint:${language}`,
      ]
    );
  }
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
  surveyWorkSheet.getColumn(lastColumnIndex + 3).values = ['choice_filter'];

  const header = surveyWorkSheet.getRow(1).values;
  header.shift();

  const rows = [];
  if (configs.useItemCategory) {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: 's_reported',
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.form_description'] }), {})
      }),
      buildRowValues(header, {
        type: 'date',
        name: 'reported_date',
        require: 'yes',
        constraint: '. <= today() and (floor(decimal-date-time(.)) >= (floor(decimal-date-time(today()) - 7)))',
        constraint_message: 'Date can’t be more than 7 days ago. Also can’t be a future date',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.date'] }), {})
      }),
      buildRowValues(header, {
        type: 'select_multiple categories',
        name: 'categories',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.select_categories'] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
        name: 'category_select',
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
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.select_items'] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            `${category.name}_items_selected`,
            items.filter((item) => item.category === category.name),
            messages
          ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
          buildRowValues(header, {
            type: 'end group',
            name: category.name,
          }),
        ];
      }).reduce((prev, categoryRows) => ([...prev, ...categoryRows]), []),
    );
  } else {
    rows.push(
      buildRowValues(header, {
        type: 'select_multiple items',
        required: 'yes',
        name: `list_items_selected`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_logs.message.select_items'] }), {})
      }),
      ...getItemRows(
        header,
        languages,
        'list_items_selected',
        items,
        messages
      ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
    );
  }
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );

  addStockLogSummaries(surveyWorkSheet, languages, Object.values(configs.items), categories, messages);
  addStockLogCalculation(surveyWorkSheet, Object.values(configs.items), languages);

  //Add choices
  addCategoryItemsToChoice(categories, items, choiceWorkSheet, languages);

  // SETTINGS
  settingWorkSheet.getRow(2).getCell(1).value = featureConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = featureConfigs.form_name;

  await workbook.xlsx.writeFile(formPath);

  // Add stock count form properties
  const expression = `user.parent.contact_type === '${configs.levels[1].place_type}' && contact.contact_type === '${configs.levels[1].place_type}'`;
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
        content: featureConfigs.title[lang]
      };
    }),
  };
  const propertyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.properties.json`);
  fs.writeFileSync(propertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${featureConfigs.form_name} updated successfully`));
}

async function getStockLogsConfigs({
  languages,
}) {
  return inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter consumption logs form ID',
      default: 'stock_logs'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter consumption logs form title in ${language}`,
      default: 'Stock Logs'
    }))
  ]);
}

module.exports = {
  getStockLogsConfigs,
  updateStockLogs,
};
