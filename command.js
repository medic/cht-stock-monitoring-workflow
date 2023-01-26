const chalk = require('chalk');
const initModule = require('./src/init');
const addItem = require('./src/add-item');

//Stock monitoring module initialization
async function init() {
  initModule();
}

module.exports = {
  init,
  add: addItem,
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
}