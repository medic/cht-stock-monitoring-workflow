#! /usr/bin/env node
const parseArgs = require('minimist');
const inquirer = require('inquirer');
const chalk = require('chalk');

const command = require('./command');
const utils = require('./src/utils');

(async () => {
  try {
    const argv = process.argv;
    const cmdArgs = parseArgs(argv.slice(1), {
      boolean: true,
      '--': true
    });

    if (!utils.isChtApp()) {
      console.log(chalk.red.bold('Not a CHT app'));
      return;
    }

    const actions = cmdArgs['_'];
    const formNames = cmdArgs['--'] || [];

    if (cmdArgs.version) {
      command.info(require('./package.json').version);
      return;
    }

    if (actions.includes('init')) {      
      return command.init()
    }
    if (actions.includes('add')) {
      return command.add()
    }
    if (actions.includes('update')) {
      return command.update()
    }
    if (actions.includes('test')) {
      return command.test()
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();