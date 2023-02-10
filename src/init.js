const chalk = require('chalk');
const utils = require('./utils');
const inquirer = require('inquirer');
const Config = require('./config');

module.exports = async function () {
  const appSettings = Config.getAppSettings();
  const appPlaceTypes = appSettings ? appSettings.place_hierarchy_types : [];
  const processDir = process.cwd();

  if (utils.alreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'placeType',
      message: 'Stock management place type',
      default: appPlaceTypes,
      choices: appPlaceTypes,
    },
    {
      type: 'input',
      name: 'expression',
      message: 'Stock count form expression',
      default: (currentAnswers) => {
        return `contact.contact_type === '${currentAnswers.placeType}'`;
      }
    },
    {
      type: 'input',
      name: 'languages',
      message: 'Enter app languages',
      default: 'fr,en'
    }
  ]);
  const placeType = answers.placeType;
  const expression = answers.expression;
  const languages = answers.languages.split(',');
  console.log(chalk.blue.bold(`Initializing stock monitoring in level ${placeType}`));

  // Create configuration file
  const messages = {
    'stock_count_balance_fill': 'Use this form to fill in balances on hand for all commodities as of today',
    'stock_count_commodities_note': '<h3 class=”text-primary”> Commodities Balance on hand </h3>',
    'stock_count_summary_header': 'Results/Summary page',
    'stock_count_submit_note': '<h4 style="text-align:center;">Be sure you Submit to complete this action.</h4>',
    'stock_count_summary_note': 'Stock items you currently have.<I class="fa fa-list-ul"></i>'
  };
  const config = {
    placeType: placeType,
    expression: expression,
    languages: languages,
    messages: {},
    items: {},
  };
  for (const language of languages) {
    config.messages[language] = messages;
  }
  utils.writeConfig(config);
};
