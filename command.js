const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./src/utils');
const build = require('./src/build');
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
  await build(config);
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
    await build(updatedConfig);
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
    await build(updatedConfig);
  },
  build: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const updatedConfigs = await verifyConfigs(config);
    await build(updatedConfigs);
  },
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
};
