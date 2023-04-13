const chalk = require('chalk');
const { updateForm } = require('./features/form-update');
const { updateStockCount } = require('./features/stock-count');
const { updateStockReturn } = require('./features/stock-return');
const { updateStockSupply } = require('./features/stock-supply');
const { updateTranslations, getTranslations } = require('./utils');
const { updateStockReturned } = require('./features/stock-returned');
const { updateStockConfirmation } = require('./features/stock-received');
const { updateStockDiscrepancy } = require('./features/stock-discrepancy');
const { updateStockOut } = require('./features/stock-out');
const { updateStockLogs } = require('./features/stock-logs');
const { updateStockOrder } = require('./features/stock-order');
const { updateOrderStockSupply } = require('./features/stock-order-supply');

module.exports = async function (configs) {

  // Update app translations
  updateTranslations(configs);
  const messages = getTranslations();

  for (const feature of Object.keys(configs.features)) {
    const featureToFunctionMap = {
      stock_count: updateStockCount,
      stock_supply: async (configs) => {
        await updateStockSupply(configs);
        if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) {
          await updateStockConfirmation(configs, messages);
          await updateStockDiscrepancy(configs);
        }
      },
      stock_return: async (configs) => {
        await updateStockReturn(configs);
        await updateStockReturned(configs);
      },
      stock_out: updateStockOut,
      stock_logs: updateStockLogs,
      stock_order: async (configs) => {
        await updateStockOrder(configs);
        await updateOrderStockSupply(configs);
      }
    };

    await featureToFunctionMap[feature](configs);
  }

  await updateForm(configs);
  console.log(chalk.green(`INFO All actions completed`));
};
