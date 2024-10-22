const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { mockConfigs } = require('./mocks/mocks');
const { updateStockOut } = require('../src/features/stock-out'); 
const {
  setDirToprojectConfig,
} = require('./test-utils');

describe('updateStockOut', () => {
  const workingDir = process.cwd();

  beforeEach(() => {
    setDirToprojectConfig();
  });

  afterEach(() => {
    jest.clearAllMocks();
    process.chdir(workingDir);
  });

  it('should update the stock out form with correct values', async () => {
    const createdAppFormFiles = ['stock_out.properties.json', 'stock_out.xlsx'];
    const processDir = process.cwd();
    
    // Check that stock out xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockOut and check that the stock_out files are generated
    await updateStockOut(mockConfigs);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that stock out files content are correctly written.
    const formPath = path.join(processDir, 'forms', 'app', 'stock_out.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const spy = jest.spyOn(workbook, 'getWorksheet');
    const surveyWorkSheet = workbook.getWorksheet('survey');
    expect(spy).toHaveBeenCalledTimes(1);
    const settingWorkSheet = workbook.getWorksheet('settings');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(surveyWorkSheet).not.toEqual([]);
    expect(settingWorkSheet).not.toEqual([]);


    const propertiesFileContent = fs.readFileSync(
      path.join(processDir, 'forms', 'app', 'stock_out.properties.json'), 
      {encoding: 'utf-8'}
    );

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'user.parent.contact_type === \'c50_supervision_area\'', 
        'person': false, 
        'place': false
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Out Title',
          'locale': 'en'
        }, 
        {
          'content': 'Titre du Stock',
          'locale': 'fr'
        }
      ]
    });

    // Delete generated stock out files
    for(const createdAppFormFile of createdAppFormFiles){
      fs.stat(path.join(processDir, 'forms', 'app', createdAppFormFile), (error) => {
        if (!error) {
          expect(fs.unlinkSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(undefined);
        }
      });
    }

  });
});
