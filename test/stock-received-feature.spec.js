const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { stockMonitoringConfigs, mockConfigsWithNoFeauture } = require('./mocks/mocks');
const { updateStockConfirmation } = require('../src/features/stock-received'); 
const { getTranslations } = require('../src/common');
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
  cleanUp
} = require('./test-utils');

describe('update Stock Received', () => {
  const workingDir = process.cwd();
  const createdAppFormFiles = ['stock_received.xlsx', 'stock_received.properties.json'];
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

  afterEach(async () => {
    // Remove the generated files
    await cleanUp(workingDir, createdAppFormFiles);
    await resetTranslationMessages(process.cwd());
    revertBackToProjectHome(workingDir);
    jest.clearAllMocks();
  });


  it('should  not be generated and updated stock received form', async () => {
    const projectDataDir = process.cwd();
    // Check that stock discrepancy xlsx and properties files does not exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(projectDataDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    
    // Call the function updateStockDiscrepancy and check it throws an exception when there is no match config
    await expect( updateStockConfirmation(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
    
  });

  it('should update the stock received form with correct values', async () => {
    const processDir = process.cwd();
    
    // Check that stock confirmation xlsx and properties files exist.
    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(false);
    }
    // Call the function updateStockConfirmation and check that the stock_received files are generated
    const messages = getTranslations();
    expect(messages.length).not.toEqual(0);
    await updateStockConfirmation(stockMonitoringConfigs, messages);

    for(const createdAppFormFile of createdAppFormFiles){
      expect(fs.existsSync(path.join(processDir, 'forms', 'app', createdAppFormFile))).toBe(true);
    }

    // Check that stock received files content are correctly written.
    const formPath = path.join(processDir, 'forms', 'app', 'stock_received.xlsx');
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

    const propertiesFileContent = fs.readFileSync(
      path.join(processDir, 'forms', 'app', 'stock_received.properties.json'), 
      {encoding: 'utf-8'}
    );

    expect(JSON.parse(propertiesFileContent)).toEqual({
      'context': {
        'expression': 'user.parent.contact_type === \'c62_chw_site\'', 
        'person': false, 
        'place': false
      }, 
      'icon': 'icon-healthcare-medicine', 
      'title': [
        {
          'content': 'Stock Received',
          'locale': 'en'
        }, 
        {
          'content': 'Réception de Stock',
          'locale': 'fr'
        }
      ]
    });

  });
});
