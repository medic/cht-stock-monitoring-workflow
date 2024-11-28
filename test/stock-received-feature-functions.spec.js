const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockMonitoringConfigs
} = require('./mocks/mocks');

const { 
  getItemRows,
  updateStockConfirmation,
  addStockConfirmCalculation,
  addStockConfirmSummaries,
  getLabelColumns
} = require('../src/features/stock-received'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
  cleanUp,
  readDataFromXforms
} = require('./test-utils');

const { getTranslations } = require('../src/common');

describe('Testing functions in Stock out feature file', () => {
  const workingDir = process.cwd();
  const createdAppFiles = ['stock_received.xlsx', 'stock_received.properties.json'];
  const enMessage = 'cht-stock-monitoring-workflow.stock_supply.page_1.header = Select item to supply\ncht-stock-monitoring-workflow.stock_supply.forms.select_category = Select the category of what you want to return\n'
  +'cht-stock-monitoring-workflow.stock_supply.page_1.select_input = Select\ncht-stock-monitoring-workflow.stock_supply.page_1.select_input_hint = Select all items to supply\ncht-stock-monitoring-workflow.stock_supply.item.stock_on_hand = Stock on hand\ncht-stock-monitoring-workflow.stock_supply.item.quantity_of = Quantity of\n'
  +'cht-stock-monitoring-workflow.stock_supply.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_supply.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n' 
  +'cht-stock-monitoring-workflow.stock_supply.summary_note = Stock items you supply.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_supply.tasks.reception-confirmation = Stock received\n'
  +'cht-stock-monitoring-workflow.stock_supply.confirmation.item_received_confirmation_question = Did you received {{qty_unit}}\ncht-stock-monitoring-workflow.stock_supply.choices.yes_no.yes = Yes\n'
  +'cht-stock-monitoring-workflow.stock_supply.choices.yes_no.no = No\ncht-stock-monitoring-workflow.stock_supply.forms.additional_doc_title = Stock uses\ncht-stock-monitoring-workflow.stock_supply.forms.item_used_question = Quantity of {{item}}\n'
  +'cht-stock-monitoring-workflow.stock_supply.confirmation.qty_received_question = Enter the quantity received\ncht-stock-monitoring-workflow.stock_supply.tasks.stock-descreptancy = Commodity Discrepancy Resolution\n'
  +'cht-stock-monitoring-workflow.stock_supply.forms.select_items = Select the different item you want to supply\ncht-stock-monitoring-workflow.stock_supply.confirmation.summary_note = Stock items you received.<i class="fa fa-list-ul"></i>\n'
  +'cht-stock-monitoring-workflow.stock_supply.discrepancy.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_supply.discrepancy.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n'
  +'cht-stock-monitoring-workflow.stock_supply.discrepancy.summary_note = Discrepancy resolution<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_issued = Quantity issued: {{qty}}\n'
  +'cht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_confirmed = Quantity confirmed: {{qty}}\ncht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_final = What is the final quantity ?\n'
  +'cht-stock-monitoring-workflow.stock_supply.label.confirm_qty = Confirm quantities\ncht-stock-monitoring-workflow.stock_supply.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\ncht-stock-monitoring-workflow.stock_supply.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}';
  
  const frMessage = 'cht-stock-monitoring-workflow.stock_supply.page_1.header = Sélectionner les élément à livrer\n'+
  'cht-stock-monitoring-workflow.stock_supply.forms.select_category = Sélectionner les catégories des éléments à retourner\n'+
  'cht-stock-monitoring-workflow.stock_supply.page_1.select_input = Sélectionner\n'+
  'cht-stock-monitoring-workflow.stock_supply.page_1.select_input_hint = Sélectionner tous les éléments à livrer\n'+
  'cht-stock-monitoring-workflow.stock_supply.item.stock_on_hand = Stock actuel\n'+
  'cht-stock-monitoring-workflow.stock_supply.item.quantity_of = Quantité de\n'+
  'cht-stock-monitoring-workflow.stock_supply.summary_header = Page Résultats\n'+
  'cht-stock-monitoring-workflow.stock_supply.submit_note = <h4 style="text-align:center;">Assurez-vous de soumettre pour enregistrer cette action.</h4>\n'+
  'cht-stock-monitoring-workflow.stock_supply.summary_note = Stock livré.<i class="fa fa-list-ul"></i>\n'+
  'cht-stock-monitoring-workflow.stock_supply.tasks.reception-confirmation = Stock reçu\n'+
  'cht-stock-monitoring-workflow.stock_supply.confirmation.item_received_confirmation_question = Avez-vous reçu {{qty_unit}}\n'+
  'cht-stock-monitoring-workflow.stock_supply.choices.yes_no.yes = Oui\n'+
  'cht-stock-monitoring-workflow.stock_supply.choices.yes_no.no = Non\n'+
  'cht-stock-monitoring-workflow.stock_supply.forms.additional_doc_title = Stock utilsé\n'+
  'cht-stock-monitoring-workflow.stock_supply.forms.item_used_question = Quantité de {{item}}\n'+
  'cht-stock-monitoring-workflow.stock_supply.confirmation.qty_received_question = Entrer la quantité reçu\n'+
  'cht-stock-monitoring-workflow.stock_supply.tasks.stock-descreptancy = Résolution Conflit\n'+
  'cht-stock-monitoring-workflow.stock_supply.forms.select_items = Sélectionner les différents éléments que vous voulez livrer\n'+
  'cht-stock-monitoring-workflow.stock_supply.confirmation.summary_note = Stock que vous avez reçu.<i class="fa fa-list-ul"></i>\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.summary_header = Page Résultats\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.submit_note = <h4 style="text-align:center;">Assurez-vous de soumettre pour completer cette action.</h4>\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.summary_note = Résolution de conflits<i class="fa fa-list-ul"></i>\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_issued = Quantité envoyée: {{qty}}\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_confirmed = Quantité confirmée: {{qty}}\n'+
  'cht-stock-monitoring-workflow.stock_supply.discrepancy.quantity_final = Quelle est la quantité finale ?\n'+
  'cht-stock-monitoring-workflow.stock_supply.label.confirm_qty = Confirmer les quantités\n'+
  'cht-stock-monitoring-workflow.stock_supply.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\n'+
  'cht-stock-monitoring-workflow.stock_supply.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}';
  
  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    await cleanUp(workingDir, createdAppFiles);
    revertBackToProjectHome(workingDir);
  });

  /** Testing getItemRows function */
  // Testing get item row function with no header
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];

    expect(() => getItemRows(header, stockMonitoringConfigs.languages, messages,  items)).toThrow(TypeError);
    
  });

  // Testing get item row function
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
    const oneRow = row[0][0];
    expect(oneRow.length).toBe(13);
    expect(oneRow[0]).toEqual('begin group');
    expect(oneRow[1]).toContain(items[0].name);
    
  });

  /** Testing add confirmation calculation to stock_received */
  it('should add confirmation calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();
    const messages = getTranslations();

    // Call the function updateStockOrder and check that the stock_order files are generated
    await updateStockConfirmation(stockMonitoringConfigs, messages);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_received.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
  
    addStockConfirmCalculation(surveyWorkSheet, items);

    // Check that items are inserted in stock_return xform 
    const itemData = [];
    for (const item of items){
      itemData.push(`${item.name}_confirmed`);
    }
    const stockOrderData = await readDataFromXforms(['out'], itemData, 'stock_received.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemData.length);
    for(let index =0; index < itemData.length; index ++){
      expect(stockOrderData.productsList[index]).toEqual(itemData[index]);
    }

  });

  /** Testing add summaries to stock_received */
  it('should add summaries correctly when categories and items are provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);
    const categories = Object.values(stockMonitoringConfigs.categories);
    const projectDataDir = process.cwd();
    const messages = getTranslations();

    // Call the function updateStockConfirmation and check that the stock_received files are generated
    await updateStockConfirmation(stockMonitoringConfigs, messages);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_received.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addStockConfirmSummaries(surveyWorkSheet, languages, items, categories);

    // Check that items are inserted in stock_returned xform 
    const categoryNames = categories.map((category) => `${category.name}_summary`);
    const itemNames =[];
    for(const item of items){
      itemNames.push(`${item.name}_summary_yes`);
      itemNames.push(`${item.name}_summary_no`);
    }
    const stockOrderData = await readDataFromXforms(categoryNames, itemNames,'stock_received.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemNames.length);
    expect(stockOrderData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockOrderData.productCategoryList.length).toBe(categoryNames.length);
    expect(stockOrderData.productCategoryList.entries).toStrictEqual(categoryNames.entries);

  });

  /** Testing get labels for to stock_received */
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
      'Results/Summary page',
      '<h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>',
      'Stock items you received.<i class="fa fa-list-ul"></i>',
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

});
