const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockMonitoringConfigs, 
  mockConfigsWithNoFeauture,
  stockReturnScenario 
} = require('./mocks/mocks');

const { 
  getItemRows,
  updateStockReturned,
  addExportCalculation,
  addReturnedSummaries,
  getLabelColumns,
} = require('../src/features/stock-returned'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
  readDataFromXforms,
  cleanUp
} = require('./test-utils');

const { getTranslations } = require('../src/common');

describe('Testing functions in Stock out feature file', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_returned.properties.json', 'stock_returned.xlsx'];

  const enMessage ='cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Categories selection\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_category = Select the category of what you want to return\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items = Select the different item you want to return\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.return_reason = Reason for return\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.excess = Excess\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.damaged = Damaged\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.expired = Expired\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.other = Other\n'+
  'cht-stock-monitoring-workflow.stock_return.message.items_selection = Items selection\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.specify = Specify reason\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_before = Quantity before\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_after = Quantity after\n'+
  'cht-stock-monitoring-workflow.stock_return.confirmation.item_received_question = Did you receive {{qty}} ?\n'+
  'cht-stock-monitoring-workflow.stock_return.confirmation.qty_received_question = Enter the quantity received\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_returned = Quantity to return\n'+
  'cht-stock-monitoring-workflow.stock_return.summary_header = Results/Summary page\n'+
  'cht-stock-monitoring-workflow.stock_return.summary_note = Stock items you returned.<i class="fa fa-list-ul"></i>';
  
  const frMessage = 'cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Sélection Catégorie\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_category = Sélectionner la catégorie de l\'élément à retourner\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items = Sélectionner les différents éléments à retourner\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.return_reason = Raison du retour\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.excess = Excès\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.damaged = Endommagé\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.expired = Expiré\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.select_items.reason.other = Autre\n'+
  'cht-stock-monitoring-workflow.stock_return.message.items_selection = Sélection d\'éléments\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.specify = Spécifier la raison\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_before = Quantité avant\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_after = Quantité après\n'+
  'cht-stock-monitoring-workflow.stock_return.confirmation.item_received_question = Avez-vous reçu {{qty}} ?\n'+
  'cht-stock-monitoring-workflow.stock_return.confirmation.qty_received_question = Entrer la quantité reçue\n'+
  'cht-stock-monitoring-workflow.stock_return.forms.qty_returned = Quantité à retourner\n'+
  'cht-stock-monitoring-workflow.stock_return.summary_header = Page Résultats/Résumé\n'+
  'cht-stock-monitoring-workflow.stock_return.summary_note = Eléments retournés.<i class="fa fa-list-ul"></i>';

  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    revertBackToProjectHome(workingDir);
    cleanUp(process.cwd(), createdAppFormFiles);
  });

  /** Testing getItemRows function */
  // Testing get item row function out config generation with no or wrong item config and params
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];

    expect(() => getItemRows(header, stockMonitoringConfigs.languages, messages,  items)).toThrow(TypeError);
    
  });

  // Testing get item row function out config generation with correct item config and params
  it('This should return rows with header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [
      'type',
      'name',
      'required',
      'relevant',
      'appearance',
      'constraint',
      'constraint_message',
      'calculation',
      'default',
      'label::en',
      'label::fr',
      'hint:en',
      'hint:fr'
    ];

    const messages  = getTranslations();
    const items = Object.values(stockMonitoringConfigs.items);

    const row =  getItemRows(header, stockMonitoringConfigs.languages, messages,  items);
    expect(row).not.toEqual([]);
    expect(row.length).toBe(items.length);
    expect(row[0].length).toBe(9);
    const oneRow = row[0][0];
    expect(oneRow.length).toBe(13);
    expect(oneRow[0]).toEqual('begin group');
    expect(oneRow[1]).toContain(items[0].name);
    
  });

  /** Testing get labels for to stock_returned */
  it('should get label for messages and language provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const messages = getTranslations(true);
    const labels =
    [
      'label::en',
      'Patient',
      'Source',
      'Source ID',
      'NO_LABEL',
      'NO_LABEL',
      '',
      'NO_LABEL',
      'NO_LABEL',
      'NO_LABEL',
      '',
      '',
      '',
      '',
      '',
      '',
      undefined,
      undefined,
      'Stock items you returned.<i class="fa fa-list-ul"></i>',
      '',
      '',
      'NO_LABEL'
    ];

    // Call the function getLabelColumns
    const outputLabels = getLabelColumns(languages, messages);
    
    // Check that the label are generated based on messages contain
    const subArrayOutput = outputLabels[0];
    const containsSubArray = subArrayOutput.some(subArray => {
      return JSON.stringify(subArray) === JSON.stringify(labels);
    });
    expect(containsSubArray).toBe(true);
    expect(subArrayOutput).toContainEqual(labels);

  });

  /** Testing add export calculation to stock_returned */
  it('should add export calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockReturned(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_returned.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
  
    addExportCalculation(surveyWorkSheet, items);

    // Check that items are inserted in stock_returned xform 
    const names = items.map((item) => `${item.name}_in`);
    const stockReturnData = await readDataFromXforms([], names, 'stock_returned.xlsx' );
    
    expect(stockReturnData.productsList.length).toBe(items.length);
    for(let index =0; index < names.length; index ++){
      expect(stockReturnData.productsList[index]).toEqual(names[index]);
    }
  });

  /** Testing add summaries to stock_returned */
  it('should add summaries correctly when categories and items are provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);
    const categories = Object.values(stockMonitoringConfigs.categories);
    const projectDataDir = process.cwd();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockReturned(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_returned.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addReturnedSummaries(surveyWorkSheet, languages, items, categories);

    // Check that items are inserted in stock_returned xform 
    const categoryNames = categories.map((category) => `${category.name}_summary`);
    const itemNames = [];
     
    items.map((item) => {
      itemNames.push(`${item.name}_summary_no`);
      itemNames.push(`${item.name}_summary_yes`);
    });

    const stockReturnedData = await readDataFromXforms(categoryNames, itemNames,'stock_returned.xlsx' );
    
    expect(stockReturnedData.productsList.length).toBe(itemNames.length);
    expect(stockReturnedData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockReturnedData.productCategoryList.length).toBe(categoryNames.length);
    expect(stockReturnedData.productCategoryList.entries).toStrictEqual(categoryNames.entries);

  });

  it('should generate and update the stock returned form with correct values', async () => {
    const processDir = process.cwd();
    
    // Check that stock supply xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockSupply and check that the stock_supply files are generated
    await updateStockReturned(stockMonitoringConfigs);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that products returned and categories are available in stock returned xform(confirmation)
    const formPath = path.join(processDir, 'forms', 'app', 'stock_returned.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const spy = jest.spyOn(workbook, 'getWorksheet');
    const surveyWorkSheet = workbook.getWorksheet('survey');
    expect(spy).toHaveBeenCalledTimes(1);
    const settingWorkSheet = workbook.getWorksheet('settings');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(surveyWorkSheet._name).toEqual('survey');
    expect(settingWorkSheet._name).toEqual('settings');
    expect(surveyWorkSheet).not.toEqual([]);
    expect(settingWorkSheet).not.toEqual([]);

    const stockReturnedData = await readDataFromXforms(stockReturnScenario.productCategoryScenario, stockReturnScenario.productReturnedScenario, 'stock_returned.xlsx');
    expect(stockReturnedData.productsList.length).toBe(stockReturnScenario.productReturnedScenario.length);
    expect(stockReturnedData.productsList.entries).toStrictEqual(stockReturnScenario.productReturnedScenario.entries);
    expect(stockReturnedData.productCategoryList.length).toBe(stockReturnScenario.productCategoryScenario.length);
    expect(stockReturnedData.productCategoryList.entries).toStrictEqual(stockReturnScenario.productCategoryScenario.entries);

    const propertiesFileContent = fs.readFileSync(
      path.join(processDir, 'forms', 'app', 'stock_returned.properties.json'), 
      {encoding: 'utf-8'}
    );

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'user.role === \'supervisor\'', 
        'person': false, 
        'place': false
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Returned',
          'locale': 'en'
        }, 
        {
          'content': 'Stock Retourné',
          'locale': 'fr'
        }
      ]
    });

  });

  // Testing stock returned should reject
  it('This should throw error for xform configurations', async () => {
    await expect(updateStockReturned(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
  });

});
