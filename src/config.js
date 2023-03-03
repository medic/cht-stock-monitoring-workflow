const path = require('path');
const fs = require('fs');

const processDir = process.cwd();
let config = null;

module.exports = {
  FORM_DIR: path.join(processDir, 'forms', 'app'),
  CONFIG_FILE_PATH: path.join(processDir, 'stm.config.json'),
  getAppSettings: () => {
    if (config) {
      return config;
    }
    const rawConfigData = fs.readFileSync(path.join(processDir, 'app_settings', 'base_settings.json'));
    config = JSON.parse(rawConfigData);
    return config;
  },
  STOCK_MONITORING_AREA_ROW_NAME: 'stock_monitoring_area_id',
  ADDITIONAL_DOC_NAME: 'additional_doc'
};
