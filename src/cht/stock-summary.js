// const messages = require('/stock-monitoring.messages.json');
const Fraction = require('fraction.js');
const { TRANSLATION_PREFIX } = require('../constants');
const { getItemCountFromLastStockCount } = require('./utils');
const Utils = require('cht-nootils')();

const NEGATIVE_STOCK_MSG = '(Ensure that you have entered all stock received)';

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

function getSummary(configs, reports) {
  const stockCountFeature = configs.features.stock_count;
  const dynamicFormNames = {
    stockCount: stockCountFeature.form_name,
    supplyForm: configs.features.stock_supply ? configs.features.stock_supply.form_name : '',
    supplyConfirm: '',
    supplyDiscrepancy: (configs.features.stock_supply && configs.features.stock_supply.discrepancy) ? configs.features.stock_supply.discrepancy.form_name : '',
    stockReturn: configs.features.stock_return ? configs.features.stock_return.form_name : '',
    stockReturned: configs.features.stock_return ? configs.features.stock_return.confirmation.form_name : '',
  };

  // Get last stock count
  const lastStockCount = Utils.getMostRecentReport(reports, dynamicFormNames.stockCount);
  const items = Object.values(configs.items);
  if (!lastStockCount) {
    return [];
  }

  const cards = stockCountFeature.contact_types.map((contact_type) => {
    const levels = Object.values(configs.levels);
    const contactLevel = levels.find((l) => l.contact_type === contact_type);
    const placeType = contactLevel.place_type;
    const itemQuantities = getItemCountFromLastStockCount(configs, reports);
    const itemsFields = items.map((item) => {
      const value = itemQuantities[item.name];
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
          context[`stock_monitoring_${itemField.name}_qty`] = itemField.count || 0;
        }
      },
      fields: itemsFields
    };
  });
  return cards;
}

module.exports = getSummary;
