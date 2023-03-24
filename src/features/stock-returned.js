const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const ExcelJS = require('exceljs');
const { getRowWithValueAtPosition, getTranslations, buildRowValues, getSheetGroupBeginEnd, getNumberOfSteps } = require('../utils');
const { RETURNED_ADD_DOC } = require('../constants');

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

function getItemRows(header, languages, messages, items) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: '${' + `${item.name}_return} > 0`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'select_one yes_no',
        name: `${item.name}_received`,
        required: 'yes',
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_return.confirmation.item_received_question'].replace('{{qty}}', '${' + item.name + '_return}').replace('{{unit}}', item.unit).replace('{{item}}', item.label[language])
        }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `${item.name}_received_qty`,
        required: 'yes',
        constraint: '. > 0',
        relevant: '${' + `${item.name}_received} = 'no'`,
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.confirmation.qty_received_question'] }), {})
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
  const rows = [];
  if (categories.length > 0) {
    for (const category of categories) {
      rows.push(
        buildRowValues(header, {
          type: 'note',
          name: `${category.name}_summary`,
          appearance: 'h1 blue',
          relevant: items.filter(it => it.category === category.name).map((item) => '${' + `${item.name}_return} > 0`).join(' or '),
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
        }),
        ...items.filter(it => it.category === category.name).map((item) => [
          buildRowValues(header, {
            type: 'note',
            name: `${item.name}_summary_no`,
            appearance: 'li',
            relevant: '${' + `${item.name}_received} = 'no'`,
            ...languages.reduce((prev, language) => ({
              ...prev,
              [`label::${language}`]: `${item.label[language]}: ` + '<span style="color:red"><s>${' + `${item.name}_return}</s></span> | ` + '<b><span style="color:green">${' + `${item.name}_received_qty}</span></b>`
            }), {})
          }),
          buildRowValues(header, {
            type: 'note',
            name: `${item.name}_summary_yes`,
            appearance: 'li',
            relevant: '${' + `${item.name}_received} = 'yes'`,
            ...languages.reduce((prev, language) => ({
              ...prev,
              [`label::${language}`]: `${item.label[language]}: ` + '${' + `${item.name}_return}`
            }), {})
          }),
        ]).reduce((prev, next) => ([...prev, ...next]), []),
      );
    }
  } else {
    //TODO: Add no category list
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
      name: `${item.name}_in`, // Row name
      calculation: 'if(${' + `${item.name}_received} = 'no',` + '${' + `${item.name}_received_qty},` + '${' + `${item.name}_return})`
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function getAdditionalDoc(formName, languages, header, items) {
  return [
    buildRowValues(header, {
      type: 'begin group',
      name: RETURNED_ADD_DOC,
      appearance: 'field-list',
      'instance::db-doc': 'true',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'form',
      calculation: `"${RETURNED_ADD_DOC}"`
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'place_id',
      calculation: '${level_1_place_id}'
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'type',
      calculation: '"data_record"'
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'created_from',
      calculation: '.',
      'instance::db-doc-ref': `/${formName}`
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'content_type',
      calculation: '"xml"'
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'contact',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: '_id',
      calculation: '${user_contact_id}'
    }),
    buildRowValues(header, {
      type: 'end group',
      name: 'contact',
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'fields',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_return_difference`, // Row name
      calculation: 'if(${' + `${item.name}_received} = 'no',` + '${' + `${item.name}_return}-` + '${' + `${item.name}_received_qty},0)`
    })),
    buildRowValues(header, {
      type: 'calculate',
      name: 'return_id',
      calculation: '${stock_return_id}',
    }),
    buildRowValues(header, {
      type: 'end group',
      name: 'fields',
    }),
    buildRowValues(header, {
      type: 'end group'
    })
  ];
}

async function updateStockReturned(configs) {
  const processDir = process.cwd();
  const returnedConfigs = configs.features.stock_return.confirmation;
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  const { languages } = configs;
  const messages = getTranslations();

  const returnedFormPath = path.join(processDir, 'forms', 'app', `${returnedConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), returnedFormPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(returnedFormPath);
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
  surveyWorkSheet.getColumn(lastColumnIndex + 1).values = [
    `instance::db-doc`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 2).values = [
    `instance::db-doc-ref`,
  ];
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();

  // Add parents
  const nbParents = getNumberOfSteps(configs.levels[1].place_type, configs.levels[2].place_type);
  const contactParentRows = [];
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
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
    );
  }
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
      buildRowValues(header, {
        type: 'end group',
      })
    );
  }
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', 2);
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactParentRows,
    'i+'
  );
  const [placeIdPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.getRow(placeIdPosition).getCell(8).value = `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`;

  const inputs = [
    ...items.map((item) => {
      return buildRowValues(header, {
        type: 'hidden',
        name: `${item.name}_return`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
      });
    }),
    buildRowValues(header, {
      type: 'hidden',
      name: 'level_1_place_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'hidden',
      name: 'stock_return_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    })
  ];
  const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 2);
  surveyWorkSheet.insertRows(
    inputPosition + 1,
    inputs,
    'i+'
  );

  const rows = [
    buildRowValues(header, {
      type: 'calculate',
      name: `user_contact_id`,
      calculation: `../inputs/user/contact_id`
    })
  ];
  if (configs.useItemCategory) {
    rows.push(
      ...categories.map((category) => {
        return [
          buildRowValues(header, {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            relevant: items.filter(it => it.category === category.name).map((item) => '${' + `${item.name}_return} > 0`).join(' or '),
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            messages,
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
      ...getItemRows(
        header,
        languages,
        messages,
      ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
    );
  }
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  addReturnedSummaries(surveyWorkSheet, languages, items, configs.useItemCategory ? categories : []);
  addExportCalculation(surveyWorkSheet, items);
  const [, end] = getSheetGroupBeginEnd(surveyWorkSheet, 'out');
  const additionalDocRows = getAdditionalDoc(returnedConfigs.form_name, languages, header, items);
  surveyWorkSheet.insertRows(
    end + 2,
    additionalDocRows,
    'i+'
  );

  //CHOICES
  const choiceLabelColumns = languages.map((l) => [
    `label::${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();

  const choices = ['yes', 'no'].map((ch) => buildRowValues(choiceHeader,
    {
      list_name: 'yes_no',
      name: ch,
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language][`stock_supply.choices.yes_no.${ch}`] }), {})
    }
  ));
  choiceWorkSheet.insertRows(
    2,
    choices,
    'i+'
  );

  // SETTINGS
  settingWorkSheet.getRow(2).getCell(1).value = returnedConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = returnedConfigs.form_name;

  await workbook.xlsx.writeFile(returnedFormPath);

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
        content: returnedConfigs.title[lang]
      };
    }),
  };
  const propertyPath = path.join(processDir, 'forms', 'app', `${returnedConfigs.form_name}.properties.json`);
  fs.writeFileSync(propertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${returnedConfigs.form_name} updated successfully`));
}

module.exports = {
  updateStockReturned,
};
