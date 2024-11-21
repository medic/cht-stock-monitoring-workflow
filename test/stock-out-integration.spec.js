const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockOutScenario, stockCountScenario, stockMonitoringScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms,
  writeTranslationMessages,
  resetTranslationMessages
} = require('./test-utils');


describe('Create and update stock_out.xlsx and properties files', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_count.properties.json', 'stock_count.xlsx', 'stock_out.properties.json', 'stock_out.xlsx'];
  const enStockCountMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\ncht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\ncht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\ncht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\ncht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\ncht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\ncht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\ncht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\ncht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  const frStockCountMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\ncht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\ncht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\ncht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\ncht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\ncht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\ncht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\ncht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\ncht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\ncht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';
  
  const enStockOutMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock out\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock at hand: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock required: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Summary\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} has low stock  of the following items\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock out\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  const frStockOutMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock épuisé\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock actuel: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock nécessaire: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Résumé\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} a épuisé son stock des éléments suivants:\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock épuisé\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';


  beforeEach( async() => {
    setDirToprojectConfig();
    await writeTranslationMessages(frStockCountMessage, enStockCountMessage, process.cwd());
    await writeTranslationMessages(frStockOutMessage, enStockOutMessage, process.cwd());
  });

  afterEach(async() => {
    await resetTranslationMessages(process.cwd());
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('should generate and update the stock_count.xlsx, stock_out.xlsx and their properties files whit the feature config provided', async() => {
    const processDir = process.cwd();

    // Check that stock count and stock out xform and properties files does not exist
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    const childProcess = spawnSync('../../main.js',  stockMonitoringScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }

    // Add stock out feature test
    const stockOutChildProcess = spawnSync('../../main.js', stockOutScenario.addStockOutFeatureScenario);
    if (stockOutChildProcess.error) {
      throw stockOutChildProcess.error;
    }
 
    expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);
    
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that the products and categories are available in stock count xform
    const { productsList, productCategoryList } = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

    expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
    expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
    expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
    expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);
 
    // Check that the products are available in stock out xform
    const stockOutProducts = await readDataFromXforms([], stockOutScenario.productsScenario, 'stock_out.xlsx');
    expect(stockOutScenario.productsScenario.length).toBe(stockOutProducts.productsList.length);
    expect(stockOutScenario.productsScenario.entries).toStrictEqual(stockOutProducts.productsList.entries);

  });

});


