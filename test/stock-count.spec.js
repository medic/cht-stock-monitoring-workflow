const { fork } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { once } = require('events');

const { stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome
} = require('./test-utils');


describe('Stock count', () => {

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    revertBackToProjectHome(process.cwd());
  });

  it('Add stock count summaries test', async() => {
    const processDir = process.cwd();
    const childProcess = fork('../../main.js', stockCountScenario);
    await once(childProcess, 'close');
    
    const formPath = path.join(processDir, 'forms', 'app', `stock_count.xlsx`);
    const formPropertiesPath = path.join(processDir, 'forms', 'app', `stock_count.properties.json`);
    const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

    // Check that stock monitoring is initialized and stock count form is generated
    expect(fs.existsSync(stockMonitoringConfig)).toBe(true);
    expect(fs.existsSync(formPropertiesPath)).toBe(true);
    expect(fs.existsSync(formPath)).toBe(true);

    // Removing the stock monitoring init file and stock count file
    expect(fs.unlinkSync(stockMonitoringConfig)).toBe(undefined);
    expect(fs.unlinkSync(formPath)).toBe(undefined);
    expect(fs.unlinkSync(formPropertiesPath)).toBe(undefined);

  });

});


