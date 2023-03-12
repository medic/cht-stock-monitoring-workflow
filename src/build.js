const chalk = require('chalk');
const { updateForm } = require('./features/form-update');
const { updateStockCount } = require('./features/stock-count');
const { updateStockReturn } = require('./features/stock-return');
const { updateStockSupply } = require('./features/stock-supply');
const { updateTranslations, getTranslations } = require('./utils');
const { updateStockReturned } = require('./features/stock-returned');
const { updateStockConfirmation } = require('./features/stock-received');

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
        if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply) {
          await updateStockConfirmation(configs, messages);
        }
        break;
      case 'stock_return':
        // Create stock return form
        await updateStockReturn(configs);
        // Create stock returned form
        await updateStockReturned(configs);
        break;
      default:
        break;
    }
  }

  await updateForm(configs);
  console.log(chalk.green(`INFO All actions completed`));
};
