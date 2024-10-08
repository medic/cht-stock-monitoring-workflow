const { fork } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const { once } = require('events');
const ExcelJS = require('exceljs');

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
    const childProcess = fork('../../main.js', stockCountScenario.initScenario);
    await once(childProcess, 'close');
    
    const formPath = path.join(processDir, 'forms', 'app', `stock_count.xlsx`);
    const formPropertiesPath = path.join(processDir, 'forms', 'app', `stock_count.properties.json`);
    const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

    // Check that stock monitoring is initialized and stock count xform is generated
    expect(fs.existsSync(stockMonitoringConfig)).toBe(true);
    expect(fs.existsSync(formPropertiesPath)).toBe(true);
    expect(fs.existsSync(formPath)).toBe(true);

    // Check that the products are available in stock count xform
    const productCategoryList = stockCountScenario.productCategoryScenario;
    const productsList = stockCountScenario.productsScenario;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    const nameCol = surveyWorkSheet.getColumn('B');
    const cellProductCategoriesList = [];
    const cellProductsList = [];
    let productCatIndex =0;
    let productIndex = 0;
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

    //Removing the stock monitoring init file and stock count file
    expect(fs.unlinkSync(stockMonitoringConfig)).toBe(undefined);
    expect(fs.unlinkSync(formPath)).toBe(undefined);
    expect(fs.unlinkSync(formPropertiesPath)).toBe(undefined);

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
  });

});


