const { getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations, getNumberOfParent } = require('../utils');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { DESCREPANCY_ADD_DOC } = require('../constants');

function getSummaries(languages, header, items, categories = []) {
  const rows = [];
  if (categories.length > 0) {
    for (const category of categories) {
      rows.push(
        buildRowValues(header, {
          type: 'note',
          name: `${category.name}_summary`,
          appearance: 'h1 blue',
          relevant: items.filter(it => it.category === category.name).map((item) => '${' + `${item.name}_qty} > 0`).join(' or '),
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
        }),
        ...items.filter(it => it.category === category.name).map((item) => [
          buildRowValues(header, {
            type: 'note',
            name: `${item.name}_summary`,
            appearance: 'li',
            relevant: '${' + `${item.name}_qty} > 0`,
            ...languages.reduce((prev, language) => ({
              ...prev,
              [`label::${language}`]: `${item.label[language]}: <b><span style="color:green">` + '${' + `${item.name}_qty}</span></b>`
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
          name: `${item.name}_summary`,
          appearance: 'li',
          relevant: '${' + `${item.name}_qty} > 0`,
          ...languages.reduce((prev, language) => ({
            ...prev,
            [`label::${language}`]: `${item.label[language]}: '<b><span style="color:green">` + '${' + `${item.name}_qty}</span></b>`
          }), {})
        }),
      ]).reduce((prev, next) => ([...prev, ...next]), []),
    );
  }
  return rows;
}

function getExportCalculations(header, items) {
  return [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_in`, // Row name
      calculation: 'if(${' + `${item.name}_qty} != '' and` + '${' + `${item.name}_qty} > 0,` + '${' + `${item.name}_received}-` + '${' + `${item.name}_qty},0`
    }))
  ];
}

function getAdditionalDoc(formName, docFormName, languages, header, items) {
  return [
    buildRowValues(header, {
      type: 'begin group',
      name: docFormName,
      appearance: 'field-list',
      'instance::db-doc': 'true',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'form',
      calculation: `"${docFormName}"`
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
      name: `${item.name}_out`, // Row name
      calculation: 'if(${' + `${item.name}_qty} != '' and` + '${' + `${item.name}_qty} > 0,` + '${' + `${item.name}_qty}-`+'${' + `${item.name}_confirmed},0)`
    })),
    buildRowValues(header, {
      type: 'calculate',
      name: 'confirmation_id',
      calculation: '${supply_confirm_id}'
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

function getItemRows(header, languages, messages, items) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: '${' + `${item.name}_received} !=` + '${' + `${item.name}_confirmed}`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_note_issued`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_supply.discrepancy.quantity_issued'].replace('{{qty}}', '${' + item.name + '_received}')
        }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `${item.name}_note_confirmed`,
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_supply.discrepancy.quantity_confirmed'].replace('{{qty}}', '${' + item.name + '_confirmed}')
        }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `${item.name}_qty`,
        required: 'yes',
        constraint: '. > 0',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.discrepancy.quantity_final'] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

async function updateStockDiscrepancy(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_supply.discrepancy;
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
        messages[language]['stock_supply.discrepancy.summary_header'],
        messages[language]['stock_supply.discrepancy.submit_note'],
        messages[language]['stock_supply.discrepancy.summary_note'],
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
  surveyWorkSheet.getColumn(lastColumnIndex + 1).values = [
    `instance::db-doc`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 2).values = [
    `instance::db-doc-ref`,
  ];
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  // Add parents
  const nbParents = getNumberOfParent(configs.levels[1].place_type, configs.levels[2].place_type);
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
  surveyWorkSheet.getRow(placeIdPosition).getCell(8).value = `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`;
  //Form inputs
  const inputs = [
    ...items.map((item) => [
      buildRowValues(header, {
        type: 'hidden',
        name: `${item.name}_received`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
      }),
      buildRowValues(header, {
        type: 'hidden',
        name: `${item.name}_confirmed`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: 'NO_LABEL' }), {})
      })
    ]).reduce((prev, next) => [...prev, ...next], []),
    buildRowValues(header, {
      type: 'hidden',
      name: 'level_1_place_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'hidden',
      name: 'supply_confirm_id',
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
            relevant: items.filter(it => it.category === category.name).map((item) => '${' + `${item.name}_received} !=` + '${' + `${item.name}_confirmed}`).join(' or '),
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
        items,
      ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
    );
  }
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  const [, summaryEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'summary');
  const summaries = getSummaries(languages, header, items, configs.useItemCategory ? categories : []);
  surveyWorkSheet.insertRows(
    summaryEnd,
    summaries,
    'i+'
  );
  const [, outEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'out');
  const calculations = getExportCalculations(header, items);
  //Insert item
  surveyWorkSheet.insertRows(
    outEnd,
    calculations,
    'i+'
  );
  const additionalDocRows = getAdditionalDoc(featureConfigs.form_name, DESCREPANCY_ADD_DOC, languages, header, items);
  surveyWorkSheet.insertRows(
    outEnd + 1 + calculations.length,
    additionalDocRows,
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

module.exports = {
  updateStockDiscrepancy
};
