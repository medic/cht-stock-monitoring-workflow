const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./src/common');
const { updateForm } = require('./src/features/form-update');
const { updateStockCount } = require('./src/features/stock-count');
const { updateStockReturn } = require('./src/features/stock-return');
const { updateStockSupply } = require('./src/features/stock-supply');
const { updateTranslations, getTranslations } = require('./src/common');
const { updateStockReturned } = require('./src/features/stock-returned');
const { updateStockConfirmation } = require('./src/features/stock-received');
const { updateStockDiscrepancy } = require('./src/features/stock-discrepancy');
const { updateStockOut } = require('./src/features/stock-out');
const { updateStockLogs } = require('./src/features/stock-logs');
const { updateStockOrder } = require('./src/features/stock-order');
const { updateOrderStockSupply } = require('./src/features/stock-order-supply');
const { getInitConfigs, createConfigFile } = require('./src/init');
const { getItemConfig, addConfigItem } = require('./src/add-item');
const { getFeatureConfigs, addFeatureConfigs, selectFeature } = require('./src/add-feature');

//Stock monitoring module initialization
async function init() {
  const processDir = process.cwd();

  if (utils.isAlreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  const answers = await getInitConfigs();
  const config = createConfigFile(answers);
  await proccessFeatureForm(config);
}

function getConfig() {
  const processDir = process.cwd();
  if (!utils.isAlreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module not found'));
    return;
  }
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  const configStr = fs.readFileSync(configFilePath);
  const config = JSON.parse(configStr);
  return config;
}

async function verifyConfigs(configs) {
  if (configs.features.stock_order && !configs.features.stock_supply) {
    console.log(chalk.red('Please enable stock supply first'));
    const supplyConfigs = await getFeatureConfigs(configs, {
      name: 'stock_supply',
    });
    const updatedConfig = await addFeatureConfigs(configs, supplyConfigs);
    return updatedConfig;
  }
  return configs;
}

async function proccessFeatureForm(configs) {

  // Update app translations
  updateTranslations(configs);
  const messages = getTranslations();

  for (const feature of Object.keys(configs.features)) {
    const featureToFunctionMap = {
      stock_count: updateStockCount,
      stock_supply: async (configs) => {
        await updateStockSupply(configs);
        if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) {
          await updateStockConfirmation(configs, messages);
          await updateStockDiscrepancy(configs);
        }
      },
      stock_return: async (configs) => {
        await updateStockReturn(configs);
        await updateStockReturned(configs);
      },
      stock_out: updateStockOut,
      stock_logs: updateStockLogs,
      stock_order: async (configs) => {
        await updateStockOrder(configs);
        await updateOrderStockSupply(configs);
      }
    };

    await featureToFunctionMap[feature](configs);
  }

  await updateForm(configs);
  console.log(chalk.green(`INFO All actions completed`));
}

module.exports = {
  init,
  addItem: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const itemConfig = await getItemConfig(config);
    let updatedConfig = await addConfigItem(config, itemConfig);
    updatedConfig = await verifyConfigs(updatedConfig);
    await proccessFeatureForm(updatedConfig);
  },
  addFeature: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const feature = await selectFeature(config);
    const featureConfigs = await getFeatureConfigs(config, feature);
    let updatedConfig = await addFeatureConfigs(config, featureConfigs);
    updatedConfig = await verifyConfigs(updatedConfig);
    await proccessFeatureForm(updatedConfig);
  },
  build: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const updatedConfigs = await verifyConfigs(config);
    await proccessFeatureForm(updatedConfigs);
  },
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
};
