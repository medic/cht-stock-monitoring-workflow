const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');

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
};
