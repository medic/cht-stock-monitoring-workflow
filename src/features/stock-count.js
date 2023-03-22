const chalk = require('chalk');
const path = require('path');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { getAppSettings, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations } = require('../utils');

function addStockCountSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + `${item.name}` + '} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + item.name + '} ' + `${item.unit}** </h5>`; // Row label
    }
    itemRows.push(buildRowValues(header, itemRow));
  }

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockCountCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_availables`, // Row name
      calculation: '${' + item.name + '}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function getItemRows(items, languages, header) {
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'integer',
      name: item.name,
      required: 'yes',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = item.label[language] || ''; // Row label
    }

    itemRows.push(buildRowValues(header, itemRow));
  }
  return itemRows;
}

async function updateStockCount(configs) {
  const processDir = process.cwd();
  const stockCountConfigs = configs.features.stock_count;
  const stockCountPath = path.join(processDir, 'forms', 'app', `${stockCountConfigs.form_name}.xlsx`);
  const { languages } = configs;
  const messages = getTranslations();
  const items = Object.values(configs.items);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockCountPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockCountPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const settingWorkSheet = workbook.getWorksheet('settings');

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
        '',
        'NO_LABEL',
        '',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(7).fill(''),
        messages[language]['stock_count.summary_header'],
        messages[language]['stock_count.submit_note'],
        messages[language]['stock_count.summary_note'],
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

  // Add items
  // Find items group last row number
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  const itemRows = [];
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  if (configs.useItemCategory) {
    for (const category of Object.values(configs.categories)) {
      itemRows.push(
        buildRowValues(
          header,
          {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${category.label[language]} - ${category.description[language]}` || '' }), {})
          }
        ),
        ...getItemRows(items.filter((item) => item.category === category.name), languages, header),
        buildRowValues(header, {
          type: 'end group',
        }),
      );
    }
  } else {
    itemRows.push(
      ...getItemRows(items, languages, header)
    );
  }

  const inputs = [
    buildRowValues(header, {
      type: 'hidden',
      name: 'date_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
  ];
  const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 2);
  surveyWorkSheet.insertRows(
    inputPosition + 1,
    inputs,
    'i+'
  );


  //Insert item
  surveyWorkSheet.insertRows(
    position+1,
    itemRows,
    'i+'
  );
  addStockCountSummaries(surveyWorkSheet, Object.values(configs.items), languages);
  addStockCountCalculation(surveyWorkSheet, Object.values(configs.items), languages);
  settingWorkSheet.getRow(2).getCell(1).value = stockCountConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = stockCountConfigs.form_name;

  await workbook.xlsx.writeFile(stockCountPath);
  const levels = Object.values(configs.levels);
  const appSettings = getAppSettings();
  const expression = stockCountConfigs.contact_types.map((contact_type) => {
    const placeType = levels.find((level) => level.contact_type === contact_type).place_type;
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === contact_type);
    const contactParent = contactTypeDetails.parents[0];
    return `(contact.contact_type === '${contactParent}' && user.parent.contact_type === '${placeType}')`;
  }).join(' || ');

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': stockCountConfigs.type === 'task' ? false : true,
      expression
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: stockCountConfigs.title[lang]
      };
    }),
  };
  const stockCountPropertyPath = path.join(processDir, 'forms', 'app', `${stockCountConfigs.form_name}.properties.json`);
  fs.writeFileSync(stockCountPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${stockCountConfigs.title[configs.defaultLanguage]} form updated successfully`));
}

async function getStockCountConfigs(levels, locales) {
  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useItemCategory',
      message: 'Categorize stock items',
      default: false,
    },
    {
      type: 'input',
      name: 'features.stock_count.form_name',
      message: 'Stock count form (Used to fill in balances on hand) ID',
      default: 'stock_count',
    },
    {
      type: 'checkbox',
      name: 'features.stock_count.contact_types',
      message: 'Select stock count form levels',
      choices: Object.values(levels).map(l => l.contact_type),
    },
    {
      type: 'list',
      name: 'features.stock_count.type',
      message: 'Select stock count form type',
      choices: [
        {
          name: 'Action form',
          value: 'action'
        },
        {
          name: 'Task form',
          value: 'task'
        }
      ],
    },
  ]);

  if (answers.features.stock_count.type === 'task') {
    const tasksAnswers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'frequency',
        message: 'Select stock count form frequency',
        choices: [
          {
            name: 'End of each week',
            value: 'end_of_week'
          },
          {
            name: 'Middle of each month',
            value: 'middle_of_month'
          },
          {
            name: 'End of each month',
            value: 'end_of_month'
          }
        ],
      }
    ]);
    answers.features.stock_count.frequency = tasksAnswers.frequency;
  }

  const titleAnswers = await inquirer.prompt([
    ...locales.map((locale) => {
      return {
        type: 'input',
        name: locale.code,
        message: `Stock count form title in ${locale.name}`,
        default: 'Stock count'
      };
    }),
  ]);

  answers.features.stock_count.title = {};
  for (const locale of locales) {
    answers.features.stock_count.title[locale.code] = titleAnswers[locale.code];
  }

  return answers;
}

module.exports = {
  updateStockCount,
  getStockCountConfigs,
};
