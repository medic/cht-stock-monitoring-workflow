const fs = require('fs');
const path = require('path');
const { Workbook } = require('exceljs');
const { getNoLabelsColums, buildRowValues, getSheetGroupBeginEnd, getRowWithValueAtPosition } = require('../common');
const chalk = require('chalk');

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
        messages[language]['stock_supply.confirmation.summary_note'],
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

function addStockConfirmCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_confirmed`, // Row name
      calculation: 'if(${have_receive_' + item.name + "_qty} = 'yes',${" + item.name + '_received},' + '${' + item.name + '_real_qty})',
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockConfirmSummaries(workSheet, items, languages, categories = []) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  let rows = [];
  if (categories.length > 0) {
    for (const category of categories) {
      const categoryItems = items.filter(it => it.category === category.name);
      rows.push(
        buildRowValues(header, {
          type: 'note',
          name: `${category.name}_summary`,
          appearance: 'h1 blue',
          relevant: categoryItems.map((item) => 'number(${' + item.name + '_received}) > 0').join(' or '),
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
        }),
        ...categoryItems.map((item) => (buildRowValues(header, {
          type: 'note',
          name: `${item.name}_summary`,
          appearance: 'li',
          relevant: 'number(${' + item.name + '_received}) > 0',
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.label[language]}: **` + '${' + `${item.name}_confirmed` + '} ' + `${item.unit}**` }), {})
        }))),
      );
    }
  } else {
    rows = items.map((item) => ({
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      relevant: 'number(${' + item.name + '_received}) > 0',
      ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.label[language]}: **` + '${' + `${item.name}_confirmed` + '} ' + `${item.unit}**` }), {})
    }));
  }

  //Insert item
  workSheet.insertRows(
    end,
    rows,
    'i+'
  );
}

function getItemRows(header, languages, messages, items) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: '${' + item.name + '_received} > 0',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'select_one yes_no',
        name: `have_receive_${item.name}_qty`,
        required: 'yes',
        ...languages.reduce((prev, language) => ({
          ...prev, [`label::${language}`]: messages[language]['stock_supply.confirmation.item_received_question']
            .replace('{{qty}}', '${' + item.name + '_received}')
            .replace('{{unit}}', item.unit)
            .replace('{{item}}', item.label[language]) }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `${item.name}_real_qty`,
        required: 'yes',
        constraint: '. != ${' + item.name + '_received}',
        relevant: '${have_receive_' + item.name + "_qty} = 'no'",
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.confirmation.qty_received_question'] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

async function updateStockConfirmation(configs, messages) {
  const processDir = process.cwd();
  const supplyConfigs = configs.features.stock_supply;
  const confirmConfigs = supplyConfigs.confirm_supply;
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  const { languages } = configs;

  const stockConfirmPath = path.join(processDir, 'forms', 'app', `${confirmConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockConfirmPath);
  const workbook = new Workbook();
  await workbook.xlsx.readFile(stockConfirmPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  const choiceLabelColumns = configs.languages.map((l) => [
    `label::${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();
  const choices = ['yes', 'no'].map((ch) => {
    const row = {
      list_name: 'yes_no',
      name: ch,
    };
    for (const language of configs.languages) {
      row[`label::${language}`] = messages[language][`stock_supply.choices.yes_no.${ch}`];
    }
    return buildRowValues(choiceHeader, row);
  });
  choiceWorkSheet.insertRows(
    2,
    choices,
    'i+'
  );

  const [labelColumns, hintColumns] = getLabelColumns(configs.languages, messages);
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

  // Add calculation
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  // inputs
  const inputs = [
    ...items.map((item) => buildRowValues(header, {
      type: 'hidden',
      name: `${item.name}_received`,
      ...getNoLabelsColums(languages)
    })),
    buildRowValues(header, {
      type: 'hidden',
      name: 'supplier_id',
      ...getNoLabelsColums(languages)
    }),
    buildRowValues(header, {
      type: 'hidden',
      name: 'supply_doc_id',
      ...getNoLabelsColums(languages)
    })
  ];
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 1);
  surveyWorkSheet.insertRows(
    position + 1,
    inputs,
    'i+'
  );

  const rows = [];
  if (configs.useItemCategory) {
    rows.push(
      ...categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category.name);
        return [
          buildRowValues(header, {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            relevant: categoryItems.map((item) => '${' + item.name + '_received} > 0').join(' or '),
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            messages,
            categoryItems,
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
        name: 'confirm_received',
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.label.confirm_qty'] }), {})
      }),
      ...getItemRows(
        header,
        languages,
        messages,
        items,
      ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
      buildRowValues(header, {
        type: 'end group',
      }),
    );
  }
  const [placePosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 1);
  surveyWorkSheet.insertRows(
    placePosition + 1,
    rows,
    'i+'
  );
  addStockConfirmCalculation(surveyWorkSheet, items);
  addStockConfirmSummaries(surveyWorkSheet, items, languages, categories);

  settingWorkSheet.getRow(2).getCell(1).value = confirmConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = confirmConfigs.form_name;

  await workbook.xlsx.writeFile(stockConfirmPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': false,
      'expression': `user.parent.contact_type === '${configs.levels[1].place_type}'`,
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: confirmConfigs.title[lang]
      };
    }),
  };
  const configStockPropertyPath = path.join(processDir, 'forms', 'app', `${confirmConfigs.form_name}.properties.json`);
  fs.writeFileSync(configStockPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${confirmConfigs.title[configs.defaultLanguage]} form updated successfully`));
}

module.exports = {
  updateStockConfirmation,
};
