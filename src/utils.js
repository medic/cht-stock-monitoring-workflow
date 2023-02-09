const path = require('path');
const fs = require('fs');

const DEFAULT_STOCK_COUNT_FILE_NB_ROWS = 40;

function isChtApp() {
  const processDir = process.cwd();
  const formDir = path.join(processDir, 'forms');
  const baseSettingDir = path.join(processDir, 'app_settings');
  if (fs.existsSync(formDir) && fs.existsSync(baseSettingDir)) {
    return true;
  }
  return false;
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
  workSheet.eachRow(function (row, rowNumber) {
    if (row.values.includes("begin group") && row.values[2].trim() === name) {
      foundItemBeginGroup = true;
      beginGroupRowNumber = rowNumber;
    }
    if (row.values.includes("end group") && foundItemBeginGroup && endGroupRowNumber === -1) {
      endGroupRowNumber = rowNumber;
    }
  });
  return [beginGroupRowNumber, endGroupRowNumber];
}

function updateColoumnsStyle(formWorkSheet, cellIndex) {
  for (let index = 0; index < DEFAULT_STOCK_COUNT_FILE_NB_ROWS; index++) {
    const style = formWorkSheet.getRow(index + 1).getCell(1).style;
    formWorkSheet.getRow(index + 1).getCell(cellIndex).style = style;
  }
}

module.exports = {
  isChtApp,
  alreadyInit,
  writeConfig,
  getSheetGroupBeginEnd,
  updateColoumnsStyle
}
