const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
//const { once } = require('events');
const ExcelJS = require('exceljs');

const { stockOutScenario, stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome
} = require('./test-utils');


describe('Stock out', () => {
  const workingDir = process.cwd();

  beforeEach(() => {
    revertBackToProjectHome(workingDir);
    setDirToprojectConfig();
  });

  afterEach(async() => {
    revertBackToProjectHome(workingDir);
  });

  it('Add stock out summaries test', async() => {
    const processDir = process.cwd();
    const workbook = new ExcelJS.Workbook();
    const childProcess = spawnSync('../../main.js',  stockOutScenario.initScenario);

    if(childProcess.status === 0) {
      // Check that stock monitoring is initialized and stock count and stock out xform and properties files are generated
      //const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

      const formFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));
      for(const formFile of formFiles){
        if(formFile.toString().includes('stock_count') || formFile.toString().includes('stock_out')){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', formFile))).toBe(true);
        }
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
      if(stockOutChildProcess.status === 0){
        const stockOutFormFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));
        for(const formFile of stockOutFormFiles){
          if(formFile.toString().includes('stock_out')){
            expect(fs.existsSync(path.join(processDir, 'forms', 'app', formFile))).toBe(true);
          }
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
      
      const stockOutFormFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));

      for(const formFile of stockOutFormFiles){
        if(formFile.toString().includes('stock_out') || formFile.toString().includes('stock_count')){
          expect(fs.unlinkSync(path.join(processDir, 'forms', 'app', formFile))).toBe(undefined);
        }
      }

      // Removing the stock monitoring init file and stock count file
      const stockMonitoringInitPath = path.join(processDir, 'stock-monitoring.config.json');
      //const stockMonitoringInitFile = fs.stat
      fs.stat(stockMonitoringInitPath, (error) => {
        if (error) {
          //console.log(error);
        }
        else {
          expect(fs.unlinkSync(stockMonitoringInitPath)).toBe(undefined);
          //console.log(stats);
        }
      });

      const translationFiles = fs.readdirSync(path.join(processDir, 'translations'));
      for(const translationFile of translationFiles){
        
        const messageFileContent = fs.readFileSync(path.join(processDir, 'translations', translationFile), {encoding: 'utf-8'});
        expect(messageFileContent).not.toBe('');
        const newMessageContent = messageFileContent.split('\n').map(message => {
          if(!message.toString().includes('cht-stock-monitoring-workflow') && message.toString()!==''){
            return `${message.toString()}\n`;
          }
        });

        expect(newMessageContent.includes('cht-stock-monitoring-workflow')).toBe(false);
        fs.truncate(path.join(processDir, 'translations', translationFile), 0, function () {});
        fs.writeFile(path.join(processDir, 'translations', translationFile),newMessageContent.toString().replaceAll(',', ''));
      }
      
    }

  });

});


