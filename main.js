#! /usr/bin/env node
const parseArgs = require('minimist');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');

const command = require('./command');
const { COMMANDS, ADD_TYPES } = require('./src/constants');

/**
 * Registry of cleanup tasks to run on error
 * Tasks are executed in reverse order (LIFO)
 */
const cleanupTasks = [];

/**
 * Register a cleanup task to be executed on error
 * @param {Function} task - Async function to execute during cleanup
 */
function registerCleanup(task) {
  cleanupTasks.push(task);
}

/**
 * Execute all registered cleanup tasks in reverse order
 * Continues execution even if individual tasks fail
 */
async function runCleanup() {
  for (const task of cleanupTasks.reverse()) {
    try {
      await task();
    } catch (e) {
      // Log but don't throw during cleanup
      console.error(chalk.yellow(`Warning: Cleanup task failed: ${e.message}`));
    }
  }
  // Clear the tasks after running
  cleanupTasks.length = 0;
}

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
      process.exitCode = 1;
      return;
    }

    const [action, type] = cmdArgs['_'];

    if (cmdArgs.version) {
      command.info(require('./package.json').version);
      return;
    }

    if (action === COMMANDS.INIT) {
      return command.init();
    }
    if (action === COMMANDS.MIGRATE) {
      return command.migrate();
    }
    if (action === COMMANDS.ADD) {
      if (!type) {
        console.log(chalk.red(`ERROR No type found. Options are: ${ADD_TYPES.ITEM} and ${ADD_TYPES.FEATURE}`));
        process.exitCode = 1;
        return;
      }
      switch (type) {
        case ADD_TYPES.ITEM:
          return command.addItem();
        case ADD_TYPES.FEATURE:
          return command.addFeature();
        default:
          break;
      }
    }
    if (action === COMMANDS.BUILD) {
      console.log(chalk.green('INFO Building stock monitoring configs'));
      return command.build();
    }
    console.log(chalk.red(`ERROR Unknown command ${action}`));
    process.exitCode = 1;
  } catch (e) {
    await runCleanup();
    if (e.name === 'ValidationError') {
      console.error(chalk.red(`Validation Error: ${e.message}`));
      process.exitCode = 2;
    } else {
      console.error(chalk.red(`Error: ${e.message}`));
      process.exitCode = 1;
    }
  }
})();

module.exports = { registerCleanup };
