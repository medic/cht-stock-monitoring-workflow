const path = require('path');
const fs = require('fs');

function isChtApp() {
  const processDir = process.cwd();
  const formDir = path.join(processDir, 'forms');
  const baseSettingDir = path.join(processDir, 'app_settings');
  if (fs.existsSync(formDir) && fs.existsSync(baseSettingDir)) {
    return true;
  }
  return false;
}

function alreadyInit(directory) {
  const configFilePath = path.join(directory, 'stock-monitoring.config.json');
  if (fs.existsSync(configFilePath)) {
    return true;
  }
  return false;
}

function writeConfig(config) {
  const processDir = process.cwd();
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));
}

module.exports = {
  isChtApp,
  alreadyInit,
  writeConfig,
}
