const {getConfig, writeConfig} = require('./common');
const inquirer = require('inquirer');
const chalk = require('chalk');
const configNeedMigration = () => {
  const config = getConfig();
  const packageJson = require('../package.json');
  const currentVersion = packageJson.version;

  if (!config.version) {
    return ['0', currentVersion];
  }
  const configVersion = config.version;
  if (configVersion === currentVersion) {
    return false;
  }
  return [configVersion, currentVersion];
};

const migrationFunctions = {
  '0.5.0': async (conf) => {
    const config = {...conf};
    const items = Object.values(config.items);
    const updatedItems = [];
    for (const item of items) {
      console.log(chalk.green.bold(`Updating ${item.name} ...`));
      const itemConfig = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'isInSet',
          message: 'Can this item be organized in set like box/blister?',
          default: true,
        }
      ]);
      let qtyMessage = `What is the maximum quantity to have for this item ? `;
      if (itemConfig.isInSet) {
        const setConfigs = await inquirer.prompt([
          ...config.languages.map((language) => ({
            type: 'input',
            name: `set.label.${language}`,
            message: `What is the name of the set? Ex: box of 8 in ${language} ?`
          })),
          {
            type: 'number',
            name: 'set.count',
            message: 'How many units are there in the set ? '
          },
        ]);
        Object.assign(itemConfig, setConfigs);
        qtyMessage = `What is the maximum quantity of set to have for this item ? `;
      }
      const itemGeneralConfigs = await inquirer.prompt([
        ...config.languages.map((language) => ({
          type: 'input',
          name: `unit.label.${language}`,
          message: `What is the name of the unit? Ex: Pills ${language} ?`
        })),
        {
          type: 'number',
          name: 'max_total',
          message: qtyMessage,
          default: -1,
        }
      ]);
      Object.assign(itemConfig, itemGeneralConfigs);
      updatedItems.push(
        {
          name: item.name,
          label: item.label,
          'warning_total': item.warning_total,
          'danger_total': item.danger_total,
          'category': item.category,
          ...itemConfig,
        }
      );
    }
    config.items = updatedItems.reduce((acc, item) => {
      acc[item.name] = item;
      return acc;
    }, {});
    return config;
  }
};

const migrate = async (fromVersion, toVersion) => {
  const allVersions = ['0', '0.5.0'];
  const fromVersionIndex = allVersions.indexOf(fromVersion);
  const toVersionIndex = allVersions.indexOf(toVersion);
  if (fromVersionIndex === -1 || toVersionIndex === -1) {
    return;
  }
  const versionsToMigrate = allVersions.slice(fromVersionIndex + 1, toVersionIndex + 1);
  let config = getConfig();
  for (const version of versionsToMigrate) {
    config = await migrationFunctions[version](config);
    config.version = version;
    config.created_date = new Date();
  }
  writeConfig(config);
};

module.exports = {
  configNeedMigration,
  migrate
};
