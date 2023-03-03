const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const Config = require('./config');
const { getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition } = require('./utils');

function addConsumptionItem(workSheet, items, languages, type = 'items_received') {
  // Find items group last row number
  const [, itemEndGroupRowNumber] = getSheetGroupBeginEnd(workSheet, type);
  const itemRows = [];
  const header = workSheet.getRow(1).values;
  header.shift();
  for (const item of items) {
    const itemRow = {
      type: 'integer', // Row type
      name: type === 'items_received' ? item.name : `${item.name}_r`, // Row name
      required: 'yes',
      relevant: '',
      appearance: '',
      constraint: `. >= 0 and . <= ${item.reception_max}`,
      'constraint_message': '',
    };
    for (const language of languages) {
      itemRow[`label:${language}`] = item.label[language] || ''; // Row label
    }
    itemRows.push(buildRowValues(header, itemRow));
  }

  //Insert item
  workSheet.insertRows(
    itemEndGroupRowNumber,
    itemRows,
    'i+'
  );
}

function addConsumptionLogSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const itemRows = [];
  const returnedItemRows = [];
  const header = workSheet.getRow(1).values;
  header.shift();
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}_received`, // Row name
      required: '',
      relevant: '${' + `${item.name}` + '} > 0',
      appearance: '',
      constraint: `. >= 0 and . <= ${item.reception_max}`,
      'constraint_message': '',
    };
    for (const language of languages) {
      itemRow[`label:${language}`] = `<h5 style="text-align:center;"> ${item.label[languages[0]]}: **` + '${' + item.name + '} ' + `${item.unit}** </h5>`; // Row label
    }
    itemRows.push(buildRowValues(header, itemRow));

    const returnedItemRow = { ...itemRow };
    returnedItemRow.name = `s_${item.name}_returned`;
    for (const language of languages) {
      returnedItemRow[`label:${language}`] = `<h5 style="text-align:center;"> ${item.label[languages[0]]}: **` + '${' + item.name + '_r} ' + `${item.unit}** </h5>`; // Row label
    }
    returnedItemRow.relevant = '${' + `${item.name}_r` + '} > 0';
    returnedItemRows.push(buildRowValues(header, returnedItemRow));
  }

  //Insert item
  workSheet.insertRows(
    end-3,
    itemRows,
    'i+'
  );
  //Insert item
  workSheet.insertRows(
    end,
    returnedItemRows,
    'i+'
  );
}

function addStockCountSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + `${item.name}` + '} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label:${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + item.name + '} ' + `${item.unit}** </h5>`; // Row label
    }
    itemRows.push(buildRowValues(header, itemRow));
  }

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addConsumptionLogCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_received`, // Row name
      calculation: '${' + item.name + '}'
    })),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_returned`, // Row name
      calculation: '${' + item.name + '_r}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockCountCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_availables`, // Row name
      calculation: '${' + item.name + '}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

// eslint-disable-next-line no-unused-vars
async function updateConsumptionLog({
  languages,
  messages,
  items,
  expression,
}) {
  fs.copyFileSync(path.join(__dirname, '../templates/consumption_log.xlsx'), Config.CONSUMPTION_LOG_PATH);
  // Add language column
  const cLogLabelColumns = [];
  const cLogHintColumns = [];
  for (const language of languages) {
    cLogLabelColumns.push(
      [
        `label:${language}`,
        'Patient',
        'Source',
        'Source ID',
        '', '', '',
        'NO_LABEL', 'NO_LABEL',
        'Name', '', '',
        'NO_LABEL', '',
        messages[language].consumption_log_item_received_header,
        'Date',
        messages[language].consumption_log_item_question,
        messages[language].consumption_log_item_returned_note,
        messages[language].consumption_log_item_received_note,
        '', '', '',
        messages[language].consumption_log_item_quantity_received_label,
        messages[language].consumption_log_item_quantity_received_note,
        '', '',
        messages[language].consumption_log_item_quantity_returned_label,
        messages[language].consumption_log_item_quantity_returned_note,
        '', '',
        messages[language].consumption_log_summary_header,
        messages[language].consumption_log_summary_note_1,
        messages[language].consumption_log_summary_note_2,
        messages[language].consumption_log_summary_note_3,
        messages[language].consumption_log_summary_note_4,
        messages[language].consumption_log_summary_followup,
        messages[language].consumption_log_summary_followup_note,
        '', '',
        'No_LABEL'
      ]
    );
    cLogHintColumns.push(
      [
        `hint:${language}`,
      ]
    );
  }

  const cLogWorkbook = new ExcelJS.Workbook();
  await cLogWorkbook.xlsx.readFile(Config.CONSUMPTION_LOG_PATH);
  const cLogFormWorkSheet = cLogWorkbook.getWorksheet('survey');
  const cLogSettingWorkSheet = cLogWorkbook.getWorksheet('settings');
  // Add languages and hints columns
  const [, cLogFirstRowData] = getRowWithValueAtPosition(cLogFormWorkSheet, 'type', 1);
  let cLogLastColumnIndex = Object.keys(cLogFirstRowData).length;
  for (const labelColumn of cLogLabelColumns) {
    cLogFormWorkSheet.getColumn(cLogLastColumnIndex + 1).values = labelColumn;
    cLogLastColumnIndex++;
  }
  for (const hintColumn of cLogHintColumns) {
    cLogFormWorkSheet.getColumn(cLogLastColumnIndex + 1).values = hintColumn;
    cLogLastColumnIndex++;
  }
  cLogSettingWorkSheet.getRow(2).getCell(1).value = messages[languages[0]].consumption_log_form_display_name;
  addConsumptionItem(cLogFormWorkSheet, Object.values(items), languages, 'items_received');
  addConsumptionItem(cLogFormWorkSheet, Object.values(items), languages, 'items_returned');
  addConsumptionLogSummaries(cLogFormWorkSheet, Object.values(items), languages);
  addConsumptionLogCalculation(cLogFormWorkSheet, Object.values(items), languages);
  await cLogWorkbook.xlsx.writeFile(Config.CONSUMPTION_LOG_PATH);

  // Add consumption log form properties
  const cLogFormProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': expression.consumptionLog
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: messages[lang].consumption_log_form_display_name
      };
    }),
  };
  fs.writeFileSync(Config.CONSUMPTION_LOG_PROPERTY_PATH, JSON.stringify(cLogFormProperties, null, 4));
  console.log(chalk.green('INFO File updated successfully'));
}

function getItemRows(items, languages, header) {
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'integer',
      name: item.name,
      required: 'yes',
      relevant: '',
      appearance: '',
      constraint: '',
      'constraint_message': '',
    };
    for (const language of languages) {
      itemRow[`label:${language}`] = item.label[language] || ''; // Row label
    }

    itemRows.push(buildRowValues(header, itemRow));
  }
  return itemRows;
}

async function updateStockCount(configs) {
  const processDir = process.cwd();
  const stockCountPath = path.join(processDir, 'forms', 'app', `${configs.stockCountName}.xlsx`);
  const { languages, messages } = configs;
  const items = Object.values(configs.items);
  fs.copyFileSync(path.join(__dirname, '../templates/stock_count.xlsx'), stockCountPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockCountPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const settingWorkSheet = workbook.getWorksheet('settings');

  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of languages) {
    labelColumns.push(
      [
        `label:${language}`,
        'Patient',
        'Source',
        'Source ID',
        '',
        'NO_LABEL',
        '',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(8).fill(''),
        messages[language].stock_count_balance_fill,
        messages[language].stock_count_commodities_note,
        '', '', '',
        messages[language].stock_count_summary_header,
        messages[language].stock_count_submit_note,
        messages[language].stock_count_summary_note,
        ...Array(2).fill(''),
        'NO_LABEL',
      ]
    );
    hintColumns.push(
      [
        `hint:${language}`,
      ]
    );
  }

  // Add languages and hints columns
  const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 1);
  let lastColumnIndex = Object.keys(firstRowData).length;
  for (const labelColumn of labelColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = labelColumn;
    lastColumnIndex++;
  }
  for (const hintColumn of hintColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = hintColumn;
    lastColumnIndex++;
  }

  // Add items
  // Find items group last row number
  const [, itemEndGroupRowNumber] = getSheetGroupBeginEnd(surveyWorkSheet, 'items');
  const itemRows = [];
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  if (configs.useItemCategory) {
    for (const category of Object.values(configs.categories)) {
      const categoryRow = {
        type: 'note',
        name: category.name,
        required: '',
        relevant: '',
        appearance: '',
        constraint: '',
        'constraint_message': '',
      };
      for (const language of languages) {
        categoryRow[`label:${language}`] = `### ${category.label[language]} - ${category.description[language]}` || ''; // Row label
      }
      itemRows.push(buildRowValues(header, categoryRow));
      itemRows.push(
        ...getItemRows(items.filter((item) => item.category === category.name), languages, header)
      );
    }
  } else {
    itemRows.push(
      ...getItemRows(items, languages, header)
    );
  }
  

  //Insert item
  surveyWorkSheet.insertRows(
    itemEndGroupRowNumber,
    itemRows,
    'i+'
  );
  addStockCountSummaries(surveyWorkSheet, Object.values(configs.items), languages);
  addStockCountCalculation(surveyWorkSheet, Object.values(configs.items), languages);
  settingWorkSheet.getRow(2).getCell(1).value = messages[languages[0]].stock_count_form_display_name;

  await workbook.xlsx.writeFile(stockCountPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': configs.expression.stockCount
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: messages[lang].stock_count_form_display_name
      };
    }),
  };
  const stockCountPropertyPath = path.join(processDir, 'forms', 'app', `${configs.stockCountName}.properties.json`);
  fs.writeFileSync(stockCountPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${messages[languages[0]].stock_count_form_display_name} form updated successfully`));
}

module.exports = async function (configs) {
  console.log(chalk.green('INFO Updating files'));
  // Create stock count form xlsx
  await updateStockCount(configs);

  // Add consumption log form xlsx
  // await updateConsumptionLog({
  //   languages,
  // });

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
