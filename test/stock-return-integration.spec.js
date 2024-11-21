const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { stockCountScenario, stockReturnScenario, stockMonitoringScenario } = require('./mocks/mocks');

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  readDataFromXforms,
  cleanUp,
  resetTranslationMessages,
  writeTranslationMessages
} = require('./test-utils');

describe('Create and update stock_count.xlsx, stock_return.xlsx, stock_returned.xlsx and properties files', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_return.xlsx', 'stock_return.properties.json','stock_returned.xlsx', 'stock_returned.properties.json', 'stock_count.properties.json', 'stock_count.xlsx'];
  
  const enStockCountMessage = `cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today
  cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>
  cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page
  cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count
  cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>
  cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>
  cht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count
  cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses
  cht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}
  cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}
  cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}
  cht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol`;

  const frStockCountMessage = `cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today
  cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>
  cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page
  cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count
  cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>
  cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>
  cht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count
  cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses
  cht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}
  cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}
  cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}
  cht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole`;
  
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


  beforeEach(async() => {
    setDirToprojectConfig();
    await writeTranslationMessages(frStockCountMessage, enStockCountMessage, process.cwd());
    await writeTranslationMessages(frMessage, enMessage, process.cwd());

  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    cleanUp(workingDir, createdAppFormFiles);
    revertBackToProjectHome(workingDir);
  });

  it('should not generate stock_count.xlsx, stock_return.xlsx, stock_returned.xlsx and should return an error message', async() => {
    const processDir = process.cwd();
    
    // Check that stock count xform and properties files does not exist
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    const invalidInputScenario = stockMonitoringScenario.invalidCommandInitScenario;
    const stockCountChildProcess = spawnSync('../../main.js',  invalidInputScenario);
    if(stockCountChildProcess.error) {
      expect(stockCountChildProcess.stdout.toString()).toThrow(Error);
    }

    const message  = stockCountChildProcess.stdout.toString().replace('\n','');
    expect(message).toEqual(`ERROR Unknown command ${invalidInputScenario[0]}`);

    // Check that stock count xform and properties files are not created
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

  });

  it('should generate and update the stock_count.xlsx, stock_return.xlsx and stock_returned.xlsx and their respective properties files whit the feature config provided', async() => {
    const projectDataDir = process.cwd();
    const stockMonitoringConfig = path.join(projectDataDir, 'stock-monitoring.config.json');

    // Check that stock monitoring is initialized and stock return and returned xform is generated
    expect(fs.existsSync(stockMonitoringConfig)).toBe(false);
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expected not to find ${createdAppFormFile}, but does exist`).toBeFalsy();
    }

    const childProcess = spawnSync('../../main.js',  stockMonitoringScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    } else {

      const stockReturnChildProcess = spawnSync('../../main.js', stockReturnScenario.addFeatureScenario);
      
      if (stockReturnChildProcess.error) {
        throw stockReturnChildProcess.error;
      }

      // Check that stock monitoring is initialized and stock return and returned xform are generated
      for(const createdAppFormFile of createdAppFormFiles){
        expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile)), `Expect to find ${createdAppFormFile}, but does not exist`).toBeTruthy();
      }
      
      expect(fs.existsSync(stockMonitoringConfig)).toBe(true);

      // Check that the products and categories are available in stock count xform
      const stockCountData = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');

      expect(stockCountData.productsList.length).toBe(stockCountScenario.productsScenario.length);
      expect(stockCountData.productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);
      expect(stockCountData.productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
      expect(stockCountData.productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);

      // Check that the products and categories are available in stock return xform
      const stockReturnData = await readDataFromXforms(stockReturnScenario.productCategoryScenario, stockReturnScenario.productsScenario, 'stock_return.xlsx');
      expect(stockReturnData.productsList.length).toBe(stockReturnScenario.productsScenario.length);
      expect(stockReturnData.productsList.entries).toStrictEqual(stockReturnScenario.productsScenario.entries);
      expect(stockReturnData.productCategoryList.length).toBe(stockReturnScenario.productCategoryScenario.length);
      expect(stockReturnData.productCategoryList.entries).toStrictEqual(stockReturnScenario.productCategoryScenario.entries);

      // Check that products returned and categories are available in stock returned xform(confirmation)
      const stockReturnedData = await readDataFromXforms(stockReturnScenario.productCategoryScenario, stockReturnScenario.productReturnedScenario, 'stock_returned.xlsx');
      expect(stockReturnedData.productsList.length).toBe(stockReturnScenario.productReturnedScenario.length);
      expect(stockReturnedData.productsList.entries).toStrictEqual(stockReturnScenario.productReturnedScenario.entries);
      expect(stockReturnedData.productCategoryList.length).toBe(stockReturnScenario.productCategoryScenario.length);
      expect(stockReturnedData.productCategoryList.entries).toStrictEqual(stockReturnScenario.productCategoryScenario.entries);

    }
  });

});
