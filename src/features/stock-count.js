const chalk = require('chalk');
const path = require('path');
const inquirer = require('inquirer');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { getNoLabelsColums, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getDefaultSurveyLabels } = require('../excel-utils');
const { getTranslations } = require('../translation-manager');

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
      relevant: '${' + `sm_${item.name}_qty` + '} > 0',
      appearance: 'li',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `${item.label[language]}: ` + (item.isInSet ? '**${'+`sm_${item.name}_sets`+'} '+item.set.label[language].toLowerCase()+' ${'+`sm_${item.name}_units`+'} '+item.unit.label[language].toLowerCase()+'**' : '**${'+`sm_${item.name}_qty`+'} '+item.unit.label[language].toLowerCase()+'**'); // Row label
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
      name: `sm_${item.name}_available`, // Row name
      calculation: '${sm_' + item.name + '_qty}'
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
        name: `sm_${item.name}_sets`,
        calculation: 'if(count-selected(${'+item.name+'}) > 0 and count-selected(substring-before(${'+item.name+'}, "/")) >= 0 and regex(substring-before(${'+item.name+"}, \"/\"), '^[0-9]+$'),number(substring-before(${"+item.name+'}, "/")),0)',
        default: '0/0'
      };
      itemRows.push(buildRowValues(header, calculateSetItemRow));
      const calculateUnitItemRow = {
        type: 'calculate',
        name: `sm_${item.name}_units`,
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
        itemRow[`hint::${language}`] = '${'+`sm_${item.name}_sets`+'} '+item.set.label[language].toLowerCase()+' ${'+`sm_${item.name}_units`+'} '+item.unit.label[language].toLowerCase(); // Row hint
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
      name: `sm_${item.name}_qty`,
      calculation: item.isInSet ? '${sm_'+item.name+'_sets} * ' + item.set.count + ' + ${sm_'+item.name+'_units}' : '${'+item.name+'}',
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

  try {
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
    console.log(chalk.green(`INFO ${stockCountConfigs.title[configs.defaultLanguage]} form updated successfully`));
  } catch (err) {
    console.log(chalk.red(`ERROR Failed to process ${stockCountPath}: ${err.message}`));
    throw err;
  }

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
}

/**
 * Check if running in non-interactive mode
 * @returns {boolean} True if non-interactive mode
 */
function isNonInteractive() {
  return !process.stdin.isTTY || (process.argv.length > 8 && process.argv[8]);
}

/**
 * Parse stock count config from CLI args for non-interactive mode
 * Note: spawnSync converts nested arrays to comma-separated strings,
 * so ['Stock count', 'Stock count'] becomes 'Stock count,Stock count'
 * @param {Object} levels - Level configurations
 * @param {Array} locales - Available locales
 * @returns {Object} Parsed stock count configuration
 */
function parseStockCountCliArgs(levels, locales) {
  const argv = process.argv;

  // argv[8] = useItemCategory ('Y' or 'N')
  // argv[9] = form_name
  // argv[10] = contact_types JSON string
  // argv[11] = type ('action' or 'task')
  // argv[12] = frequency
  // argv[13] = titles (comma-separated: 'Stock count,Stock count')

  const useItemCategory = argv[8] === 'Y' || argv[8] === 'true' || argv[8] === true;
  const formName = argv[9] || 'stock_count';

  let contactTypes;
  try {
    // Handle JSON-like string format from test
    const contactTypesStr = argv[10] || '[]';
    contactTypes = JSON.parse(contactTypesStr.replace(/'/g, '"').replace(/(\w+):/g, '"$1":'));
  } catch {
    // Fallback to using all levels
    contactTypes = Object.values(levels);
  }

  const type = argv[11] || 'action';
  const frequency = type === 'task' ? (argv[12] || 'end_of_week') : undefined;

  // Parse titles - comma-separated in single arg (spawnSync behavior)
  const title = {};
  const titleArg = argv[13] || 'Stock count,Stock count';
  const titles = titleArg.split(',');
  locales.forEach((locale, i) => {
    title[locale.code] = (titles[i] || 'Stock count').trim();
  });

  const answers = {
    useItemCategory,
    features: {
      stock_count: {
        form_name: formName,
        contact_types: contactTypes,
        type,
        title
      }
    }
  };

  if (frequency) {
    answers.features.stock_count.frequency = frequency;
  }

  return answers;
}

async function getStockCountConfigs(levels, locales) {
  // Handle non-interactive mode (tests, CI, piped input)
  if (isNonInteractive()) {
    return parseStockCountCliArgs(levels, locales);
  }

  const answers = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useItemCategory',
      message: 'Categorize stock items',
      default: true,
      when: function(answers){
        const argv = process.argv;
        if (!argv[9]){
          return true;
        }
        answers.useItemCategory = argv[9] === 'true' || argv[9] === true;
        return false;
      }
    },
    {
      type: 'input',
      name: 'features.stock_count.form_name',
      message: 'Stock count form (Used to fill in balances on hand) ID',
      default: 'stock_count',
      when: function(answers){
        const argv = process.argv;
        if (!argv[9]){
          return true;
        }
        const answer = {
          features: {
            stock_count: {
              form_name: argv[9]
            }
          }
        };
        Object.assign(answers, answer);
        return false;
      }
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
      when: function(answers){
        const argv = process.argv;
        if (!argv[10]){
          return true;
        }

        answers.features.stock_count.contact_types = JSON.parse(argv[10]);
        
        return false;
      }
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
      when: function(answers){
        const argv = process.argv;
        if (!argv[11]){
          return true;
        }
  
        answers.features.stock_count.type = argv[11];
        return false;
      }
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
        when: function(answers){
          const argv = process.argv;
          if (!argv[12]){
            return true;
          }
          answers.frequency = argv[12];
          return false;
        }
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
        default: 'Stock count',
        when: function(answers){
          const argv = process.argv;
          if (!argv[13]){
            return true;
          }

          const answer = {
            'en': argv[13].split(',')[0],
            'fr': argv[13].split(',')[1]
          };
          Object.assign(answers, answer);
          return false;
        }
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
