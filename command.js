const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const utils = require('./src/utils');
const build = require('./src/build');
const { getInitConfigs, createConfigFile } = require('./src/init');
const { getItemConfig, addConfigItem } = require('./src/add-item');
const { getFeatureConfigs, addFeatureConfigs } = require('./src/add-feature');

//Stock monitoring module initialization
async function init() {
  const processDir = process.cwd();

  if (utils.alreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  const answers = await getInitConfigs();
  const config = createConfigFile(answers);
  await build(config);
}

function getConfig() {
  const processDir = process.cwd();
  if (!utils.alreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module not found'));
    return;
  }
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  const configStr = fs.readFileSync(configFilePath);
  const config = JSON.parse(configStr);
  return config;
}

module.exports = {
  init,
  addItem: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const itemConfig = await getItemConfig(config);
    const updatedConfig = await addConfigItem(config, itemConfig);
    await build(updatedConfig);
  },
  addFeature: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    const featureConfigs = await getFeatureConfigs(config);
    const updatedConfig = await addFeatureConfigs(config, featureConfigs);
    await build(updatedConfig);
  },
  build: async () => {
    const config = getConfig();
    if (!config) {
      return;
    }
    await build(config);
  },
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
};
