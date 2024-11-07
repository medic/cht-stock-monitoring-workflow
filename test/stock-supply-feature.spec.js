const fs = require('fs');
const path = require('path');
const { stockSupplyConfig, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { updateStockSupply } = require('../src/features/stock-supply'); 
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  readOutputFiles,
  cleanUp
} = require('./test-utils');

describe('update Stock Supply', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_supply.xlsx', 'stock_supply.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async () => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
    jest.clearAllMocks();
  });

  it('should  not generate and update stock supply form', async () => {
    const projectDataDir = process.cwd();
    // Check that stock discrepancy xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    
    // Call the function updateStockDiscrepancy and check it throws an exception when there is no match config
    await expect( updateStockSupply(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });

  it('should generate and update the stock supply form with correct values', async () => {
    const processDir = process.cwd();
    
    // Check that stock supply xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockSupply and check that the stock_supply files are generated
    await updateStockSupply(stockSupplyConfig);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that stock supply files content are correctly written.
    const {workbook, propertiesFileContent} = await readOutputFiles(createdAppFormFiles);
    const spy = jest.spyOn(workbook, 'getWorksheet');
    const surveyWorkSheet = workbook.getWorksheet('survey');
    expect(spy).toHaveBeenCalledTimes(1);
    const settingWorkSheet = workbook.getWorksheet('settings');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(surveyWorkSheet._name).toEqual('survey');
    expect(settingWorkSheet._name).toEqual('settings');
    expect(surveyWorkSheet).not.toEqual([]);
    expect(settingWorkSheet).not.toEqual([]);

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'contact.contact_type === \'c62_chw_site\' && user.parent.contact_type === \'c50_supervision_area\' && user.role === \'supervisor\'', 
        'person': false, 
        'place': true
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Supply',
          'locale': 'en'
        }, 
        {
          'content': 'Livraison de Stock',
          'locale': 'fr'
        }
      ]
    });

  });
});
