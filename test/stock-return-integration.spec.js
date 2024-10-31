const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stockReturnScenario } = require('./mocks/mocks');

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  deleteGeneratedFiles
} = require('./test-utils');

describe('Stock Returned feature', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_return.xlsx', 'stock_return.properties.json','stock_returned.xlsx', 'stock_returned.properties.json', 'stock_count.properties.json', 'stock_count.xlsx'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    jest.clearAllMocks();
    revertBackToProjectHome(workingDir);
  });

  afterAll(() => {
    revertBackToProjectHome(workingDir);
  });

  it('Add stock count integration test', async() => {
    const projectDataDir = process.cwd();

    // Check that stock monitoring is initialized and stock return and returned xform is generated
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }

    const childProcess = spawnSync('../../main.js',  stockReturnScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    } else {

      const stockReturnChildProcess = spawnSync('../../main.js', stockReturnScenario.addFeatureScenario);
      
      if (stockReturnChildProcess.error) {
        throw stockReturnChildProcess.error;
      }

      const stockMonitoringConfig = path.join(projectDataDir, 'stock-monitoring.config.json');

      // Check that stock monitoring is initialized and stock return and returned xform are generated
      for(const createdAppFormFile of createdAppFormFiles){
        expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expect to find ${createdAppFormFile}, but does not exist`).toBeTruthy();
      }

      expect(fs.existsSync(stockMonitoringConfig)).toBe(true);

      //Removing the stock monitoring init file and stock return and returned file
      await deleteGeneratedFiles(createdAppFormFiles);

      // Removing the stock monitoring init file and stock return and returned file
      const stockMonitoringInitPath = path.join(projectDataDir, 'stock-monitoring.config.json');
      fs.stat(stockMonitoringInitPath, (error) => {
        if (!error) {
          expect(fs.unlinkSync(stockMonitoringInitPath)).toBe(undefined);
        }
      });
    }
  });

});
