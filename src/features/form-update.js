const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { getRowWithValueAtPosition, getSheetGroupBeginEnd, buildRowValues,
  getLastGroupIndex, getRowNumberWithNameInInterval
} = require('../excel-utils');
const { getTranslations } = require('../translation-manager');
const chalk = require('chalk');
const { FORM_ADDITIONAL_DOC_NAME } = require('../constants');

async function updateForm(configs) {
  const formConfigs = Object.values(configs.forms);
  const languages = configs.languages;
  const categories = Object.values(configs.categories);
  const messages = getTranslations();

  for (const formConfig of formConfigs) {
    const formName = formConfig.name;
    const formItemConfigs = formConfig.items;
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

    try {
      await formWorkbook.xlsx.readFile(formPath);
      const surveyWorkSheet = formWorkbook.getWorksheet('survey');

      // Add additional doc header if needed
      const header = surveyWorkSheet.getRow(1).values;
      header.shift();
      const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 0);
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
      const namePosition = header.indexOf('name');
      const [userBegin, userEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'user', namePosition);
      const userAppend = [];
      const userFacilityRow = buildRowValues(header, {
        type: 'hidden',
        name: 'facility_id',
        ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
      });
      const [,inputEnd] = getSheetGroupBeginEnd(surveyWorkSheet, 'inputs', namePosition);
      let insertionPosition = inputEnd;
      if (userBegin === -1) {
        userAppend.push(
          buildRowValues(header, {
            type: 'begin group',
            name: 'user',
            ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
          }),
          buildRowValues(header, {
            name: 'contact_id',
            type: 'db:person',
            appearance: 'db-object',
            ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
          }),
          userFacilityRow,
          buildRowValues(header, {
            type: 'end group',
            name: 'user',
          }),
        );
      } else {
        const userFacilityIndex = getRowNumberWithNameInInterval(
          surveyWorkSheet, 'facility_id', userBegin, userEnd, 1
        );
        if (userFacilityIndex === -1) {
          insertionPosition = userEnd;
          userAppend.push(userFacilityRow);
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

      const noLabelValues = languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {});
      const [survIndex,] = getRowWithValueAtPosition(surveyWorkSheet, referenceToLevel, 1);

      const additionalDocRows = [
        ...(survIndex === -1 ? [
          buildRowValues(header, {
            type: 'calculate',
            name: referenceToLevel,
            calculation: '../inputs/user/facility_id',
          })
        ] : []),
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
            const itemConfig = formItemConfigs[item.name];
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
              const itemConfig = formItemConfigs[item.name];
              let itemObj = {
                name: `sm_${item.name}_used_in_${formConfig.name}`,
                relevant: itemConfig['deduction_type'] === 'by_user' ? itemConfig.formular : '',
              };
              if (itemConfig['deduction_type'] === 'formula') {
                itemObj.type = 'calculate';
                itemObj.calculation = itemConfig['deduction_type'] === 'formula' ? itemConfig.formular : '';
              } else {
                itemObj.required = 'yes';
                if (item.isInSet) {
                  itemObj.type = 'string';
                  itemObj.constraint = "regex(., '^\\d+\\/\\d+$')";
                  itemObj.name = `sm_${item.name}_used_in`;
                  itemObj.default = '0/0';
                  itemObj = Object.assign(itemObj, {
                    ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_count.forms.item_used_question'].replace('{{item}}', item.label[language]) }), {}),...languages.reduce((prev, language) => ({
                      ...prev,
                      [`hint::${language}`]: '${'+`sm_${item.name}_set`+'} '+item.set.label[language].toLowerCase()+' ${'+`sm_${item.name}_unit`+'} '+item.unit.label[language].toLowerCase()
                    }), {})
                  });
                } else {
                  itemObj.type = 'integer';
                  itemObj = Object.assign(itemObj, {
                    ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_count.forms.item_used_question'].replace('{{item}}', item.label[language]) }), {})
                  });
                }
              }
              return buildRowValues(header, itemObj);
            }),
            ...formItems.filter(item => item.category === category.name && item.isInSet).map((item) => {
              return [
                buildRowValues(header, {
                  type: 'calculate',
                  name: `sm_${item.name}_set`,
                  calculation: 'if(count-selected(${sm_'+item.name+'_used_in}) > 0 and count-selected(substring-before(${sm_'+item.name+'_used_in}, "/")) >= 0 and regex(substring-before(${sm_'+item.name+"_used_in}, \"/\"), '^[0-9]+$'),number(substring-before(${sm_"+item.name+'_used_in}, "/")),0)',
                }),
                buildRowValues(header, {
                  type: 'calculate',
                  name: `sm_${item.name}_unit`,
                  calculation: 'if(count-selected(${sm_'+item.name+'_used_in}) > 0 and count-selected(substring-after(${sm_'+item.name+'_used_in}, "/")) >= 0 and regex(substring-after(${sm_'+item.name+"_used_in}, \"/\"), '^[0-9]+$'),number(substring-after(${sm_"+item.name+'_used_in}, "/")),0)',
                }),
                buildRowValues(header, {
                  type: 'calculate',
                  name: `sm_${item.name}_used_in_${formConfig.name}`,
                  calculation: '${sm_'+item.name+'_set} * ' + item.set.count + ' + ${sm_'+item.name+'_unit}',
                }),
              ];
            }).reduce((prev, next) => [...prev, ...next], []),
          ];
        }).reduce((prev, next) => [...prev, ...next], []),
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
        const typeColumnIndex = header.indexOf('type');
        const lastGroupIndex = getLastGroupIndex(surveyWorkSheet, typeColumnIndex);
        surveyWorkSheet.spliceRows(
          lastGroupIndex+1,
          0,
          ...additionalDocRows
        );
      }

      // Before writing the workbook, check and adjust the settings sheet
      await handleSettingsSheet(formWorkbook);

      await formWorkbook.xlsx.writeFile(formPath);
      console.log(chalk.green(`INFO ${formName} form updated successfully`));
    } catch (err) {
      console.log(chalk.red(`ERROR Failed to process ${formPath}: ${err.message}`));
      throw err;
    }
  }
}

async function handleSettingsSheet(workbook) {
  const settingsSheet = workbook.getWorksheet('settings');
  if (!settingsSheet) {return;}

  // Assuming version column is the first column
  const headerRow = settingsSheet.getRow(1);
  const versionColumnIndex = headerRow.values.indexOf('version');


  // Handle case where version row not found
  if (!versionColumnIndex === -1) {return;}

  // Assuming version value is in the next row
  const versionCell = settingsSheet.getCell(2, versionColumnIndex); 

  // Fix where the form is broken
  if (versionCell.value?.result?.toString() === 'Invalid Date') {
    versionCell.value.result = undefined;
  }
}

module.exports = {
  updateForm,
};
