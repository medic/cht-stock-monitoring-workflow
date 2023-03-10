const inquirer = require('inquirer');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ExcelJS = require('exceljs');
const { getRowWithValueAtPosition, getTranslations, buildRowValues, getSheetGroupBeginEnd } = require('../utils');

function getLabelColumns(languages, messages) {
  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of languages) {
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
        messages[language]['stock_supply.summary_header'],
        messages[language]['stock_supply.submit_note'],
        messages[language]['stock_return.summary_note'],
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

  return [labelColumns, hintColumns];
}

function getChoicesFromMessage(messages, languages, choiceName, key = 'stock_return.forms.select_items.reason') {
  const choices = Object.keys(messages[languages[0]])
    .filter(m => m.startsWith(key))
    .map(m => m.replace(`${key}.`, ''));

  return choices.map((choice) => {
    return {
      list_name: choiceName,
      name: choice,
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language][`${key}.${choice}`] }), {})
    };
  });
}

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
        type: 'select_multiple return_reason',
        name: `${item.name}_return_reason`,
        required: 'yes',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.select_items.return_reason'] }), {})
      }),
      buildRowValues(header, {
        type: 'text',
        name: `${item.name}_reason_note`,
        required: 'yes',
        relevant: 'selected(${' + item.name + '_return_reason}, ' + `'other')`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.specify'] }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_before`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.qty_before'] + ': ${' + item.name + '_current}' }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `${item.name}_returned_qty`,
        required: 'yes',
        constraint: '. > 0',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.qty_returned'] }), {})
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: `${item.name}_after`,
        calculation: '${' + item.name + '_current} - if(${' + `${item.name}_returned_qty} != '',` + '${' + `${item.name}_returned_qty},0)`
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_after_note`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.qty_after'] + ': ${' + item.name + '_after}' }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

function addReturnedSummaries(workSheet, languages, items, categories = []) {
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
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.label[language]}: ` + '${' + `${item.name}_returned_qty}` }), {})
        }))),
      );
    }
  } else {
    rows = items.map((item) => ({
      type: 'note',
      name: `${item.name}_summary`,
      appearance: 'li',
      relevant: 'selected(${items_selected}, ' + `'${item.name}')`,
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.name[language]}: ` + '${' + `${item.name}_returned_qty}` }), {})
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
      name: `${item.name}_out`, // Row name
      calculation: 'if(${' + `${item.name}_returned_qty} != '',` + '${' + `${item.name}_returned_qty},0)`
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

async function updateStockReturn(configs) {
  const processDir = process.cwd();
  const returnConfigs = configs.features.stock_return;
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  const { languages } = configs;
  const messages = getTranslations();

  const returnFormPath = path.join(processDir, 'forms', 'app', `${returnConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), returnFormPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(returnFormPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  //SURVEY
  const [labelColumns, hintColumns] = getLabelColumns(configs.languages, messages);
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
  lastColumnIndex++;
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();

  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  const rows = items.map((item) => {
    return buildRowValues(header, {
      type: 'calculate',
      name: `${item.name}_current`,
      default: 0,
      calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
    });
  });
  if (configs.useItemCategory) {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: `select_categories`,
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.select_category_label'] }), {})
      }),
      buildRowValues(header, {
        type: 'select_multiple categories',
        name: 'categories',
        required: 'yes',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.select_category'] }), {})
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
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.select_items'] }), {})
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
    //TODO: Add begin and end
    rows.push(
      ...getItemRows(
        header,
        languages,
        messages,
        '---',
        items
      ),
    );
  }
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  addReturnedSummaries(surveyWorkSheet, languages, items, configs.useItemCategory ? categories : []);
  addExportCalculation(surveyWorkSheet, items);

  //CHOICES
  const choiceLabelColumns = languages.map((l) => [
    `label::${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  choiceWorkSheet.getColumn(choiceLastColumn + 1).values = ['category_filter'];
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();
  const categoryChoiceRows = categories.map((category) => {
    return buildRowValues(
      choiceHeader,
      {
        list_name: 'categories',
        name: category.name,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
      }
    );
  });
  const itemsChoiceRows = items.map((item) => {
    return buildRowValues(
      choiceHeader,
      {
        list_name: 'items',
        name: item.name,
        category_filter: item.category,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }
    );
  });
  const returnReasonChoiceRows = getChoicesFromMessage(messages, languages, 'return_reason').map((choice) => buildRowValues(choiceHeader, choice));
  choiceWorkSheet.insertRows(
    2,
    [
      ...categoryChoiceRows,
      ...itemsChoiceRows,
      ...returnReasonChoiceRows
    ],
    'i+'
  );

  // SETTINGS
  settingWorkSheet.getRow(2).getCell(1).value = returnConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = returnConfigs.form_name;

  await workbook.xlsx.writeFile(returnFormPath);

  // Add stock count form properties
  const expression = `user.role === '${configs.levels[1].role}' && contact.contact_type === '${configs.levels[1].place_type}'`;
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
        content: returnConfigs.title[lang]
      };
    }),
  };
  const propertyPath = path.join(processDir, 'forms', 'app', `${returnConfigs.form_name}.properties.json`);
  fs.writeFileSync(propertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${returnConfigs.form_name} updated successfully`));
}

async function getStockReturnConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock return form ID'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock return form title in ${language}`,
      default: 'Stock return'
    })),
    {
      type: 'input',
      name: 'confirmation.form_name',
      message: 'Enter stock returned confirmation form ID'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `confirmation.title.${language}`,
      message: `Enter stock returned confirmation form title in ${language}`,
      default: 'Stock returned confirmation'
    })),
  ]);

  return configs;
}

module.exports = {
  updateStockReturn,
  getStockReturnConfigs,
};
