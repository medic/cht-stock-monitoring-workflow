const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { getRowWithValueAtPosition, getSheetGroupBeginEnd, buildRowValues, getTranslations, getRowNumberWithNameInInterval, getNoLabelsColums } = require('../common');
const chalk = require('chalk');
const { FORM_ADDITIONAL_DOC_NAME } = require('../constants');

async function updateForm(configs) {
  const formConfigs = Object.values(configs.forms);
  const languages = configs.languages;
  const categories = Object.values(configs.categories);
  const messages = getTranslations();

  for (const formConfig of formConfigs) {
    const formName = formConfig.name;
    const formItemIds = Object.keys(formConfig.items);
    const items = Object.values(configs.items);
    const formItems = items.filter(item => formItemIds.includes(item.name));
    let formCategoryIds = items
      .filter(item => formItemIds.includes(item.name))
      .map(item => item.category);
    formCategoryIds = [...new Set(formCategoryIds)];

    const formPath = path.join('forms', 'app', `${formName}.xlsx`);
    if (!fs.existsSync(formPath)) {
      throw new Error(`${formName} not found`);
    }

    const formWorkbook = new ExcelJS.Workbook();
    await formWorkbook.xlsx.readFile(formPath);
    const surveyWorkSheet = formWorkbook.getWorksheet('survey');

    // Add additional doc header if needed
    const header = surveyWorkSheet.getRow(1).values;
    header.shift();
    const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 1);
    const lastColumnIndex = Object.keys(firstRowData).length;
    ['instance::db-doc', 'instance::db-doc-ref'].forEach((column, index) => {
      if (!header.includes(column)) {
        surveyWorkSheet.getColumn(lastColumnIndex + index + 1).values = [
          column,
        ];
        header.push(column);
      }
    });

    // Find user defined row
    const namePosition = header.indexOf('name') + 1;
    const [userBegin, userEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'user', namePosition);
    const userAppend = [];
    const parentRows = [
      buildRowValues(header, {
        type: 'begin group',
        name: 'parent',
        ...getNoLabelsColums(languages)
      }),
      buildRowValues(header, {
        type: 'hidden',
        name: '_id',
        ...getNoLabelsColums(languages)
      }),
      buildRowValues(header, {
        type: 'end group',
        name: 'parent',
      }),
    ];
    const [inputBegin,] = getSheetGroupBeginEnd(surveyWorkSheet, 'inputs', namePosition);
    let insertionPosition = inputBegin+1;
    if (userBegin === -1) {
      userAppend.push(
        buildRowValues(header, {
          type: 'begin group',
          name: 'user',
          ...getNoLabelsColums(languages)
        }),
        buildRowValues(header, {
          name: 'contact_id',
          type: 'db:person',
          appearance: 'db-object',
          ...getNoLabelsColums(languages)
        }),
        ...parentRows,
        buildRowValues(header, {
          type: 'end group',
          name: 'user',
        }),
      );
    } else {
      const userParentBegin = getRowNumberWithNameInInterval(surveyWorkSheet, 'parent', userBegin, userEnd, namePosition);
      if (userParentBegin === -1) {
        insertionPosition = userBegin + 1;
        userAppend.push(
          ...parentRows,
        );
      }
    }
    if (userAppend.length > 0) {
      surveyWorkSheet.insertRows(insertionPosition, userAppend, '+i');
    }

    const referenceToLevel = `${configs.levels['1'].place_type}_id`;

    // Remove additional doc group if already exist
    const [begin, end] = getSheetGroupBeginEnd(surveyWorkSheet, FORM_ADDITIONAL_DOC_NAME);
    if (begin !== -1) {
      const rows = surveyWorkSheet.getRows(begin, end - begin + 1);
      for (const row of rows) {
        row.splice(1, header.length);
      }
    }

    const noLabelValues = getNoLabelsColums(languages);
    const additionalDocRows = [
      buildRowValues(header, {
        type: 'calculate',
        name: referenceToLevel,
        calculation: '../inputs/user/parent/_id',
      }),
      buildRowValues(header, {
        type: 'begin group',
        name: FORM_ADDITIONAL_DOC_NAME,
        appearance: 'field-list summary',
        'instance::db-doc': 'true',
        ...noLabelValues
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'stock_monitoring_reported_date',
        calculation: formConfig.reportedDate,
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'place_id',
        calculation: '${' + `${referenceToLevel}` + '}'
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'type',
        calculation: '"data_record"'
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'created_from',
        calculation: '.',
        'instance::db-doc-ref': `/${formName}`
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'created_from_name',
        calculation: `"${formConfig.name}"`,
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'content_type',
        calculation: '"xml"'
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: 'form',
        calculation: `"${FORM_ADDITIONAL_DOC_NAME}"`
      }),
      buildRowValues(header, {
        type: 'begin group',
        name: 'contact',
        ...noLabelValues
      }),
      buildRowValues(header, {
        type: 'calculate',
        name: '_id',
        calculation: '${' + `${referenceToLevel}` + '}'
      }),
      buildRowValues(header, {
        type: 'end group',
        name: 'contact',
      }),
      buildRowValues(header, {
        type: 'begin group',
        name: 'fields',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_count.forms.additional_doc_title'] }), {}),
      }),
      ...formCategoryIds.map((categoryId) => {
        const category = categories.find((category) => category.name === categoryId);
        const byUserItems = formItems.filter((item) => {
          const itemConfig = formConfig.items[item.name];
          return item.category === category.name && itemConfig['deduction_type'] === 'by_user';
        });
        return [
          buildRowValues(header, {
            type: 'note',
            name: `${category.name}_out`,
            appearance: byUserItems.length > 0 ? 'h1 lime' : 'hidden',
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] + ' <i class="fa fa-cubes"></i>' }), {})
          }),
          ...formItems.filter(item => item.category === category.name).map((item) => {
            const itemConfig = formConfig.items[item.name];
            return buildRowValues(header, {
              type: itemConfig['deduction_type'] === 'formula' ? 'calculate' : 'decimal',
              name: `${item.name}_used_in_${formConfig.name}`,
              relevant: itemConfig['deduction_type'] === 'by_user' ? itemConfig.formular : '',
              calculation: itemConfig['deduction_type'] === 'formula' ? itemConfig.formular : '',
              ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_count.forms.item_used_question'].replace('{{item}}', item.label[language]) }), {})
            });
          }),
        ];
      }).reduce((prev, next) => [...prev, ...next], []),
      ...(formCategoryIds.length === 0 ? formItems.map((item) => {
        const itemConfig = formConfig.items[item.name];
        return buildRowValues(header, {
          type: itemConfig['deduction_type'] === 'formula' ? 'calculate' : 'decimal',
          name: `${item.name}_used_in_${formConfig.name}`,
          required: itemConfig['deduction_type'] === 'formula' ? '' : 'yes',
          relevant: itemConfig['deduction_type'] === 'by_user' ? itemConfig.formular : '',
          calculation: itemConfig['deduction_type'] === 'formula' ? itemConfig.formular : '',
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_count.forms.item_used_question'].replace('{{item}}', item.label[language]) }), {})
        });
      }) : []),
      buildRowValues(header, {
        type: 'end group',
        name: 'fields',
      }),
      buildRowValues(header, {
        type: 'end group',
      })
    ];
    if (begin !== -1) {
      surveyWorkSheet.spliceRows(
        begin,
        end - begin + 1,
        ...additionalDocRows
      );
    } else {
      surveyWorkSheet.addRows(
        additionalDocRows,
        '+i',
      );
    }
    await formWorkbook.xlsx.writeFile(formPath);
    console.log(chalk.green(`INFO ${formName} form updated successfully`));
  }
}

module.exports = {
  updateForm,
};
