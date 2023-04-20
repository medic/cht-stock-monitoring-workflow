const chalk = require('chalk');
const utils = require('./common');
const inquirer = require('inquirer');
const { getStockCountConfigs } = require('./features/stock-count');

async function getInitConfigs() {
  const appSettings = utils.getAppSettings();
  const appPersonTypes = appSettings.contact_types.filter((ct) => ct.person);
  console.log(chalk.green(`INFO Stock monitoring configuration`));
  const monitoringType = await inquirer.prompt([
    {
      type: 'list',
      name: 'monitoring_type',
      message: 'Type',
      choices: [
        {
          name: '2 levels (supervisor + chw)',
          value: '2_levels'
        },
        {
          name: '3 levels (Health center + supervisor + chw)',
          value: '3_levels'
        }
      ],
    }
  ]);

  let nbLevels = 2;
  if (monitoringType.monitoring_type === '3_levels') {
    nbLevels = 3;
  }

  let levels = {};
  for (let index = 1; index <= nbLevels; index++) {
    const levelNumber = nbLevels + 1 - index;
    const level = await inquirer.prompt([
      {
        type: 'list',
        name: `${levelNumber}.contact_type`,
        message: `Select level ${levelNumber} contact type`,
        choices: appPersonTypes.map((p) => p.id),
      }
    ]);
    levels = {
      ...levels,
      ...level,
    };
  }
  for (const levelNumber of Object.keys(levels)) {
    const level = levels[levelNumber];
    // Get parents
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === level.contact_type);
    const contactPlace = contactTypeDetails.parents[0];
    levels[levelNumber]['place_type'] = contactPlace;
  }

  const answers = await getStockCountConfigs(levels, appSettings.locales);

  return {
    ...answers,
    levels,
  };
}

function createConfigFile(configs) {
  const appSettings = utils.getAppSettings();
  const languages = appSettings.locales.map((locale) => locale.code);
  console.log(chalk.blue.bold(`Initializing stock monitoring in level`));

  // Create configuration file
  configs.languages = languages;
  configs.defaultLanguage = appSettings.locale;
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
