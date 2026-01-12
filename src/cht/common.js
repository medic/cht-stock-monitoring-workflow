var luxon = require('luxon');
var constants = require('../constants');
var Utils = require('cht-nootils')();


/**
 * Get dynamic reported date
 * @param {Object} report
 * @returns {DateTime}
 **/
function getDynamicReportedDate(report) {
  var specifiedDate =
    Utils.getField(report, 's_reported.s_reported_date') ||
    Utils.getField(report, 'supervision_date');
  return (specifiedDate && luxon.DateTime.fromISO(specifiedDate)) ||
    luxon.DateTime.fromMillis(parseInt((report && report.reported_date) || 0));
}

/**
 * Get items consumption
 * @param {Object} configs stock monitoring configs
 * @param {Array} reports list of contact reports
 * @param {week|month} period item consumption period
 */
function getItemsConsumption(configs, reports, period) {
  if (!period) {
    period = 'week';
  }
  var STOCK_SUPPLY = '';
  var SUPPLY_CORRECTION = '';
  var STOCK_RETURNED = '';
  if (configs.features && configs.features.stock_supply) {
    STOCK_SUPPLY = configs.features.stock_supply.form_name;
    if (configs.features.stock_supply.confirm_supply.active) {
      SUPPLY_CORRECTION = configs.features.stock_supply.discrepancy.form_name;
    }
  }
  if (configs.features && configs.features.stock_return) {
    STOCK_RETURNED = configs.features.stock_return.confirmation.form_name;
  }
  var items = Object.values(configs.items);
  var today = luxon.DateTime.now();
  var lastWeek = today.startOf(period).minus({
    hour: 1
  }).endOf('day');
  var params = {};
  params[period] = 3;
  var threeWeeksBefore = lastWeek.minus(params).startOf('day');
  // Latest reports
  var latestReports = reports.filter(function (report) {
    var reportedDate = getDynamicReportedDate(report);
    if (report.form === constants.FORM_ADDITIONAL_DOC_NAME) {
      var stmReportedDate = report['stock_monitoring_reported_date'];
      if (stmReportedDate) {
        reportedDate = luxon.DateTime.fromISO(stmReportedDate);
      }
    }
    return threeWeeksBefore <= reportedDate && reportedDate <= lastWeek;
  });

  var itemQuantities = items.reduce(function (prev, next) {
    var prevCopy = Object.assign({}, prev);
    prevCopy[next.name] = 0;
    return prevCopy;
  }, {});
  var itemNames = Object.keys(itemQuantities);

  for (var i = 0; i < latestReports.length; i++) {
    var report = latestReports[i];
    for (var j = 0; j < itemNames.length; j++) {
      var itemName = itemNames[j];
      switch (report.form) {
        case constants.FORM_ADDITIONAL_DOC_NAME:
          {
            var qtyUsed = Number(Utils.getField(report, itemName + '_used_in_' + report.created_from_name) || 0);
            itemQuantities[itemName] += qtyUsed;
          }
          break;
        case STOCK_SUPPLY:
          {
            itemQuantities[itemName] += Number(Utils.getField(report, 'out.' + itemName + '_supply') || 0);
          }
          break;
        case SUPPLY_CORRECTION:
          {
            itemQuantities[itemName] -= (Number(Utils.getField(report, 'out.' + itemName + '_in')) || 0);
          }
          break;
        case STOCK_RETURNED:
          {
            itemQuantities[itemName] -= Number(Utils.getField(report, 'out.' + itemName + '_in') || 0);
          }
          break;
        default:
          break;
      }
    }
  }

  return itemQuantities;
}

function getItemCountInReports(itemName, reports, forms) {
  var lastStockCount = Utils.getMostRecentReport(reports, forms.stockCount);
  var total = Number(Utils.getField(lastStockCount, 'out.' + itemName + '_availables')) || 0;

  for (var index = 0; index < reports.length; index++) {
    var report = reports[index];
    switch (report.form) {
      /**
       * *supervisor - out*
       * Additional doc created from supervisor stock supply form.
       * Remove item quantity from supervisor stock
       */
      case constants.SUPPLY_ADDITIONAL_DOC:
        {
          if (forms.supplyConfirm.length === 0) {
            total += Number(Utils.getField(report, itemName + '_in') || 0);
          }
        }
        break;
      /**
       * *chw - in/out*
       * Additional doc created from supervisor stock supply form.
       * Add item quantity from chw stock
       */
      case forms.stockLogs:
        {
          var received = Utils.getField(report, 'out.' + itemName + '_received');
          var returned = Utils.getField(report, 'out.' + itemName + '_returned');
          total += (received - returned);
        }
        break;
      /**
       * *chw - out*
       * Supervisor stock supply form to chw
       * Add item quantity to chw stock
       */
      case forms.supplyForm:
      case forms.orderSupplyForm:
        {
          total -= Number(Utils.getField(report, 'out.' + itemName + '_supply') || 0);
        }
        break;
      /**
       * *chw - out*
       * Additional doc created from cht app when chw use items
       * Remove item quantity from chw stock
       */
      case constants.FORM_ADDITIONAL_DOC_NAME:
        {
          total -= Number(Utils.getField(report, itemName + '_used_in_' + report.created_from_name) || 0);
        }
        break;
      /**
       * *chw - in/out*
       * Chw form ajusted by supervisor discrepency
       */
      case constants.DISCREPANCY_ADD_DOC:
        total += Number(Utils.getField(report, itemName + '_out')) || 0;
        break;
      /**
       * *supervisor - in/out*
       * Supervisor enter final quantity in discrepency form
       */
      case forms.supplyDiscrepancy:
        {
          var qtyDiff = (Number(Utils.getField(report, 'out.' + itemName + '_in')) || 0);
          total += qtyDiff;
        }
        break;
      /**
       * *chw - in/out*
       * Chw form ajusted by supervisor return connfirmation
       */
      case constants.RETURNED_ADD_DOC:
        total += Number(Utils.getField(report, itemName + '_return_difference')) || 0;
        break;
      /**
       * *chw - in*
       * Item supply confirmed by chw
       */
      case forms.supplyConfirm:
        total += Number(Utils.getField(report, 'out.' + itemName + '_confirmed') || 0);
        break;
      /**
       * *chw - out*
       * Chw return items to supervisor
       */
      case forms.stockReturn:
        total -= Number(Utils.getField(report, 'out.' + itemName + '_out') || 0);
        break;
      /**
       * *supervisor - out*
       * Supervisor received item returned by chw
       */
      case forms.stockReturned:
      {
        total += Number(Utils.getField(report, 'out.' + itemName + '_in') || 0);
        break;
      }
      default:
        break;
    }
  }
  return total;
}

function getItemCountFromLastStockCount(configs, reports) {
  if (reports.length === 0) {
    return {};
  }
  var reportForms = {
    SUPPLY_ADDITIONAL_DOC: constants.SUPPLY_ADDITIONAL_DOC,
    FORM_ADDITIONAL_DOC_NAME: constants.FORM_ADDITIONAL_DOC_NAME,
    stockCount: configs.features.stock_count && configs.features.stock_count.form_name,
    supplyForm: configs.features.stock_supply && configs.features.stock_supply.form_name,
    orderSupplyForm: configs.features.stock_order && configs.features.stock_order.stock_supply && configs.features.stock_order.stock_supply.form_name,
    supplyConfirm: (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) ? configs.features.stock_supply.confirm_supply.form_name : '',
    supplyDiscrepancy: (configs.features.stock_supply && configs.features.stock_supply.discrepancy) ? configs.features.stock_supply.discrepancy.form_name : '',
    DISCREPANCY_ADD_DOC: constants.DISCREPANCY_ADD_DOC,
    stockReturn: configs.features.stock_return && configs.features.stock_return.form_name,
    stockReturned: configs.features.stock_return && configs.features.stock_return.confirmation.form_name,
    stockReturnedCHW: configs.features.stock_return && constants.RETURNED_ADD_DOC,
    stockLogs: configs.features.stock_logs && configs.features.stock_logs.form_name,
  };
  var lastStockCount = Utils.getMostRecentReport(reports, reportForms.stockCount);
  if (!lastStockCount) {
    return {};
  }
  var reportsFomLastStockCount = reports.filter(function (report) {
    var forms = Object.values(reportForms);
    return report && (report._id === lastStockCount._id || (forms.includes(report.form) && getDynamicReportedDate(report) > getDynamicReportedDate(lastStockCount)));
  });
  if (reportsFomLastStockCount.length === 0) {
    return {};
  }
  var items = Object.values(configs.items);

  return items.map(function(item) {
    var value = getItemCountInReports(item.name, reportsFomLastStockCount, reportForms);
    return {
      name: item.name,
      count: value,
    };
  }).reduce(function (prev, next) {
    prev[next.name] = next.count;
    return prev;
  }, {});
}

module.exports = {
  getDynamicReportedDate: getDynamicReportedDate,
  getItemsConsumption: getItemsConsumption,
  getItemCountFromLastStockCount: getItemCountFromLastStockCount
};
