#! /usr/bin/env node
const parseArgs = require('minimist');
const chalk = require('chalk');

const command = require('./command');
const utils = require('./src/utils');

(async () => {
  try {
    const argv = process.argv;
    const cmdArgs = parseArgs(argv.slice(2));

    if (!utils.isChtApp()) {
      console.log(chalk.red.bold('Not a CHT app'));
      return;
    }

    const [action, type] = cmdArgs['_'];

    if (cmdArgs.version) {
      command.info(require('./package.json').version);
      return;
    }

    if (action === 'init') {
      return command.init();
    }
    if (action === 'add') {
      if (!type) {
        console.log(chalk.red('ERROR No type found. Options are: item and feature'));
        return;
      }
      switch (type) {
        case 'item':
          return command.addItem();
        case 'feature':
          return command.addFeature();
        default:
          break;
      }
    }
    if (action === 'build') {
      console.log(chalk.green('INFO Building stock monitoring configs'));
      return command.build();
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();
