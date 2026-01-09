const inquirer = require('inquirer');
const { writeConfig } = require('./config-manager');
const path = require('path');
const fs = require('fs-extra');
const validator = require('validator');

/**
 * Check if running in non-interactive mode
 * @returns {boolean} True if non-interactive mode
 */
function isNonInteractive() {
  return !process.stdin.isTTY;
}

/**
 * Parse item config from CLI args for non-interactive mode
 * Note: spawnSync converts nested arrays to comma-separated strings.
 *
 * Expected arg positions:
 * argv[14] = form ID (e.g., 'patient_assessment_under_5')
 * argv[15] = isAlwaysCurrent ('Y' or 'N')
 * argv[16] = reportedDate
 * argv[17] = category name
 * argv[18] = category labels (comma-separated: 'Category,Categorie')
 * argv[19] = category descriptions (comma-separated)
 * argv[20] = item name
 * argv[21] = item labels (comma-separated: 'Paracetamol,Paracetamole')
 * argv[22] = isInSet ('Y' or 'N')
 * argv[23] = set labels (comma-separated) (if isInSet)
 * argv[24] = set count (if isInSet)
 * argv[25] = unit labels (comma-separated)
 * argv[26] = warning_total
 * argv[27] = danger_total
 * argv[28] = max_total
 * argv[29] = deduction_type
 * argv[30] = formular
 *
 * @param {Object} configs - Stock monitoring configuration
 * @returns {Object} Parsed item configuration
 */
function parseItemCliArgs(configs) {
  const argv = process.argv;
  const languages = configs.languages || ['en', 'fr'];

  // Fixed positions based on test scenario structure (after stock_count args at 8-13)
  const formId = validator.escape(argv[14] || 'patient_assessment_under_5');
  const isAlwaysCurrent = argv[15] === 'Y' || argv[15] === 'true';
  const reportedDate = isAlwaysCurrent ? 'now()' : validator.escape(argv[16] || 'now()');

  // Category config (if useItemCategory is true)
  let categoryConfig = null;
  let idx = 17; // Start at category name

  if (configs.useItemCategory) {
    const categoryName = validator.escape(argv[idx++] || 'default');

    // Category labels are comma-separated
    const categoryLabels = {};
    const catLabelParts = (argv[idx++] || '').split(',');
    languages.forEach((lang, i) => {
      categoryLabels[lang] = validator.escape((catLabelParts[i] || categoryName).trim());
    });

    // Category descriptions are comma-separated
    const categoryDescriptions = {};
    const catDescParts = (argv[idx++] || '').split(',');
    languages.forEach((lang, i) => {
      categoryDescriptions[lang] = validator.escape((catDescParts[i] || '').trim());
    });

    categoryConfig = {
      name: categoryName,
      label: categoryLabels,
      description: categoryDescriptions
    };
  }

  // Item config
  const itemName = validator.escape(argv[idx++] || 'item');

  // Item labels are comma-separated
  const itemLabels = {};
  const itemLabelParts = (argv[idx++] || '').split(',');
  languages.forEach((lang, i) => {
    itemLabels[lang] = validator.escape((itemLabelParts[i] || itemName).trim());
  });

  const isInSet = argv[idx++] === 'Y' || argv[idx - 1] === 'true';

  let setConfig = null;
  if (isInSet) {
    // Set labels are comma-separated
    const setLabels = {};
    const setLabelParts = (argv[idx++] || '').split(',');
    languages.forEach((lang, i) => {
      setLabels[lang] = validator.escape((setLabelParts[i] || 'Box').trim());
    });
    const setCount = Number(argv[idx++]) || 1;
    setConfig = { label: setLabels, count: setCount };
  }

  // Unit labels are comma-separated
  const unitLabels = {};
  const unitLabelParts = (argv[idx++] || '').split(',');
  languages.forEach((lang, i) => {
    unitLabels[lang] = validator.escape((unitLabelParts[i] || 'Unit').trim());
  });

  const warningTotal = Number(argv[idx++]) || 20;
  const dangerTotal = Number(argv[idx++]) || 15;
  const maxTotal = Number(argv[idx++]) || -1;
  const deductionType = validator.escape(argv[idx++] || 'by_user');
  const formular = argv[idx] !== undefined ? String(argv[idx]) : '0';

  const itemConfig = {
    name: itemName,
    label: itemLabels,
    isInSet,
    unit: { label: unitLabels },
    warning_total: warningTotal,
    danger_total: dangerTotal,
    max_total: maxTotal
  };

  if (setConfig) {
    itemConfig.set = setConfig;
  }

  if (categoryConfig) {
    itemConfig.category = categoryConfig.name;
  }

  const formConfig = {
    name: formId,
    reportedDate,
    items: {
      [itemName]: {
        deduction_type: deductionType,
        formular
      }
    }
  };

  return { formConfig, categoryConfig, itemConfig };
}

/**
 * Interactively prompt user to configure a new stock item
 * Guides the user through form selection, category selection/creation, and item configuration
 * including labels, set/unit packaging, thresholds, and deduction formulas.
 * Supports command-line arguments for non-interactive usage.
 * @param {Object} configs - Stock monitoring configuration object
 * @param {string[]} configs.languages - Supported language codes (e.g., ['en', 'fr'])
 * @param {boolean} configs.useItemCategory - Whether items should be organized into categories
 * @param {Object.<string, Object>} configs.categories - Existing category definitions keyed by category name
 * @param {Object.<string, Object>} configs.items - Existing item definitions keyed by item name
 * @param {Object.<string, Object>} configs.forms - Form configurations keyed by form ID
 * @returns {Promise<Object>} Configuration result object containing:
 * @returns {Object} returns.formConfig - Form configuration with name, reportedDate, and items mapping
 * @returns {Object|null} returns.categoryConfig - Category configuration with name, label, description (or null if not categorized)
 * @returns {Object} returns.itemConfig - Item configuration with name, labels, isInSet, set/unit configs, thresholds
 * @example
 * const configs = await getConfig();
 * const { formConfig, categoryConfig, itemConfig } = await getItemConfig(configs);
 * // User is prompted for form ID, item details, thresholds, etc.
 */
async function getItemConfig(configs) {
  // Handle non-interactive mode (tests, CI, piped input)
  if (isNonInteractive()) {
    return parseItemCliArgs(configs);
  }
  const processDir = process.cwd();
  let categoryConfig = null;
  let itemConfig = null;
  let formConfig = {};

  // Get form id
  const formAnswer = await inquirer.prompt([
    {
      type: 'input',
      name: 'form',
      message: 'Form ID',
      validate: async (input) => {
        // Validate input to prevent path traversal
        if (!input || !/^[a-zA-Z0-9_-]+$/.test(input)) {
          return 'Form ID must contain only letters, numbers, underscores, and hyphens';
        }
        //Find stock_monitoring_area_id
        const formPath = path.join(processDir, 'forms', 'app', `${input}.xlsx`);
        if (!fs.existsSync(formPath)) {
          return `Form ${input} not found`;
        }
        return true;
      },
      when: function(answers){
        const argv = process.argv;
        if (!argv[14]){
          return true;
        }
        answers.form = validator.escape(argv[14]);          
        return false;
      }
    }
  ]);

  // Find if place_id calculation exist in form
  const form = formAnswer.form;
  formConfig = configs.forms[form] || {
    items: {}
  };
  formConfig.name = form;
  if (!formConfig.reportedDate || formConfig.reportedDate.length === 0) {
    const reportedDateSameAsCurrent = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'isAlwaysCurrent',
        message: `Is ${form} report reported date always the current date?`,
        default: true,
        when: function(answers){
          const argv = process.argv;
          if (!argv[15]){
            return true;
          }
          answers.isAlwaysCurrent = argv[15] === 'true' || argv[15] === true;          
          return false;
        }
      }
    ]);
    if (!reportedDateSameAsCurrent.isAlwaysCurrent) {
      const reportDateFormular = await inquirer.prompt([
        {
          type: 'input',
          name: 'reportedDate',
          message: 'Enter a xlsform calculation formular to calculate the reported date',
          default: 'now()',
          when: function(answers){
            const argv = process.argv;
            if (!argv[16]){
              return true;
            }
            answers.reportedDate = validator.escape(argv[16]);          
            return false;
          }
        }
      ]);
      formConfig.reportedDate = `${reportDateFormular.reportedDate}`;
    } else {
      formConfig.reportedDate = 'now()';
    }
  }

  // Find existing items not in form to propose them
  const configItems = Object.keys(configs.items);
  const formItems = Object.keys(formConfig.items);
  const existingItems = configItems.filter((it) => !formItems.includes(it));

  // Propose to select item
  if (existingItems.length > 0) {
    const choices = existingItems.map((it) => {
      return {
        name: configs.items[it].label[configs.languages[0]],
        value: it,
      };
    });

    choices.push({
      name: 'Create new item',
      value: '___new_item___'
    });
    const itemSelect = await inquirer.prompt([{
      type: 'list',
      name: 'item',
      message: 'Select item',
      choices,
      when: function(answers){
        const argv = process.argv;
        if (!argv[17]){
          return true;
        }
        answers.item = validator.escape(argv[17]);                      
        return false;
      }
    }]);
    if (itemSelect.item !== '___new_item___') {
      itemConfig = configs.items[itemSelect.item];
      if (itemConfig.category) {
        categoryConfig = configs.categories[itemConfig.category];
      }
    }
  }

  // Creating a new item
  if (!itemConfig) {
    if (configs.useItemCategory) {
      if (configs.categories && Object.keys(configs.categories).length > 0) {
        // Propose category to select
        const choices = Object.values(configs.categories).map((it) => ({
          name: it.label[configs.languages[0]],
          value: it.name,
        }));
        choices.push({
          name: 'Create new category',
          value: '___new_category___'
        });
        const categorySelect = await inquirer.prompt([{
          type: 'list',
          name: 'category',
          message: 'Select category',
          choices,
        }]);
        if (categorySelect.category !== '___new_category___') {
          categoryConfig = configs.categories[categorySelect.category];
        }
      }
      if (!categoryConfig) {
        categoryConfig = await inquirer.prompt([
          {
            type: 'input',
            name: 'name',
            message: 'Enter category name',
            when: function(answers){
              const argv = process.argv;
              if (!argv[17]){
                return true;
              }
              answers.name = validator.escape(argv[17]);                      
              return false;
            }
          },
          ...configs.languages.map((language) => ({
            type: 'input',
            name: `label.${language}`,
            message: `Enter category label in ${language}`,
            when: function(answers) {
              const argv = process.argv;
              if (!argv[18]){
                return true;
              }
              const parts = argv[18].split(',');
              const answer = {
                label: configs.languages.reduce((acc, lang, index) => {
                  acc[lang] = validator.escape(parts[index] || '');
                  return acc;
                }, {})
              };

              Object.assign(answers, answer);
              return false;
            }
          })),
          ...configs.languages.map((language) => ({
            type: 'input',
            name: `description.${language}`,
            message: `Enter category description in ${language}`,
            when: function(answers){
              const argv = process.argv;
              if (!argv[19]){
                return true;
              }
              const parts = argv[19].split(',');
              const answer = {
                description: configs.languages.reduce((acc, lang, index) => {
                  acc[lang] = validator.escape(parts[index] || '');
                  return acc;
                }, {})
              };

              Object.assign(answers, answer);
              return false;
            }
          }))
        ]);
      }
    }
    itemConfig = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Enter item name',
        when: function(answers){
          const argv = process.argv;
          if (!argv[20]){
            return true;
          }
          answers.name = validator.escape(argv[20]);
          return false;
        }
      },
      ...configs.languages.map((language) => ({
        type: 'input',
        name: `label.${language}`,
        message: `Enter item label in ${language}`,
        when: function(answers){
          const argv = process.argv;
          if (!argv[21]){
            return true;
          }
          const parts = argv[21].split(',');
          const answer = {
            label: configs.languages.reduce((acc, lang, index) => {
              acc[lang] = validator.escape(parts[index] || '');
              return acc;
            }, {})
          };
          Object.assign(answers, answer);
          return false;
        }
      })),
      {
        type: 'confirm',
        name: 'isInSet',
        message: 'Can this item be organized in set like box/blister?',
        default: true,
        when: function(answers){
          const argv = process.argv;
          if (!argv[22]){
            return true;
          }
          answers.isInSet = argv[22] === 'true' || argv[22] === true;
          return false;
        }
      },
    ]);

    if (itemConfig.isInSet) {
      const setConfigs = await inquirer.prompt([
        ...configs.languages.map((language) => ({
          type: 'input',
          name: `set.label.${language}`,
          message: `What is the name of the set? Ex: box of 8 in ${language} ?`,
          when: function(answers){
            const argv = process.argv;
            if (!argv[23]){
              return true;
            }
            const parts = argv[23].split(',');
            const answer = {
              set: {
                label: configs.languages.reduce((acc, lang, index) => {
                  acc[lang] = validator.escape(parts[index] || '');
                  return acc;
                }, {})
              }
            };
            Object.assign(answers, answer);
            return false;
          }
        })),
        {
          type: 'number',
          name: 'set.count',
          message: 'How many units are there in the set ? ',
          when: function(answers){
            const argv = process.argv;
            if (!argv[24]){
              return true;
            }

            answers.set.count = Number(argv[24]);            
            return false;
          }
        },
      ]);
      Object.assign(itemConfig, setConfigs);
    }
    const itemGeneralConfigs = await inquirer.prompt([
      ...configs.languages.map((language) => ({
        type: 'input',
        name: `unit.label.${language}`,
        message: `What is the name of the unit? Ex: Tablet in ${language} ?`,
        when: function(answers){
          const argv = process.argv;
          if (!argv[25]){
            return true;
          }
          const parts = argv[25].split(',');
          const answer = {
            unit: {
              label: configs.languages.reduce((acc, lang, index) => {
                acc[lang] = validator.escape(parts[index] || '');
                return acc;
              }, {})
            }
          };
          Object.assign(answers, answer);
          return false;
        }
      })),
      {
        type: 'number',
        name: 'warning_total',
        message: 'What is the threshold (quantity) that requires attention ? ',
        when: function(answers){
          const argv = process.argv;
          if (!argv[26]){
            return true;
          }
          answers.warning_total = Number(argv[26]); 
          return false;
        }
      },
      {
        type: 'number',
        name: 'danger_total',
        message: 'What is the threshold (quantity) that triggers a stock out ? ',
        when: function(answers){
          const argv = process.argv;
          if (!argv[27]){
            return true;
          }
          answers.danger_total = Number(argv[27]); 
          return false;
        }
      },
      {
        type: 'number',
        name: 'max_total',
        message: 'What is the maximum quantity to have for this item ? ',
        default: -1,
        when: function(answers){
          const argv = process.argv;
          if (!argv[28]){
            return true;
          }
          answers.max_total = Number(argv[28]); 
          return false;
        }
      }
    ]);
    Object.assign(itemConfig, itemGeneralConfigs);
    if (categoryConfig) {
      itemConfig.category = categoryConfig.name;
    }
  }

  const itemDeduction = await inquirer.prompt([
    {
      type: 'list',
      name: 'deduction_type',
      message: 'How is the item deduced ?',
      choices: [
        {
          name: 'User select quantity',
          value: 'by_user'
        },
        {
          name: 'Custom automatic formula',
          value: 'formula'
        }
      ],
      when: function(answers){
        const argv = process.argv;
        if (!argv[29]){
          return true;
        }
        answers.deduction_type = validator.escape(argv[29]);
        return false;
      }
    }
  ]);

  const formularRequest = await inquirer.prompt([
    {
      type: 'input',
      name: 'formular',
      message: itemDeduction.deduction_type === 'formula' ? 'Enter formular' : 'In what condition ask the quantity?',
      when: function(answers){
        const argv = process.argv;
        if (!argv[30]){
          return true;
        }
        answers.formular = validator.escape(argv[30]);
        return false;
      }
    }
  ]);
  itemDeduction.formular = formularRequest.formular;

  formConfig.items[itemConfig.name] = itemDeduction;
  return {
    formConfig,
    categoryConfig,
    itemConfig
  };
}

/**
 * Validate item configuration for required fields and proper formats
 * Checks item name, labels, unit configuration, and threshold values
 * @param {Object} itemConfig - Item configuration to validate
 * @param {string} itemConfig.name - Item identifier (must start with letter, alphanumeric with underscores)
 * @param {Object.<string, string>} itemConfig.label - Labels keyed by language code
 * @param {Object} itemConfig.unit - Unit configuration with label property
 * @param {number} itemConfig.warning_total - Warning threshold (must be greater than danger_total)
 * @param {number} itemConfig.danger_total - Danger/stock-out threshold
 * @returns {string[]} Array of validation error messages (empty array if valid)
 * @example
 * const errors = validateItemConfig(itemConfig);
 * if (errors.length > 0) {
 *   console.error('Validation errors:', errors);
 * }
 */
function validateItemConfig(itemConfig) {
  const errors = [];

  if (!itemConfig.name || typeof itemConfig.name !== 'string') {
    errors.push('Item name is required and must be a string');
  } else if (!/^[a-z][a-z0-9_]*$/i.test(itemConfig.name)) {
    errors.push('Item name must start with a letter and contain only letters, numbers, and underscores');
  }

  if (!itemConfig.label || typeof itemConfig.label !== 'object') {
    errors.push('Item must have labels');
  }

  if (!itemConfig.unit || !itemConfig.unit.label) {
    errors.push('Item must have a unit with labels');
  }

  if (typeof itemConfig.warning_total !== 'number' || itemConfig.warning_total < 0) {
    errors.push('warning_total must be a non-negative number');
  }

  if (typeof itemConfig.danger_total !== 'number' || itemConfig.danger_total < 0) {
    errors.push('danger_total must be a non-negative number');
  }

  if (itemConfig.warning_total <= itemConfig.danger_total) {
    errors.push('warning_total should be greater than danger_total');
  }

  return errors;
}

/**
 * Validate form configuration for required fields
 * Checks that form has a name and items configuration object
 * @param {Object} formConfig - Form configuration to validate
 * @param {string} formConfig.name - Form identifier/name
 * @param {Object} formConfig.items - Items configuration mapping
 * @returns {string[]} Array of validation error messages (empty array if valid)
 * @example
 * const errors = validateFormConfig(formConfig);
 * if (errors.length > 0) {
 *   console.error('Form validation errors:', errors);
 * }
 */
function validateFormConfig(formConfig) {
  const errors = [];

  if (!formConfig.name || typeof formConfig.name !== 'string') {
    errors.push('Form name is required');
  }

  if (!formConfig.items || typeof formConfig.items !== 'object') {
    errors.push('Form must have items configuration');
  }

  return errors;
}

/**
 * Validate category configuration for required fields
 * Checks that category has a name and labels if provided. Returns empty array if null.
 * @param {Object|null} categoryConfig - Category configuration to validate (optional, null is valid)
 * @param {string} [categoryConfig.name] - Category identifier/name
 * @param {Object.<string, string>} [categoryConfig.label] - Labels keyed by language code
 * @returns {string[]} Array of validation error messages (empty array if valid or null)
 * @example
 * const errors = validateCategoryConfig(categoryConfig);
 * // Returns [] for null categoryConfig
 */
function validateCategoryConfig(categoryConfig) {
  if (!categoryConfig) return []; // Optional

  const errors = [];

  if (!categoryConfig.name || typeof categoryConfig.name !== 'string') {
    errors.push('Category name is required');
  }

  if (!categoryConfig.label || typeof categoryConfig.label !== 'object') {
    errors.push('Category must have labels');
  }

  return errors;
}

/**
 * Add a new item configuration to the app config and persist to disk
 * Validates all configurations before adding and writes updated config to stock-monitoring.config.json
 * @param {Object} appConfig - The application configuration object
 * @param {Object.<string, Object>} appConfig.items - Existing items keyed by name
 * @param {Object.<string, Object>} appConfig.categories - Existing categories keyed by name
 * @param {Object.<string, Object>} appConfig.forms - Existing forms keyed by form ID
 * @param {Object} itemData - Item configuration data object
 * @param {Object} itemData.formConfig - Form configuration with name, reportedDate, and items
 * @param {Object|null} itemData.categoryConfig - Category configuration (null if not using categories)
 * @param {Object} itemData.itemConfig - Item definition with name, labels, unit, thresholds
 * @returns {Object} Updated application configuration with new item added
 * @throws {Error} If configuration validation fails with detailed error messages
 * @example
 * const appConfig = getConfig();
 * const itemData = await getItemConfig(appConfig);
 * const updatedConfig = addConfigItem(appConfig, itemData);
 */
function addConfigItem(appConfig, {
  formConfig,
  categoryConfig,
  itemConfig
}) {
  // Validate all inputs
  const errors = [
    ...validateItemConfig(itemConfig),
    ...validateFormConfig(formConfig),
    ...validateCategoryConfig(categoryConfig)
  ];

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n  - ${errors.join('\n  - ')}`);
  }

  // Proceed with adding config
  appConfig.items[itemConfig.name] = itemConfig;
  if (categoryConfig) {
    appConfig.categories[categoryConfig.name] = categoryConfig;
  }
  appConfig.forms[formConfig.name] = formConfig;
  writeConfig(appConfig);
  return appConfig;
}

module.exports = {
  getItemConfig,
  addConfigItem,
  validateItemConfig,
  validateFormConfig,
  validateCategoryConfig,
};
