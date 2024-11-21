const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockMonitoringConfigs, 
  mockConfigsWithNoFeauture 
} = require('./mocks/mocks');

const { 
  getStockReturnConfigs,
  addExportCalculation,
  addReturnedSummaries,
  getChoicesFromMessage,
  updateStockReturn,
  getItemRows,
} = require('../src/features/stock-return'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
  readDataFromXforms,
  cleanUp,
} = require('./test-utils');

const { getTranslations } = require('../src/common');

describe('Testing functions in Stock out feature file', () => {
  const workingDir = process.cwd();
  const processInitialArgv = process.argv; // Save the original argv
  const createdAppFormFiles = ['stock_returned.xlsx', 'stock_returned.properties.json', 'stock_return.xlsx', 'stock_return.properties.json'];
  const enMessage =`
  cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Categories selection
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
  cht-stock-monitoring-workflow.stock_return.summary_note = Stock items you returned.<i class="fa fa-list-ul"></i>
  cht-stock-monitoring-workflow.stock_return.confirmation.item_received_question = Did you receive {{qty}} ?
  cht-stock-monitoring-workflow.stock_return.confirmation.qty_received_question = Enter the quantity received
  cht-stock-monitoring-workflow.stock_return.tasks.return-confirmation = Return confirmation
  cht-stock-monitoring-workflow.stock_return.message.summary_header = Results/Summary page`;
  
  const frMessage = `
  cht-stock-monitoring-workflow.stock_return.forms.select_category_label = Sélection Catégorie
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
  cht-stock-monitoring-workflow.stock_return.summary_note = Eléments retournés.<i class="fa fa-list-ul"></i>
  cht-stock-monitoring-workflow.stock_return.confirmation.item_received_question = Avez-vous reçu {{qty}} ?
  cht-stock-monitoring-workflow.stock_return.confirmation.qty_received_question = Entrer la quantité reçue
  cht-stock-monitoring-workflow.stock_return.tasks.return-confirmation = Confirmation Retour
  cht-stock-monitoring-workflow.stock_return.message.summary_header = Page Résultats/Résumé`;

  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
    process.argv = processInitialArgv; // Restore the original argv after each test
  });

  /** Testing getItemRows function */
  // Testing get item row function out config generation with correct item config and params
  it('This should return rows with header, messages, languages(fr, en), selected item name and items to be added  ', async () => {

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
    const categories = Object.values(stockMonitoringConfigs.categories);

    const rows =  getItemRows(header, stockMonitoringConfigs.languages, messages, categories[0].name,  items);
    expect(rows).not.toEqual([]);
    expect(rows.length).toBe(items.length);
    expect(rows[0].length).toBe(15);
    const oneRow = rows[0][0];
    expect(oneRow.length).toBe(13);
    expect(oneRow[0]).toEqual('begin group');
    expect(oneRow[1]).toContain(items[0].name);
    
  });

  // Testing get item row function out config generation with no or wrong item config and params
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en), selected item name and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];
    const categories = Object.values(stockMonitoringConfigs.categories);

    expect(() => getItemRows(header, stockMonitoringConfigs.languages, messages, categories[0].name,  items)).toThrow(TypeError);
    
  });

  /** Testing getStockReturnConfigs function */
  // Testing stock out config generation with correct item config
  it('This should generate stock return configurations with  a given item', async () => {
    process.argv = [
      '', '', '', '','stock_return', 'Stock Return,Retour de Stock',
      'stock_returned', 'Stock Returned,Stock Retourné'
    ];
    const configs = {
      form_name: 'stock_return',
      title: { 
        en: 'Stock Return', 
        fr: 'Retour de Stock' 
      },
      confirmation: {
        form_name: 'stock_returned',
        title: {
          en: 'Stock Returned',
          fr: 'Stock Retourné'
        },
      }
    };
    const featureConfigs = await  getStockReturnConfigs(stockMonitoringConfigs);
    expect(featureConfigs).toEqual(configs);
    
  });

  // Testing stock out config not generating with no or wrong item config
  it('This should throw error with no feature or wrong item config', async () => {
    await expect(getStockReturnConfigs(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
  });

  /** Testing add summaries to stock_returned */
  it('should add summaries correctly when categories and items are provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);
    const categories = Object.values(stockMonitoringConfigs.categories);
    const projectDataDir = process.cwd();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockReturn(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_return.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addReturnedSummaries(surveyWorkSheet, languages, items, categories);

    // Check that items are inserted in stock_returned xform 
    const categoryNames = categories.map((category) => `${category.name}_summary`);
    const itemNames = items.map((item) => `${item.name}_summary`);
    const stockReturnedData = await readDataFromXforms(categoryNames, itemNames,'stock_return.xlsx' );
    
    expect(stockReturnedData.productsList.length).toBe(itemNames.length);
    expect(stockReturnedData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockReturnedData.productCategoryList.length).toBe(categoryNames.length);
    expect(stockReturnedData.productCategoryList.entries).toStrictEqual(categoryNames.entries);

  });

  it('should add summaries correctly when no categories are provided', async () => {
    const projectDataDir = process.cwd();
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockReturn(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_return.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addReturnedSummaries(surveyWorkSheet, languages, items);

    const itemNames = items.map((item) => `${item.name}_summary`);

    const stockReturnedData = await readDataFromXforms([], itemNames,'stock_return.xlsx' );
    
    expect(stockReturnedData.productsList.length).toBe(itemNames.length);
    expect(stockReturnedData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockReturnedData.productCategoryList.length).toBe(0);

  });

  /** Testing add export calculation to stock_return */
  it('should add export calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockReturn(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_return.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
  
    addExportCalculation(surveyWorkSheet, items);

    // Check that items are inserted in stock_returned xform 
    const names = items.map((item) => `${item.name}_out`);
    const stockReturnData = await readDataFromXforms([], names, 'stock_return.xlsx' );
    
    expect(stockReturnData.productsList.length).toBe(items.length);
    for(let index =0; index < names.length; index ++){
      expect(stockReturnData.productsList[index]).toEqual(names[index]);
    }
  });

  it('should return choices from message for return reason', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const choices =[
      {
        list_name: 'return_reason',
        name: 'excess',
        'label::en': 'Excess',
        'label::fr': 'Excès'
      },
      {
        list_name: 'return_reason',
        name: 'damaged',
        'label::en': 'Damaged',
        'label::fr': 'Endommagé'
      },
      {
        list_name: 'return_reason',
        name: 'expired',
        'label::en': 'Expired',
        'label::fr': 'Expiré'
      },
      {
        list_name: 'return_reason',
        name: 'other',
        'label::en': 'Other',
        'label::fr': 'Autre'
      }
    ];
    const messages = getTranslations();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    const returnChoices = getChoicesFromMessage(messages, languages, 'return_reason');

    expect(returnChoices.length).toBe(choices.length);
    expect(returnChoices.entries).toBe(choices.entries);
  });

});
