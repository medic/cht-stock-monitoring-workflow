const { DateTime } = require('luxon');
const { FORM_ADDITIONAL_DOC_NAME, RETURNED_ADD_DOC, DESCREPANCY_ADD_DOC, SUPPLY_ADDITIONAL_DOC } = require('../constants');
const Utils = require('cht-nootils')();


/**
 * Get dynamic reported date
 * @param {Object} report
 * @returns {DateTime}
 **/
const getDynamicReportedDate = report => {
  const specifiedDate =
    Utils.getField(report, 's_reported.s_reported_date') ||
    Utils.getField(report, 'supervision_date');
  return (specifiedDate && DateTime.fromISO(specifiedDate)) ||
    DateTime.fromMillis(parseInt((report && report.reported_date) || 0));
};

/**
 * Get items consumption
 * @param {Object} configs stock monitoring configs
 * @param {Array} reports list of contact reports
 * @param {week|month} period item consumption period
 * @returns {item: quantity}
 */
function getItemsConsumption(configs, reports, period = 'week') {
  let STOCK_SUPPLY = '';
  let SUPPLY_CORRECTION = '';
  let STOCK_RETURNED = '';
  if (configs.features && configs.features.stock_supply) {
    STOCK_SUPPLY = configs.features.stock_supply.form_name;
    if (configs.features.stock_supply.confirm_supply.active) {
      SUPPLY_CORRECTION = configs.features.stock_supply.discrepancy.form_name;
    }
  }
  if (configs.features && configs.features.stock_return) {
    STOCK_RETURNED = configs.features.stock_return.confirmation.form_name;
  }
  const items = Object.values(configs.items);
  const today = DateTime.now();
  const lastWeek = today.startOf(period).minus({
    hour: 1
  }).endOf('day');
  const threeWeeksBefore = lastWeek.minus({
    [period]: 3
  }).startOf('day');
  // Latest reports
  const latestReports = reports.filter((report) => {
    let reportedDate = getDynamicReportedDate(report);
    if (report.form === FORM_ADDITIONAL_DOC_NAME) {
      const stmReportedDate = report['stock_monitoring_reported_date'];
      if (stmReportedDate) {
        reportedDate = DateTime.fromISO(stmReportedDate);
      }
    }
    return threeWeeksBefore <= reportedDate && reportedDate <= lastWeek;
  });

  const itemQuantities = items.reduce((prev, next) => {
    return { ...prev, [next.name]: 0 };
  }, {});
  const itemNames = Object.keys(itemQuantities);

  for (const report of latestReports) {
    for (const itemName of itemNames) {
      switch (report.form) {
        case FORM_ADDITIONAL_DOC_NAME:
          {
            const qtyUsed = Number(Utils.getField(report, `${itemName}_used_in_${report.created_from_name}`) || 0);
            itemQuantities[itemName] += qtyUsed;
          }
          break;
        case STOCK_SUPPLY:
          {
            itemQuantities[itemName] += Number(Utils.getField(report, `out.${itemName}_supply`) || 0);
          }
          break;
        case SUPPLY_CORRECTION:
          {
            itemQuantities[itemName] -= (Number(Utils.getField(report, `out.${itemName}_in`)) || 0);
          }
          break;
        case STOCK_RETURNED:
          {
            itemQuantities[itemName] -= Number(Utils.getField(report, `out.${itemName}_in`) || 0);
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
  const lastStockCount = Utils.getMostRecentReport(reports, forms.stockCount);
  let total = Number(Utils.getField(lastStockCount, `out.${itemName}_availables`)) || 0;

  for (const report of reports) {
    switch (report.form) {
      /**
       * *chw - in*
       * Additional doc created from supervisor stock supply form.
       * Add item quantity from chw stock
       */
      case SUPPLY_ADDITIONAL_DOC:
        {
          const needConfirmation = Utils.getField(report, 'need_confirmation');
          if (needConfirmation === 'no') {
            total += Number(Utils.getField(report, `${itemName}_in`) || 0);
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
          const received = Utils.getField(report, `out.${itemName}_received`);
          const returned = Utils.getField(report, `out.${itemName}_returned`);
          total += (received - returned);
        }
        break;
      /**
       * *supervisor - out*
       * Supervisor stock supply form to chw
       * Remove item quantity from supervisor stock
       */
      case forms.supplyForm:
        total -= Number(Utils.getField(report, `out.${itemName}_supply`) || 0);
        break;
      /**
       * *chw - out*
       * Additional doc created from cht app when chw use items
       * Remove item quantity from chw stock
       */
      case FORM_ADDITIONAL_DOC_NAME:
        {
          total -= Number(Utils.getField(report, `${itemName}_used_in_${report.created_from_name}`) || 0);
        }
        break;
      /**
       * *chw - in/out*
       * Chw form ajusted by supervisor discrepency
       */
      case DESCREPANCY_ADD_DOC:
        total += Number(Utils.getField(report, `${itemName}_out`)) || 0;
        break;
      /**
       * *supervisor - in/out*
       * Supervisor enter final quantity in discrepency form
       */
      case forms.supplyDiscrepancy:
        {
          const qtyDiff = (Number(Utils.getField(report, `out.${itemName}_in`)) || 0);
          total += qtyDiff;
        }
        break;
      /**
       * *chw - in/out*
       * Chw form ajusted by supervisor return connfirmation
       */
      case RETURNED_ADD_DOC:
        total += Number(Utils.getField(report, `${itemName}_return_difference`)) || 0;
        break;
      /**
       * *chw - in*
       * Item supply confirmed by chw
       */
      case forms.supplyConfirm:
        total += Number(Utils.getField(report, `out.${itemName}_confirmed`) || 0);
        break;
      /**
       * *chw - out*
       * Chw return items to supervisor
       */
      case forms.stockReturn:
        total -= Number(Utils.getField(report, `out.${itemName}_out`) || 0);
        break;
      /**
       * *supervisor - out*
       * Supervisor received item returned by chw
       */
      case forms.stockReturned:
        total += Number(Utils.getField(report, `out.${itemName}_in`) || 0);
        break;
      default:
        break;
    }

  }
  return total;
}

function getItemCountFromLastStockCount(configs, reports) {
  const reportForms = {
    SUPPLY_ADDITIONAL_DOC,
    FORM_ADDITIONAL_DOC_NAME,
    stockCount: configs.features.stock_count ? configs.features.stock_count.form_name : '',
    supplyForm: configs.features.stock_supply ? configs.features.stock_supply.form_name : '',
    supplyConfirm: (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) ? configs.features.stock_supply.confirm_supply.form_name : '',
    supplyDiscrepancy: (configs.features.stock_supply && configs.features.stock_supply.discrepancy) ? configs.features.stock_supply.discrepancy.form_name : '',
    DESCREPANCY_ADD_DOC,
    stockReturn: configs.features.stock_return ? configs.features.stock_return.form_name : '',
    stockReturned: configs.features.stock_return ? configs.features.stock_return.confirmation.form_name : '',
    stockLogs: configs.features.stock_logs ? configs.features.stock_logs.form_name : '',
  };
  const lastStockCount = Utils.getMostRecentReport(reports, reportForms.stockCount);
  const reportsFomLastStockCount = reports.filter((report) => {
    const forms = Object.values(reportForms);
    return report._id === lastStockCount._id || (forms.includes(report.form) && getDynamicReportedDate(report) > getDynamicReportedDate(lastStockCount));
  });
  const items = Object.values(configs.items);
  
  return items.map((item) => {
    const value = getItemCountInReports(item.name, reportsFomLastStockCount, reportForms);
    return {
      name: item.name,
      count: value,
    };
  }).reduce((prev, next) => ({...prev, [next.name]: next.count }), {});
}

module.exports = {
  getDynamicReportedDate,
  getItemsConsumption,
  getItemCountFromLastStockCount
};
