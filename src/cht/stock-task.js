var luxon = require('luxon');
var constants = require('../constants');
var common = require('./common');

/**
 * Get stock monitoring tasks
 * @param {Object} configs stock monitoring configs
 * @returns {Array} list of tasks
 **/
function getTasks(configs) {
  var tasks = [];
  var items = Object.values(configs.items);
  //Stock count task
  if (configs.features.stock_count.type === 'task') {
    tasks.push(
      {
        name: 'task.stock-monitoring.stock-count',
        title: constants.TRANSLATION_PREFIX + 'stock_count.tasks.stock-count',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'contacts',
        appliesToType: [user.parent.contact_type],
        appliesIf: function(contact) {
          if (user.parent.contact_type !== contact.contact.contact_type) {
            return false;
          }
          var existStockCount = contact.reports.find(function (report){
            report.form === configs.features.stock_count.form_name;
          });
          if (!existStockCount) {
            this.stockMonitoringStockCountDate = Date.now();
            return true;
          }
          var today = luxon.DateTime.now();
          if (configs.features.stock_count.frequency.includes('end_of_week')) {
            this.stockMonitoringStockCountDate = today.endOf('week').toJSDate();
            return true;
          }
          var dueDays = null;
          if (configs.features.stock_count.frequency.includes('middle_of_month')) {
            dueDays = Math.abs(today.daysInMonth / 2);
          }
          if (configs.features.stock_count.frequency.includes('end_of_month')) {
            dueDays = today.daysInMonth;
          }
          if (dueDays && today.day <= dueDays) {
            this.stockMonitoringStockCountDate = today.plus({
              days: dueDays - today.day
            }).toJSDate();
            return true;
          }
          return false;
        },
        events: [
          {
            start: 1,
            end: 3,
            dueDate: function () {
              return this.stockMonitoringStockCountDate;
            },
          },
        ],
        resolvedIf: function (contact) {
          var lastStockCount = Utils.getMostRecentReport(contact.reports, configs.features.stock_count.form_name);
          if (!lastStockCount) {
            return false;
          }
          var dateId = luxon.DateTime
            .fromJSDate(this.stockMonitoringStockCountDate)
            .set({
              minute: 0,
              second: 0,
              millisecond: 0,
              hour: 0
            });
          return Utils.getField(lastStockCount, 'inputs.date_id') !== dateId.toMillis().toString();
        },
        actions: [
          {
            form: configs.features.stock_count.form_name,
            modifyContent: function (content) {
              this.stockMonitoringStockCountDate.setHours(0, 0, 0, 0);
              content['date_id'] = this.stockMonitoringStockCountDate.getTime().toString();
            }
          }
        ]
      }
    );
  }

  // Supply confirmation task
  if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) {
    tasks.push(
      {
        name: 'task.stock-monitoring.reception-confirmation',
        title: constants.TRANSLATION_PREFIX + 'stock_supply.tasks.reception-confirmation',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_supply.form_name],
        appliesIf: function (contact, report) {
          var confirmationReport = contact
            .reports
            .find(function (rp) {
              return rp.form === configs.features.stock_supply.confirm_supply.form_name &&
                Utils.getField(rp, 'inputs.supply_doc_id') === report._id;
            });
          return !confirmationReport && user.parent._id === Utils.getField(report, 'place_id');
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return luxon.DateTime.fromISO(common.getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_supply.confirm_supply.form_name,
            modifyContent: function (content, contact, report) {
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                content[item.name+'_received'] = Utils.getField(report, 'out.'+item.name+'_supply');
              }
              content['supply_doc_id'] = report._id;
              content['supplier_id'] = Utils.getField(report, 'user_contact_id');
            }
          }
        ]
      },
      {
        name: 'task.stock-monitoring.stock-descreptancy',
        title: constants.TRANSLATION_PREFIX + 'stock_supply.tasks.stock-descreptancy',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_supply.confirm_supply.form_name],
        appliesIf: function (contact, report) {
          var itemDescrepancy = items.find(function(item) {
            var itemReceived = Number(Utils.getField(report, 'inputs.'+item.name+'_received') || 0);
            var itemConfirmed = Number(Utils.getField(report, 'out.'+item.name+'_confirmed') || 0);
            if (itemReceived !== itemConfirmed) {
              return true;
            }
            return false;
          });
          var supplierId = Utils.getField(report, 'inputs.supplier_id');
          if (!itemDescrepancy) {
            return false;
          }
          var discrepancyConfirm = contact.reports.find(function (rp) {
            return rp.form === configs.features.stock_supply.discrepancy.form_name &&
              Utils.getField(rp, 'confirmation_id') === report._id;
          });
          // eslint-disable-next-line no-undef
          return !discrepancyConfirm && user._id === supplierId;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return luxon.DateTime.fromISO(common.getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        resolvedIf: function (contact, report) {
          return  contact.reports.find(function(current){
            if (current.form !== constants.DESCREPANCY_ADD_DOC) {
                return false;
            }
            return report._id === Utils.getField(current, 'confirmation_id');
          });
        },
        actions: [
          {
            form: configs.features.stock_supply.discrepancy.form_name,
            modifyContent: function (content, contact, report) {
              var itemDescrepancys = items.filter(function(item) {
                var itemReceived = Utils.getField(report, 'inputs.'+item.name+'_received');
                var itemConfirmed = Utils.getField(report, 'out.'+item.name+'_confirmed');
                return itemReceived !== itemConfirmed;
              });
              for (var i = 0; i < itemDescrepancys.length; i++) {
                var item = itemDescrepancys[i];
                content[item.name+'_received'] = Utils.getField(report, 'inputs.'+item.name+'_received');
                content[item.name+'_confirmed'] = Utils.getField(report, 'out.'+item.name+'_confirmed');
              }
              content['level_1_place_id'] = Utils.getField(report, 'place_id');
              content['supply_confirm_id'] = report._id;
            }
          }
        ]
      }
    );
  }

  // Stock return confirmation
  if (configs.features.stock_return) {
    tasks.push(
      {
        name: 'task.stock-monitoring.return-confirmation',
        title: constants.TRANSLATION_PREFIX+ 'stock_return.tasks.return-confirmation',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_return.form_name],
        appliesIf: function(contact, report) {
          var confirmationReport = contact
            .reports
            .find(function (rp) {
              return rp.form === constants.RETURNED_ADD_DOC && Utils.getField(rp, 'return_id') === report._id;
            });
          // eslint-disable-next-line no-undef
          return !confirmationReport && user.parent.contact_type === configs.levels['2'].place_type;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return luxon.DateTime.fromISO(common.getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_return.confirmation.form_name,
            modifyContent: function (content, contact, report) {
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                content[item.name+'_return'] = Utils.getField(report, 'out.'+item.name+'_out');
              }
              content['level_1_place_id'] = Utils.getField(report, 'place_id');
              content['stock_return_id'] = report._id;
            }
          }
        ]
      }
    );
  }

  // Stock return confirmation
  if (configs.features.stock_out) {
    tasks.push(
      {
        name: 'task.stock-monitoring.stock_out',
        title: constants.TRANSLATION_PREFIX+'stock_out.tasks.stock_out',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'contacts',
        appliesToType: [configs.levels['1'].place_type],
        appliesIf: function (contact) {
          var itemsInLowStock = [];
          // eslint-disable-next-line no-undef
          if (user.parent.contact_type !== configs.levels['2'].place_type) {
            return false;
          }
          this.stockMonitoring_itemCounts = common.getItemCountFromLastStockCount(configs, contact.reports);
          this.stockMonitoring_itemRequiredQty = {};
          if (configs.features.stock_out.formular === 'weekly_qty') {
            var consumption = common.getItemsConsumption(configs, contact.reports);
            this.stockMonitoring_itemRequiredQty = consumption;
            Object.keys(this.stockMonitoring_itemRequiredQty).forEach(function(item) {
              if (typeof this.stockMonitoring_itemRequiredQty[item] === 'number') {
                this.stockMonitoring_itemRequiredQty[item] = consumption[item] / 3 * 2 - this.stockMonitoring_itemCounts[item];
              }
            });
            var itemKeys = Object.keys(this.stockMonitoring_itemCounts);
            for (var i = 0; i < itemKeys.length; i++) {
              var itemKey = itemKeys[i];
              var isItemInLow = this.stockMonitoring_itemCounts[itemKey] < consumption[itemKey] / 3 * 2;
              if (isItemInLow) {
                itemsInLowStock.push(itemKey);
              }
            }

          } else {
            for (var j = 0; j < items.length; j++) {
              var item = items[j];
              var itemCount = this.stockMonitoring_itemCounts[item.name];
              var itemThreshold = item.danger_total;
              this.stockMonitoring_itemRequiredQty[item.name] = item.warning_total * 2 - itemCount;
              if (itemCount < itemThreshold) {
                itemsInLowStock.push(item.name);
              }
            }
          }
          return itemsInLowStock.length > 0;
        },
        events: [
          {
            start: 0,
            end: 30,
            dueDate: function () {
              return luxon.DateTime.now().toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_out.form_name,
            modifyContent: function (content) {
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                content[item.name+'_required'] = Math.round(this.stockMonitoring_itemRequiredQty[item.name]);
                content[item.name+'_at_hand'] = Math.round(this.stockMonitoring_itemCounts[item.name]);
              }
            }
          }
        ]
      }
    );
  }

  if (configs.features.stock_order) {
    tasks.push(
      {
        name: 'task.stock-monitoring.stock_supply',
        title: constants.TRANSLATION_PREFIX + 'stock_order.tasks.stock_supply',
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_order.form_name],
        appliesIf: function (contact, report) {
          // eslint-disable-next-line no-undef
          if (user.parent.contact_type !== configs.levels['3'].place_type) {
            return false;
          }
          // Get a supply additional doc with supply id = report._id
          var orderId = report._id;
          var supplyAdditionalReport = contact.reports.find(function(rp) {
            return rp.form === constants.SUPPLY_ADDITIONAL_DOC && rp['s_order_id'] === orderId;
          });
          return !supplyAdditionalReport;
        },
        events: [
          {
            start: 0,
            end: 30,
            dueDate: function (event, contact, report) {
              return common.getDynamicReportedDate(report).toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_order.stock_supply.form_name,
            modifyContent: function (content, contact, report) {
              content['order_id'] = report._id;
              for (var i = 0; i < items.length; i++) {
                var item = items[i];
                content[item.name + '_ordered'] = Utils.getField(report, 'out.'+item.name+'_ordered');
              }
            }
          }
        ]
      }
    );
  }
  return tasks;
}

module.exports = getTasks;
