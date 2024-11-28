const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');

const { 
  stockSupplyScenario, 
  stockCountScenario,
  stockMonitoringScenario 
} = require('./mocks/mocks');
const { 
  setDirToprojectConfig,
  revertBackToProjectHome,
  cleanUp,
  readDataFromXforms,
  writeTranslationMessages,
  resetTranslationMessages
} = require('./test-utils');


describe('Stock supply integration test', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = [ 'stock_count.xlsx', 'stock_count.properties.json', 'stock_supply.xlsx', 'stock_supply.properties.json', 'stock_received.xlsx', 'stock_received.properties.json', 'stock_discrepancy_resolution.xlsx', 'stock_discrepancy_resolution.properties.json'];
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

  beforeEach(async() => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    await resetTranslationMessages(process.cwd());
    revertBackToProjectHome(workingDir);
  });

  it('Add stock out integration test', async() => {
    const processDir = process.cwd();
    // Check that stock supply, received and stock discrepancy xform and properties files are not generated
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }

    // Initializing stock monitoring
    const childProcess = await spawnSync('../../main.js',  stockMonitoringScenario.initScenario);

    if (childProcess.error) {
      throw childProcess.error;
    }
    else {

      // Add stock supply feature test
      const stockSupplyChildProcess = await spawnSync('../../main.js', stockSupplyScenario.addStockSupplyFeature);
      if (stockSupplyChildProcess.error) {
        throw stockSupplyChildProcess.error;
      }
      else {

        // Check that stock monitoring is initialized and stock count and stock out xform and properties files are generated
        for(const createdAppFormFile of createdAppFormFiles){
          expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
        }

        expect(fs.existsSync(path.join(processDir, 'stock-monitoring.config.json'))).toBe(true);

        // Check that stock count files content are correctly written.
        let formPath = path.join(processDir, 'forms', 'app', 'stock_count.xlsx');
        const  workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(formPath);
        let surveyWorkSheet = workbook.getWorksheet('survey');
        let settingWorkSheet = workbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        let propertiesFileContent = fs.readFileSync(
          path.join(processDir, 'forms', 'app', 'stock_received.properties.json'), 
          {encoding: 'utf-8'}
        );
        expect(propertiesFileContent).not.toEqual([]);

        // Check that the products are available in stock count xform
        const {productsList, productCategoryList} = await readDataFromXforms(stockCountScenario.productCategoryScenario, stockCountScenario.productsScenario, 'stock_count.xlsx');
        expect(productCategoryList.length).toBe(stockCountScenario.productCategoryScenario.length);
        expect(productCategoryList.entries).toStrictEqual(stockCountScenario.productCategoryScenario.entries);
        
        expect(productsList.length).toBe(stockCountScenario.productsScenario.length);
        expect(productsList.entries).toStrictEqual(stockCountScenario.productsScenario.entries);

        // Check that stock Supply files content are correctly written.
        formPath = path.join(processDir, 'forms', 'app', 'stock_supply.xlsx');
        const stockSupplyWorkbook = new ExcelJS.Workbook();
        await stockSupplyWorkbook.xlsx.readFile(formPath);
        surveyWorkSheet = stockSupplyWorkbook.getWorksheet('survey');
        settingWorkSheet = stockSupplyWorkbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        propertiesFileContent = fs.readFileSync(
          path.join(processDir, 'forms', 'app', 'stock_supply.properties.json'), 
          {encoding: 'utf-8'}
        );
        expect(stockSupplyWorkbook.propertiesFileContent).not.toEqual([]);

        // Check that stock Received files content are correctly written.
        formPath = path.join(processDir, 'forms', 'app', 'stock_received.xlsx');
        const stockReceivedWorkbook = new ExcelJS.Workbook();
        await stockReceivedWorkbook.xlsx.readFile(formPath);
        surveyWorkSheet = stockReceivedWorkbook.getWorksheet('survey');
        settingWorkSheet = stockReceivedWorkbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        propertiesFileContent = fs.readFileSync(
          path.join(processDir, 'forms', 'app', 'stock_received.properties.json'), 
          {encoding: 'utf-8'}
        );
        expect(stockReceivedWorkbook.propertiesFileContent).not.toEqual([]);

        // Check that stock Discrepancy files content are correctly written.
        formPath = path.join(processDir, 'forms', 'app', 'stock_discrepancy_resolution.xlsx');
        const stockDiscrepancyWorkbook = new ExcelJS.Workbook();
        await stockDiscrepancyWorkbook.xlsx.readFile(formPath);
        surveyWorkSheet = stockDiscrepancyWorkbook.getWorksheet('survey');
        settingWorkSheet = stockDiscrepancyWorkbook.getWorksheet('settings');
        expect(surveyWorkSheet._name).toEqual('survey');
        expect(settingWorkSheet._name).toEqual('settings');
        propertiesFileContent = fs.readFileSync(
          path.join(processDir, 'forms', 'app', 'stock_discrepancy_resolution.properties.json'), 
          {encoding: 'utf-8'}
        );
        expect(stockDiscrepancyWorkbook.propertiesFileContent).not.toEqual([]);

      }
    }

  });

});


