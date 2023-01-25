const path = require('path');
const fs = require('fs');

const processDir = process.cwd();
let config = null;

module.exports = {
  FORM_DIR: path.join(processDir, 'forms', 'app'),
  CONFIG_FILE_PATH: path.join(processDir, 'stm.config.json'),
  STOCK_COUNT_PATH: path.join(processDir, 'forms', 'app', 'stock_count.xlsx'),
  CONSUMPTION_LOG_PATH: path.join(processDir, 'forms', 'app', 'consumption_log.xlsx'),
  STOCK_COUNT_PROPERTY_PATH: path.join(processDir, 'forms', 'app', 'stock_count.properties.json'),
  CONSUMPTION_LOG_PROPERTY_PATH: path.join(processDir, 'forms', 'app', 'consumption_log.properties.json'),
  getAppSettings: () => {
    if (config) {
      return config;
    }
    const rawConfigData = fs.readFileSync(path.join(processDir, 'app_settings', 'base_settings.json'));
    config = JSON.parse(rawConfigData);
    return config;
  }
}