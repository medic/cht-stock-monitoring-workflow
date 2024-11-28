const { 
  stockMonitoringConfigs 
} = require('./mocks/mocks');

const { 
  getItemRows,
  getExportCalculations,
  getAdditionalDoc,
  getSummaries,
} = require('../src/features/stock-discrepancy'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
} = require('./test-utils');

const { getTranslations } = require('../src/common');

describe('Testing functions in Stock out feature file', () => {
  const processInitialArgv = process.argv; // Save the original argv
  const workingDir = process.cwd();
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
    revertBackToProjectHome(workingDir);
    process.argv = processInitialArgv; // Restore the original argv after each test
  });

  /** Testing getItemRows function */
  // Testing get item row function out config generation with no or wrong item config and params
  it('This should throw error and should not generate rows with empty header, messages, languages(fr, en) and items to be added  ', async () => {

    const header = [];
    const messages  = {};
    const items = [{}];

    expect(() => getItemRows(header, stockMonitoringConfigs.languages, messages,  items)).toThrow(TypeError);
    
  });

  // Testing get item row function with correct item config and params
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

  /** Testing getSummaries function */
  it('This should return summaries based the item config provided ', async () => {
    
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
    const categories = Object.values(stockMonitoringConfigs.categories);
    const languages = Object.values(stockMonitoringConfigs.languages);
    const itemCategoryNoteSummury = [
      'note',
      'malaria_summary',
      '',
      '${paracetamol_qty} > 0',
      'h1 blue',
      '',
      '',
      '',
      '',
      '',
      'Categorie',
      '',
      ''
    ];

    const summaries = await  getSummaries(languages, header, items, categories);
    expect(summaries).toContainEqual(itemCategoryNoteSummury);
    
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

    const itemCalculation = [
      'calculate',
      'paracetamol_out',
      '',
      '',
      '',
      '',
      '',
      "if(${paracetamol_qty} != '' and ${paracetamol___count} > 0,${paracetamol___count}-${paracetamol_confirmed},0)",
      '',
      '',
      '',
      '',
      ''
    ];

    const additionalDoc = getAdditionalDoc(form_name, 'descrepancy_doc', languages, header, items);
    expect(additionalDoc).toContainEqual(itemCalculation);

  });

  /** Testing add export calculation to stock_order */
  it('should add export calculation correctly with items provided', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
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
  
    const exprotCalculation =getExportCalculations(header, items);

    // Check that items are inserted in stock_return xform 
    const itemData = [
      [
        'calculate',
        'paracetamol_in',
        '',
        '',
        '',
        '',
        '',
        "if(${paracetamol_qty} != '' and ${paracetamol___count} > 0,${paracetamol_received}-${paracetamol___count},0)",
        '',
        '',
        '',
        '',
        ''
      ]
    ];

    expect(exprotCalculation).toEqual(itemData);

  });


});
