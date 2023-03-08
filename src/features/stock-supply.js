const { getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations } = require('../utils');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');

function addStockSupplyCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_supply`, // Row name
      calculation: '${' + `supply_${item.name}` + '}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockSupplySummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + `supply_${item.name}` + '} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label:${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + `supply_${item.name}` + '} ' + `${item.unit}** </h5>`; // Row label
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

async function updateStockConfirmation(configs) {
  const processDir = process.cwd();
  const supplyConfigs = configs.features.stock_supply;
  const confirmConfigs = supplyConfigs.confirm_supply;

  const stockConfirmPath = path.join(processDir, 'forms', 'app', `${confirmConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockConfirmPath);
}

async function updateStockSupply(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_supply;
  const { languages } = configs;
  const messages = getTranslations();
  const stockSupplyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.xlsx`);
  const items = Object.values(configs.items);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockSupplyPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockSupplyPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of configs.languages) {
    labelColumns.push(
      [
        `label:${language}`,
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
        messages[language]['stock_supply.summary_note'],
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
  settingWorkSheet.getRow(2).getCell(1).value = featureConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = featureConfigs.form_name;

  //Add choices
  const choiceLabelColumns = configs.languages.map((l) => [
    `label:${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();
  const choices = items.map((item) => {
    const row = {
      list_name: 'items',
      name: item.name,
    };
    for (const language of configs.languages) {
      row[`label:${language}`] = item.label[language]; // Row label
    }
    return buildRowValues(choiceHeader, row);
  });
  choiceWorkSheet.insertRows(
    2,
    choices,
    'i+'
  );

  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  const rows = items.map((item) => {
    return buildRowValues(header, {
      type: 'calculate',
      name: `stock_monitoring_${item.name}_qty`,
      calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
    });
  });
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  const selectPage = {
    type: 'begin group',
    name: 'select_items',
    appearance: 'field-list',
  };
  for (const language of configs.languages) {
    selectPage[`label:${language}`] = messages[language]['stock_supply.page_1.header']; // Row label
  }
  rows.push(buildRowValues(header, selectPage));
  const selectRow = {
    type: 'select_multiple items',
    name: 'selected_items',
    appearance: ''
  };
  for (const language of configs.languages) {
    selectRow[`label:${language}`] = messages[language]['stock_supply.page_1.select_input']; // Row label
  }
  for (const language of configs.languages) {
    selectRow[`hint:${language}`] = messages[language]['stock_supply.page_1.select_input_hint']; // Row label
  }
  rows.push(buildRowValues(header, selectRow));
  rows.push(buildRowValues(header, {
    type: 'end group'
  }));
  if (configs.useItemCategory) {
    for (const category of Object.values(configs.categories)) {
      const catHeader = {
        type: 'begin group',
        name: `category_${category.name}`,
        appearance: 'field-list',
      };
      for (const language of configs.languages) {
        catHeader[`label:${language}`] = category.label[language]; // Row label
      }
      rows.push(buildRowValues(header, catHeader));
      const categoryItems = items.filter((it) => it.category === category.name);
      for (const categoryItem of categoryItems) {
        const titleRow = {
          type: 'note',
          name: `note_${categoryItem.name}_title`,
          relevant: 'selected(${selected_items},' + `'${categoryItem.name}')`
        };
        for (const language of configs.languages) {
          titleRow[`label:${language}`] = `<h3 style="text-align:center; font-weight:bold; background-color:#93C47E;">${categoryItem.label[language]}</h3>`;
        }
        rows.push(buildRowValues(header, titleRow));
        const noteRow = {
          type: 'note',
          name: `note_current_${categoryItem.name}_qty`,
          relevant: 'selected(${selected_items},' + `'${categoryItem.name}')`
        };
        for (const language of configs.languages) {
          noteRow[`label:${language}`] = messages[language]['stock_supply.item.stock_on_hand'];
          noteRow[`hint:${language}`] = '${' + `stock_monitoring_${categoryItem.name}_qty` + '}';
        }
        rows.push(buildRowValues(header, noteRow));

        const rowQty = {
          type: 'decimal',
          name: `supply_${categoryItem.name}`,
          relevant: 'selected(${selected_items},' + `'${categoryItem.name}')`,
          default: 0,
        };
        for (const language of configs.languages) {
          rowQty[`label:${language}`] = messages[language]['stock_supply.item.quantity_of'] + ' ' + categoryItem.unit;
        }
        rows.push(buildRowValues(header, rowQty));
      }
      rows.push(buildRowValues(header, {
        type: 'end group'
      }));
    }
  } else {
    const pageHeader = {
      type: 'begin group',
      name: `item_quantity`,
      appearance: 'field-list',
    };
    for (const language of configs.languages) {
      pageHeader[`label:${language}`] = 'Quantity'; // Row label
    }
    rows.push(buildRowValues(header, pageHeader));
    for (const item of items) {
      const titleRow = {
        type: 'note',
        name: `note_${item.name}_title`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        titleRow[`label:${language}`] = `<h3 style="text-align:center; font-weight:bold; background-color:#93C47E;">${item.label[language]}</h3>`;
      }
      rows.push(buildRowValues(header, titleRow));
      const noteRow = {
        type: 'note',
        name: `note_current_${item.name}_qty`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        noteRow[`label:${language}`] = messages[language]['stock_supply.item.stock_on_hand'];
        noteRow[`hint:${language}`] = '${' + `stock_monitoring_${item.name}_qty` + '}';
      }
      rows.push(buildRowValues(header, noteRow));

      const rowQty = {
        type: 'decimal',
        name: `supply_${item.name}`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`,
        default: 0,
      };
      for (const language of configs.languages) {
        rowQty[`label:${language}`] = messages[language]['stock_supply.item.quantity_of'] + ' ' + item.unit;
      }
      rows.push(buildRowValues(header, rowQty));
    }
    rows.push(buildRowValues(header, {
      type: 'end group'
    }));
  }
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  addStockSupplySummaries(surveyWorkSheet, Object.values(configs.items), languages);
  addStockSupplyCalculation(surveyWorkSheet, Object.values(configs.items), languages);
  if (!featureConfigs.confirm_supply.active) {
    //TODO: Add additional docs and auto deduct
  }
  await workbook.xlsx.writeFile(stockSupplyPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': `contact.contact_type === '${configs.levels[1].place_type}' && user.role === '${configs.levels[2].role}'`,
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: featureConfigs.title[lang]
      };
    }),
  };
  const stockSupplyPropertyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.properties.json`);
  fs.writeFileSync(stockSupplyPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${featureConfigs.title[configs.defaultLanguage]} form updated successfully`));
  if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply) {
    updateStockConfirmation(configs);
  }
}

module.exports = {
  addStockSupplyCalculation,
  addStockSupplySummaries,
  updateStockSupply,
};
