const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

const { stockCountScenario } = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms,
  writeTranslationMessages,
  resetTranslationMessages
} = require('./test-utils');


describe('Create and update stock_count.xlsx and properties files', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_count.properties.json', 'stock_count.xlsx'];
  const enMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\n\
  cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\n\
  cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\n\
  cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\n\
  cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n\
  cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\n\
  cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\ncht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\n\
  cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\n\
  cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  const frMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\n\
  cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\n\
  cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\n\
  cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\n\
  cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n\
  cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\n\
  cht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\n\
  cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\n\
  cht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\n\
  cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\n\
  cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';

  beforeEach(async() => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    await resetTranslationMessages(process.cwd());
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('Add stock count integration test', async() => {
    const processDir = process.cwd();
    // Check that stock count xform and properties files does not exist
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    const childProcess = spawnSync('../../main.js',  stockCountScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }

    const stockMonitoringConfig = path.join(processDir, 'stock-monitoring.config.json');

    // Check that stock monitoring is initialized and stock count xform is generated
    expect(fs.existsSync(stockMonitoringConfig)).toBe(true);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that the products and categories are available in stock count xform
    const { productsList, productCategoryList } = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

    expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
    expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
    expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
    expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);

  });

});
