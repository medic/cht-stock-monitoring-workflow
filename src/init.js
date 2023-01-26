const chalk = require('chalk');
const fs = require('fs');
const utils = require('./utils');
const path = require('path');
const Config = require('./config');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');

module.exports = async function () {
  const appSettings = Config.getAppSettings();
  const appPlaceTypes = appSettings ? appSettings.place_hierarchy_types : [];
  const processDir = process.cwd();

  if (utils.alreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'placeType',
      message: "Stock management place type",
      default: appPlaceTypes,
      choices: appPlaceTypes,
    },
    {
      type: 'input',
      name: 'expression',
      message: "Stock count form expression",
      default: (currentAnswers) => {
        return `contact.type === '${currentAnswers.placeType}'`;
      }
    }
  ]);
  const placeType = answers.placeType;
  const expression = answers.expression;
  console.log(chalk.blue.bold(`Initializing stock monitoring in level ${placeType}`));

  // Create configuration file
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  const config = {
    placeType: placeType,
    expression: expression,
  };
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));

  // Create stock count form xlsx
  // Copy form template
  fs.copyFileSync(path.join(__dirname, '../templates/stock_count.xlsx'), Config.STOCK_COUNT_PATH);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(Config.STOCK_COUNT_PATH);
  const formWorkSheet = workbook.getWorksheet(1);
  const row = formWorkSheet.getRow(6);
  row.getCell(6).value = `select-contact type-${placeType}`;
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
  row.getCell(6).value = `select-contact type-${placeType}`;
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
}