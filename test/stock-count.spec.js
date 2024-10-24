const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  readDataFromXforms
} = require('./test-utils');


describe('Stock count', () => {
  const workingDir = process.cwd();

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    revertBackToProjectHome(workingDir);
  });

  it('Add stock count integration test', async() => {
    const processDir = process.cwd();
    const childProcess = spawnSync('../../main.js',  stockCountScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    } else {
      const formPath = path.join(processDir, 'forms', 'app', `stock_count.xlsx`);
      const formPropertiesPath = path.join(processDir, 'forms', 'app', `stock_count.properties.json`);
      const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

      // Check that stock monitoring is initialized and stock count xform is generated
      expect(fs.existsSync(stockMonitoringConfig)).toBe(true);
      expect(fs.existsSync(formPropertiesPath)).toBe(true);
      expect(fs.existsSync(formPath)).toBe(true);

      // Check that the products are available in stock count xform
      const productCategories = stockCountScenario.productCategoryScenario;
      const products = stockCountScenario.productsScenario;
      const { productsList, productCategoryList } = await readDataFromXforms(productCategories, products, 'stock_count.xlsx');

      expect(productsList.length).toBe(products.length);
      expect(productsList.entries).toStrictEqual(products.entries);
      
      expect(productCategoryList.length).toBe(productCategories.length);
      expect(productCategoryList.entries).toStrictEqual(productCategories.entries);

      //Removing the stock monitoring init file and stock count file
      expect(fs.unlinkSync(stockMonitoringConfig)).toBe(undefined);
      expect(fs.unlinkSync(formPath)).toBe(undefined);
      expect(fs.unlinkSync(formPropertiesPath)).toBe(undefined);
    }
  });

});
