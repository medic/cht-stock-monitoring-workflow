const chalk = require('chalk');
const inquirer = require('inquirer');

const utils = require('./utils');

const FEATURES = {
  'stock_supply': 'Stock supply (Used to issue stock item)',
  'stock_count': 'Stock count',
};

async function getStockSupplyConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock supply form ID'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock supply form title in ${language}`,
      default: 'Stock supply'
    })),
    {
      type: 'confirm',
      name: 'confirm_supply.active',
      message: 'Activate supply confirmation',
      default: false,
    }
  ]);

  if (configs.confirm_supply.active) {
    const confirmationConfigs = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirm_supply.form_name',
        message: 'Enter supply confirmation ID',
      },
      ...languages.map((language) => ({
        type: 'input',
        name: `confirm_supply.title.${language}`,
        message: `Enter supply confirmation form title in ${language}`,
        default: 'Stock received'
      }))
    ]);
    confirmationConfigs['confirm_supply'].active = true;

    return {
      ...configs,
      ...confirmationConfigs,
    };
  }
  return configs;
}

async function getFeatureConfigs(configs) {
  const remainingFeatures = Object.keys(FEATURES).filter((feature) => !configs.features[feature]);
  if (remainingFeatures.length === 0) {
    console.log(chalk.green('INFO The are no more feature to add'));
    return;
  }

  const feature = await inquirer.prompt([
    {
      type: 'list',
      name: 'name',
      message: 'Select feature',
      choices: remainingFeatures.map((ft) => ({
        name: FEATURES[ft],
        value: ft,
      }))
    }
  ]);

  let featureConfigs = null;

  switch (feature.name) {
    case 'stock_supply':
      featureConfigs = await getStockSupplyConfigs(configs);
      break;
    default:
      break;
  }

  if (featureConfigs) {
    return {
      ...feature,
      ...featureConfigs,
    };
  }
  return null;
}

function addFeatureConfigs(appConfig, featureConfigs) {
  const { name, ...rest } = featureConfigs;
  appConfig.features[name] = rest;
  utils.writeConfig(appConfig);
  return appConfig;
}

module.exports = {
  getFeatureConfigs,
  addFeatureConfigs,
};
