const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { stockMonitoringConfigs, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { 
  updateStockOrder, 
} = require('../src/features/stock-order'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp
} = require('./test-utils');

describe('Stock Order feature', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_order.xlsx', 'stock_order.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    jest.clearAllMocks();
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  afterAll(() => {
    revertBackToProjectHome(workingDir);
  });

  it('should order form should not be generated and updated', async () => {
    const projectDataDir = process.cwd();
    // Check that stock out xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }
    
    // Call the function updateStockOut and check it throws an exception when there is no match config
    await expect( updateStockOrder(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });


  it('should order form should be generated and updated with correct values', async () => {

    const projectDataDir = process.cwd();
    // Check that stock out xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }
    // Call the function updateStockOut and check that the stock_out files are generated
    await updateStockOrder(stockMonitoringConfigs);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expect to find ${createdAppFormFile}, but does not exist`).toBeTruthy();
    }

    // Check that stock out files content are correctly written.
    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_order.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const spy = jest.spyOn(workbook, 'getWorksheet');
    const surveyWorkSheet = workbook.getWorksheet('survey');
    expect(spy).toHaveBeenCalledTimes(1);
    const settingWorkSheet = workbook.getWorksheet('settings');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(surveyWorkSheet._name).toEqual('survey');
    expect(settingWorkSheet._name).toEqual('settings');

    const propertiesFileContent = fs.readFileSync(
      path.join(projectDataDir, 'forms', 'app', 'stock_order.properties.json'), 
      {encoding: 'utf-8'}
    );

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'contact.contact_type === \'c60_chw_site\' && user.role === \'chw\'', 
        'person': false, 
        'place': true
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Order',
          'locale': 'en'
        }, 
        {
          'content': 'Commande de Stock',
          'locale': 'fr'
        }
      ]
    });
  });

});
