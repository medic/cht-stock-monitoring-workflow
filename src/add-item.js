const inquirer = require('inquirer');
const utils = require('./utils');
const path = require('path');
const fs = require('fs');
const { STOCK_MONITORING_AREA_ROW_NAME } = require('./config');

function getPreviousItemValue(config, form, item, param) {
  if (config.items?.[item]) {
    const properties = config.items[item];
    if (param === 'expression') {
      return properties.forms[form] || '';
    }
    if (param.startsWith('label')) {
      const language = param.split('.')[1];
      return properties.label[language];
    }
    return properties[param];
  }
  return '';
}

module.exports = async function (config) {
  const languageSpecificQuestions = [];
  for (const language of config.languages) {
    languageSpecificQuestions.push({
      type: 'input',
      name: `label:${language}`,
      message: `Item label in ${language}`,
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, `label.${language}`);
      }
    });
  }
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'form',
      message: 'Form ID',
      validate: async (input) => {
        //Find stock_monitoring_area_id
        const processDir = process.cwd();
        const formPath = path.join(processDir, 'forms', 'app', `${input}.xlsx`);
        if (!fs.existsSync(formPath)) {
          return `Form ${input} not found`;
        }
        const workSheet = await utils.getWorkSheet(formPath);
        const stockMonitoringAreaIdRow = utils.getRowWithName(workSheet, STOCK_MONITORING_AREA_ROW_NAME);
        if (!stockMonitoringAreaIdRow) {
          return `${STOCK_MONITORING_AREA_ROW_NAME} calculated row not found in form. Please add it with value the parent ${config.placeType} _id`;
        }
        return true;
      }
    },
    {
      type: 'input',
      name: 'name',
      message: 'Item name'
    },
    ...languageSpecificQuestions,
    {
      type: 'input',
      name: 'unit',
      message: 'Item unit',
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'unit');
      }
    },
    {
      type: 'input',
      name: 'reception_min',
      message: 'Minimum reception count',
      validate: (input) => {
        const isValid = Number(input) >= 0;
        if (!isValid) {
          return 'Must be greater than or equal to 0';
        }
        return isValid;
      },
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'reception_min');
      }
    },
    {
      type: 'input',
      name: 'reception_max',
      message: 'Maximum reception count',
      validate: (input, answers) => {
        const isValid = Number(answers.reception_min) < Number(input);
        if (!isValid) {
          return `Must be greater than ${answers.reception_min}`;
        }
        return isValid;
      },
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'reception_max');
      }
    },
    {
      type: 'input',
      name: 'warning_count',
      message: 'Item warning stock',
      validate: (input, answers) => {
        const isValid = Number(answers.reception_min) < Number(input) && Number(answers.reception_max) > Number(input);
        if (!isValid) {
          return `Must be between ${answers.reception_min} and ${answers.reception_max}`;
        }
        return isValid;
      },
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'warning_count');
      }
    },
    {
      type: 'input',
      name: 'danger_count',
      message: 'Item danger stock',
      validate: (input, answers) => {
        const isValid = Number(answers.warning_count) > Number(input) && Number(input) > 0;
        if (!isValid) {
          return `Must be lower than ${answers.warning_count}`;
        }
        return isValid;
      },
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'danger_count');
      }
    },
    {
      type: 'input',
      name: 'expression',
      message: 'Xform count expression',
      default: (answers) => {
        return getPreviousItemValue(config, answers.form, answers.name, 'expression');
      }
    },
  ]);
  const { form, expression, ...properties } = answers;
  properties.forms = {};
  if (config.items?.[answers.name]) {
    properties.forms = config.items[answers.name].forms;
  }
  properties.forms[form] = expression;
  properties.label = {};
  for (const language of config.languages) {
    properties.label[language] = answers[`label:${language}`];
    properties[`label:${language}`] = undefined;
  }
  config.items[answers.name] = properties;
  utils.writeConfig(config);
  return config;
};
