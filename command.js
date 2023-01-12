const initModule = require('./src/init');

//Stock monitoring module initialization
async function init(level = 'health_center', formula = "contact.type === 'health_center' && user.parent && user.parent.type === 'health_center'") {
  initModule(level, formula);
}

module.exports = {
  init,
  info: function (message) {
    console.log(chalk.blue.italic(message));
  }
}