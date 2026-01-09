const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');
const validator = require('validator');

const { getNoLabelsColums, getRowWithValueAtPosition, buildRowValues, getSheetGroupBeginEnd,
  getItemCount
} = require('../excel-utils');
const { getTranslations } = require('../translation-manager');
const { getNumberOfSteps } = require('../config-manager');

function getItemRows(header, languages, messages, items) {
  return items.map((item) => {
    const row = [
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_name`,
        appearance: 'h2 lime',
        relevant: '${' + `${item.name}_at_hand} <=` + '${' + `${item.name}_required}`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: item.label[language],
        }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_note_at_hand`,
        appearance: 'li',
        relevant: '${' + `${item.name}_at_hand} <=` + '${' + `${item.name}_required}`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_out.message.stock_at_hand'].replace('{{qty}}', getItemCount(item, language, '_at_hand', '_at_hand'))
        }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_note_required`,
        appearance: 'li',
        relevant: '${' + `${item.name}_at_hand} <=` + '${' + `${item.name}_required}`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_out.message.stock_required'].replace('{{qty}}', getItemCount(item, language, '_required', '_required'))
        }), {})
      }),
    ];
    if (item.isInSet) {
      row.push(
        buildRowValues(header, {
          type: 'calculate',
          name: `${item.name}_at_hand___set`,
          calculation: 'int(${'+item.name+'_at_hand} div '+item.set.count+')'
        }),
        buildRowValues(header, {
          type: 'calculate',
          name: `${item.name}_at_hand___unit`,
          calculation: '${'+item.name+'_at_hand} mod '+item.set.count
        }),
        buildRowValues(header, {
          type: 'calculate',
          name: `${item.name}_required___set`,
          calculation: 'int(${'+item.name+'_required} div '+item.set.count+')'
        }),
        buildRowValues(header, {
          type: 'calculate',
          name: `${item.name}_required___unit`,
          calculation: '${'+item.name+'_required} mod '+item.set.count
        }),
      );
    }
    return row;
  });
}

async function updateStockOut(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_out;
  const { languages } = configs;
  const messages = getTranslations();
  const formPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.xlsx`);
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), formPath);
  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
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
          messages[language]['stock_out.message.summary_header'],
          messages[language]['stock_out.message.submit_note'].replace('{{name}}', '${contact_name}'),
          messages[language]['stock_out.message.summary_note'],
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
    const header = surveyWorkSheet.getRow(1).values;
    header.shift();
    // Add parents
    const nbParents = getNumberOfSteps(configs.levels[1].place_type, configs.levels[2].place_type);
    const contactParentRows = [
      ...Array(nbParents).fill(
        [
          buildRowValues(header, {
            type: 'begin group',
            name: `parent`,
            appearance: `hidden`,
            ...getNoLabelsColums(languages)
          }),
          buildRowValues(header, {
            type: 'string',
            name: '_id',
            ...getNoLabelsColums(languages)
          })
        ]
      ).reduce((prev, next) => [...prev, ...next], []),
      ...Array(nbParents).fill(
        buildRowValues(header, {
          type: 'end group',
        })
      )
    ];
    const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', 1);
    surveyWorkSheet.insertRows(
      contactPosition + 3,
      contactParentRows,
      'i+'
    );
    const [placeIdPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 1);
    surveyWorkSheet.insertRow(
      placeIdPosition + 1,
      buildRowValues(header, {
        type: 'calculate',
        name: 'contact_name',
        calculation: '../inputs/contact/name',
      }),
      'i+'
    );
    surveyWorkSheet.getRow(placeIdPosition).getCell(8).value = `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`;

    //Form inputs
    const inputs = [
      ...items.map((item) => [
        buildRowValues(header, {
          type: 'hidden',
          name: `${item.name}_required`,
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
        }),
        buildRowValues(header, {
          type: 'hidden',
          name: `${item.name}_at_hand`,
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
        })
      ]).reduce((prev, next) => [...prev, ...next], []),
    ];
    const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 1);
    surveyWorkSheet.insertRows(
      inputPosition + 1,
      inputs,
      'i+'
    );

    const rows = [];
    if (configs.useItemCategory) {
      rows.push(
        ...categories.map((category) => {
          return [
            buildRowValues(header, {
              type: 'note',
              name: category.name,
              appearance: 'h1 green',
              relevant: items.filter(it => it.category === category.name).map((item) => '${' + `${item.name}_at_hand} <` + '${' + `${item.name}_required}`).join(' or '),
              ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
            }),
            ...getItemRows(
              header,
              languages,
              messages,
              items.filter((item) => item.category === category.name),
            ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
          ];
        }).reduce((prev, categoryRows) => ([...prev, ...categoryRows]), []),
      );
    } else {
      rows.push(
        ...getItemRows(
          header,
          languages,
          messages,
          items,
        ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
      );
    }
    const [, summaryEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'summary');
    surveyWorkSheet.insertRows(
      summaryEnd,
      rows,
      'i+'
    );

    // Update settings
    settingWorkSheet.getRow(2).getCell(1).value = featureConfigs.title[configs.defaultLanguage];
    settingWorkSheet.getRow(2).getCell(2).value = featureConfigs.form_name;

    await workbook.xlsx.writeFile(formPath);
    console.log(chalk.green(`INFO ${featureConfigs.form_name} updated successfully`));
  } catch (err) {
    console.log(chalk.red(`ERROR Failed to process ${formPath}: ${err.message}`));
    throw err;
  }

  // Add stock count form properties
  const expression = `user.parent.contact_type === '${configs.levels[2].place_type}'`;
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': false,
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
}

async function getStockOutConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock out form ID',
      default: 'stock_out',
      when: function (answers){
        const argv = process.argv;
        if (!argv[5]){
          return true;
        } 
        answers.form_name = validator.escape(argv[5]);
        return false;
      }
    },
    {
      type: 'list',
      name: 'formular',
      message: 'Stock out formular',
      choices: [
        {
          name: 'Use item danger quantity',
          value: 'item_danger_qty'
        },
        {
          name: 'Use weekly estimated quantity',
          value: 'weekly_qty'
        }
      ],
      when: function (answers){
        const argv = process.argv;
        if (!argv[6]){
          return true;
        } 
        answers.formular = validator.escape(argv[6]);
        return false;
      }
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock out form title in ${language}`,
      default: 'Stock Out',
      when: function (answers){
        const argv = process.argv;
        if (!argv[7]){
          return true;
        }  
        const answer = {
          title:{
            'en': validator.escape(argv[7].split(',')[0]),
            'fr': validator.escape(argv[7].split(',')[1])
          }
        };
        Object.assign(answers, answer);
        return false;
      }
    }))
  ]);
  return configs;
}

module.exports = {
  getStockOutConfigs,
  updateStockOut,
  getItemRows
};
