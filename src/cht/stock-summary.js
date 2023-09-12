var Fraction = require('fraction.js');
var constants = require('../constants');
var common = require('./common');
var Utils = require('cht-nootils')();

var NEGATIVE_STOCK_MSG = '(Ensure that you have entered all stock received)';

function stockItemToSafeHtml (value, item) {
  var html = '';
  var innerHtml = (new Fraction(value.toFixed(1))).toString() + ' ' + item.unit;
  if (value < 0) {
    innerHtml += ' '+NEGATIVE_STOCK_MSG;
  }
  var color = 'green';
  if (value <= item.danger_total) {
    color = 'red';
  } else if (value <= item.warning_total) {
    color = 'orange';
  }

  html += '<strong style="color: ' + color + '">' + innerHtml + '<strong>';
  return html;
}

function getSummary(configs, reports) {
  var stockCountFeature = configs.features.stock_count;
  var dynamicFormNames = {
    stockCount: stockCountFeature.form_name,
    supplyForm: configs.features.stock_supply && configs.features.stock_supply.form_name,
    supplyConfirm: '',
    supplyDiscrepancy: configs.features.stock_supply && configs.features.stock_supply.discrepancy && configs.features.stock_supply.discrepancy.form_name,
    stockReturn: configs.features.stock_return && configs.features.stock_return.form_name,
    stockReturned: configs.features.stock_return && configs.features.stock_return.confirmation.form_name,
  };

  // Get last stock count
  var lastStockCount = Utils.getMostRecentReport(reports, dynamicFormNames.stockCount);
  var items = Object.keys(configs.items).map(function (key) {
    return configs.items[key];
  });
  if (!lastStockCount) {
    return [];
  }

  return stockCountFeature.contact_types.map(function (contact) {
    var levels = Object.values(configs.levels);
    var contactLevel = levels.find(function (l) {
      return l.contact_type === contact.contact_type;
    });
    var placeType = contactLevel.place_type;
    var itemQuantities = common.getItemCountFromLastStockCount(configs, reports);
    var itemsFields = items.map(function (item) {
      var value = itemQuantities[item.name];
      return {
        name: item.name,
        label: constants.TRANSLATION_PREFIX + 'items.' + item.name + '.label',
        count: value,
        value: stockItemToSafeHtml(value, item),
        filter: 'safeHtml',
        width: 3,
      };
    });
    return {
      label: constants.TRANSLATION_PREFIX + 'stock_count.contact_summary.title',
      appliesToType: placeType,
      appliesIf: lastStockCount,
      modifyContext: function (context) {
        for (var index = 0; index < itemsFields.length; index++) {
          var itemField = itemsFields[index];
          context['stock_monitoring_' + itemField.name + '_qty'] = itemField.count || 0;
        }
      },
      fields: itemsFields
    };
  });
}

module.exports = getSummary;
