const chalk = require('chalk');
const utils = require('./utils');
const inquirer = require('inquirer');

async function getInitConfigs() {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'languages',
      message: 'Enter app languages',
      default: 'en'
    },
    {
      type: 'confirm',
      name: 'useItemCategory',
      message: 'Categorize stock items',
      default: false,
    },
    {
      type: 'input',
      name: 'stockCountName',
      message: 'Stock count form (Used to fill in balances on hand) ID or name',
      default: 'stock_count',
    },
    {
      type: 'input',
      name: 'expression.stockCount',
      message: 'Stock count form expression',
    }
  ]);

  const languages = answers.languages.split(',');
  const formDisplayNames = await inquirer.prompt([
    ...languages.map((lang) => {
      return {
        type: 'input',
        name: `stock_count_form_display_name.${lang}`,
        message: `Stock count form display name in ${lang}`,
        default: 'Stock count'
      };
    }),
  ]);

  return {
    ...answers,
    ...formDisplayNames,
  };
}

function createConfigFile(configs) {
  const languages = configs.languages.split(',');
  console.log(chalk.blue.bold(`Initializing stock monitoring in level`));

  // Create configuration file
  const messages = {
    'stock_count_balance_fill': 'Use this form to fill in balances on hand for all commodities as of today',
    'stock_count_commodities_note': '<h3 class=”text-primary”> Commodities Balance on hand </h3>',
    'stock_count_summary_header': 'Results/Summary page',
    'stock_count_submit_note': '<h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>',
    'stock_count_summary_note': 'Stock items you currently have.<I class="fa fa-list-ul"></i>',
    'consumption_log_item_received_header': 'Use this form to report on quantity received and quantity returned to the health facility',
    'consumption_log_item_question': 'What would you like to report',
    'consumption_log_item_returned_note': 'Quantity Returned for redistribution to oters or expiry issues',
    'consumption_log_item_received_note': 'Quantity Received refers to stock received. Can be either issued by health assistant or any other health facility staff',
    'consumption_log_item_quantity_received_label': 'Quantity Received',
    'consumption_log_item_quantity_received_note': '<h3 class=”text-primary”> Please input the quantities that you have received for all commodities </h3>',
    'consumption_log_item_quantity_returned_label': 'Quantity Returned',
    'consumption_log_item_quantity_returned_note': '<h3 class=”text-primary”> Please input the quantities that you have returned to the health facility for all the commodities </h3>',
    'consumption_log_summary_header': 'Results/Summary page',
    'consumption_log_summary_note_1': '<h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>',
    'consumption_log_summary_note_2': 'Stock Item Details <I class="fa fa-list-ul"></i>',
    'consumption_log_summary_note_3': '<h4 style="text-align:center;">Quantity received</h4>',
    'consumption_log_summary_note_4': '<h4 style="text-align:center;">Quantity returned to the health facility</h4>',
    'consumption_log_summary_followup': 'Follow Up',
    'consumption_log_summary_followup_note': 'If you have stockouts, follow up with your supervisor to know when to go for a refill'
  };
  configs.languages = languages;
  configs.messages = {};
  for (const language of languages) {
    const msg = { ...messages };
    msg['stock_count_form_display_name'] = configs['stock_count_form_display_name'][language];
    // msg['consumption_log_form_display_name'] = configs['consumption_log_form_display_name'][language];
    configs.messages[language] = msg;
  }
  configs.forms = {};
  configs.items = {};
  configs.categories = {};
  utils.writeConfig(configs);
  return configs;
}

module.exports = {
  getInitConfigs,
  createConfigFile,
};
