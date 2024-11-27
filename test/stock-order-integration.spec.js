const { 
  spawnSync, 
} = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockMonitoringScenario, stockOrderScenario, stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  readDataFromXforms,
  cleanUp
} = require('./test-utils');


describe('Stock order', () => {
  const createdAppFormFiles = ['stock_order.xlsx', 'stock_order.properties.json', 'stock_supply.xlsx', 'stock_supply.properties.json', 'stock_count.xlsx', 'stock_count.properties.json', 'undefined.xlsx', 'undefined.properties.json'];
  const workingDir = process.cwd();

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('Add stock order summaries test', async() => {
    const processDir = process.cwd();
    const childProcess = await spawnSync('../../main.js',  stockMonitoringScenario.initScenario);
    
    if(childProcess.status === 0) {

      // Add stock out feature test
      const stockOrderChildProcess = await spawnSync('../../main.js', stockOrderScenario.addStockOrderFeatureScenario);

      if(stockOrderChildProcess.status === 0){
        
        // Assert that all the file exit 
        for(const createdAppFormFile of createdAppFormFiles){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
        }

        // Check that the products and categories are available in stock count xform
        const {productsList, productCategoryList} = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

        expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
        expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
        expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
        expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);

        // Check that the products are available in stock order xform
        const stockOrderProductScenario = await readDataFromXforms([], stockOrderScenario.stockOrderProductScenario, 'stock_order.xlsx');
        expect(stockOrderScenario.stockOrderProductScenario.length).toBe(stockOrderProductScenario.productsList.length);
        expect(stockOrderScenario.stockOrderProductScenario.entries).toStrictEqual(stockOrderProductScenario.productsList.entries);

        // Stock supply data stock_supply xform
        const stockSupplyData = await readDataFromXforms([], stockOrderScenario.stockSupplyProductsScenario, 'stock_supply.xlsx');
        expect(stockSupplyData.productsList.length).toBe(stockOrderScenario.stockSupplyProductsScenario.length);
        expect(stockSupplyData.productsList.entries).toStrictEqual(stockOrderScenario.stockSupplyProductsScenario.entries);
        
      }
    }
    
  });

});


