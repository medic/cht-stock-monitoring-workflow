const chalk = require('chalk');
const inquirer = require('inquirer');

// Config and translation managers
const { getConfig, isAlreadyInit } = require('./src/config-manager');
const { getTranslations, updateTranslations } = require('./src/translation-manager');

// Migration
const { configNeedMigration, migrate } = require('./src/migration');

// Features
const { updateForm } = require('./src/features/form-update');
const { updateStockCount } = require('./src/features/stock-count');
const { updateStockReturn } = require('./src/features/stock-return');
const { updateStockSupply } = require('./src/features/stock-supply');
const { updateStockReturned } = require('./src/features/stock-returned');
const { updateStockConfirmation } = require('./src/features/stock-received');
const { updateStockDiscrepancy } = require('./src/features/stock-discrepancy');
const { updateStockOut } = require('./src/features/stock-out');
const { updateStockLogs } = require('./src/features/stock-logs');
const { updateStockOrder } = require('./src/features/stock-order');
const { updateOrderStockSupply } = require('./src/features/stock-order-supply');

// Init and config
const { getInitConfigs, createConfigFile } = require('./src/init');
const { getItemConfig, addConfigItem } = require('./src/add-item');
const { getFeatureConfigs, addFeatureConfigs, selectFeature } = require('./src/add-feature');

/**
 * Custom error class for validation errors
 */
class ValidationError extends Error {
  constructor(message, recoveryAction = null) {
    super(message);
    this.name = 'ValidationError';
    this.recoveryAction = recoveryAction;
  }
}

/**
 * Validates the configuration object
 * @param {Object} configs - The configuration object to validate
 * @throws {ValidationError} If validation fails with recovery action if available
 */
function validateConfigs(configs) {
  const items = Object.keys(configs.items);

  if (items.length === 0) {
    throw new ValidationError(
      'Please add items first',
      'add_items'
    );
  }

  if (configs.features.stock_order && !configs.features.stock_supply) {
    throw new ValidationError(
      'Please enable stock supply first',
      'enable_stock_supply'
    );
  }
}

/**
 * Maps feature names to their processing functions
 * @param {Object} configs - The configuration object
 * @param {Object} messages - The translation messages
 * @returns {Object} Map of feature names to async processing functions
 */
function getFeatureProcessors(configs, messages) {
  return {
    stock_count: updateStockCount,
    stock_supply: async (configs) => {
      await updateStockSupply(configs);
      if (
        configs.features.stock_supply &&
        configs.features.stock_supply.confirm_supply &&
        configs.features.stock_supply.confirm_supply.active
      ) {
        await updateStockConfirmation(configs, messages);
        await updateStockDiscrepancy(configs);
      }
    },
    stock_return: async (configs) => {
      await updateStockReturn(configs);
      await updateStockReturned(configs);
    },
    stock_out: updateStockOut,
    stock_logs: updateStockLogs,
    stock_order: async (configs) => {
      await updateStockOrder(configs);
      await updateOrderStockSupply(configs);
    }
  };
}

/**
 * Processes all enabled features
 * @param {Object} configs - The configuration object
 * @param {Object} messages - The translation messages
 */
async function processFeatures(configs, messages) {
  const featureProcessors = getFeatureProcessors(configs, messages);

  for (const feature of Object.keys(configs.features)) {
    const processor = featureProcessors[feature];
    if (processor) {
      await processor(configs);
    }
  }
}

/**
 * Handles recovery from validation errors
 * @param {Object} configs - The current configuration
 * @param {ValidationError} error - The validation error
 * @returns {Object} Updated configuration after recovery
 */
async function handleValidationRecovery(configs, error) {
  console.log(chalk.red(error.message));

  switch (error.recoveryAction) {
    case 'add_items': {
      const itemConfig = await getItemConfig(configs);
      return await addConfigItem(configs, itemConfig);
    }
    case 'enable_stock_supply': {
      const supplyConfigs = await getFeatureConfigs(configs, {
        name: 'stock_supply',
      });
      return await addFeatureConfigs(configs, supplyConfigs);
    }
    default:
      throw error;
  }
}

/**
 * Main orchestrator function for processing feature forms
 * Coordinates validation, translations, feature processing, and form updates
 * @param {Object} configs - The configuration object
 */
async function processFeatureForm(configs) {
  try {
    // Step 1: Validate configuration
    validateConfigs(configs);
  } catch (error) {
    if (error instanceof ValidationError && error.recoveryAction) {
      const updatedConfig = await handleValidationRecovery(configs, error);
      return processFeatureForm(updatedConfig);
    }
    throw error;
  }

  // Step 2: Update translations
  updateTranslations(configs);
  const messages = getTranslations();

  // Step 3: Process all enabled features
  await processFeatures(configs, messages);

  // Step 4: Update forms
  await updateForm(configs);

  console.log(chalk.green(`INFO All actions completed`));
}

/**
 * Stock monitoring module initialization
 */
async function init() {
  const processDir = process.cwd();

  if (isAlreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module already init'));
    return;
  }

  const answers = await getInitConfigs();
  const config = createConfigFile(answers);
  await processFeatureForm(config);
}

/**
 * Pre-command hook to check for migrations
 */
const beforeCommand = async () => {
  const needMigration = configNeedMigration();
  if (needMigration) {
    console.log(
      chalk.green(
        'INFO Stock monitoring module need migration from version ' +
          needMigration[0] +
          ' to ' +
          needMigration[1]
      )
    );
    const question = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'migrate',
        message: 'Do you want to migrate now ?',
      }
    ]);
    if (question.migrate) {
      await migrate(needMigration[0], needMigration[1]);
    }
  }
};

module.exports = {
  init,
  addItem: async () => {
    await beforeCommand();
    const config = getConfig();
    if (!config) {
      return;
    }
    const itemConfig = await getItemConfig(config);
    const updatedConfig = await addConfigItem(config, itemConfig);
    await processFeatureForm(updatedConfig);
  },
  addFeature: async () => {
    await beforeCommand();
    const config = getConfig();
    if (!config) {
      return;
    }
    const feature = await selectFeature(config);
    const featureConfigs = await getFeatureConfigs(config, feature);
    const updatedConfig = await addFeatureConfigs(config, featureConfigs);
    await processFeatureForm(updatedConfig);
  },
  build: async () => {
    await beforeCommand();
    const config = getConfig();
    if (!config) {
      return;
    }
    await processFeatureForm(config);
  },
  migrate: async () => {
    await beforeCommand();
    const config = getConfig();
    if (!config) {
      return;
    }
    await processFeatureForm(config);
  },
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
};
