const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');
const { stockOutMockConfigs, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { updateStockOut } = require('../src/features/stock-out'); 
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages
} = require('./test-utils');

describe('Create and update stock_out.xlsx and properties files ', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_out.properties.json', 'stock_out.xlsx'];
  const enMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock out\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock at hand: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock required: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Summary\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} has low stock  of the following items\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock out\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  const frMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock épuisé\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock actuel: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock nécessaire: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Résumé\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} a épuisé son stock des éléments suivants:\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock épuisé\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';

  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    revertBackToProjectHome(workingDir);
  });

  it('should not generate and update stock_out.xlsx form when no feature provider in the config', async () => {
    const projectDataDir = process.cwd();
    // Check that stock out xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    
    // Call the function updateStockOut and check it throws an exception when there is no match config
    await expect( updateStockOut(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });

  it('should generate and update the stock_out.xlsx form with correct values when a config provided with the stock_out feature', async () => {
    const processDir = process.cwd();
    
    // Check that stock out xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockOut and check that the stock_out files are generated
    await updateStockOut(stockOutMockConfigs);

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
