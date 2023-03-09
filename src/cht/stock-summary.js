// const messages = require('/stock-monitoring.messages.json');
const { Fraction } = require('fractional');
const { TRANSLATION_PREFIX, SUPPLY_ADDITIONAL_DOC, FORM_ADDITIONAL_DOC_NAME } = require('../constants');
const { DateTime } = require('luxon');
let Utils = {};

const NEGATIVE_STOCK_MSG = '(Ensure that you have entered all stock received)';

const getDynamicReportedDate = report => {
  const specifiedDate = Utils.getField(report, 's_reported.s_reported_date') || Utils.getField(report, 'supervision_date');
  return (specifiedDate && DateTime.fromISO(specifiedDate)) ||
    DateTime.fromMillis(parseInt((report && report.reported_date) || 0));
};

function getItemCount(itemName, listReports, dynamicFormNames) {
  const lastStockCount = Utils.getMostRecentReport(listReports, dynamicFormNames.stockCount);
  let total = Number(Utils.getField(lastStockCount, `out.${itemName}_availables`));

  for (const report of listReports) {
    switch (report.form) {
      case SUPPLY_ADDITIONAL_DOC:
      case FORM_ADDITIONAL_DOC_NAME:
        total -= Number(Utils.getField(report, `${itemName}_out`) || 0);
        break;
      case dynamicFormNames.supplyConfirm:
        total += Number(Utils.getField(report, `out.${itemName}_confirmed`));
        break;
      default:
        break;
    }

  }
  //TODO: Update calculation
  return total;
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
  const dynamicFormNames = {
    stockCount: stockCountFeature.form_name,
    supplyConfirm: '',
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
    const stockReports = [];
    const lastStockCount = Utils.getMostRecentReport(reports, dynamicFormNames.stockCount);
    if (lastStockCount) {
      stockReports.push(
        lastStockCount,
        ...reports.filter((report) => {
          const forms = [SUPPLY_ADDITIONAL_DOC, FORM_ADDITIONAL_DOC_NAME];
          if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) {
            dynamicFormNames.supplyConfirm = configs.features.stock_supply.confirm_supply.form_name;
            forms.push(dynamicFormNames.supplyConfirm);
          }
          return forms.includes(report.form) && getDynamicReportedDate(report) > getDynamicReportedDate(lastStockCount);
        })
      );
    }
    const itemsFields = items.map((item) => {
      const value = getItemCount(item.name, stockReports, dynamicFormNames);
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
