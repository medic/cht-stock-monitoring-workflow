const { updateStockCount } = require('./features/stock-count');
const { updateStockSupply } = require('./features/stock-supply');
const { updateTranslations } = require('./utils');

module.exports = async function (configs) {

  // Update app translations
  updateTranslations(configs);

  for (const feature of Object.keys(configs.features)) {
    switch (feature) {
      case 'stock_count':
      // Create stock count form xlsx
        await updateStockCount(configs);
        break;
      case 'stock_supply':
        // Create stock supply form xlsx
        await updateStockSupply(configs);
        break;
      default:
        break;
    }
  }

  // Add form properties
  // const itemConfigs = Object.values(items);
  // for (const itemConfig of itemConfigs) {
  //   const forms = Object.keys(itemConfig.forms);
  //   for (const form of forms) {
  //     const formPath = path.join(Config.FORM_DIR, `${form}.xlsx`);
  //     const formWorkbook = new ExcelJS.Workbook();
  //     await formWorkbook.xlsx.readFile(formPath);
  //     const formWorkSheet = formWorkbook.getWorksheet('survey');

  //     // Get header and add instance::db-doc and instance::db-doc-ref if missing
  //     const headerRow = formWorkSheet.getRow(1);
  //     const header = headerRow.values;
  //     header.shift();
  //     let formLastColumIndex = header.length;
  //     if (!header.includes('instance::db-doc')) {
  //       formWorkSheet.getColumn(formLastColumIndex + 1).values = ['instance::db-doc'];
  //       header.push('instance::db-doc');
  //       formLastColumIndex++;
  //     }
  //     if (!header.includes('instance::db-doc-ref')) {
  //       formWorkSheet.getColumn(formLastColumIndex + 1).values = ['instance::db-doc-ref'];
  //       header.push('instance::db-doc-ref');
  //       formLastColumIndex++;
  //     }

  //     // Get additional_doc group
  //     let [begin, end] = getSheetGroupBeginEnd(formWorkSheet, Config.ADDITIONAL_DOC_NAME);
  //     const noLabelValues = {};
  //     for (const language of languages) {
  //       noLabelValues[`label::${language}`] = 'NO_LABEL';
  //     }
  //     if (begin === -1) {
  //       // Add additional doc bloc
  //       const addDocGroupBeginValue = {
  //         type: 'begin group',
  //         name: Config.ADDITIONAL_DOC_NAME,
  //         appearance: 'field-list',
  //         'instance::db-doc': 'true'
  //       };
  //       for (const language of languages) {
  //         addDocGroupBeginValue[`label::${language}`] = 'NO_LABEL';
  //       }
  //       const addDocGroupBegin = buildRowValues(header, addDocGroupBeginValue);
  //       const addDocGroupEnd = buildRowValues(header, {
  //         type: 'end group',
  //         name: Config.ADDITIONAL_DOC_NAME,
  //         ...noLabelValues,
  //       });
  //       formWorkSheet.addRows([addDocGroupBegin, addDocGroupEnd]);
  //       await formWorkbook.xlsx.writeFile(formPath);
  //       [begin, end] = getSheetGroupBeginEnd(formWorkSheet, Config.ADDITIONAL_DOC_NAME);
  //       formWorkSheet.insertRows(end, [
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: 'place_id',
  //           calculation: '${' + `${Config.STOCK_MONITORING_AREA_ROW_NAME}` + '}'
  //         }),
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: 'type',
  //           calculation: '"data_record"'
  //         }),
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: 'created_from',
  //           calculation: '.',
  //           'instance::db-doc-ref': `/${form}`
  //         }),
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: 'content_type',
  //           calculation: '"xml"'
  //         }),
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: 'form',
  //           calculation: '"prescription_summary"'
  //         }),
  //         buildRowValues(header, {
  //           type: 'begin group',
  //           name: 'contact',
  //           ...noLabelValues,
  //         }),
  //         buildRowValues(header, {
  //           type: 'calculate',
  //           name: '_id',
  //           calculation: '${' + `${Config.STOCK_MONITORING_AREA_ROW_NAME}` + '}'
  //         }),
  //         buildRowValues(header, {
  //           type: 'end group',
  //           name: 'contact',
  //         }),
  //         buildRowValues(header, {
  //           type: 'begin group',
  //           name: 'fields',
  //           ...noLabelValues,
  //         }),
  //         buildRowValues(header, {
  //           type: 'end group',
  //           name: 'fields',
  //         }),
  //       ], 'i+');
  //       end += 10;
  //     }

  //     const itemRowName = `stm___${itemConfig.name}___given`;
  //     const rowValue = buildRowValues(header, {
  //       type: 'calculate',
  //       name: itemRowName,
  //       calculation: itemConfig.forms[form]
  //     });
  //     const [itemIndex, itemRow] = getRowWithValueAtPosition(formWorkSheet, itemRowName);
  //     if (itemRow) {
  //       const rowAtIndex = formWorkSheet.getRow(itemIndex);
  //       for (let i = 0; i < header.length; i++) {
  //         rowAtIndex.getCell(i+1).value = rowValue[i];
  //       }
  //     } else {
  //       formWorkSheet.insertRow(end - 1, rowValue);
  //     }

  //     // Style
  //     const groupStyle = {
  //       font: { size: 16, name: 'Arial', family: 2, charset: 1 },
  //       border: {},
  //       fill: {
  //         type: 'pattern',
  //         pattern: 'solid',
  //         fgColor: { theme: 5, tint: 0.7999816888943144 },
  //         bgColor: { argb: '618f7200' }
  //       }
  //     };
  //     [begin, end] = getSheetGroupBeginEnd(formWorkSheet, Config.ADDITIONAL_DOC_NAME);
  //     for (let i = begin; i <= end; i++) {
  //       for (let j = 1; j <= header.length; j++) {
  //         formWorkSheet.getRow(i).getCell(j).style = groupStyle;
  //       }
  //     }
  //     await formWorkbook.xlsx.writeFile(formPath);
  //   }
  // }
};
