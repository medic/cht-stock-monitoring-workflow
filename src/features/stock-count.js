const chalk = require('chalk');
const path = require('path');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { getNoLabelsColums, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations, getDefaultSurveyLabels } = require('../common');

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
      relevant: '${' + `${item.name}` + '___count} > 0',
      appearance: 'li',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `${item.label[language]}: ` + (item.isInSet ? '**${'+`${item.name}___set`+'} '+item.set.label[language].toLowerCase()+' ${'+`${item.name}___unit`+'} '+item.unit.label[language].toLowerCase()+'**' : '**${'+`${item.name}___count`+'} '+item.unit.label[language].toLowerCase()+'**'); // Row label
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
      calculation: '${' + item.name + '___count}'
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
  const messages = getTranslations();
  const itemRows = [];
  for (const item of items) {
    if (item.isInSet) {
      const calculateSetItemRow = {
        type: 'calculate',
        name: `${item.name}___set`,
        calculation: 'if(count-selected(${'+item.name+'}) > 0 and count-selected(substring-before(${'+item.name+'}, "/")) >= 0 and regex(substring-before(${'+item.name+"}, \"/\"), '^[0-9]+$'),number(substring-before(${"+item.name+'}, "/")),0)',
        default: '0/0'
      };
      itemRows.push(buildRowValues(header, calculateSetItemRow));
      const calculateUnitItemRow = {
        type: 'calculate',
        name: `${item.name}___unit`,
        calculation: 'if(count-selected(${'+item.name+'}) > 0 and count-selected(substring-after(${'+item.name+'}, "/")) >= 0 and regex(substring-after(${'+item.name+"}, \"/\"), '^[0-9]+$'),number(substring-after(${"+item.name+'}, "/")),0)',
        default: '0/0'
      };
      itemRows.push(buildRowValues(header, calculateUnitItemRow));
      const itemRow = {
        type: 'string',
        name: `${item.name}`,
        required: 'yes',
        constraint: "regex(., '^\\d+\\/\\d+$')",
        default: '0/0',
      };
      for (const language of languages) {
        itemRow.constraint_message = messages[language]['stock_count.message.set_unit_constraint_message'].replace('{{unit_label}}', item.unit.label[language].toLowerCase()).replace('{{set_label}}', item.set.label[language].toLowerCase());
        itemRow[`label::${language}`] = `${item.label[language]}` || ''; // Row label
        itemRow[`hint::${language}`] = '${'+`${item.name}___set`+'} '+item.set.label[language].toLowerCase()+' ${'+`${item.name}___unit`+'} '+item.unit.label[language].toLowerCase(); // Row hint
      }
      itemRows.push(buildRowValues(header, itemRow));
    } else {
      const itemRow = {
        type: 'integer',
        name: item.name,
        required: 'yes',
        default: '0',
      };
      for (const language of languages) {
        itemRow[`label::${language}`] = item.label[language] || ''; // Row label
        itemRow[`hint::${language}`] = messages[language]['stock_count.message.unit_quantity_hint'].replace('{{quantity}}', '${'+item.name+'}').replace('{{unit_label}}', item.unit.label[language].toLowerCase()); // Row hint
      }

      itemRows.push(buildRowValues(header, itemRow));
    }
    const calculateItemRowCount = {
      type: 'calculate',
      name: `${item.name}___count`,
      calculation: item.isInSet ? '${'+item.name+'___set} * ' + item.set.count + ' + ${'+item.name+'___unit}' : '${'+item.name+'}',
    };
    itemRows.push(buildRowValues(header, calculateItemRowCount));
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
  const [labelColumns, hintColumns] = getDefaultSurveyLabels(
    'stock_count',
    messages,
    languages,
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

  // Add items
  // Find items group last row number
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 1);
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
      ...getNoLabelsColums(languages)
    }),
  ];
  const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 1);
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
  addStockCountCalculation(surveyWorkSheet, Object.values(configs.items));
  settingWorkSheet.getRow(2).getCell(1).value = stockCountConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = stockCountConfigs.form_name;

  await workbook.xlsx.writeFile(stockCountPath);
  const expression = stockCountConfigs.contact_types.map((contact) => {
    return `((contact.contact_type === '${contact.place_type}' || contact.type === '${contact.place_type}') && (user.role === '${contact.role}'))`;
  }).join(' || ');

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': stockCountConfigs.type !== 'task',
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
      default: true,
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
      choices: Object.values(levels).map(l => {
        return {
          name: `${l.place_type} << ${l.contact_type}`,
          value: l,
        };
      }),
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
