const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');

function isChtApp() {
  const processDir = process.cwd();
  const formDir = path.join(processDir, 'forms');
  const baseSettingDir = path.join(processDir, 'app_settings');
  if (fs.existsSync(formDir) && fs.existsSync(baseSettingDir)) {
    return true;
  }
  return false;
}

function getAppSettings() {
  const processDir = process.cwd();
  const baseSettingFile = path.join(processDir, 'app_settings', 'base_settings.json');
  const rawSettings = fs.readFileSync(baseSettingFile, {
    encoding: 'utf-8'
  });
  const settings = JSON.parse(rawSettings);
  return settings;
}

function alreadyInit(directory) {
  const configFilePath = path.join(directory, 'stock-monitoring.config.json');
  if (fs.existsSync(configFilePath)) {
    return true;
  }
  return false;
}

function writeConfig(config) {
  const processDir = process.cwd();
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));
}

function getSheetGroupBeginEnd(workSheet, name) {
  let foundItemBeginGroup = false;
  let beginGroupRowNumber = -1;
  let endGroupRowNumber = -1;
  let interneGroupBegin = false;
  workSheet.eachRow(function (row, rowNumber) {
    if (row.values.includes('begin group')) {
      if (foundItemBeginGroup) {
        interneGroupBegin = true;
      } else if (row.values[2].trim() === name) {
        foundItemBeginGroup = true;
        beginGroupRowNumber = rowNumber;
      }
    }
    if (row.values.includes('end group')) {
      if (interneGroupBegin) {
        interneGroupBegin = false;
      } else if (endGroupRowNumber === -1 && foundItemBeginGroup) {
        endGroupRowNumber = rowNumber;
      }
    }
  });
  return [beginGroupRowNumber, endGroupRowNumber];
}

function getRowWithValueAtPosition(workSheet, value, position = 2) {
  let columns = [];
  let rowData = null;
  let index = -1;
  workSheet.eachRow(function (row, rowNumber) {
    if (rowNumber === 1) {
      columns = row.values;
      //The row.values first element is undefined
      columns.shift();
    }
    
    if (row.values[position] && row.values[position].trim() === value) {
      if (!rowData) {
        rowData = {};
      }
      for (let i = 0; i < columns.length; i++) {
        rowData[columns[i]] = row.values[i];
      }
      index = rowNumber;
    }
  });
  return [index, rowData];
}

async function getWorkSheet(excelFilePath, workSheetNumber = 1) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);
  return workbook.getWorksheet(workSheetNumber);
}

/**
 * Build row value using header values order.
 * @param {Array} header workSheet header row values
 * @param {Object} values row values with name {type: 'integer', name: 'question_1'}
 * @returns Array
 */
function buildRowValues(header, values) {
  const rowValues = [];
  for (const cell of header) {
    if (!cell) {
      rowValues.push('');
      continue;
    }
    const value = values[cell.trim()];
    if (value && value.length > 0) {
      rowValues.push(value);
    } else {
      rowValues.push('');
    }
  }
  return rowValues;
}

module.exports = {
  isChtApp,
  getAppSettings,
  alreadyInit,
  writeConfig,
  getSheetGroupBeginEnd,
  getRowWithValueAtPosition,
  getWorkSheet,
  buildRowValues,
};

