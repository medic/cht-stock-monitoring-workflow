const { 
  spawnSync, 
  //fork
} = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');

const { stockOrderScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome
} = require('./test-utils');


describe('Stock order', () => {
  const workingDir = process.cwd();

  beforeEach(() => {
    revertBackToProjectHome(workingDir);
    setDirToprojectConfig();
  });

  afterEach(() => {
    revertBackToProjectHome(workingDir);
  });

  it('Add stock order summaries test', async() => {
    const processDir = process.cwd();
    const workbook = new ExcelJS.Workbook();
    const childProcess = await spawnSync('../../main.js',  stockOrderScenario.initScenario);
    //await fork('../../main.js', stockMonitoring.addStockOrderFeatureScenario);

    if(childProcess.status === 0) {
      
      const formFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));
      for(const formFile of formFiles){
        if(formFile.toString().includes('stock_count') || formFile.toString().includes('stock_order')){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', formFile))).toBe(true);
        }
      }

      expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);

      // Check that the products are available in stock count xform
      const productCategoryList = stockOrderScenario.productCategoryScenario;
      const productsList = stockOrderScenario.productsScenario;
      await workbook.xlsx.readFile(path.join(processDir, 'forms', 'app', `stock_count.xlsx`));
      let surveyWorkSheet = workbook.getWorksheet('survey');
      let nameCol = surveyWorkSheet.getColumn('B');
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
      const stockOrderChildProcess = await spawnSync('../../main.js', stockOrderScenario.addStockOrderFeatureScenario);
      
      if(stockOrderChildProcess.status === 0){
        const stockOrderFormFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));
        for(const formFile of stockOrderFormFiles){
          if(formFile.toString().includes('stock_order')){
            expect(fs.existsSync(path.join(processDir, 'forms', 'app', formFile))).toBe(true);
          }
        }
      
        // Check that the products are available in stock order xform
        const stockOrderData = stockOrderScenario.stockOrderScenario;
        await workbook.xlsx.readFile(path.join(processDir, 'forms', 'app', `stock_order.xlsx`));
        surveyWorkSheet = workbook.getWorksheet('survey');
        nameCol = surveyWorkSheet.getColumn('B');
        const stockOrderCellProductsList = [];
        productIndex = 0;
    
        nameCol.eachCell(function(cell){
          if(cell.value === stockOrderData[productIndex] && productIndex < stockOrderData.length){
            stockOrderCellProductsList.push(cell.value);
            productIndex ++; 
          }
        });

        // Stock supply data stock_supply xform
        const stockSupplyData = stockOrderScenario.stockSupplyProductsScenario;
        await workbook.xlsx.readFile(path.join(processDir, 'forms', 'app', `stock_supply.xlsx`));
        surveyWorkSheet = workbook.getWorksheet('survey');
        nameCol = surveyWorkSheet.getColumn('B');
        const stockSupplyCellProductsList = [];
        productIndex = 0;

        nameCol.eachCell(function(cell){
          if(cell.value === stockSupplyData[productIndex] && productIndex < stockSupplyData.length){
            stockSupplyCellProductsList.push(cell.value);
            productIndex ++; 
          }
        });

        expect(stockOrderData.length).toBe(stockOrderCellProductsList.length);
        expect(stockSupplyData.length).toBe(stockSupplyCellProductsList.length);
        expect(stockSupplyData.entries).toStrictEqual(stockSupplyCellProductsList.entries);
        expect(stockOrderData.entries).toStrictEqual(stockOrderCellProductsList.entries);
        
      }
      
      
      const stockOutFormFiles = fs.readdirSync(path.join(processDir, 'forms', 'app'));

      for(const formFile of stockOutFormFiles){
        if(formFile.toString().includes('stock_') || formFile.toString().includes('stock_')  || formFile.toString().includes('undefined')){
          expect(fs.unlinkSync(path.join(processDir, 'forms', 'app', formFile))).toBe(undefined);
        }
      }

      // Removing the stock monitoring init file and stock count file
      const stockMonitoringInitPath = path.join(processDir, 'stock-monitoring.config.json');
      //const stockMonitoringInitFile = fs.stat
      fs.stat(stockMonitoringInitPath, (error) => {
        if (!error) {
          expect(fs.unlinkSync(stockMonitoringInitPath)).toBe(undefined);
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


