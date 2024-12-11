const { 
  stockMonitoringConfigs, 
} = require('./mocks/mocks');
const { 
  updateForm,
} = require('../src/features/form-update'); 
const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages,
  readDataFromXforms
} = require('./test-utils');

describe('Create and update stock_out.xlsx and properties files ', () => {
  const workingDir = process.cwd();

  const enMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\n'+
  'cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\n'+
  'cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\n'+
  'cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\n'+
  'cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n'+
  'cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\ncht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\n'+
  'cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\ncht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\n'+
  'cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\n'+
  'cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  
  const frMessage = 'cht-stock-monitoring-workflow.stock_count.balance_fill = Use this form to fill in balances on hand for all commodities as of today\n'+
  'cht-stock-monitoring-workflow.stock_count.commodities_note = <h3 class="text-primary"> Commodities Balance on hand </h3>\n'+
  'cht-stock-monitoring-workflow.stock_count.message.summary_header = Results/Summary page\n'+
  'cht-stock-monitoring-workflow.stock_count.contact_summary.title = Stock count\n'+
  'cht-stock-monitoring-workflow.stock_count.message.submit_note = <h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>\n'+
  'cht-stock-monitoring-workflow.stock_count.message.summary_note = Stock items you currently have.<i class="fa fa-list-ul"></i>\n'+
  'cht-stock-monitoring-workflow.stock_count.tasks.stock-count = Stock count\n'+
  'cht-stock-monitoring-workflow.stock_count.forms.additional_doc_title = Stock uses\n'+
  'cht-stock-monitoring-workflow.stock_count.forms.item_used_question = Quantity of {{item}}\n'+
  'cht-stock-monitoring-workflow.stock_count.message.set_unit_constraint_message = Should be in the form x/y for x {{set_label}} and y {{unit_label}}\n'+
  'cht-stock-monitoring-workflow.stock_count.message.unit_quantity_hint = Add the quantity: {{quantity}} {{unit_label}}\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';


  beforeEach(async () => {
    setDirToprojectConfig();
    await writeTranslationMessages(frMessage, enMessage, process.cwd());
  });

  afterEach(async() => {
    jest.clearAllMocks();
    await resetTranslationMessages(process.cwd());
    revertBackToProjectHome(workingDir);
  });


  it('should update forms from the configs', async () => {
    const items = Object.values(stockMonitoringConfigs.items);
    await updateForm(stockMonitoringConfigs);

    // Check that items are inserted in forms from config 
    const formConfigs = Object.values(stockMonitoringConfigs.forms);
    const categories = Object.values(stockMonitoringConfigs.categories);

    const names = [];
    for (const formConfig of formConfigs) {
      const formItemIds = Object.keys(formConfig.items);
      const formItems = items.filter(item => formItemIds.includes(item.name));
      categories.map((category) => {
        formItems.filter(item => item.category === category.name && item.isInSet).map((item) => {
          names.push(`${item.name}___set`);
          names.push(`${item.name}___unit`);
          names.push(`${item.name}_used_in_${formConfig.name}`);
        });
      });

      const stockReturnData = await readDataFromXforms([], names, `${formConfig.name}.xlsx` );
    
      expect(stockReturnData.productsList.length).toBe(names.length);
      for(let index =0; index < names.length; index ++){
        expect(stockReturnData.productsList[index]).toEqual(names[index]);
      }

    }
  });

});
