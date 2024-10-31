const fs = require('fs');
const path = require('path');
const { mockConfigsStockReturn, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { 
  updateStockReturn, 
} = require('../src/features/stock-return'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  readOutputFiles,
  deleteGeneratedFiles
} = require('./test-utils');

describe('Stock Return feature', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_return.xlsx', 'stock_return.properties.json'];

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    jest.clearAllMocks();
    revertBackToProjectHome(workingDir);
  });

  afterAll(() => {
    revertBackToProjectHome(workingDir);
  });

  it('stock return form should should not be generated and updated', async () => {
    const projectDataDir = process.cwd();
    // Check that stock return xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }
    
    // Call the function updateStockReturn and check it throws an exception when there is no match config
    await expect( updateStockReturn(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });


  it(' stock return form should form should be generated and updated with correct values', async () => {

    const projectDataDir = process.cwd();
    // Check that stock return xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }
    // Call the function updateStockReturn and check that the stock_return files are generated
    await updateStockReturn(mockConfigsStockReturn);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expect to find ${createdAppFormFile}, but does not exist`).toBeTruthy();
    }

    // Check that stock out files content are correctly written.
    const {workbook, propertiesFileContent} = await readOutputFiles(createdAppFormFiles);
    const spy = jest.spyOn(workbook, 'getWorksheet');
    const surveyWorkSheet = workbook.getWorksheet('survey');
    expect(spy).toHaveBeenCalledTimes(1);
    const settingWorkSheet = workbook.getWorksheet('settings');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(surveyWorkSheet._name).toEqual('survey');
    expect(settingWorkSheet._name).toEqual('settings');

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'user.parent.contact_type === \'c60_chw_site\' && contact.contact_type === \'c60_chw_site\'', 
        'person': false, 
        'place': true
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Return',
          'locale': 'en'
        }, 
        {
          'content': 'Retour de Stock',
          'locale': 'fr'
        }
      ]
    });

    // Remove the generated files
    await deleteGeneratedFiles(createdAppFormFiles);
  });

});
