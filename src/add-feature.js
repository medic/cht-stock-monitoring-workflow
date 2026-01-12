const chalk = require('chalk');
const inquirer = require('inquirer');

const { writeConfig } = require('./config-manager');
const { getStockSupplyConfigs } = require('./features/stock-supply');
const { getStockReturnConfigs } = require('./features/stock-return');
const { FEATURES } = require('./constants');
const { getStockOutConfigs } = require('./features/stock-out');
const { getStockLogsConfigs } = require('./features/stock-logs');
const { getStockOrderConfigs } = require('./features/stock-order');

/**
 * Interactively prompt user to select a feature to add to the stock monitoring configuration
 * Available features depend on the number of monitoring levels:
 * - 1 level: stock_logs
 * - 2+ levels: stock_supply, stock_return, stock_out, stock_order
 * Features already configured are filtered out from the selection.
 * Supports command-line arguments for non-interactive usage.
 * @param {Object} configs - Application configuration object
 * @param {Object} configs.levels - Level configurations (determines available features)
 * @param {Object} configs.features - Already configured features (excluded from selection)
 * @returns {Promise<Object|undefined>} Feature selection object with name property, or undefined if no features available
 * @returns {string} [returns.name] - Selected feature name (e.g., 'stock_supply', 'stock_return')
 * @example
 * const configs = getConfig();
 * const feature = await selectFeature(configs);
 * if (feature) {
 *   console.log('Selected feature:', feature.name);
 * }
 */
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
 * Get feature-specific configuration by prompting user for required settings
 * Delegates to the appropriate feature configuration function based on feature name:
 * - stock_supply: Configure stock supply workflow
 * - stock_return: Configure stock return workflow
 * - stock_out: Configure stock out alerts
 * - stock_logs: Configure stock logging
 * - stock_order: Configure stock ordering workflow
 * @param {Object} configs - Application configuration object
 * @param {Object} configs.levels - Level configurations
 * @param {Object} configs.features - Existing feature configurations
 * @param {string[]} configs.languages - Supported language codes
 * @param {Object} feature - Feature selection object from selectFeature()
 * @param {string} feature.name - Feature name to configure
 * @returns {Promise<Object|null>} Feature configuration object with name and settings, or null if unknown feature
 * @returns {string} [returns.name] - Feature name
 * @example
 * const feature = await selectFeature(configs);
 * const featureConfigs = await getFeatureConfigs(configs, feature);
 * if (featureConfigs) {
 *   console.log('Feature configured:', featureConfigs.name);
 * }
 */
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

/**
 * Add feature configuration to the application config and persist to disk
 * Extracts the feature name and adds the remaining configuration to appConfig.features
 * @param {Object} appConfig - Application configuration object
 * @param {Object} appConfig.features - Existing features configuration object
 * @param {Object} featureConfigs - Feature configuration from getFeatureConfigs()
 * @param {string} featureConfigs.name - Feature name (will be used as key in features object)
 * @returns {Object} Updated application configuration with new feature added
 * @example
 * const feature = await selectFeature(configs);
 * const featureConfigs = await getFeatureConfigs(configs, feature);
 * if (featureConfigs) {
 *   const updatedConfig = addFeatureConfigs(configs, featureConfigs);
 *   console.log('Feature added:', featureConfigs.name);
 * }
 */
function addFeatureConfigs(appConfig, featureConfigs) {
  const { name, ...rest } = featureConfigs;
  appConfig.features[name] = rest;
  writeConfig(appConfig);
  return appConfig;
}

module.exports = {
  selectFeature,
  getFeatureConfigs,
  addFeatureConfigs,
};
