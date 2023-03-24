const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const chalk = require('chalk');

const TRANSLATION_PREFIX = 'cht-workflow-stock-monitoring.';

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

function getTranslations(removePrefix = true) {
  const appSettings = getAppSettings();
  const processDir = process.cwd();
  const locales = appSettings.locales.map(l => l.code);
  return locales
    .map((locale) => {
      // Get cht app messages path
      const messagePath = path.join(processDir, 'translations', `messages-${locale}.properties`);
      const messages = fs.readFileSync(messagePath).toString().split('\n');
      return [
        locale,
        messages
          .map(message => message.split(/=(.*)/))
          .filter(line => line.length > 2 && line[0].startsWith(TRANSLATION_PREFIX))
          .map((line) => {
            const ln = [...line];
            if (removePrefix) {
              ln[0] = ln[0].replace(TRANSLATION_PREFIX, '');
            }
            return ln;
          })
          .reduce((prev, next) => ({ ...prev, [next[0].trim()]: next[1].trim() }), {})];
    }).reduce((prev, next) => ({ ...prev, [next[0]]: next[1] }), {});
}

function updateTranslations(configs) {
  const appSettings = getAppSettings();
  const processDir = process.cwd();
  const items = Object.values(configs.items);

  const locale = appSettings.locale;
  const locales = appSettings.locales.map(l => l.code);
  // Get cht app messages path
  const chtAppMsg = getTranslations(false);

  const rawCompMessages = fs.readFileSync(path.join(__dirname, '../templates/stock-monitoring.messages.json'));
  const compMsgs = JSON.parse(rawCompMessages);

  const chtAppMsgKeys = Object.keys(chtAppMsg[locale]);
  const compMsgKeys = Object.keys(compMsgs);

  // Feature messages
  const missingFeaturesKeys = [].concat(
    ...Object.keys(configs.features).map((feature) => {
      const featureKeys = Object.keys(compMsgs).filter((key) => key.startsWith(`${feature}.`));
      return [].concat(
        ...featureKeys.map((featureKey) => {
          const featureKeys = compMsgKeys.filter(k => k.startsWith(featureKey));
          return featureKeys.filter((fKey) => !chtAppMsgKeys.includes(`cht-workflow-stock-monitoring.${fKey}`));
        })
      );
    })
  );
  const missingFeatureMsgs = missingFeaturesKeys.reduce((prev, next) =>
    ({ ...prev, [`cht-workflow-stock-monitoring.${next}`]: compMsgs[next] }), {});
  const missingMsgs = {};
  for (const lang of locales) {
    missingMsgs[lang] = { ...missingFeatureMsgs };
  }

  for (const item of items) {
    for (const lang of locales) {
      const key = `cht-workflow-stock-monitoring.items.${item.name}.label`;
      if (!chtAppMsgKeys.includes(key)) {
        missingMsgs[lang][key] = item.label[lang];
      }
    }
  }

  // Append missing locales
  for (const lang of locales) {
    const localFilePath = path.join(processDir, 'translations', `messages-${lang}.properties`);
    const langMsg = Object.keys(missingMsgs[lang]).map(k => `${k} = ${missingMsgs[lang][k].replaceAll("'", '"')}`).join('\n');
    if (fs.existsSync(localFilePath)) {
      fs.appendFileSync(localFilePath, `\n${langMsg}`);
    }
  }

  const nbNewKeys = Object.keys(missingMsgs[locale]).length;
  if (nbNewKeys > 0) {
    console.log(chalk.green(`INFO ${nbNewKeys} new messages added`));
  } else {
    console.log(chalk.green(`INFO no new message added`));
  }
}

function writeConfig(config) {
  const processDir = process.cwd();
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  fs.writeFileSync(configFilePath, JSON.stringify(config, null, 4));
  updateTranslations(config);
}

function getConfigs() {
  const processDir = process.cwd();
  const configFilePath = path.join(processDir, 'stock-monitoring.config.json');
  const content = fs.readFileSync(configFilePath);
  return JSON.parse(content);
}

/**
 * Get xform group begin and end index. If not found begin and end = -1
 * @param {WorkSheet} workSheet Xform worksheet
 * @param {string} name Group name
 * @returns [groupBeginIndex, groupEndIndex]
 */
function getSheetGroupBeginEnd(workSheet, name) {
  let foundItemBeginGroup = false;
  let beginGroupRowNumber = -1;
  let endGroupRowNumber = -1;
  let interneGroupBegin = 0;
  workSheet.eachRow(function (row, rowNumber) {
    if (row.values.includes('begin group')) {
      if (foundItemBeginGroup) {
        interneGroupBegin ++;
      } else if (row.values[2].trim() === name) {
        foundItemBeginGroup = true;
        beginGroupRowNumber = rowNumber;
      }
    }
    if (row.values.includes('end group')) {
      if (interneGroupBegin > 0) {
        interneGroupBegin --;
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

function getNumberOfParent(fromLevel, toLevel, initialNbParent = 0) {
  const appSettings = getAppSettings();
  const fromLevelDetail = appSettings.contact_types.find((settings) => settings.id === fromLevel);
  if (fromLevelDetail && fromLevelDetail.parents) {
    if (fromLevelDetail.parents.includes(toLevel)) {
      return initialNbParent + 1;
    } else {
      return getNumberOfParent(toLevel, fromLevelDetail.parents[0], initialNbParent + 1);
    }
  }
  return null;
}

function addCategoryItemsToChoice(categories, items, choiceWorkSheet, languages) {
  const choiceLabelColumns = languages.map((l) => [
    `label::${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  choiceWorkSheet.getColumn(choiceLastColumn + 1).values = ['category_filter'];
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();
  const categoryChoiceRows = categories.map((category) => {
    return buildRowValues(
      choiceHeader,
      {
        list_name: 'categories',
        name: category.name,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
      }
    );
  });
  const itemsChoiceRows = items.map((item) => {
    return buildRowValues(
      choiceHeader,
      {
        list_name: 'items',
        name: item.name,
        category_filter: item.category,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }
    );
  });
  choiceWorkSheet.insertRows(
    2,
    [
      ...categoryChoiceRows,
      ...itemsChoiceRows,
    ],
    'i+'
  );
}

function getDefaultSurveyLabels(feature, messages, languages) {
  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of languages) {
    labelColumns.push(
      [
        `label::${language}`,
        'Patient',
        'Source',
        'Source ID',
        'NO_LABEL',
        'NO_LABEL',
        '',
        'NO_LABEL',
        'NO_LABEL',
        'NO_LABEL',
        ...Array(6).fill(''),
        messages[language][`${feature}.message.summary_header`],
        messages[language][`${feature}.message.submit_note`],
        messages[language][`${feature}.message.summary_note`],
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

  return [labelColumns, hintColumns];
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
  getConfigs,
  updateTranslations,
  getTranslations,
  getNumberOfParent,
  addCategoryItemsToChoice,
  getDefaultSurveyLabels,
};

