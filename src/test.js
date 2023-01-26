const ExcelJS = require('exceljs');
const Config = require('./config');

module.exports = async function (config) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(Config.STOCK_COUNT_PATH);
  const formWorkSheet = workbook.getWorksheet(1);
  const row = formWorkSheet.getRow(1);
  const style = formWorkSheet.getRow(1).getCell(1).style;
  console.log('style', style);

  // Add language column
  formWorkSheet.spliceColumns(3, 2, [1, 2], [3, 4]);
  console.log('style after', row);
  formWorkSheet.getRow(1).getCell(3).style = style;
  await workbook.xlsx.writeFile(Config.STOCK_COUNT_PATH);
}