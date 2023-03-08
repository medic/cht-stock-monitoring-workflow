const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { getAppSettings, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations } = require('../utils');

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
  const stockCountConfigs = configs.features.stock_count;
  const stockCountPath = path.join(processDir, 'forms', 'app', `${stockCountConfigs.form_name}.xlsx`);
  const { languages } = configs;
  const messages = getTranslations();
  const items = Object.values(configs.items);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_count.xlsx'), stockCountPath);
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
        messages[language]['stock_count.balance_fill'],
        messages[language]['stock_count.commodities_note'],
        '', '', '',
        messages[language]['stock_count.summary_header'],
        messages[language]['stock_count.submit_note'],
        messages[language]['stock_count.summary_note'],
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
  settingWorkSheet.getRow(2).getCell(1).value = stockCountConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = stockCountConfigs.form_name;

  await workbook.xlsx.writeFile(stockCountPath);
  const levels = Object.values(configs.levels);
  const appSettings = getAppSettings();
  const expression = stockCountConfigs.contact_types.map((contact_type) => {
    const role = levels.find((level) => level.contact_type === contact_type).role;
    const contactTypeDetails = appSettings.contact_types.find((ct) => ct.id === contact_type);
    const contactParent = contactTypeDetails.parents[0];
    return `(contact.contact_type === '${contactParent}' && user.role === '${role}')`;
  }).join(' || ');

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      expression
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: stockCountConfigs.title[lang]
      };
    }),
  };
  const stockCountPropertyPath = path.join(processDir, 'forms', 'app', `${stockCountConfigs.form_name}.properties.json`);
  fs.writeFileSync(stockCountPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${stockCountConfigs.title[configs.defaultLanguage]} form updated successfully`));
}

module.exports = {
  updateStockCount,
};
