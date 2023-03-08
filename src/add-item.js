const inquirer = require('inquirer');
const utils = require('./utils');
const path = require('path');
const fs = require('fs-extra');

/**
 * Config
 * - expression
 * - languages
 * - useItemCategory
 * - confirmItemSupply
 * - messages
 * - categories = {}
 * - items = {}
 * - forms = {}
 */
async function getItemConfig(config) {
  const processDir = process.cwd();
  let categoryConfig = null;
  let itemConfig = null;
  let formConfig = {};

  // Get form id
  const formAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'form',
      message: 'Form ID',
      validate: async (input) => {
        //Find stock_monitoring_area_id
        const formPath = path.join(processDir, 'forms', 'app', `${input}.xlsx`);
        if (!fs.existsSync(formPath)) {
          return `Form ${input} not found`;
        }
        return true;
      }
    }
  ]);

  // Find if place_id calculation exist in form
  const form = formAnswer.form;
  formConfig = config.forms[form] || {
    items: {}
  };
  formConfig.name = form;

  if (!formConfig.place_id) {
    const formPath = path.join(processDir, 'forms', 'app', `${form}.xlsx`);
    const workSheet = await utils.getWorkSheet(formPath);
    const [, stockMonitoringAreaIdRow] = utils.getRowWithValueAtPosition(workSheet, 'place_id');
    if (!stockMonitoringAreaIdRow) {
      // Ask place_id
      const placeAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'place_id',
          message: 'Add form place_id calculation'
        }
      ]);
      formConfig['place_id'] = placeAnswer.place_id;
    }
  }

  // Find existing items not in form to propose them
  const configItems = Object.keys(config.items);
  const formItems = Object.keys(formConfig.items);
  const existingItems = configItems.filter((it) => !formItems.includes(it));

  // Propose to select item
  if (existingItems.length > 0) {
    const choices = existingItems.map((it) => {
      return {
        name: config.items[it].label[config.languages[0]],
        value: it,
      };
    });
    choices.push({
      name: 'Create new item',
      value: '___new_item___'
    });
    const itemSelect = await inquirer.prompt([{
      type: 'list',
      name: 'item',
      message: 'Select item',
      choices,
    }]);
    if (itemSelect.item !== '___new_item___') {
      itemConfig = config.items[itemSelect.item];
      if (itemConfig.category) {
        categoryConfig = config.categories[itemConfig.category];
      }
    }
  }

  if (!itemConfig) {
    if (config.useItemCategory) {
      if (config.categories && Object.keys(config.categories).length > 0) {
        // Propose category to select
        const choices = Object.values(config.categories).map((it) => ({
          name: it.label[config.languages[0]],
          value: it.name,
        }));
        choices.push({
          name: 'Create new category',
          value: '___new_category___'
        });
        const categorySelect = await inquirer.prompt([{
          type: 'list',
          name: 'category',
          message: 'Select category',
          choices,
        }]);
        if (categorySelect.category !== '___new_category___') {
          categoryConfig = config.categories[categorySelect.category];
        }
      }
      if (!categoryConfig) {
        categoryConfig = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter category name',
          },
          ...config.languages.map((language) => ({
            type: 'input',
            name: `label.${language}`,
            message: `Enter category label in ${language}`
          })),
          ...config.languages.map((language) => ({
            type: 'input',
            name: `description.${language}`,
            message: `Enter category description in ${language}`
          }))
        ]);
      }
    }
    itemConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter item name',
      },
      ...config.languages.map((language) => ({
        type: 'input',
        name: `label.${language}`,
        message: `Enter item label in ${language}`
      })),
      {
        type: 'input',
        name: 'unit',
        message: 'Enter item unit',
      },
      {
        type: 'number',
        name: 'warning_total',
        message: 'Warning total',
      },
      {
        type: 'number',
        name: 'danger_total',
        message: 'Danger total',
      }
    ]);
    if (categoryConfig) {
      itemConfig.category = categoryConfig.name;
    }
  }

  const itemDeduction = await inquirer.prompt([
    {
      type: 'list',
      name: 'deduction_type',
      message: 'How is the item deduced ?',
      choices: [
        {
          name: 'User select quantity',
          value: 'by_user'
        },
        {
          name: 'Custom automatic formula',
          value: 'formula'
        }
      ]
    }
  ]);

  const formularRequest = await inquirer.prompt([
    {
      type: 'input',
      name: 'formular',
      message: itemDeduction.deduction_type === 'formula' ? 'Enter formular' : 'In what condition ask the quantity?'
    }
  ]);
  itemDeduction.formular = formularRequest.formular;
  
  formConfig.items[itemConfig.name] = itemDeduction;
  return {
    formConfig,
    categoryConfig,
    itemConfig
  };
}

function addConfigItem(appConfig, {
  formConfig,
  categoryConfig,
  itemConfig
}) {
  appConfig.items[itemConfig.name] = itemConfig;
  appConfig.categories[categoryConfig.name] = categoryConfig;
  appConfig.forms[formConfig.name] = formConfig;
  utils.writeConfig(appConfig);
  return appConfig;
}

module.exports = {
  getItemConfig,
  addConfigItem,
};
