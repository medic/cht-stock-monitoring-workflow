const assert = require('chai').assert;
const rewire = require('rewire');
const path = require('path');
const fs = require('fs');

const initModule = rewire('../src/init');
const utilsModule = rewire('../src/utils.js');
const updateModule = rewire('../src/update.js');

const _process = { ...process };
_process.cwd = () => {
  return path.join(__dirname, 'app');
};

let appConfig = null;

describe('Init', function () {
  before(function () {
    utilsModule.__set__('process', _process);

    initModule.__set__('utils', utilsModule);
    updateModule.__set__('utils', utilsModule);
    updateModule.__set__('Config', {
      STOCK_COUNT_PATH: path.join(__dirname, 'app', 'forms', 'app', 'stock_count.xlsx'),
      STOCK_COUNT_PROPERTY_PATH: path.join(__dirname, 'app', 'forms', 'app', 'stock_count.properties.json'),
      CONSUMPTION_LOG_PATH: path.join(__dirname, 'app', 'forms', 'app', 'consumption_log.xlsx'),
      CONSUMPTION_LOG_PROPERTY_PATH: path.join(__dirname, 'app', 'forms', 'app', 'consumption_log.properties.json'),
    });

    // Copy test files
    fs.copyFileSync('./test/files/assessment.properties.json', './test/app/forms/app/assessment.properties.json');
    fs.copyFileSync('./test/files/assessment.xlsx', './test/app/forms/app/assessment.xlsx');
    fs.copyFileSync('./test/files/base_settings.json', './test/app/app_settings/base_settings.json');
  });
  describe('#init()', function () {
    it('should create config file', function () {
      const config = {
        placeType: 'c40_health_area',
        expression: "contact.contact_type === 'c40_health_area'",
        languages: 'fr,en'
      };
      appConfig = initModule.createConfigFile(config);
      const configPath = path.join(__dirname, 'app', 'stock-monitoring.config.json');
      assert.isOk(fs.existsSync(configPath));

      const configFileContent = JSON.parse(fs.readFileSync(configPath));
      assert.equal(configFileContent.placeType, config.placeType);
      assert.equal(configFileContent.expression, config.expression);
      assert.isArray(configFileContent.languages);
    });

    it('should create stock count and consumption log file', async function () {
      await updateModule(appConfig);

      const stockCountFilePath = path.join(__dirname, 'app', 'forms', 'app', 'stock_count.xlsx');
      const consumptionLogFilePath = path.join(__dirname, 'app', 'forms', 'app', 'consumption_log.xlsx');

      assert.isOk(fs.existsSync(stockCountFilePath));
      assert.isOk(fs.existsSync(consumptionLogFilePath));
    });
  });

  describe('#addConfigItem()', function () {
    it('should update stock count file', function () {
      
    });
  });
});
