const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const initModule = require('./src/init');
const utils = require('./src/utils');
const addItem = require('./src/add-item');
const update = require('./src/update');

//Stock monitoring module initialization
async function init() {
  initModule();
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
  add: async () => {
    const config = getConfig();
    const updatedConfig = await addItem(config);
    await update(updatedConfig);
  },
  update: async () => {
    const config = getConfig();
    await update(config);
  },
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
};
