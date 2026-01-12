/**
 * Constants for stock monitoring workflow
 * @module constants
 */

/**
 * Command names for CLI actions
 * @readonly
 * @enum {string}
 */
const COMMANDS = {
  INIT: 'init',
  MIGRATE: 'migrate',
  ADD: 'add',
  BUILD: 'build',
};

/**
 * Add command subtypes
 * @readonly
 * @enum {string}
 */
const ADD_TYPES = {
  ITEM: 'item',
  FEATURE: 'feature',
};

module.exports = {
  COMMANDS,
  ADD_TYPES,
  TRANSLATION_PREFIX: 'cht-stock-monitoring-workflow.',
  SUPPLY_ADDITIONAL_DOC: 'stock_supply_doc',
  // Note: Value 'descrepancy_doc' is intentionally kept misspelled for backward
  // compatibility with existing CHT deployments. Do not change without migration.
  DISCREPANCY_ADD_DOC: 'descrepancy_doc',
  RETURNED_ADD_DOC: 'sm---stock_returned',
  FORM_ADDITIONAL_DOC_NAME: 'prescription_summary',
  FEATURES: {
    'stock_supply': 'Stock supply (Used to issue stock item)',
    'stock_count': 'Stock count',
    'stock_return': 'Stock return',
    'stock_out': 'Stock out (Task appears immediately when there is a stock out)',
    'stock_order': 'Stock order',
    'stock_logs': 'Consumption logs (form filled with received and returned items)',
  }
};
