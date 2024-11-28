const { 
  stockMonitoringConfigs, 
  mockConfigsWithNoFeauture 
} = require('./mocks/mocks');

const { 
  getItemRows,
  getStockOutConfigs 
} = require('../src/features/stock-out'); 

const {
  setDirToprojectConfig,
  revertBackToProjectHome,
  writeTranslationMessages,
  resetTranslationMessages
} = require('./test-utils');

const { getTranslations } = require('../src/common');

describe('Testing functions in Stock out feature file', () => {
  const processInitialArgv = process.argv; // Save the original argv
  const workingDir = process.cwd();
  const enMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock out\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock at hand: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock required: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Summary\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} has low stock  of the following items\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock out\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamol\n';
  const frMessage = 'cht-stock-monitoring-workflow.stock_out.tasks.stock_out = Stock épuisé\ncht-stock-monitoring-workflow.stock_out.message.stock_at_hand = Stock actuel: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.stock_required = Stock nécessaire: {{qty}}\ncht-stock-monitoring-workflow.stock_out.message.summary_header = Résumé\ncht-stock-monitoring-workflow.stock_out.message.submit_note = {{name}} a épuisé son stock des éléments suivants:\ncht-stock-monitoring-workflow.stock_out.message.summary_note = Stock épuisé\ncht-stock-monitoring-workflow.items.paracetamol.label = Paracetamole\n';

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

  // Testing get item row function out config generation with correct item config and params
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
    expect(row[0].length).toBe(7);
    const oneRow = row[0][0];
    expect(oneRow.length).toBe(13);
    expect(oneRow[0]).toEqual('note');
    expect(oneRow[1]).toContain(items[0].name);
    
  });

  /** Testing getStockOutConfigs function */
  // Testing stock out config generation with correct item config
  it('This should generate stock out configurations based the item config provided ', async () => {
    process.argv = ['node', '', '','', '' ,'stock_out', 'item_danger_qty', 'Stock Out, Rupture de Stock'];
    const configs = {
      form_name: 'stock_out',
      formular: 'item_danger_qty',
      title: { en: 'Stock Out', fr: ' Rupture de Stock' }
    };
    const featureConfigs = await  getStockOutConfigs(stockMonitoringConfigs);
    expect(featureConfigs).toEqual(configs);
    
  });

  // Testing stock out config not generating with no or wrong item config
  it('This should throw error for xform configurations with no or wrong item config', async () => {
    await expect(getStockOutConfigs(mockConfigsWithNoFeauture)).rejects.toThrow(Error);
  });

});
