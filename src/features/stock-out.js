const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');
const { getTranslations, getRowWithValueAtPosition, getNumberOfSteps, buildRowValues, getSheetGroupBeginEnd } = require('../utils');

function getItemRows(header, languages, messages, items) {
  return items.map((item) => {
    return [
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
          [`label::${language}`]: messages[language]['stock_out.message.stock_at_hand'].replace('{{qty}}', '${' + item.name + '_at_hand}')
        }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_note_required`,
        appearance: 'li',
        relevant: '${' + `${item.name}_at_hand} <=` + '${' + `${item.name}_required}`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_out.message.stock_required'].replace('{{qty}}', '${' + item.name + '_required}')
        }), {})
      }),
    ];
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
          ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
        }),
        buildRowValues(header, {
          type: 'string',
          name: '_id',
          ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
        })
      ]
    ).reduce((prev, next) => [...prev, ...next], []),
    ...Array(nbParents).fill(
      buildRowValues(header, {
        type: 'end group',
      })
    )
  ];
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', 2);
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactParentRows,
    'i+'
  );
  const [placeIdPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
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
  const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 2);
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

  // Add stock count form properties
  const expression = `user.parent.contact_type === '${configs.levels[2].place_type}' && contact.contact_type === '${configs.levels[2].place_type}'`;
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
  console.log(chalk.green(`INFO ${featureConfigs.form_name} updated successfully`));
}

async function getStockOutConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock out form ID',
      default: 'stock_out'
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
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock out form title in ${language}`,
      default: 'Stock Out'
    }))
  ]);
  return configs;
}

module.exports = {
  getStockOutConfigs,
  updateStockOut,
};
