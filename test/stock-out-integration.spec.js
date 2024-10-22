const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');

const { stockOutScenario, stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp
} = require('./test-utils');


describe('Stock out integration test', () => {
  const workingDir = process.cwd();

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async() => {
    revertBackToProjectHome(workingDir);
  });

  it('Add stock out integration test', async() => {
    const processDir = process.cwd();
    const workbook = new ExcelJS.Workbook();
    const childProcess = await spawnSync('../../main.js',  stockOutScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }
    else {
      // Check that stock monitoring is initialized and stock count and stock out xform and properties files are generated
      const createdAppFormFiles = ['stock_count.properties.json', 'stock_count.xlsx'];

      for(const createdAppFormFile of createdAppFormFiles){
        expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
      }

      expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);

      // Check that the products are available in stock count xform
      const productCategoryList = stockCountScenario.productCategoryScenario;
      const productsList = stockCountScenario.productsScenario;
      await workbook.xlsx.readFile(path.join(processDir, 'forms', 'app', `stock_count.xlsx`));
      const surveyWorkSheet = workbook.getWorksheet('survey');
      const nameCol = surveyWorkSheet.getColumn('B');
      const cellProductCategoriesList = [];
      const cellProductsList = [];
      let productIndex = 0;
      let productCatIndex =0;
      nameCol.eachCell(function(cell){

        if(cell.value === productCategoryList[productCatIndex] && productCatIndex < productCategoryList.length){
          cellProductCategoriesList.push(cell.value);
          productCatIndex ++;
          productIndex = 0;
        }

        if(cell.value === productsList[productIndex] && productIndex < productsList.length){
          cellProductsList.push(cell.value);
          productIndex ++;
        }
        
      });

      expect(productsList.length).toBe(cellProductsList.length);
      expect(productsList.entries).toStrictEqual(cellProductsList.entries);
      
      expect(productCategoryList.length).toBe(cellProductCategoriesList.length);
      expect(productCategoryList.entries).toStrictEqual(cellProductCategoriesList.entries);

      // Add stock out feature test
      const stockOutChildProcess = spawnSync('../../main.js', stockOutScenario.addStockOutFeatureScenario);
      if (stockOutChildProcess.error) {
        throw stockOutChildProcess.error;
      }
      else {
        const createdStockOutAppFormFiles = ['stock_out.properties.json', 'stock_out.xlsx'];
        for(const createdAppFormFile of createdStockOutAppFormFiles){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
        }
        
        // Check that the products are available in stock out xform
        const stockOutProductsList = stockOutScenario.productsScenario;
        await workbook.xlsx.readFile(path.join(processDir, 'forms', 'app', `stock_out.xlsx`));
        const surveyWorkSheet = workbook.getWorksheet('survey');
        const nameCol = surveyWorkSheet.getColumn('B');
        const stockOutCellProductsList = [];
        productIndex = 0;
        nameCol.eachCell(function(cell){
          if(cell.value === stockOutProductsList[productIndex] && productIndex < stockOutProductsList.length){
            stockOutCellProductsList.push(cell.value);
            productIndex ++; 
          }
        });

        expect(stockOutProductsList.length).toBe(stockOutCellProductsList.length);
        expect(stockOutProductsList.entries).toStrictEqual(stockOutCellProductsList.entries);
      }

      cleanUp(workingDir);
    }

  });

});


