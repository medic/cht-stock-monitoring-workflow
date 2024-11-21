const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockMonitoringConfigs, 
  mockConfigsWithNoFeauture 
} = require('./mocks/mocks');

const { 
  updateStockReturn, 
} = require('../src/features/stock-return'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  resetTranslationMessages,
  writeTranslationMessages,
  cleanUp
} = require('./test-utils');

describe('Stock Return feature', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_return.xlsx', 'stock_return.properties.json'];
  const enMessage =`cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Categories selection
  cht-stock-monitoring-workflow.stock_return.forms.select_category = Select the category of what you want to return
  cht-stock-monitoring-workflow.stock_return.forms.select_items = Select the different item you want to return
  cht-stock-monitoring-workflow.stock_return.forms.select_items.return_reason = Reason for return
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.excess = Excess
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.damaged = Damaged
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.expired = Expired
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.other = Other
  cht-stock-monitoring-workflow.stock_return.message.items_selection = Items selection
  cht-stock-monitoring-workflow.stock_return.forms.specify = Specify reason
  cht-stock-monitoring-workflow.stock_return.forms.qty_before = Quantity before
  cht-stock-monitoring-workflow.stock_return.forms.qty_after = Quantity after
  cht-stock-monitoring-workflow.stock_return.forms.qty_returned = Quantity to return
  cht-stock-monitoring-workflow.stock_return.summary_header = Results/Summary page
  cht-stock-monitoring-workflow.stock_return.summary_note = Stock items you returned.<i class="fa fa-list-ul"></i>`;
  
  const frMessage = `cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Sélection Catégorie
  cht-stock-monitoring-workflow.stock_return.forms.select_category = Sélectionner la catégorie de l'élément à retourner
  cht-stock-monitoring-workflow.stock_return.forms.select_items = Sélectionner les différents éléments à retourner
  cht-stock-monitoring-workflow.stock_return.forms.select_items.return_reason = Raison du retour
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.excess = Excès
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.damaged = Endommagé
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.expired = Expiré
  cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.other = Autre
  cht-stock-monitoring-workflow.stock_return.message.items_selection = Sélection d'éléments
  cht-stock-monitoring-workflow.stock_return.forms.specify = Spécifier la raison
  cht-stock-monitoring-workflow.stock_return.forms.qty_before = Quantité avant
  cht-stock-monitoring-workflow.stock_return.forms.qty_after = Quantité après
  cht-stock-monitoring-workflow.stock_return.forms.qty_returned = Quantité à retourner
  cht-stock-monitoring-workflow.stock_return.summary_header = Page Résultats/Résumé
  cht-stock-monitoring-workflow.stock_return.summary_note = Eléments retournés.<i class="fa fa-list-ul"></i>`;

  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    cleanUp(workingDir, createdAppFormFiles);
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
    await updateStockReturn(stockMonitoringConfigs);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expect to find ${createdAppFormFile}, but does not exist`).toBeTruthy();
    }

    // Check that stock out files content are correctly written.
    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_return.xlsx');
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
      path.join(projectDataDir, 'forms', 'app', 'stock_return.properties.json'), 
      {encoding: 'utf-8'}
    );
    
    expect(JSON.parse(propertiesFileContent)).toEqual({
      context: {
        expression: 'user.parent.contact_type === \'c62_chw_site\' && contact.contact_type === \'c62_chw_site\'', 
        person: false, 
        place: true,
      },
      icon: 'icon-healthcare-medicine',  
      title: [
        {
          content: 'Stock Return',
          locale: 'en'
        }, 
        {
          content: 'Retour de Stock',
          locale: 'fr'
        }
      ]
    });
  });

});
