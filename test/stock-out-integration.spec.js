const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockOutScenario, stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms
} = require('./test-utils');


describe('Stock out integration test', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_count.properties.json', 'stock_count.xlsx', 'stock_out.properties.json', 'stock_out.xlsx'];


  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async() => {
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('Add stock out integration test', async() => {
    const processDir = process.cwd();

    // Check that stock count and stock out xform and properties files does not exist
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    const childProcess = spawnSync('../../main.js',  stockOutScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }

    // Add stock out feature test
    const stockOutChildProcess = spawnSync('../../main.js', stockOutScenario.addStockOutFeatureScenario);
    if (stockOutChildProcess.error) {
      throw stockOutChildProcess.error;
    }
 
    expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);
    
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that the products and categories are available in stock count xform
    const { productsList, productCategoryList } = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

    expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
    expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
    expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
    expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);
 
    // Check that the products are available in stock out xform
    const stockOutProducts = await readDataFromXforms([], stockOutScenario.productsScenario, 'stock_out.xlsx');
    expect(stockOutScenario.productsScenario.length).toBe(stockOutProducts.productsList.length);
    expect(stockOutScenario.productsScenario.entries).toStrictEqual(stockOutProducts.productsList.entries);

  });

});


