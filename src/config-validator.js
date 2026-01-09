/**
 * Configuration schema validator for stock monitoring config
 */

const REQUIRED_TOP_LEVEL_KEYS = ['version', 'languages', 'levels', 'items', 'features'];

class ConfigValidationError extends Error {
  constructor(message, path = null) {
    super(message);
    this.name = 'ConfigValidationError';
    this.path = path;
  }
}

function validateConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new ConfigValidationError('Configuration must be an object');
  }

  // Check required top-level keys
  for (const key of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(key in config)) {
      throw new ConfigValidationError(`Missing required key: ${key}`, key);
    }
  }

  // Validate languages
  if (!Array.isArray(config.languages) || config.languages.length === 0) {
    throw new ConfigValidationError('languages must be a non-empty array', 'languages');
  }

  // Validate levels
  if (typeof config.levels !== 'object') {
    throw new ConfigValidationError('levels must be an object', 'levels');
  }

  // Validate items
  if (typeof config.items !== 'object') {
    throw new ConfigValidationError('items must be an object', 'items');
  }

  for (const [itemName, item] of Object.entries(config.items)) {
    validateItem(item, itemName);
  }

  // Validate features
  if (typeof config.features !== 'object') {
    throw new ConfigValidationError('features must be an object', 'features');
  }

  return true;
}

function validateItem(item, itemName) {
  if (!item.name || typeof item.name !== 'string') {
    throw new ConfigValidationError(`Item ${itemName} must have a name string`, `items.${itemName}.name`);
  }

  if (!item.label || typeof item.label !== 'object') {
    throw new ConfigValidationError(`Item ${itemName} must have a label object`, `items.${itemName}.label`);
  }

  if (!item.unit || typeof item.unit !== 'object' || !item.unit.label) {
    throw new ConfigValidationError(`Item ${itemName} must have a unit with label`, `items.${itemName}.unit`);
  }

  if (typeof item.warning_total !== 'number') {
    throw new ConfigValidationError(`Item ${itemName} must have numeric warning_total`, `items.${itemName}.warning_total`);
  }

  if (typeof item.danger_total !== 'number') {
    throw new ConfigValidationError(`Item ${itemName} must have numeric danger_total`, `items.${itemName}.danger_total`);
  }
}

function validateLevel(level, levelKey) {
  if (!level.place_type || typeof level.place_type !== 'string') {
    throw new ConfigValidationError(`Level ${levelKey} must have place_type`, `levels.${levelKey}.place_type`);
  }

  if (!level.role || typeof level.role !== 'string') {
    throw new ConfigValidationError(`Level ${levelKey} must have role`, `levels.${levelKey}.role`);
  }
}

module.exports = {
  validateConfig,
  validateItem,
  validateLevel,
  ConfigValidationError,
  REQUIRED_TOP_LEVEL_KEYS
};
