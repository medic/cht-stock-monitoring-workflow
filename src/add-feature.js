const chalk = require('chalk');
const inquirer = require('inquirer');

const utils = require('./utils');
const { getStockSupplyConfigs } = require('./features/stock-supply');
const { getStockReturnConfigs } = require('./features/stock-return');
const { FEATURES } = require('./constants');

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
    case 'stock_return':
      featureConfigs = await getStockReturnConfigs(configs);
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
