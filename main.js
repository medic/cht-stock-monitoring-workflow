#! /usr/bin/env node
const parseArgs = require('minimist');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const command = require('./command');

/**
 * Check if the current working directory is a CHT application directory
 * @return {boolean} true if the current working directory is a CHT application directory
 */
function isChtApp() {
  const processDir = process.cwd();
  const formDir = path.join(processDir, 'forms');
  const baseSettingDir = path.join(processDir, 'app_settings');
  if (fs.existsSync(formDir) && fs.existsSync(baseSettingDir)) {
    return true;
  }
  return false;
}

(async () => {
  try {
    const argv = process.argv;
    const cmdArgs = parseArgs(argv.slice(2));

    if (!isChtApp()) {
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
    if (action === 'migrate') {
      return command.migrate();
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
    console.log(chalk.red(`ERROR Unknown command ${action}`));
  } catch (e) {
    console.error(e);
    process.exitCode = 1; // emit a non-zero exit code for scripting
  }
})();
