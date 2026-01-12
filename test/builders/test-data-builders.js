/**
 * Test data builders for stock monitoring workflow tests
 * These builders provide factory functions to create test data with sensible defaults
 * that can be overridden as needed.
 *
 * @module test/builders/test-data-builders
 */

let itemCounter = 0;
let categoryCounter = 0;

/**
 * Reset counters for unique name generation
 * Call this in beforeEach to ensure clean state between tests
 */
function resetCounters() {
  itemCounter = 0;
  categoryCounter = 0;
}

/**
 * Build an item configuration with sensible defaults
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Item configuration object
 * @example
 * const item = buildItem({ name: 'aspirin' });
 * const itemWithSet = buildItem({ isInSet: true });
 */
function buildItem(overrides = {}) {
  itemCounter++;
  const name = overrides.name || `item_${itemCounter}`;

  const defaults = {
    name,
    label: {
      en: `Item ${itemCounter}`,
      fr: `Article ${itemCounter}`,
    },
    isInSet: false,
    unit: {
      label: {
        en: 'Tablet',
        fr: 'Comprime',
      },
    },
    warning_total: 20,
    danger_total: 10,
    max_total: 100,
  };

  const item = { ...defaults, ...overrides };

  // If isInSet is true, ensure set configuration exists
  if (item.isInSet && !item.set) {
    item.set = {
      label: {
        en: 'Box',
        fr: 'Boite',
      },
      count: 10,
    };
  }

  // Merge nested objects properly
  if (overrides.label) {
    item.label = { ...defaults.label, ...overrides.label };
  }
  if (overrides.unit) {
    item.unit = { label: { ...defaults.unit.label, ...overrides.unit.label } };
  }
  if (overrides.set) {
    item.set = {
      label: { ...(defaults.set?.label || {}), ...overrides.set.label },
      count: overrides.set.count || 10,
    };
  }

  return item;
}

/**
 * Build a category configuration with sensible defaults
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Category configuration object
 * @example
 * const category = buildCategory({ name: 'malaria' });
 */
function buildCategory(overrides = {}) {
  categoryCounter++;
  const name = overrides.name || `category_${categoryCounter}`;

  const defaults = {
    name,
    label: {
      en: `Category ${categoryCounter}`,
      fr: `Categorie ${categoryCounter}`,
    },
    description: {
      en: `Description for category ${categoryCounter}`,
      fr: `Description pour categorie ${categoryCounter}`,
    },
  };

  const category = { ...defaults, ...overrides };

  if (overrides.label) {
    category.label = { ...defaults.label, ...overrides.label };
  }
  if (overrides.description) {
    category.description = { ...defaults.description, ...overrides.description };
  }

  return category;
}

/**
 * Build a level/contact type configuration
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Level configuration object
 * @example
 * const level = buildLevel({ role: 'supervisor' });
 */
function buildLevel(overrides = {}) {
  return {
    contact_type: 'c62_chw',
    role: 'chw',
    place_type: 'c60_chw_site',
    ...overrides,
  };
}

/**
 * Build feature configuration for stock_count
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Stock count feature configuration
 */
function buildStockCountFeature(overrides = {}) {
  return {
    form_name: 'stock_count',
    type: 'action',
    title: {
      en: 'Stock Count',
      fr: 'Comptage de Stock',
    },
    contact_types: [buildLevel()],
    ...overrides,
  };
}

/**
 * Build feature configuration for stock_out
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Stock out feature configuration
 */
function buildStockOutFeature(overrides = {}) {
  return {
    form_name: 'stock_out',
    formular: 'item_danger_qty',
    title: {
      en: 'Stock Out',
      fr: 'Rupture de Stock',
    },
    ...overrides,
  };
}

/**
 * Build feature configuration for stock_supply
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Stock supply feature configuration
 */
function buildStockSupplyFeature(overrides = {}) {
  return {
    form_name: 'stock_supply',
    title: {
      en: 'Stock Supply',
      fr: 'Approvisionnement',
    },
    ...overrides,
  };
}

/**
 * Build a complete stock monitoring configuration
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Complete configuration object
 * @example
 * const config = buildConfig();
 * const configWithItems = buildConfig({
 *   items: { paracetamol: buildItem({ name: 'paracetamol' }) }
 * });
 */
function buildConfig(overrides = {}) {
  const defaults = {
    version: '1.2.0',
    languages: ['en', 'fr'],
    defaultLanguage: 'en',
    useItemCategory: false,
    levels: {
      1: buildLevel(),
    },
    items: {},
    categories: {},
    features: {},
    forms: {},
  };

  const config = { ...defaults, ...overrides };

  // Deep merge for nested objects
  if (overrides.levels) {
    config.levels = { ...defaults.levels, ...overrides.levels };
  }
  if (overrides.items) {
    config.items = { ...defaults.items, ...overrides.items };
  }
  if (overrides.categories) {
    config.categories = { ...defaults.categories, ...overrides.categories };
  }
  if (overrides.features) {
    config.features = { ...defaults.features, ...overrides.features };
  }

  return config;
}

/**
 * Build a configuration with a single item (convenience function)
 * @param {Object} itemOverrides - Overrides for the item
 * @param {Object} configOverrides - Overrides for the config
 * @returns {Object} Configuration with one item
 */
function buildConfigWithItem(itemOverrides = {}, configOverrides = {}) {
  const item = buildItem(itemOverrides);
  return buildConfig({
    items: { [item.name]: item },
    ...configOverrides,
  });
}

/**
 * Build a configuration with stock_count feature
 * @param {Object} featureOverrides - Overrides for the feature
 * @param {Object} configOverrides - Overrides for the config
 * @returns {Object} Configuration with stock_count feature
 */
function buildConfigWithStockCount(featureOverrides = {}, configOverrides = {}) {
  const item = buildItem();
  return buildConfig({
    items: { [item.name]: item },
    features: {
      stock_count: buildStockCountFeature(featureOverrides),
    },
    ...configOverrides,
  });
}

/**
 * Build a configuration with stock_out feature
 * @param {Object} featureOverrides - Overrides for the feature
 * @param {Object} configOverrides - Overrides for the config
 * @returns {Object} Configuration with stock_out feature
 */
function buildConfigWithStockOut(featureOverrides = {}, configOverrides = {}) {
  const item = buildItem();
  return buildConfig({
    items: { [item.name]: item },
    features: {
      stock_out: buildStockOutFeature(featureOverrides),
    },
    ...configOverrides,
  });
}

/**
 * Build form configuration
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} Form configuration
 */
function buildFormConfig(overrides = {}) {
  return {
    name: 'test_form',
    reportedDate: 'now()',
    items: {},
    ...overrides,
  };
}

/**
 * Build app settings mock
 * @param {Object} overrides - Properties to override defaults
 * @returns {Object} App settings object
 */
function buildAppSettings(overrides = {}) {
  return {
    locale: 'en',
    locales: [
      { code: 'en', name: 'English' },
      { code: 'fr', name: 'French' },
    ],
    contact_types: [
      {
        id: 'c62_chw',
        parents: ['c50_supervision_area'],
      },
      {
        id: 'c50_supervision_area',
        parents: ['district_hospital'],
      },
    ],
    ...overrides,
  };
}

module.exports = {
  resetCounters,
  buildItem,
  buildCategory,
  buildLevel,
  buildStockCountFeature,
  buildStockOutFeature,
  buildStockSupplyFeature,
  buildConfig,
  buildConfigWithItem,
  buildConfigWithStockCount,
  buildConfigWithStockOut,
  buildFormConfig,
  buildAppSettings,
};
