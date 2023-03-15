const { DateTime } = require('luxon');
const { TRANSLATION_PREFIX, DESCREPANCY_ADD_DOC, SUPPLY_ADDITIONAL_DOC, RETURNED_ADD_DOC } = require('../constants');

const getDynamicReportedDate = report => {
  const specifiedDate = Utils.getField(report, 's_reported.s_reported_date') || Utils.getField(report, 'supervision_date');
  return (specifiedDate && DateTime.fromISO(specifiedDate)) ||
    DateTime.fromMillis(parseInt((report && report.reported_date) || 0));
};

function getStockTask(configs) {
  const tasks = [];
  const items = Object.values(configs.items);
  //Stock count task
  if (configs.features.stock_count.type === 'task') {
    const levels = Object
      .values(configs.levels)
      .filter((level) => configs.features.stock_count.contact_types.includes(level.contact_type));
    tasks.push(
      {
        name: 'task.stock-monitoring.stock-count',
        title: `${TRANSLATION_PREFIX}stock_count.tasks.stock-count`,
        icon: 'icon-healthcare-medicine',
        appliesTo: 'contacts',
        appliesToType: levels.map(level => level.place_type),
        appliesIf: (contact) => {
          const level = levels
            // eslint-disable-next-line no-undef
            .find(level => level.role === user.role);
          if (!level || level.place_type !== contact.contact.contact_type) {
            return false;
          }
          const existStockCount = contact.reports.find((report) => report.form === configs.features.stock_count.form_name);
          if (!existStockCount) {
            this.stockMonitoringStockCountDate = Date.now();
            return true;
          }
          const today = DateTime.now();
          if (configs.features.stock_count.frequency.includes('end_of_week')) {
            this.stockMonitoringStockCountDate = today.plus({
              days: 7 - today.weekday
            }).toJSDate();
            return true;
          }
          let dueDays = null;
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
            dueDate: () => this.stockMonitoringStockCountDate,
          },
        ],
        resolvedIf: function (contact) {
          const lastStockCount = Utils.getMostRecentReport(contact.reports, configs.features.stock_count.form_name);
          if (!lastStockCount) {
            return false;
          }
          const dateId = DateTime
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
              const dateId = DateTime
                .fromJSDate(this.stockMonitoringStockCountDate)
                .set({
                  minute: 0,
                  second: 0,
                  millisecond: 0,
                  hour: 0
                });
              content['date_id'] = dateId.toMillis().toString();
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
        title: `${TRANSLATION_PREFIX}stock_supply.tasks.reception-confirmation`,
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [SUPPLY_ADDITIONAL_DOC],
        appliesIf: (contact, report) => {
          const needConfirmation = Utils.getField(report, 'need_confirmation');
          if (needConfirmation === 'no') {
            return false;
          }
          const confirmationReport = contact
            .reports
            .find((rp) => rp.form === configs.features.stock_supply.confirm_supply.form_name &&
              Utils.getField(rp, 'inputs.supply_doc_id') === report._id);
          // eslint-disable-next-line no-undef
          return !confirmationReport && user.role === configs.levels['1'].role;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return DateTime.fromISO(getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_supply.confirm_supply.form_name,
            modifyContent: function (content, contact, report) {
              for (const item of items) {
                content[`${item.name}_received`] = Utils.getField(report, `${item.name}_in`);
              }
              content['supply_doc_id'] = report._id;
            }
          }
        ]
      },
      {
        name: 'task.stock-monitoring.stock-descreptancy',
        title: `${TRANSLATION_PREFIX}stock_supply.tasks.stock-descreptancy`,
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_supply.confirm_supply.form_name],
        appliesIf: (contact, report) => {
          const itemDescrepancy = items.find((item) => {
            const itemReceived = Number(Utils.getField(report, `inputs.${item.name}_received`) || 0);
            const itemConfirmed = Number(Utils.getField(report, `out.${item.name}_confirmed`) || 0);
            if (itemReceived !== itemConfirmed) {
              return true;
            }
            return false;
          });
          if (!itemDescrepancy) {
            return false;
          }
          const discrepancyConfirm = contact.reports.find((rp) =>
            rp.form === DESCREPANCY_ADD_DOC &&
            Utils.getField(rp, 'confirmation_id') === report._id);
          // eslint-disable-next-line no-undef
          return !discrepancyConfirm && user.role === configs.levels['2'].role;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return DateTime.fromISO(getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        resolvedIf: function (contact, report) {
          const confirmationReport = contact.reports.find((current) => {
            const supplyConfirmId = Utils.getField(current, 'supply_confirm_id');
            return current.form === configs.features.stock_supply.discrepancy.form_name &&
              report._id === supplyConfirmId;
          });
          return confirmationReport;
        },
        actions: [
          {
            form: configs.features.stock_supply.discrepancy.form_name,
            modifyContent: function (content, contact, report) {
              const itemDescrepancys = items.filter((item) => {
                const itemReceived = Utils.getField(report, `inputs.${item.name}_received`);
                const itemConfirmed = Utils.getField(report, `out.${item.name}_confirmed`);
                if (itemReceived !== itemConfirmed) {
                  return true;
                }
                return false;
              });
              for (const item of itemDescrepancys) {
                content[`${item.name}_received`] = Utils.getField(report, `inputs.${item.name}_received`);
                content[`${item.name}_confirmed`] = Utils.getField(report, `out.${item.name}_confirmed`);
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
        title: `${TRANSLATION_PREFIX}stock_return.tasks.return-confirmation`,
        icon: 'icon-healthcare-medicine',
        appliesTo: 'reports',
        appliesToType: [configs.features.stock_return.form_name],
        appliesIf: (contact, report) => {
          const confirmationReport = contact
            .reports
            .find((rp) => rp.form === RETURNED_ADD_DOC && Utils.getField(rp, 'return_id') === report._id);
          // eslint-disable-next-line no-undef
          return !confirmationReport && user.role === configs.levels['2'].role;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function (event, contact, report) {
              return DateTime.fromISO(getDynamicReportedDate(report)).toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_return.confirmation.form_name,
            modifyContent: function (content, contact, report) {
              for (const item of items) {
                content[`${item.name}_return`] = Utils.getField(report, `out.${item.name}_out`);
              }
              content['level_1_place_id'] = Utils.getField(report, 'place_id');
              content['stock_return_id'] = report._id;
            }
          }
        ]
      }
    );
  }
  return tasks;
}

module.exports = getStockTask;
