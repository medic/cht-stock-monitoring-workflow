const chalk = require('chalk');
const utils = require('./common');
const inquirer = require('inquirer');
const { getStockCountConfigs } = require('./features/stock-count');
const validator = require('validator');

async function getInitConfigs() {
  const appSettings = utils.getAppSettings();
  const appPersonTypes = appSettings.contact_types.filter((ct) => ct.person);
  const appUserRoles = Object.keys(appSettings.roles);
  console.log(chalk.green(`INFO Stock monitoring configuration`));
  const monitoringType = await inquirer.prompt([
    {
      type: 'list',
      name: 'monitoring_type',
      message: 'Type',
      choices: [
        {
          name: '1 level (CHW only)',
          value: '1_level'
        },
        {
          name: '2 levels (supervisor + chw)',
          value: '2_levels'
        },
        {
          name: '3 levels (Health center + supervisor + chw)',
          value: '3_levels'
        }
      ],
      when: function (answers) {
        const argv = process.argv;
        if (argv[3] === '2_levels') {
          answers.monitoring_type = validator.escape(argv[3]);
          return false;
        }
        return true;
      },
    }
  ]);

  let nbLevels;
  switch (monitoringType.monitoring_type) {
    case '2_levels':
      nbLevels = 2;
      break;
    case '3_levels':
      nbLevels = 3;
      break;
    default:
      nbLevels = 1;
      break;
  }

  let levels = {};
  for (let index = 1; index <= nbLevels; index++) {
    const levelNumber = nbLevels + 1 - index;
    let messagePrecision = '';
    if (levelNumber === 1) {
      messagePrecision = ' (Lowest level) ';
    }
    if (levelNumber === nbLevels) {
      messagePrecision = ' (Highest level) ';
    }
    const level = await inquirer.prompt([
      {
        type: 'list',
        name: `${levelNumber}.contact_type`,
        message: `Select level ${levelNumber}${messagePrecision} contact type`,
        choices: appPersonTypes.map((p) => p.id),
        when: function (answers) {
          const argv = process.argv;
          let answer = {};
          if (!argv[4] || !argv[6]){
            return true;
          }
          
          switch(levelNumber){
            case 1:
              answer = {
                1: {
                  contact_type: validator.escape(argv[4]),
                  role: validator.escape(argv[5])
                }
              };
              break;
            case 2:
              answer = {
                2: {
                  contact_type: validator.escape(argv[6]),
                  role: validator.escape(argv[7])
                }
              };
              break;
          }
          Object.assign(answers, answer);
          return false;
        },
      },
      {
        type: 'list',
        name: `${levelNumber}.role`,
        message: `Select level ${levelNumber}${messagePrecision} user role`,
        choices: appUserRoles,
        when: function (answers) {
          const argv = process.argv;
          let answer = {};
          if (!argv[5] || !argv[7]){
            return true;
          }

          switch(levelNumber){
            case 1:
              answer = {
                1: {
                  contact_type: validator.escape(argv[4]),
                  role: validator.escape(argv[5])
                }
              };
              break;
            case 2:
              answer = {
                2: {
                  contact_type: validator.escape(argv[6]),
                  role: validator.escape(argv[7])
                }
              };
              break;
          }

          Object.assign(answers, answer);
          
          return false;
        },
      }
    ]);

    const contactType = level[`${levelNumber}`].contact_type;
    // Get parent
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === contactType);
    if (contactTypeDetails.parents.length > 1) {
      const parent = await inquirer.prompt([
        {
          type: 'list',
          name: 'parent',
          message: `Select level ${levelNumber}${messagePrecision} parent`,
          choices: contactTypeDetails.parents,
          when:function(answers){
            const argv = process.argv;
            let answer = {};
            if (!argv[10]){
              return true;
            }

            switch(levelNumber){
              case 1:
                answer = {
                  1: {
                    parent: validator.escape(argv[10]),
                  }
                };
                break;
              case 2:
                answer = {
                  2: {
                    parent: validator.escape(argv[10]),
                  }
                };
                break;
              case 3:
                answer = {
                  3: {
                    parent: validator.escape(argv[10]),
                  }
                };
                break;
            }

            Object.assign(answers, answer);
            
            return false;
          }
        }
      ]);
      level[`${levelNumber}`].place_type = parent.parent;
    } else {
      level[`${levelNumber}`].place_type = contactTypeDetails.parents[0];
    }
    levels = {
      ...levels,
      ...level,
    };
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
