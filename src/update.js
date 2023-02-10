const ExcelJS = require('exceljs');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const Config = require('./config');
const { getSheetGroupBeginEnd, updateColoumnsStyle } = require('./utils');

const DEFAULT_LABEL_COLUMN_INDEX = 3;
const DEFAULT_HINT_COLUMN_INDEX = 11;

function addStockCountItem(workSheet, items, languages) {
  // Find items group last row number
  const [, itemEndGroupRowNumber] = getSheetGroupBeginEnd(workSheet, 'items');
  const itemRows = [];
  for (const item of items) {
    const itemRow = [
      'integer', // Row type
      item.name, // Row name
    ];
    for (const language of languages) {
      itemRow.push(item.label[language] || ''); // Row label
    }
    itemRow.push(...['yes', '', '']); // Row required, relevant and appearance
    itemRow.push(`. >= 0 and . <= ${item.reception_max}`); // Row condition
    itemRows.push(itemRow);
  }

  //Insert item
  workSheet.insertRows(
    itemEndGroupRowNumber,
    itemRows,
    'i+'
  );
}

function addConsumptionItem(workSheet, items, languages, type = 'items_received') {
  // Find items group last row number
  const [, itemEndGroupRowNumber] = getSheetGroupBeginEnd(workSheet, type);
  const itemRows = [];
  for (const item of items) {
    const itemRow = [
      'integer', // Row type
      type === 'items_received' ? item.name : `${item.name}_r`, // Row name
    ];
    itemRow.push(item.label[languages[0]] || ''); 
    itemRow.push(...['yes', '', '']); // Row required, relevant and appearance
    itemRow.push(`. >= 0 and . <= ${item.reception_max}`); // Row condition
    itemRows.push(itemRow);
  }

  //Insert item
  workSheet.insertRows(
    itemEndGroupRowNumber,
    itemRows,
    'i+'
  );
}

function addConsumptionLogSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const itemRows = [];
  const returnedItemRows = [];
  for (const item of items) {
    const itemRow = [
      'note', // Row type
      `s_${item.name}_received`, // Row name
    ];
    // rome-ignore lint/style/useTemplate: <explanation>
    itemRow.push(`<h5 style="text-align:center;"> ${item.label[languages[0]]}: **` + '${' + item.name + '} ' + `${item.unit}** </h5>`); // Row label
    // rome-ignore lint/style/useTemplate: <explanation>
    itemRow.push(...['', '${' + `${item.name}` + '} > 0', '']); // Row required, relevant and appearance
    itemRows.push(itemRow);

    const returnedItemRow = [...itemRow];
    returnedItemRow[1] = `s_${item.name}_returned`;
    // rome-ignore lint/style/useTemplate: <explanation>
    returnedItemRow[2] = `<h5 style="text-align:center;"> ${item.label[languages[0]]}: **` + '${' + item.name + '_r} ' + `${item.unit}** </h5>`; // Row label
    // rome-ignore lint/style/useTemplate: <explanation>
    returnedItemRow[4] = '${' + `${item.name}_r` + '} > 0';
    returnedItemRows.push(returnedItemRow);
  }

  //Insert item
  workSheet.insertRows(
    end-3,
    itemRows,
    'i+'
  );
  //Insert item
  workSheet.insertRows(
    end,
    returnedItemRows,
    'i+'
  );
}

function addStockCountSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const itemRows = [];
  for (const item of items) {
    const itemRow = [
      'note', // Row type
      `s_${item.name}`, // Row name
    ];
    for (const language of languages) {
      // rome-ignore lint/style/useTemplate: <explanation>
      itemRow.push(`<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + item.name + '} ' + `${item.unit}** </h5>`); // Row label
    }
    // rome-ignore lint/style/useTemplate: <explanation>
    itemRow.push(...['', '${'+`${item.name}`+'} > 0', '']); // Row required, relevant and appearance
    itemRows.push(itemRow);
  }

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addConsumptionLogCalculation(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const itemRows = [];
  for (const item of items) {
    const itemRow = [
      'calculate', // Row type
      `${item.name}_received`, // Row name
      ...Array(languages.length).fill(''), // Row language
      ...Array(4).fill(''),
      // rome-ignore lint/style/useTemplate: <explanation>
      '${' + item.name + '}'
    ];
    itemRows.push(itemRow);
    const returnedtemRow = [
      'calculate', // Row type
      `${item.name}_returned`, // Row name
      ...Array(languages.length).fill(''), // Row language
      ...Array(4).fill(''),
      // rome-ignore lint/style/useTemplate: <explanation>
      '${' + item.name + '_r}'
    ];
    itemRows.push(returnedtemRow);
  }

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockCountCalculation(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const itemRows = [];
  for (const item of items) {
    const itemRow = [
      'calculate', // Row type
      `${item.name}_received`, // Row name
      ...Array(languages.length).fill(''), // Row language
      ...Array(5).fill(''),
      // rome-ignore lint/style/useTemplate: <explanation>
      '${'+item.name+'}'
    ];
    itemRows.push(itemRow);
  }

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

module.exports = async function ({
  expression,
  languages,
  messages,
  items,
}) {
  console.log(chalk.green('INFO Updating files'));
  // Create stock count form xlsx
  // Copy form template
  fs.copyFileSync(path.join(__dirname, '../templates/stock_count.xlsx'), Config.STOCK_COUNT_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(Config.STOCK_COUNT_PATH);
  const formWorkSheet = workbook.getWorksheet(1);

  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of languages) {
    labelColumns.push(
      [
        `label:${language}`,
        'Patient',
        'Source',
        'Source ID',
        '',
        'NO_LABEL',
        '',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(8).fill(''),
        messages[language].stock_count_balance_fill,
        messages[language].stock_count_commodities_note,
        '', '', '',
        messages[language].stock_count_summary_header,
        messages[language].stock_count_submit_note,
        messages[language].stock_count_summary_note,
        ...Array(4).fill(''),
        'NO_LABEL',
      ]
    );
    hintColumns.push(
      [
        `hint:${language}`,
      ]
    );
  }
  formWorkSheet.spliceColumns(DEFAULT_LABEL_COLUMN_INDEX, 1, ...labelColumns);
  const hintIndex = DEFAULT_HINT_COLUMN_INDEX + languages.length - 1;
  formWorkSheet.spliceColumns(hintIndex, 1, ...hintColumns);

  // Styling new columns cells
  for (let i = 0; i < languages.length; i++) {
    const cellIndex = DEFAULT_LABEL_COLUMN_INDEX + i;
    updateColoumnsStyle(formWorkSheet, cellIndex);
    const hintCellIndex = hintIndex + i;
    updateColoumnsStyle(formWorkSheet, hintCellIndex);
  }

  // Add place selection
  addStockCountItem(formWorkSheet, Object.values(items), languages);
  addStockCountSummaries(formWorkSheet, Object.values(items), languages);
  addStockCountCalculation(formWorkSheet, Object.values(items), languages);

  await workbook.xlsx.writeFile(Config.STOCK_COUNT_PATH);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': expression
    }
  };
  fs.writeFileSync(Config.STOCK_COUNT_PROPERTY_PATH, JSON.stringify(formProperties, null, 4));

  // Add consumption log form xlsx
  fs.copyFileSync(path.join(__dirname, '../templates/consumption_log.xlsx'), Config.CONSUMPTION_LOG_PATH);
  const cLogWorkbook = new ExcelJS.Workbook();
  await cLogWorkbook.xlsx.readFile(Config.CONSUMPTION_LOG_PATH);
  const cLogFormWorkSheet = cLogWorkbook.getWorksheet(1);
  addConsumptionItem(cLogFormWorkSheet, Object.values(items), languages, 'items_received');
  addConsumptionItem(cLogFormWorkSheet, Object.values(items), languages, 'items_returned');
  addConsumptionLogSummaries(cLogFormWorkSheet, Object.values(items), languages);
  addConsumptionLogCalculation(cLogFormWorkSheet, Object.values(items), languages);
  await cLogWorkbook.xlsx.writeFile(Config.CONSUMPTION_LOG_PATH);

  // Add consumption log form properties
  const cLogFormProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': expression
    }
  };
  fs.writeFileSync(Config.CONSUMPTION_LOG_PROPERTY_PATH, JSON.stringify(cLogFormProperties, null, 4));
  console.log(chalk.green('INFO File updated successfully'));

  // Get items

};
