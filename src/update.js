const ExcelJS = require('exceljs');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const Config = require('./config');

function addStockCountItem(workSheet, items) {
  // Find items group last row number
  let foundItemBeginGroup = false;
  let itemEndGroupRowNumber = 0;
  workSheet.eachRow(function (row, rowNumber) {
    if (row.values.includes("begin group") && row.values.includes("items")) {
      foundItemBeginGroup = true;
      console.log('foundItemBeginGroup', rowNumber);
    }
    if (row.values.includes("end group") && foundItemBeginGroup && itemEndGroupRowNumber === 0) {
      itemEndGroupRowNumber = rowNumber;
      console.log('end group', rowNumber);
    }
  });
  console.log('itemEndGroupRowNumber', itemEndGroupRowNumber);

  //Insert item
  workSheet.insertRows(
    itemEndGroupRowNumber,
    Array(items.length).fill([]),
    'i+'
  );
}

module.exports = async function ({
  placeType,
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
  const row = formWorkSheet.getRow(6);

  // Add language column
  const columns = [];
  for (const language of languages) {
    columns.push(
      [
        `label:${language}`,
        'Patient',
        'Source',
        'Source ID',
        'NO_LABEL',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(7).fill(''),
        messages[language].stock_count_balance_fill,
        messages[language].stock_count_commodities_note,
        '', '', '',
        messages[language].stock_count_summary_header,
        messages[language].stock_count_submit_note,
        messages[language].stock_count_summary_note,
      ]
    );
  }
  formWorkSheet.spliceColumns(3, languages.length, ...columns);

  // Styling new columns cells
  for (let i = 0; i < languages.length; i++) {
    const cellIndex = 3 + i;
    for (let index = 0; index < 23; index++) {
      const style = formWorkSheet.getRow(index + 1).getCell(1).style;
      formWorkSheet.getRow(index + 1).getCell(cellIndex).style = style;
    }
  }

  // Add place selection
  row.getCell(6).value = `select-contact type-${placeType}`;
  addStockCountItem(formWorkSheet, Object.values(items));

  await workbook.xlsx.writeFile(Config.STOCK_COUNT_PATH);

  // Add stock count form properties
  const formProperties = {
    "icon": "icon-healthcare-medicine",
    "context": {
      "person": false,
      "place": true,
      "expression": expression
    }
  }
  fs.writeFileSync(Config.STOCK_COUNT_PROPERTY_PATH, JSON.stringify(formProperties, null, 4));

  // Add consumption log form xlsx
  fs.copyFileSync(path.join(__dirname, '../templates/consumption_log.xlsx'), Config.CONSUMPTION_LOG_PATH);
  const cLogWorkbook = new ExcelJS.Workbook();
  await cLogWorkbook.xlsx.readFile(Config.CONSUMPTION_LOG_PATH);
  const cLogFormWorkSheet = workbook.getWorksheet(1);
  const cLogRow = cLogFormWorkSheet.getRow(6);
  cLogRow.getCell(6).value = `select-contact type-${placeType}`;
  await cLogWorkbook.xlsx.writeFile(Config.CONSUMPTION_LOG_PATH);

  // Add consumption log form properties
  const cLogFormProperties = {
    "icon": "icon-healthcare-medicine",
    "context": {
      "person": false,
      "place": true,
      "expression": expression
    }
  }
  fs.writeFileSync(Config.CONSUMPTION_LOG_PROPERTY_PATH, JSON.stringify(cLogFormProperties, null, 4));
  console.log(chalk.green('INFO File updated successfully'));
}