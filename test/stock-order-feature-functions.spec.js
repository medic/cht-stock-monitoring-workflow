const path = require('path');
const ExcelJS = require('exceljs');
const { 
  stockOutMockConfigs, 
  mockConfigsWithNoFeauture ,
  stockMonitoringConfigs
} = require('./mocks/mocks');

const { 
  getItemRows,
  getStockOrderConfigs,
  updateStockOrder,
  addOrderSummaries,
  addExportCalculation
} = require('../src/features/stock-order'); 

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
  const createdAppFormFiles = ['stock_order.xlsx', 'stock_order.properties.json'];
  const workingDir = process.cwd();
  const enMessage = 'cht-stock-monitoring-workflow.stock_order.message.select_category_label = Categories selection\ncht-stock-monitoring-workflow.stock_order.message.select_category = Select the category of what you want to order\ncht-stock-monitoring-workflow.stock_order.message.select_items = Select the different item you want to order\ncht-stock-monitoring-workflow.stock_order.message.items_selection = Items selection\ncht-stock-monitoring-workflow.stock_order.message.qty_before = Quantity before\ncht-stock-monitoring-workflow.stock_order.message.qty_ordered = Quantity to order\ncht-stock-monitoring-workflow.stock_order.message.qty_after = Quantity after\ncht-stock-monitoring-workflow.stock_order.message.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_order.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\ncht-stock-monitoring-workflow.stock_order.message.summary_note = Stock items you ordered.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_order.supply.message.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_order.supply.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\ncht-stock-monitoring-workflow.stock_order.supply.message.summary_note = Stock items you supplied.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_order.tasks.stock_supply = Stock Supply\ncht-stock-monitoring-workflow.stock_order.label.add_item_qty = Add item quantity\ncht-stock-monitoring-workflow.stock_order.supply.message.qty_ordered = Quantity ordered: <b>{{qty}}</b>\ncht-stock-monitoring-workflow.stock_order.supply.message.qty = Quantity to supply';
  const frMessage = 'cht-stock-monitoring-workflow.stock_order.message.select_category_label = Sélection des catégories\ncht-stock-monitoring-workflow.stock_order.message.select_category = Sélectionner les catégories des éléments à commander\ncht-stock-monitoring-workflow.stock_order.message.select_items = Selectionner les différents éléments à commander\ncht-stock-monitoring-workflow.stock_order.message.items_selection = Sélection des éléments\ncht-stock-monitoring-workflow.stock_order.message.qty_before = Quantité avant\ncht-stock-monitoring-workflow.stock_order.message.qty_ordered = Quantité à commander\ncht-stock-monitoring-workflow.stock_order.message.qty_after = Quantité après\ncht-stock-monitoring-workflow.stock_order.message.summary_header = Page Résultas/Résumé\ncht-stock-monitoring-workflow.stock_order.message.submit_note = <h4 style="text-align:center;">Assurez-vous de soumettre pour compléter cette action.</h4>\ncht-stock-monitoring-workflow.stock_order.message.summary_note = Eléments commandés.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_order.supply.message.summary_header = Page Résultas/Résumé\ncht-stock-monitoring-workflow.stock_order.supply.message.submit_note = <h4 style="text-align:center;">Assurez-vous de soumettre pour compléter cette action.</h4>\ncht-stock-monitoring-workflow.stock_order.supply.message.summary_note = Eléments livrés.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_order.tasks.stock_supply = Stock à livrer\ncht-stock-monitoring-workflow.stock_order.label.add_item_qty = Ajouter la quantité\ncht-stock-monitoring-workflow.stock_order.supply.message.qty_ordered = Quantité commandée: <b>{{qty}}</b>\ncht-stock-monitoring-workflow.stock_order.supply.message.qty = Quantité à livrer';

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
  // Testing get item row function out config generation with no or wrong item config and params
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];

    expect(() => getItemRows(header, stockOutMockConfigs.languages, messages,  items)).toThrow(TypeError);
    
  });

  // Testing get item row function out of config generation with correct item config and params
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
    const categories = Object.values(stockMonitoringConfigs.categories);

    const row =  getItemRows(header, stockMonitoringConfigs.languages, messages, `${categories[0].name}_items_selected`,  items);
    expect(row).not.toEqual([]);
    expect(row.length).toBe(items.length);
    expect(row[0].length).toBe(13);
    const oneRow = row[0][0];
    expect(oneRow.length).toBe(13);
    expect(oneRow[0]).toEqual('begin group');
    expect(oneRow[1]).toContain(items[0].name);
    
  });

  /** Testing getStockOutConfigs function */
  // Testing stock out config generation with correct item config
  it('This should generate stock out configurations based the item config provided ', async () => {
    process.argv = ['node', '', '','', '', 
      '[{contact_type: \'c62_chw\', role: \'chw\', place_type: \'c60_chw_site\' },{contact_type: \'c52_supervisor\',role: \'supervisor\',place_type: \'c50_supervision_area\'}]', 
      'stock_order',  
      'Stock Order, Commande de Stock', '', 'Stock Order Supply, Approvisionnement en commande de stock',
      'stock_order_supply'
    ];
    const configs = {
      actors: [
        {
          contact_type: 'c62_chw',
          role: 'chw',
          place_type: 'c60_chw_site'
        },
        {
          contact_type: 'c52_supervisor',
          role: 'supervisor',
          place_type: 'c50_supervision_area'
        }
      ],
      form_name: 'stock_order',
      title: { en: 'Stock Order', fr: ' Commande de Stock' },
      stock_supply: {
        title: {
          en: 'Stock Order Supply',
          fr: ' Approvisionnement en commande de stock'
        }
      }
    };
    
    const featureConfigs = await  getStockOrderConfigs(stockMonitoringConfigs);
    expect(featureConfigs).toEqual(configs);
    
  });

  // Testing stock out config not generating with no or wrong item config
  it('This should throw error for xform configurations with no or wrong item config', async () => {
    await expect(getStockOrderConfigs(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
  });

  /** Testing add summaries to stock_order */
  it('should add summaries correctly when categories and items are provided', async () => {
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);
    const categories = Object.values(stockMonitoringConfigs.categories);
    const projectDataDir = process.cwd();

    // Call the function updateStockReturned and check that the stock_returned files are generated
    await updateStockOrder(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_order.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addOrderSummaries(surveyWorkSheet, languages, items, categories);

    // Check that items are inserted in stock_returned xform 
    const categoryNames = categories.map((category) => `${category.name}_summary`);
    const itemNames = items.map((item) => `${item.name}_summary`);
    const stockOrderData = await readDataFromXforms(categoryNames, itemNames,'stock_order.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemNames.length);
    expect(stockOrderData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockOrderData.productCategoryList.length).toBe(categoryNames.length);
    expect(stockOrderData.productCategoryList.entries).toStrictEqual(categoryNames.entries);

  });

  it('should add summaries correctly when no categories are provided', async () => {
    const projectDataDir = process.cwd();
    const languages = Object.values(stockMonitoringConfigs.languages);
    const items = Object.values(stockMonitoringConfigs.items);

    // Call the function updateStockOrder and check that the stock_return files are generated
    await updateStockOrder(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_order.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
    
    addOrderSummaries(surveyWorkSheet, languages, items);

    const itemNames = items.map((item) => `${item.name}_summary`);

    const stockOrderData = await readDataFromXforms([], itemNames,'stock_order.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemNames.length);
    expect(stockOrderData.productsList.entries).toStrictEqual(itemNames.entries);
    expect(stockOrderData.productCategoryList.length).toBe(0);

  });

  /** Testing add export calculation to stock_order */
  it('should add export calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    const projectDataDir = process.cwd();

    // Call the function updateStockOrder and check that the stock_order files are generated
    await updateStockOrder(stockMonitoringConfigs);

    const formPath = path.join(projectDataDir, 'forms', 'app', 'stock_order.xlsx');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(formPath);
    const surveyWorkSheet = workbook.getWorksheet('survey');
  
    addExportCalculation(surveyWorkSheet, items);

    // Check that items are inserted in stock_return xform 
    const itemData = [];
    for (const item of items){
      itemData.push(`${item.name}___current___set`);
      itemData.push(`${item.name}___current___unit`);
      itemData.push(`${item.name}___set`);
      itemData.push(`${item.name}___unit`);
      itemData.push(`${item.name}___after___set`);
      itemData.push(`${item.name}___after___unit`);
      itemData.push(`${item.name}___count`);
      itemData.push(`${item.name}_after`);
    }
    const stockOrderData = await readDataFromXforms(['___paracetamol'], itemData, 'stock_order.xlsx' );
    
    expect(stockOrderData.productsList.length).toBe(itemData.length);
    for(let index =0; index < itemData.length; index ++){
      expect(stockOrderData.productsList[index]).toEqual(itemData[index]);
    }

  });

});
