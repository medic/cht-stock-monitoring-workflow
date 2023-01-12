const chalk = require('chalk');
const fs = require('fs');
const utils = require('./utils');
const path = require('path');
const constants = require('./constants');
const ExcelJS = require('exceljs');

module.exports = async function (level, formula) {
  console.log(chalk.blue.bold(`Initializing stock monitoring in level ${level}`));

  const processDir = process.cwd();
  if (utils.alreadyInit()) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  // Create configuration file
  const configFilePath = path.join(processDir, 'stm.config.json');
  const config = {
    level,
    expression: formula,
  };
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));

  // Create stock count form xlsx
  // Copy form template
  fs.copyFileSync('../templates/stock_count.xlsx', constants.STOCK_COUNT_PATH);
  // Update level
  const streamOption = {
    filename: constants.STOCK_COUNT_PATH,
    useStyles: true,
    useSharedStrings: true
  };
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter(streamOption);
  const formWorkSheet = workbook.getWorksheet(0);
  formWorkSheet.getCell('A6').value = `db:${level}`;
  formWorkSheet.commit();
  await workbook.commit();

  // Add stock count form properties
  const formProperties = {
    "icon": "icon-healthcare-medicine",
    "context": {
      "person": false,
      "place": true,
      "expression": formula
    }
  }
  fs.writeFileSync(constants.STOCK_COUNT_PROPERTY_PATH, JSON.stringify(formProperties, null, 4));

  // Add consumption log form xlsx
  // Add consumption log form properties
}