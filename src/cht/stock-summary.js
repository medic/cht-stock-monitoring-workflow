// const messages = require('/stock-monitoring.messages.json');
const { Fraction } = require('fractional');
const { TRANSLATION_PREFIX } = require('./utils');
let Utils = {};

const NEGATIVE_STOCK_MSG = '(Ensure that you have entered all stock received)';

function getItemCount(itemName, reports) {
  const lastStockCount = Utils.getMostRecentReport(reports, 'commodity_count');
  const initialCount = Utils.getField(lastStockCount, `out.${itemName}_availables`);
  //TODO: Update calculation
  return Number(initialCount);
}

const htmlGenerator = (value, item) => {
  let html = '';
  let innerHtml = `${(new Fraction(value.toFixed(1))).toString()} ${item.unit}`;
  if (value < 0) {
    innerHtml += ` ${NEGATIVE_STOCK_MSG}`;
  }
  let color = 'green';
  if (value <= item.danger_total) {
    color = 'red';
  } else if (value <= item.warning_total) {
    color = 'orange';
  }

  html += '<strong style="color: ' + color + '">' + innerHtml + '<strong>';
  return html;
};

function getSummary(configs, reports, _Utils) {
  // TODO: Try to remove this params. I had webpack issue
  Utils = _Utils;
  const stockCountFeature = configs.features.stock_count;

  // Get last stock count
  const lastStockCount = Utils.getMostRecentReport(reports, 'commodity_count');
  const items = Object.values(configs.items);
  if (!lastStockCount) {
    return [];
  }

  const cards = stockCountFeature.contact_types.map((contact_type) => {
    const levels = Object.values(configs.levels);
    const contactLevel = levels.find((l) => l.contact_type === contact_type);
    const placeType = contactLevel.place_type;
    const itemsFields = items.map((item) => {
      const value = getItemCount(item.name, reports);
      return {
        name: item.name,
        label: `${TRANSLATION_PREFIX}items.${item.name}.label`,
        count: value,
        value: htmlGenerator(value, item),
        filter: 'safeHtml',
        width: 3,
      };
    });
    return {
      label: `${TRANSLATION_PREFIX}stock_count.contact_summary.title`,
      appliesToType: placeType,
      appliesIf: lastStockCount,
      modifyContext: (context) => {
        for (const itemField of itemsFields) {
          context[`stock_monitoring_${itemField.name}_qty`] = itemField.count;
        }
      },
      fields: itemsFields
    };
  });
  return cards;
}

module.exports = getSummary;
