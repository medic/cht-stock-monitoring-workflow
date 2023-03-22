const fs = require('fs');
const path = require('path');
const { Workbook } = require('exceljs');
const { buildRowValues, getSheetGroupBeginEnd, getRowWithValueAtPosition } = require('../utils');
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

function addStockConfirmSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + item.name + '_received} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + `${item.name}_confirmed` + '} ' + `${item.unit}** </h5>`; // Row label
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

async function updateStockConfirmation(configs, messages) {
  const processDir = process.cwd();
  const supplyConfigs = configs.features.stock_supply;
  const confirmConfigs = supplyConfigs.confirm_supply;
  const items = Object.values(configs.items);
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

  // Add calculation
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  const inputs = [
    ...items.map((item) => buildRowValues(header, {
      type: 'hidden',
      name: `${item.name}_received`,
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    })),
    buildRowValues(header, {
      type: 'hidden',
      name: 'supply_doc_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    })
  ];
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 2);
  surveyWorkSheet.insertRows(
    position + 1,
    inputs,
    'i+'
  );

  const rows = [];
  if (configs.useItemCategory) {
    const categories = Object.values(configs.categories);
    for (const category of categories) {
      const categoryItems = items.filter((it) => it.category === category.name);
      const catHeader = {
        type: 'begin group',
        name: `category_${category.name}`,
        relevant: categoryItems.map((item) => '${' + item.name + '_received} > 0').join(' or '),
        appearance: 'field-list',
      };
      for (const language of configs.languages) {
        catHeader[`label::${language}`] = category.label[language]; // Row label
      }
      rows.push(buildRowValues(header, catHeader));
      for (const categoryItem of categoryItems) {
        const confirmationRow = {
          type: 'select_one yes_no',
          name: `have_receive_${categoryItem.name}_qty`,
          required: 'yes',
          relevant: '${' + categoryItem.name + '_received} > 0'
        };
        for (const language of configs.languages) {
          let msg = messages[language]['stock_supply.confirmation.item_received_question'];
          msg = msg.replace('{{qty}}', '${' + categoryItem.name + '_received}');
          msg = msg.replace('{{unit}}', categoryItem.unit);
          msg = msg.replace('{{item}}', categoryItem.label[language]);
          confirmationRow[`label::${language}`] = msg;
        }
        rows.push(buildRowValues(header, confirmationRow));

        const qtyRow = {
          type: 'decimal',
          name: `${categoryItem.name}_real_qty`,
          required: 'yes',
          constraint: '. != ${' + categoryItem.name + '_received}',
          relevant: '${have_receive_' + categoryItem.name + "_qty} = 'no'"
        };
        for (const language of configs.languages) {
          qtyRow[`label::${language}`] = messages[language]['stock_supply.confirmation.qty_received_question'];
        }
        rows.push(buildRowValues(header, qtyRow));
      }
      rows.push(buildRowValues(header, {
        type: 'end group'
      }));
    }
  } else {
    for (const item of items) {
      const confirmationRow = {
        type: 'select_one yes_no',
        name: `have_receive_${item.name}_qty`,
        required: 'yes',
        relevant: '${' + item.name + '_received} > 0',
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_supply.confirmation.item_received_question'].replace('{{qty}}', '${' + item.name + '_received}').replace('{{unit}}', item.unit).replace('{{item}}', item.label[language]),
        }), {})
      };
      rows.push(buildRowValues(header, confirmationRow));

      const qtyRow = {
        type: 'decimal',
        name: `${item.name}_real_qty`,
        required: 'yes',
        constraint: '. != ${' + item.name + '_received}',
        relevant: '${have_receive_' + item.name + "_qty} = 'no'"
      };
      for (const language of configs.languages) {
        qtyRow[`label::${language}`] = messages[language]['stock_supply.confirmation.qty_received_question'];
      }
      rows.push(buildRowValues(header, qtyRow));
    }
    rows.push(buildRowValues(header, {
      type: 'end group'
    }));
  }
  const [placePosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.insertRows(
    placePosition + 1,
    rows,
    'i+'
  );
  addStockConfirmCalculation(surveyWorkSheet, items);
  addStockConfirmSummaries(surveyWorkSheet, items, languages);

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
