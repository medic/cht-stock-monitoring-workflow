const inquirer = require('inquirer');
const utils = require('./common');
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
async function getItemConfig(configs) {
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
  formConfig = configs.forms[form] || {
    items: {}
  };
  formConfig.name = form;
  if (!formConfig.reportedDate || formConfig.reportedDate.length === 0) {
    const reportedDateSameAsCurrent = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'isAlwaysCurrent',
        message: `Is ${form} report reported date always the current date?`,
        default: true
      }
    ]);
    if (!reportedDateSameAsCurrent.isAlwaysCurrent) {
      const reportDateFormular = await inquirer.prompt([
        {
          type: 'input',
          name: 'reportedDate',
          message: 'Enter a xlsform calculation formular to calculate the reported date',
          default: 'now()'
        }
      ]);
      formConfig.reportedDate = `${reportDateFormular.reportedDate}`;
    } else {
      formConfig.reportedDate = 'now()';
    }
  }

  // Find existing items not in form to propose them
  const configItems = Object.keys(configs.items);
  const formItems = Object.keys(formConfig.items);
  const existingItems = configItems.filter((it) => !formItems.includes(it));

  // Propose to select item
  if (existingItems.length > 0) {
    const choices = existingItems.map((it) => {
      return {
        name: configs.items[it].label[configs.languages[0]],
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
      itemConfig = configs.items[itemSelect.item];
      if (itemConfig.category) {
        categoryConfig = configs.categories[itemConfig.category];
      }
    }
  }

  // Creating a new item
  if (!itemConfig) {
    if (configs.useItemCategory) {
      if (configs.categories && Object.keys(configs.categories).length > 0) {
        // Propose category to select
        const choices = Object.values(configs.categories).map((it) => ({
          name: it.label[configs.languages[0]],
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
          categoryConfig = configs.categories[categorySelect.category];
        }
      }
      if (!categoryConfig) {
        categoryConfig = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter category name',
          },
          ...configs.languages.map((language) => ({
            type: 'input',
            name: `label.${language}`,
            message: `Enter category label in ${language}`
          })),
          ...configs.languages.map((language) => ({
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
      ...configs.languages.map((language) => ({
        type: 'input',
        name: `label.${language}`,
        message: `Enter item label in ${language}`
      })),
      {
        type: 'confirm',
        name: 'isInSet',
        message: 'Can this item be organized in set like box/blister?',
        default: true,
      },
    ]);

    if (itemConfig.isInSet) {
      const setConfigs = await inquirer.prompt([
        ...configs.languages.map((language) => ({
          type: 'input',
          name: `set.label.${language}`,
          message: `What is the name of the set? Ex: box of 8 in ${language} ?`
        })),
        {
          type: 'number',
          name: 'set.count',
          message: 'How many units are there in the set ? '
        },
      ]);
      Object.assign(itemConfig, setConfigs);
    }
    const itemGeneralConfigs = await inquirer.prompt([
      ...configs.languages.map((language) => ({
        type: 'input',
        name: `unit.label.${language}`,
        message: `What is the name of the unit? Ex: Tablet in ${language} ?`
      })),
      {
        type: 'number',
        name: 'warning_total',
        message: 'What is the threshold (quantity) that requires attention ? ',
      },
      {
        type: 'number',
        name: 'danger_total',
        message: 'What is the threshold (quantity) that triggers a stock out ? ',
      },
      {
        type: 'number',
        name: 'max_total',
        message: 'What is the maximum quantity to have for this item ? ',
        default: -1,
      }
    ]);
    Object.assign(itemConfig, itemGeneralConfigs);
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
  if (categoryConfig) {
    appConfig.categories[categoryConfig.name] = categoryConfig;
  }
  appConfig.forms[formConfig.name] = formConfig;
  utils.writeConfig(appConfig);
  return appConfig;
}

module.exports = {
  getItemConfig,
  addConfigItem,
};
