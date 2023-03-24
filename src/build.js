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
    switch (feature) {
      case 'stock_count':
      // Create stock count form xlsx
        await updateStockCount(configs);
        break;
      case 'stock_supply':
        // Create stock supply form xlsx
        await updateStockSupply(configs);
        if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply && configs.features.stock_supply.confirm_supply.active) {
          await updateStockConfirmation(configs, messages);
          await updateStockDiscrepancy(configs);
        }
        break;
      case 'stock_return':
        // Create stock return form
        await updateStockReturn(configs);
        // Create stock returned form
        await updateStockReturned(configs);
        break;
      case 'stock_out':
        await updateStockOut(configs);
        break;
      case 'stock_logs':
        await updateStockLogs(configs);
        break;
      case 'stock_order':
        await updateStockOrder(configs);
        await updateOrderStockSupply(configs);
        break;
      default:
        break;
    }
  }

  await updateForm(configs);
  console.log(chalk.green(`INFO All actions completed`));
};