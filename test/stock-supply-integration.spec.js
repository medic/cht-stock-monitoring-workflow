const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { 
  stockSupplyScenario, 
  stockCountScenario 
} = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readOutputFiles,
  readDataFromXforms
} = require('./test-utils');


describe('Stock supply integration test', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = [ 'stock_count.xlsx', 'stock_count.properties.json', 'stock_supply.xlsx', 'stock_supply.properties.json', 'stock_received.xlsx', 'stock_received.properties.json', 'stock_discrepancy_resolution.xlsx', 'stock_discrepancy_resolution.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async() => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
    jest.clearAllMocks();
  });

  it('Add stock out integration test', async() => {
    const processDir = process.cwd();
    // Check that stock supply, received and stock discrepancy xform and properties files are not generated
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    // Initializing stock monitoring
    const childProcess = await spawnSync('../../main.js',  stockSupplyScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }
    else {

      // Add stock supply feature test
      const stockSupplyChildProcess = await spawnSync('../../main.js', stockSupplyScenario.addStockSupplyFeature);
      if (stockSupplyChildProcess.error) {
        throw stockSupplyChildProcess.error;
      }
      else {

        // Check that stock monitoring is initialized and stock count and stock out xform and properties files are generated
        for(const createdAppFormFile of createdAppFormFiles){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
        }

        expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);

        // Check that stock count files content are correctly written.
        const {workbook, propertiesFileContent} = await readOutputFiles(['stock_count.xlsx', 'stock_count.properties.json']);
        let surveyWorkSheet = workbook.getWorksheet('survey');
        let settingWorkSheet = workbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        expect(propertiesFileContent).not.toEqual([]);

        // Check that the products are available in stock count xform
        const {productsList, productCategoryList} = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');
        expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
        expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);
        
        expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
        expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);

        // Check that stock Supply files content are correctly written.
        const stockSupplyWorkbook = await readOutputFiles(['stock_supply.xlsx', 'stock_supply.properties.json']);
        surveyWorkSheet = stockSupplyWorkbook.workbook.getWorksheet('survey');
        settingWorkSheet = stockSupplyWorkbook.workbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        expect(stockSupplyWorkbook.propertiesFileContent).not.toEqual([]);

        // Check that stock Received files content are correctly written.
        const stockReceivedWorkbook = await readOutputFiles(['stock_supply.xlsx', 'stock_supply.properties.json']);
        surveyWorkSheet = stockReceivedWorkbook.workbook.getWorksheet('survey');
        settingWorkSheet = stockReceivedWorkbook.workbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        expect(stockReceivedWorkbook.propertiesFileContent).not.toEqual([]);

        // Check that stock Discrepancy files content are correctly written.
        const stockDiscrepancyWorkbook = await readOutputFiles(['stock_discrepancy_resolution.xlsx', 'stock_discrepancy_resolution.properties.json']);
        surveyWorkSheet = stockDiscrepancyWorkbook.workbook.getWorksheet('survey');
        settingWorkSheet = stockDiscrepancyWorkbook.workbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        expect(stockDiscrepancyWorkbook.propertiesFileContent).not.toEqual([]);

      }
    }

  });

});


