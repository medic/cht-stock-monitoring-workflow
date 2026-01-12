const chalk = require('chalk');
const { getAppSettings, writeConfig } = require('./config-manager');
const inquirer = require('inquirer');
const { getStockCountConfigs } = require('./features/stock-count');
const validator = require('validator');

/**
 * Check if running in non-interactive mode (no TTY or CLI args provided)
 * @returns {boolean} True if non-interactive mode
 */
function isNonInteractive() {
  // Check if stdin is not a TTY (e.g., when spawned from tests)
  if (!process.stdin.isTTY) {
    return true;
  }
  // Check if CLI args are provided (argv[3] would be monitoring_type)
  return process.argv.length > 3 && process.argv[3];
}

/**
 * Parse command-line arguments for non-interactive init
 * @param {Object} appSettings - App settings for validation
 * @returns {Object} Parsed configuration from CLI args
 */
function parseCliArgs(appSettings) {
  const argv = process.argv;
  const monitoringType = validator.escape(argv[3] || '2_levels');

  let nbLevels;
  switch (monitoringType) {
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

  const levels = {};
  if (nbLevels >= 1) {
    const contactType = validator.escape(argv[4] || '');
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === contactType);
    levels[1] = {
      contact_type: contactType,
      role: validator.escape(argv[5] || ''),
      place_type: contactTypeDetails ? contactTypeDetails.parents[0] : ''
    };
  }
  if (nbLevels >= 2) {
    const contactType = validator.escape(argv[6] || '');
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === contactType);
    levels[2] = {
      contact_type: contactType,
      role: validator.escape(argv[7] || ''),
      place_type: contactTypeDetails ? contactTypeDetails.parents[0] : ''
    };
  }

  return { levels, nbLevels };
}

/**
 * Interactively prompt user to configure initial stock monitoring settings
 * Collects monitoring level configuration (1-3 levels), contact types, user roles,
 * and stock count feature settings. Supports command-line arguments for non-interactive usage.
 * @returns {Promise<Object>} Initial configuration object
 * @returns {Object} returns.levels - Level configurations keyed by level number (1, 2, 3)
 * @returns {string} returns.levels[n].contact_type - Contact type ID for the level
 * @returns {string} returns.levels[n].role - User role for the level
 * @returns {string} returns.levels[n].place_type - Place type (parent contact type) for the level
 * @returns {Object} returns.features - Feature configurations including stock_count
 * @returns {boolean} returns.useItemCategory - Whether to use item categories
 * @throws {Error} If app settings cannot be read or user cancels prompts
 * @example
 * const initConfigs = await getInitConfigs();
 * // User is prompted for monitoring type, contact types, roles
 * console.log('Levels configured:', Object.keys(initConfigs.levels));
 */
async function getInitConfigs() {
  const appSettings = getAppSettings();

  // Handle non-interactive mode (tests, CI, piped input)
  if (isNonInteractive()) {
    console.log(chalk.green(`INFO Stock monitoring configuration (non-interactive mode)`));
    const { levels } = parseCliArgs(appSettings);
    const answers = await getStockCountConfigs(levels, appSettings.locales);
    return {
      ...answers,
      levels,
    };
  }
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

/**
 * Create the initial stock monitoring configuration file
 * Initializes a new stock-monitoring.config.json with the provided configuration,
 * adding language settings from app_settings and empty containers for forms, items, and categories
 * @param {Object} configs - Initial configuration from getInitConfigs()
 * @param {Object} configs.levels - Level configurations
 * @param {Object} configs.features - Feature configurations
 * @param {boolean} configs.useItemCategory - Whether to use item categories
 * @returns {Object} Complete configuration object that was written to disk
 * @returns {string[]} returns.languages - Array of language codes from app settings
 * @returns {string} returns.defaultLanguage - Default language code from app settings
 * @returns {Object} returns.forms - Empty forms object (to be populated later)
 * @returns {Object} returns.items - Empty items object (to be populated later)
 * @returns {Object} returns.categories - Empty categories object (to be populated later)
 * @example
 * const initConfigs = await getInitConfigs();
 * const fullConfig = createConfigFile(initConfigs);
 * // Creates stock-monitoring.config.json in current directory
 */
function createConfigFile(configs) {
  const appSettings = getAppSettings();
  const languages = appSettings.locales.map((locale) => locale.code);
  console.log(chalk.blue.bold(`Initializing stock monitoring in level`));

  // Create configuration file
  configs.languages = languages;
  configs.defaultLanguage = appSettings.locale;
  configs.forms = {};
  configs.items = {};
  configs.categories = {};
  configs.features = configs.features || {};
  writeConfig(configs);
  return configs;
}

module.exports = {
  getInitConfigs,
  createConfigFile,
};
