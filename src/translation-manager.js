const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const { getAppSettings } = require('./config-manager');

/**
 * Prefix used for all stock monitoring workflow translation keys.
 * This prefix is added to translation keys to namespace them within the CHT app.
 * @constant {string}
 */
const TRANSLATION_PREFIX = 'cht-stock-monitoring-workflow.';

/**
 * Cache for translations to avoid repeated file reads
 * @type {{data: Object|null, timestamp: number|null, directory: string|null}}
 */
const translationCache = {
  data: null,
  timestamp: null,
  directory: null,
};

/**
 * Invalidate the translation cache
 * Called after updating translations to ensure fresh data on next read
 */
function invalidateCache() {
  translationCache.data = null;
  translationCache.timestamp = null;
  translationCache.directory = null;
}

/**
 * Get translations from CHT app messages files.
 * Reads all locale-specific message files and extracts translations
 * that belong to the stock monitoring workflow (those with TRANSLATION_PREFIX).
 * Uses caching to avoid repeated file reads within the same session.
 *
 * @param {boolean} [removePrefix=true] - Whether to remove the translation prefix from keys
 * @returns {Object} Translations keyed by locale code, e.g., { en: { key: value }, fr: { key: value } }
 * @example
 * // Get translations with prefix removed (default)
 * const translations = getTranslations();
 * // Returns: { en: { 'items.paracetamol.label': 'Paracetamol' }, fr: { 'items.paracetamol.label': 'Paracétamol' } }
 *
 * @example
 * // Get translations with prefix preserved
 * const translations = getTranslations(false);
 * // Returns: { en: { 'cht-stock-monitoring-workflow.items.paracetamol.label': 'Paracetamol' } }
 */
function getTranslations(removePrefix = true) {
  const appSettings = getAppSettings();
  const processDir = process.cwd();
  const locales = appSettings.locales.map(l => l.code);

  // Check cache validity - must be same directory and have data
  const isCacheValid = translationCache.data !== null &&
    translationCache.directory === processDir;

  if (isCacheValid) {
    // Return cached data, applying prefix removal if needed
    if (removePrefix) {
      return translationCache.data.withoutPrefix;
    }
    return translationCache.data.withPrefix;
  }

  // Read translations from files
  const withPrefix = locales
    .map((locale) => {
      const messagePath = path.join(processDir, 'translations', `messages-${locale}.properties`);
      const messages = fs.readFileSync(messagePath, {
        encoding: 'utf-8'
      }).split('\n');
      return [
        locale,
        messages
          .map(message => message.split(/=(.*)/))
          .filter(line => line.length > 2 && line[0].startsWith(TRANSLATION_PREFIX))
          .reduce((prev, next) => ({ ...prev, [next[0].trim()]: next[1].trim() }), {})
      ];
    }).reduce((prev, next) => ({ ...prev, [next[0]]: next[1] }), {});

  // Create version without prefix
  const withoutPrefix = {};
  for (const locale of Object.keys(withPrefix)) {
    withoutPrefix[locale] = {};
    for (const key of Object.keys(withPrefix[locale])) {
      const newKey = key.replace(TRANSLATION_PREFIX, '');
      withoutPrefix[locale][newKey] = withPrefix[locale][key];
    }
  }

  // Update cache
  translationCache.data = { withPrefix, withoutPrefix };
  translationCache.timestamp = Date.now();
  translationCache.directory = processDir;

  return removePrefix ? withoutPrefix : withPrefix;
}

/**
 * Update CHT app translation files with missing stock monitoring messages.
 * This function compares existing translations with required translations from
 * the stock monitoring configuration and template messages, then appends any
 * missing translations to the appropriate locale files.
 *
 * @param {Object} configs - Stock monitoring configuration object
 * @param {Object} configs.items - Item definitions with labels keyed by item name
 * @param {Object} configs.items[].name - Item identifier
 * @param {Object} configs.items[].label - Labels keyed by language code, e.g., { en: 'Paracetamol', fr: 'Paracétamol' }
 * @param {Object} configs.features - Feature configurations (e.g., stock_count, stock_out)
 * @returns {void}
 * @example
 * updateTranslations({
 *   items: {
 *     paracetamol: { name: 'paracetamol', label: { en: 'Paracetamol', fr: 'Paracétamol' } }
 *   },
 *   features: { stock_count: {}, stock_out: {} }
 * });
 */
function updateTranslations(configs) {
  const appSettings = getAppSettings();
  const processDir = process.cwd();
  const items = Object.values(configs.items);

  const locale = appSettings.locale;
  const locales = appSettings.locales.map(l => l.code);
  // Get cht app messages path
  const chtAppMsg = getTranslations(false);

  const rawCompMessages = fs.readFileSync(path.join(__dirname, '../templates/stock-monitoring.messages.json'));
  const compMsgs = JSON.parse(rawCompMessages);

  const chtAppMsgKeys = Object.keys(chtAppMsg[locale]);
  const compMsgKeys = Object.keys(compMsgs);

  // Feature messages
  const missingFeaturesKeys = [].concat(
    ...Object.keys(configs.features).map((feature) => {
      const featureKeys = Object.keys(compMsgs).filter((key) => key.startsWith(`${feature}.`));
      return [].concat(
        ...featureKeys.map((featureKey) => {
          const featureKeys = compMsgKeys.filter(k => k.startsWith(featureKey));
          return featureKeys.filter((fKey) => !chtAppMsgKeys.includes(`cht-stock-monitoring-workflow.${fKey}`));
        })
      );
    })
  );
  const missingFeatureMsgs = missingFeaturesKeys.reduce((prev, next) =>
    ({ ...prev, [`cht-stock-monitoring-workflow.${next}`]: compMsgs[next] }), {});
  const missingMsgs = {};
  for (const lang of locales) {
    missingMsgs[lang] = { ...missingFeatureMsgs };
  }

  for (const item of items) {
    for (const lang of locales) {
      const key = `cht-stock-monitoring-workflow.items.${item.name}.label`;
      if (!chtAppMsgKeys.includes(key)) {
        missingMsgs[lang][key] = item.label[lang] || '';
      }
    }
  }

  // Append missing locales
  for (const lang of locales) {
    const localFilePath = path.join(processDir, 'translations', `messages-${lang}.properties`);
    const langMsg = Object.keys(missingMsgs[lang]).map(k => `${k} = ${(missingMsgs[lang][k] || '').replaceAll("'", '"')}`).join('\n');
    if (fs.existsSync(localFilePath)) {
      fs.appendFileSync(localFilePath, `\n${langMsg}`);
    }
  }

  // Invalidate cache since translations have been updated
  invalidateCache();

  const nbNewKeys = Object.keys(missingMsgs[locale]).length;
  if (nbNewKeys > 0) {
    console.log(chalk.green(`INFO ${nbNewKeys} new messages added`));
  } else {
    console.log(chalk.green(`INFO no new message added`));
  }
}

module.exports = {
  TRANSLATION_PREFIX,
  getTranslations,
  updateTranslations,
  invalidateCache,
};
