const path = require('path');
const fs = require('fs');
const chalk = require('chalk');
const { validateConfig, ConfigValidationError } = require('./config-validator');

/**
 * Get CHT app settings
 * @returns {object} CHT app settings with filtered locales (disabled locales excluded)
 * @throws {Error} If app settings file not found or cannot be read
 */
function getAppSettings() {
  const processDir = process.cwd();
  const baseSettingFile = path.join(processDir, 'app_settings', 'base_settings.json');

  if (!fs.existsSync(baseSettingFile)) {
    throw new Error(`App settings file not found: ${baseSettingFile}`);
  }

  let rawSettings;
  try {
    rawSettings = fs.readFileSync(baseSettingFile, {
      encoding: 'utf-8'
    });
  } catch (err) {
    throw new Error(`Failed to read app settings file: ${err.message}`);
  }

  let settings;
  try {
    settings = JSON.parse(rawSettings);
  } catch (err) {
    throw new Error(`Invalid JSON in app settings file (${baseSettingFile}): ${err.message}`);
  }

  if (!settings.locales || !Array.isArray(settings.locales)) {
    throw new Error('App settings missing required "locales" array');
  }

  settings.locales = settings.locales.filter((locale) => locale.disabled !== true);
  return settings;
}

/**
 * Check if stock-monitoring.config.json exists in the directory
 * @param {string} directory - The directory to check
 * @returns {boolean} True if the config file exists, false otherwise
 */
function isAlreadyInit(directory) {
  try {
    const configFilePath = path.join(directory, 'stock-monitoring.config.json');
    return !!fs.existsSync(configFilePath);
  } catch (err) {
    console.error(err);
    return false;
  }
}

/**
 * Create a backup of the configuration file
 * @param {string} configFilePath - Path to the config file
 * @returns {string|null} Path to the backup file, or null if no backup was created
 */
function createConfigBackup(configFilePath) {
  if (!fs.existsSync(configFilePath)) {
    return null;
  }

  const backupPath = `${configFilePath}.bak`;
  try {
    fs.copyFileSync(configFilePath, backupPath);
    return backupPath;
  } catch (err) {
    console.error(chalk.yellow(`Warning: Could not create backup: ${err.message}`));
    return null;
  }
}

/**
 * Restore configuration from backup
 * @param {string} configFilePath - Path to the config file
 * @param {string} backupPath - Path to the backup file
 * @returns {boolean} True if restore was successful
 */
function restoreConfigFromBackup(configFilePath, backupPath) {
  if (!backupPath || !fs.existsSync(backupPath)) {
    return false;
  }

  try {
    fs.copyFileSync(backupPath, configFilePath);
    fs.unlinkSync(backupPath);
    return true;
  } catch (err) {
    console.error(chalk.red(`Failed to restore from backup: ${err.message}`));
    return false;
  }
}

/**
 * Write config to stock-monitoring.config.json
 *
 * Creates a backup of the existing config before writing. If the write fails,
 * the backup is restored automatically.
 *
 * @param {object} config - The configuration object to write
 * @param {object} config.items - Item definitions with labels
 * @param {object} config.features - Feature configurations
 * @param {string} [config.version] - Version number (auto-populated from package.json if not provided)
 * @param {object} [options] - Options for writing config
 * @param {boolean} [options.updateTranslations=true] - Whether to update translation files after writing
 * @returns {void}
 * @throws {ConfigValidationError} If the configuration is invalid
 */
function writeConfig(config, options = {}) {
  const { updateTranslations: shouldUpdateTranslations = true } = options;
  const processDir = process.cwd();
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');

  // Get package version
  if (!fs.existsSync(configFilePath) || !config.version) {
    const packageFilePath = path.join(
      __dirname,
      '../package.json'
    );
    const packageFileRaw = fs.readFileSync(packageFilePath).toString();
    if (packageFileRaw.length > 0) {
      config.version = JSON.parse(packageFileRaw).version;
    }
  }

  // Validate config before writing
  try {
    validateConfig(config);
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      console.error(chalk.red.bold('Configuration validation failed:'));
      console.error(chalk.red(`  ${error.message}`));
      if (error.path) {
        console.error(chalk.yellow(`  Path: ${error.path}`));
      }
      throw error;
    }
    throw error;
  }

  // Create backup before writing
  const backupPath = createConfigBackup(configFilePath);

  try {
    config.last_update_date = new Date();
    fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));

    // Clean up backup on success
    if (backupPath && fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }
  } catch (err) {
    // Restore from backup on failure
    if (backupPath) {
      console.error(chalk.red(`Write failed, restoring from backup...`));
      restoreConfigFromBackup(configFilePath, backupPath);
    }
    throw err;
  }

  // Update translations if requested (default: true)
  if (shouldUpdateTranslations) {
    // Lazy require to avoid circular dependency during module initialization
    // This is safe because it only executes at runtime, not during require()
    const translationManager = require('./translation-manager');
    translationManager.updateTranslations(config);
  }
}

/**
 * Get config from stock-monitoring.config.json
 * @param {object} [options] - Options for loading config
 * @param {boolean} [options.validateOnLoad=false] - Whether to validate the config after loading
 * @returns {object|undefined} The parsed configuration object, or undefined if not initialized
 * @throws {Error} If the config file exists but cannot be read or parsed
 * @throws {ConfigValidationError} If validateOnLoad is true and the configuration is invalid
 */
function getConfig(options = {}) {
  const { validateOnLoad = false } = options;
  const processDir = process.cwd();
  if (!isAlreadyInit(processDir)) {
    console.log(chalk.red.bold('Stock monitoring module not found'));
    return;
  }
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  const configStr = fs.readFileSync(configFilePath);
  const config = JSON.parse(configStr);

  if (validateOnLoad) {
    try {
      validateConfig(config);
    } catch (error) {
      if (error instanceof ConfigValidationError) {
        console.error(chalk.red.bold('Configuration validation failed:'));
        console.error(chalk.red(`  ${error.message}`));
        if (error.path) {
          console.error(chalk.yellow(`  Path: ${error.path}`));
        }
        throw error;
      }
      throw error;
    }
  }

  return config;
}

/**
 * Get number of steps between two levels in the contact hierarchy
 *
 * Traverses the contact type hierarchy defined in app settings to determine
 * the number of parent relationships between two contact types.
 *
 * @param {string} fromLevel - The level from which we start (e.g., 'clinic', 'health_center')
 * @param {string} toLevel - The level to which we want to go (e.g., 'district_hospital')
 * @param {number} [initialNbParent=0] - The number of parents already found (used for recursion)
 * @returns {number|null} The number of steps between the two levels, or null if no path was found
 * @example
 * // Returns 1 - health_center is direct parent of clinic
 * getNumberOfSteps('clinic', 'health_center')
 *
 * @example
 * // Returns 2 - district_hospital is grandparent of clinic
 * getNumberOfSteps('clinic', 'district_hospital')
 *
 * @example
 * // Returns 0 - same level
 * getNumberOfSteps('clinic', 'clinic')
 *
 * @example
 * // Returns null - unknown level
 * getNumberOfSteps('clinic', 'unknown')
 */
function getNumberOfSteps(fromLevel, toLevel, initialNbParent = 0) {
  const appSettings = getAppSettings();
  const fromLevelDetail = appSettings.contact_types.find((settings) => settings.id === fromLevel);
  if (fromLevelDetail && fromLevelDetail.parents) {
    if (fromLevelDetail.parents.includes(toLevel)) {
      // If the current level has the toLevel as a parent, we stop and return the number of parents
      return initialNbParent + 1;
    } else if (fromLevelDetail.parents[0] === fromLevel) {
      // If the current level is the top level, we stop and return null
      return null;
    } else {
      // If the current level is not the top level nor the toLevel, we continue with the first parent
      return getNumberOfSteps(fromLevelDetail.parents[0], toLevel, initialNbParent + 1);
    }
  }
  // If no parents were found, we stop and return null
  return null;
}

module.exports = {
  getAppSettings,
  isAlreadyInit,
  writeConfig,
  getConfig,
  getNumberOfSteps,
  ConfigValidationError,
};
