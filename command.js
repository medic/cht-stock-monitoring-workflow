const chalk = require('chalk');
const initModule = require('./src/init');

//Stock monitoring module initialization
async function init() {
  initModule();
}

module.exports = {
  init,
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
}