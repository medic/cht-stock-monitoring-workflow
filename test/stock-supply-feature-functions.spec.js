const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockMonitoringConfigs,
  mockConfigsWithNoFeauture 
} = require('./mocks/mocks');

const { 
  getItemRows,
  updateStockSupply,
  getStockSupplyConfigs,
  addStockSupplyCalculation,
  getAdditionalDoc,
  addStockSupplySummaries,
   
} = require('../src/features/stock-supply'); 

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
  const processInitialArgv = process.argv; // Save the original argv
  const workingDir = process.cwd();
  const createdAppFiles = ['stock_received.xlsx', 'stock_received.properties.json', 'stock_supply.xlsx', 'stock_supply.properties.json'];
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
    process.argv = processInitialArgv; // Restore the original argv after each test
  });


  // Testing get item row function
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];

    expect(() => getItemRows(header, stockMonitoringConfigs.languages, messages,  items)).toThrow(TypeError);
    
  });

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

  /** Testing add confirmation calculation to stock_supply */
  it('should add stock supply calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();
    const messages = getTranslations();

    // Call the function updateStockSupply and check that the stock_order files are generated
    await updateStockSupply(stockMonitoringConfigs, messages);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_supply.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
  
    addStockSupplyCalculation(surveyWorkSheet, items);

    // Check that items are inserted in stock_return xform 
    const itemData = items.map(item => `${item.name}_supply`);
    const stockSupplyData = await readDataFromXforms([], itemData, 'stock_supply.xlsx' );
  
    expect(stockSupplyData.productsList.length).toBe(itemData.length);
    for(let index =0; index < itemData.length; index ++){
      expect(stockSupplyData.productsList[index]).toEqual(itemData[index]);
    }

  });

  /** Testing add summaries to stock_supply */
  it('should add summaries correctly when categories and items are provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();
    const messages = getTranslations();

    // Call the function updateStockSupply and check that the stock_supply files are generated
    await updateStockSupply(stockMonitoringConfigs, messages);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_supply.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addStockSupplySummaries(surveyWorkSheet, items, languages);

    // Check that items are inserted in stock_supply xform 
    const categoryNames = [];
    const itemNames =items.map(item => `s_${item.name}`);
    const stockOrderData = await readDataFromXforms(categoryNames, itemNames,'stock_supply.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemNames.length);
    expect(stockOrderData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockOrderData.productCategoryList.length).toBe(categoryNames.length);
    expect(stockOrderData.productCategoryList.entries).toStrictEqual(categoryNames.entries);

  });

  // Testing get additional doc
  it('This should return additional doc for stock discrepancy', async () => {
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

    const items = Object.values(stockMonitoringConfigs.items);
    const languages = Object.values(stockMonitoringConfigs.languages);
    const form_name = stockMonitoringConfigs.features.stock_supply.discrepancy.form_name;
    const needsConfirmation = stockMonitoringConfigs.features.stock_supply.confirm_supply.active;

    const itemCalculation = [
      'calculate',
      'paracetamol_in',
      '',
      '',
      '',
      '',
      '',
      '${paracetamol___count}',
      '',
      '',
      '',
      '',
      ''
    ];

    const additionalDoc = getAdditionalDoc(form_name, languages, header, items, needsConfirmation);
    expect(additionalDoc).toContainEqual(itemCalculation);

  });

  /** Testing getStockSupplyConfigs function */
  // Testing stock supply config generation with correct item config
  it('This should generate stock supply config configurations based the item config provided ', async () => {
    process.argv = ['', '', '','', 
      'stock_supply', 'Stock Supply,Apporvisionnement de stock', 
      true, 'stock_received','Stock Received, Stock Reçu', 
      'stock_discrepancy_resolution',
      'Stock Discrepancy Resolution, Resolution de Stock'
    ];
    const configs = {
      form_name: 'stock_supply',
      title: { en: 'Stock Supply', fr: 'Apporvisionnement de stock' },
      confirm_supply: {
        form_name: 'stock_received',
        title: { 
          en: 'Stock Received', 
          fr: ' Stock Reçu' 
        },
        active: true
      },
      discrepancy: {
        form_name: 'stock_discrepancy_resolution',
        title: { 
          en: 'Stock Discrepancy Resolution', 
          fr: ' Resolution de Stock' 
        }
      }
    };
    
    const featureConfigs = await  getStockSupplyConfigs(stockMonitoringConfigs);
    expect(featureConfigs).toEqual(configs);
    
  });

  it('This should throw error for xform configurations with no or wrong item config', async () => {
    await expect(getStockSupplyConfigs(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
  });

});
