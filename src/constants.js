const path = require('path');

const processDir = process.cwd();

module.exports = {
  FORM_DIR: path.join(processDir, 'forms', 'app'),
  CONFIG_FILE_PATH: path.join(processDir, 'stm.config.json'),
  STOCK_COUNT_PATH: path.join(processDir, 'forms', 'app', 'stock_count.xlsx'),
  STOCK_COUNT_PROPERTY_PATH: path.join(processDir, 'forms', 'app', 'stock_count.properties.json')
}