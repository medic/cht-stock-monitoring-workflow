const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms
} = require('./test-utils');


describe('Stock count', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_count.properties.json', 'stock_count.xlsx'];


  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('Add stock count integration test', async() => {
    const processDir = process.cwd();
    // Check that stock count xform and properties files does not exist
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    const childProcess = spawnSync('../../main.js',  stockCountScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }

    const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

    // Check that stock monitoring is initialized and stock count xform is generated
    expect(fs.existsSync(stockMonitoringConfig)).toBe(true);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that the products and categories are available in stock count xform
    const { productsList, productCategoryList } = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

    expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
    expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
    expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
    expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);

  });

});


