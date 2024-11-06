const fs = require('fs');
const path = require('path');
const { stockSupplyConfig, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { updateStockDiscrepancy } = require('../src/features/stock-discrepancy');
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  readOutputFiles,
  cleanUp
} = require('./test-utils');

describe('update Stock Supply', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_discrepancy_resolution.xlsx', 'stock_discrepancy_resolution.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async() => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
    jest.clearAllMocks();
  });

  it('stock return form should should not be generated and updated', async () => {
    const projectDataDir = process.cwd();
    // Check that stock discrepancy xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    
    // Call the function updateStockDiscrepancy and check it throws an exception when there is no match config
    await expect( updateStockDiscrepancy(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });


  it('should update the stock supply form with correct values', async () => {
    const processDir = process.cwd();
    
    // Check that stock confirmation xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockDiscrepancy and check that the stock_received files are generated
    await updateStockDiscrepancy(stockSupplyConfig);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that stock received files content are correctly written.
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
        'expression': 'user.parent.contact_type === \'c50_supervision_area\' && user.role === \'supervisor\'', 
        'person': false, 
        'place': false
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Discrepancy Resolution',
          'locale': 'en'
        }, 
        {
          'content': 'Résolution de conflits',
          'locale': 'fr'
        }
      ]
    });

  });
});
