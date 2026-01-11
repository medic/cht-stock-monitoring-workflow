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
  // V2 naming convention: sm_ prefix with single underscores
  SUPPLY_ADDITIONAL_DOC: 'sm_supply_doc',
  DISCREPANCY_ADD_DOC: 'sm_discrepancy_doc',
  RETURNED_ADD_DOC: 'sm_returned_doc',
  FORM_ADDITIONAL_DOC_NAME: 'sm_prescription_doc',
  FEATURES: {
    'stock_supply': 'Stock supply (Used to issue stock item)',
    'stock_count': 'Stock count',
    'stock_return': 'Stock return',
    'stock_out': 'Stock out (Task appears immediately when there is a stock out)',
    'stock_order': 'Stock order',
    'stock_logs': 'Consumption logs (form filled with received and returned items)',
  }
};
