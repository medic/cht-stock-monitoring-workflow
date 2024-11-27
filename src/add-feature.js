const chalk = require('chalk');
const inquirer = require('inquirer');

const utils = require('./common');
const { getStockSupplyConfigs } = require('./features/stock-supply');
const { getStockReturnConfigs } = require('./features/stock-return');
const { FEATURES } = require('./constants');
const { getStockOutConfigs } = require('./features/stock-out');
const { getStockLogsConfigs } = require('./features/stock-logs');
const { getStockOrderConfigs } = require('./features/stock-order');

/**
 * Select feature to add
 * @param {Object} configs - app configs
 * @returns {Promise<Object>} feature object
 * @returns {string} feature.name - feature name
 **/
async function selectFeature(configs) {
  const features = [];
  if (configs.levels['1'] && !configs.levels['2']) {
    features.push(
      'stock_logs',
    );
  }
  if (configs.levels['2']) {
    features.push(
      'stock_supply',
      'stock_return',
      'stock_out',
      'stock_order',
    );
  }
  const remainingFeatures = features.filter((feature) => !configs.features[feature]);
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
      })),
      when: function (answers){
        const argv = process.argv;
        if (!argv[4]){
          return true;
        } 
        answers.name = argv[4];
        return false;
      }
    }
  ]);

  return feature;
}

/**
 * Get feature configs
 * @param {Object} configs - app configs
 * @param {Object} feature - feature object
 * @param {string} feature.name - feature name
 * @returns {Promise<Object>} feature configs
 **/
async function getFeatureConfigs(configs, feature) {
  let featureConfigs = null;

  switch (feature.name) {
    case 'stock_supply':
      featureConfigs = await getStockSupplyConfigs(configs);
      break;
    case 'stock_return':
      featureConfigs = await getStockReturnConfigs(configs);
      break;
    case 'stock_out':
      featureConfigs = await getStockOutConfigs(configs);
      break;
    case 'stock_logs':
      featureConfigs = await getStockLogsConfigs(configs);
      break;
    case 'stock_order':
      featureConfigs = await getStockOrderConfigs(configs);
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
  selectFeature,
  getFeatureConfigs,
  addFeatureConfigs,
};
