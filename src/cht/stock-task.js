/* eslint-disable prefer-const */
/* eslint-disable no-unused-vars */
const { DateTime } = require('luxon');
const { TRANSLATION_PREFIX, DESCREPANCY_ADD_DOC, SUPPLY_ADDITIONAL_DOC, RETURNED_ADD_DOC, FORM_ADDITIONAL_DOC_NAME } = require('../constants');

const getDynamicReportedDate = report => {
  const specifiedDate = Utils.getField(report, 's_reported.s_reported_date') || Utils.getField(report, 'supervision_date');
  return (specifiedDate && DateTime.fromISO(specifiedDate)) ||
    DateTime.fromMillis(parseInt((report && report.reported_date) || 0));
};

// eslint-disable-next-line no-unused-vars
function getItemsConsumption(configs, reports) {
  // let STOCK_SUPPLY = '';
  // let SUPPLY_CORRECTION = '';
  // let STOCK_RETURNED = '';
  // if (configs.features && configs.features.stock_supply) {
  //   STOCK_SUPPLY = configs.features.stock_supply.form_name;
  //   if (configs.features.stock_supply.confirm_supply.active) {
  //     SUPPLY_CORRECTION = configs.features.stock_supply.discrepancy.form_name;
  //   }
  // }
  // if (configs.features && configs.features.stock_return) {
  //   STOCK_RETURNED = configs.features.stock_return.confirmation.form_name;
  // }
  // const items = Object.values(configs.items);
  // const today = DateTime.now();
  // const lastWeek = today.startOf('week').minus({
  //   hour: 1
  // }).endOf('day');
  // const threeWeeksBefore = lastWeek.minus({
  //   weeks: 3
  // }).startOf('day');
  //Latest reports
  // const latestReports = reports.filter((report) => {
  //   const reportDate = getDynamicReportedDate(report);
  //   return threeWeeksBefore <= reportDate && reportDate <= lastWeek;
  // });

  // const itemQuantities = items.reduce((prev, next) => {
  //   return { ...prev, [next.name]: 0 };
  // }, {});
  // console.log('latestReports', latestReports.length);
  // const itemNames = Object.keys(itemQuantities);

  // for (const report of latestReports) {
  //   for (const itemName of itemNames) {
  //     switch (report.form) {
  //       case FORM_ADDITIONAL_DOC_NAME:
  //         {
  //           const form = Utils.getField(report, 'form');
  //           itemQuantities[itemName] += Number(Utils.getField(report, `${itemName}_used_in_${form}`) || 0);
  //         }
  //         break;
  //       case STOCK_SUPPLY:
  //         {
  //           itemQuantities[itemName] += Number(Utils.getField(report, `out.${itemName}_supply`) || 0);
  //         }
  //         break;
  //       case SUPPLY_CORRECTION:
  //         {
  //           itemQuantities[itemName] -= (Number(Utils.getField(report, `out.${itemName}_in`)) || 0);
  //         }
  //         break;
  //       case STOCK_RETURNED:
  //         {
  //           itemQuantities[itemName] -= Number(Utils.getField(report, `out.${itemName}_in`) || 0);
  //         }
  //         break;
  //       default:
  //         break;
  //     }
  //   }
  // }

  return [];
}

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

  // Stock return confirmation
  if (configs.features.stock_out) {
    tasks.push(
      {
        name: 'task.stock-monitoring.stock_out',
        title: `${TRANSLATION_PREFIX}stock_out.tasks.stock_out`,
        icon: 'icon-healthcare-medicine',
        appliesTo: 'contacts',
        appliesToType: [configs.levels['1'].place_type],
        appliesIf: (contact) => {
          console.log('contact', contact.contact._id, configs.features.stock_out.formular);
          // if (configs.features.stock_out.formular === 'weekly_qty') {
          //   console.log('contact', contact.contact._id);
          // }
          // eslint-disable-next-line no-undef
          return true;
        },
        events: [
          {
            start: 0,
            end: 3,
            dueDate: function () {
              return DateTime.now().toJSDate();
            },
          },
        ],
        actions: [
          {
            form: configs.features.stock_out.form_name,
          }
        ]
      }
    );
  }
  return tasks;
}

module.exports = getStockTask;
