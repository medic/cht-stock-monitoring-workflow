const fs = require('fs');
const path = require('path');
const { stockSupplyConfig, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { updateStockConfirmation } = require('../src/features/stock-received'); 
const { getTranslations } = require('../src/common');
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  readOutputFiles,
  cleanUp
} = require('./test-utils');

describe('update Stock Received', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_received.xlsx', 'stock_received.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(async () => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
    jest.clearAllMocks();
  });


  it('should  not be generated and updated stock received form', async () => {
    const projectDataDir = process.cwd();
    // Check that stock discrepancy xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    
    // Call the function updateStockDiscrepancy and check it throws an exception when there is no match config
    await expect( updateStockConfirmation(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });

  it('should update the stock received form with correct values', async () => {
    const processDir = process.cwd();
    
    // Check that stock confirmation xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockConfirmation and check that the stock_received files are generated
    const messages = getTranslations();
    expect(messages.length).not.toEqual(0);
    await updateStockConfirmation(stockSupplyConfig, messages);

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
        'expression': 'user.parent.contact_type === \'c62_chw_site\'', 
        'person': false, 
        'place': false
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Received',
          'locale': 'en'
        }, 
        {
          'content': 'Réception de Stock',
          'locale': 'fr'
        }
      ]
    });

  });
});
