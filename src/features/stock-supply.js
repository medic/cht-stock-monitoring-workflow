const { getNoLabelsColums, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations, getNumberOfSteps, addCategoryItemsToChoice,
  getContactParentHierarchy
} = require('../common');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');
const { SUPPLY_ADDITIONAL_DOC } = require('../constants');

function addStockSupplyCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_supply`, // Row name
      calculation: '${' + `supply_${item.name}` + '}'
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockSupplySummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + `${item.name}` + '___count} > 0',
      appearance: 'h5',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `${item.label[language]}: ` + (item.isInSet ? '**${'+`${item.name}___set`+'} '+item.set.label[language].toLowerCase()+' ${'+`${item.name}___unit`+'} '+item.unit.label[language].toLowerCase()+'**' : '**${'+`${item.name}___count`+'} '+item.unit.label[language].toLowerCase()+'**'); // Row label
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

function getAdditionalDoc(formName, languages, header, items, needConfirmation) {
  return [
    buildRowValues(header, {
      type: 'begin group',
      name: SUPPLY_ADDITIONAL_DOC,
      appearance: 'field-list',
      'instance::db-doc': 'true',
      ...getNoLabelsColums(languages)
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'form',
      calculation: `"${SUPPLY_ADDITIONAL_DOC}"`
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
      name: 'content_type',
      calculation: '"xml"'
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'contact',
      ...getNoLabelsColums(languages)
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: '_id',
      calculation: '${user_contact_id}'
    }),
    buildRowValues(header, {
      type: 'end group',
      name: 'contact',
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'fields',
      ...getNoLabelsColums(languages)
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'supplier_id',
      calculation: '${user_contact_id}'
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'place_id',
      calculation: '${supply_place_id}'
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'need_confirmation',
      calculation: needConfirmation ? '"yes"' : '"no"'
    }),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_in`, // Row name
      calculation: '${' + item.name + '___count}',
    })),
    buildRowValues(header, {
      type: 'end group',
      name: 'fields',
    }),
    buildRowValues(header, {
      type: 'end group'
    })
  ];
}

function getItemRows(header, languages, selectionFieldName, items) {
  const messages = getTranslations();
  return items.map((item) => {
    const row = [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: 'selected(${' + selectionFieldName + `}, '${item.name}')`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
    ];


    if (item.isInSet) {
      const calculateSetItemRow = {
        type: 'calculate',
        name: `${item.name}___set`,
        calculation: 'if(count-selected(${supply_'+item.name+'}) > 0 and count-selected(substring-before(${supply_'+item.name+'}, "/")) >= 0 and regex(substring-before(${supply_'+item.name+"}, \"/\"), '^[0-9]+$'),number(substring-before(${supply_"+item.name+'}, "/")),0)',
        default: '0/0'
      };
      row.push(buildRowValues(header, calculateSetItemRow));
      const calculateUnitItemRow = {
        type: 'calculate',
        name: `${item.name}___unit`,
        calculation: 'if(count-selected(${supply_'+item.name+'}) > 0 and count-selected(substring-after(${supply_'+item.name+'}, "/")) >= 0 and regex(substring-after(${supply_'+item.name+"}, \"/\"), '^[0-9]+$'),number(substring-after(${supply_"+item.name+'}, "/")),0)',
        default: '0/0'
      };
      row.push(buildRowValues(header, calculateUnitItemRow));
      const itemRow = {
        type: 'string',
        name: `supply_${item.name}`,
        required: 'yes',
        constraint: "regex(., '^\\d+\\/\\d+$')",
        default: '0/0',
      };
      for (const language of languages) {
        itemRow.constraint_message = messages[language]['stock_supply.message.set_unit_constraint_message'].replace('{{unit_label}}', item.unit.label[language].toLowerCase()).replace('{{set_label}}', item.set.label[language].toLowerCase());
        itemRow[`label::${language}`] = `${item.label[language]}` || ''; // Row label
        itemRow[`hint::${language}`] = '${'+`${item.name}___set`+'} '+item.set.label[language].toLowerCase()+' ${'+`${item.name}___unit`+'} '+item.unit.label[language].toLowerCase(); // Row hint
      }
      row.push(buildRowValues(header, itemRow));
    } else {
      const itemRow = {
        type: 'integer',
        name: `supply_${item.name}`,
        required: 'yes',
        default: '0',
      };
      for (const language of languages) {
        itemRow[`label::${language}`] = messages[language]['stock_supply.item.quantity_of'] + ' ' + item.unit.label[language].toLowerCase(); // Row label
        itemRow[`hint::${language}`] = messages[language]['stock_count.message.unit_quantity_hint'].replace('{{quantity}}', '${supply_'+item.name+'}').replace('{{unit_label}}', item.unit.label[language].toLowerCase()); // Row hint
      }

      row.push(buildRowValues(header, itemRow));
    }
    const calculateItemRowCount = {
      type: 'calculate',
      name: `${item.name}___count`,
      calculation: item.isInSet ? '${'+item.name+'___set} * ' + item.set.count + ' + ${'+item.name+'___unit}' : '${supply_'+item.name+'}',
    };
    row.push(buildRowValues(header, calculateItemRowCount));

    row.push(
      buildRowValues(header, {
        type: 'end group',
      }),
    );

    return row;
  });
}

async function updateStockSupply(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_supply;
  const { languages } = configs;
  const messages = getTranslations();
  const stockSupplyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.xlsx`);
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockSupplyPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockSupplyPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  // Add language column
  const labelColumns = [];
  const hintColumns = [];
  for (const language of configs.languages) {
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
        messages[language]['stock_supply.summary_header'],
        messages[language]['stock_supply.submit_note'],
        messages[language]['stock_supply.summary_note'],
        ...Array(2).fill(''),
        'NO_LABEL',
      ]
    );
    hintColumns.push(
      [
        `hint::${language}`,
      ]
    );
  }
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  // Add languages and hints columns
  const typeColumnIndex = header.indexOf('type');
  const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', typeColumnIndex);
  let lastColumnIndex = Object.keys(firstRowData).length;
  for (const labelColumn of labelColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = labelColumn;
    lastColumnIndex++;
    header.push(labelColumn[0]);
  }
  for (const hintColumn of hintColumns) {
    surveyWorkSheet.getColumn(lastColumnIndex + 1).values = hintColumn;
    lastColumnIndex++;
    header.push(hintColumn[0]);
  }
  surveyWorkSheet.getColumn(lastColumnIndex + 1).values = [
    `instance::db-doc`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 2).values = [
    `instance::db-doc-ref`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 3).values = ['choice_filter'];
  header.push(...['instance::db-doc', 'instance::db-doc-ref', 'choice_filter']);
  settingWorkSheet.getRow(2).getCell(1).value = featureConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = featureConfigs.form_name;

  //Add choices
  addCategoryItemsToChoice(categories, items, choiceWorkSheet, languages);

  // Get level 2
  const nbParents = getNumberOfSteps(configs.levels[1].place_type, configs.levels[2].place_type);
  const contactParentRows = getContactParentHierarchy(nbParents, header, languages);
  const nameColumnIndex = header.indexOf('name');
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', nameColumnIndex);
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactParentRows,
    'i+'
  );
  const rows = [
    ...items.map((item) => {
      return buildRowValues(header, {
        type: 'calculate',
        name: `${item.name}_current`,
        calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
      });
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: `supply_place_id`,
      calculation: `../inputs/contact/_id`
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: `user_contact_id`,
      calculation: `../inputs/user/contact_id`
    })
  ];
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', nameColumnIndex);
  surveyWorkSheet.getRow(position).getCell(8).value = `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`;
  if (configs.useItemCategory) {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: 'select_items',
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.forms.select_category'] }), {})
      }),
      buildRowValues(header, {
        type: 'select_multiple categories',
        name: 'categories',
        appearance: '',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.page_1.select_input'] }), {}),
      }),
      buildRowValues(header, {
        type: 'end group'
      }),
      ...categories.map((category) => {
        return [
          buildRowValues(header, {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            relevant: 'selected(${categories}, ' + `'${category.name}')`,
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
          }),
          buildRowValues(header, {
            type: 'select_multiple items',
            required: 'yes',
            name: `${category.name}_items_selected`,
            choice_filter: `category_filter = '${category.name}'`,
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_supply.forms.select_items'] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            `${category.name}_items_selected`,
            items.filter((item) => item.category === category.name),
          ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
          buildRowValues(header, {
            type: 'end group',
          }),
        ];
      }).reduce((prev, categoryRows) => ([...prev, ...categoryRows]), []),
    );
  } else {
    const pageHeader = {
      type: 'begin group',
      name: `item_quantity`,
      appearance: 'field-list',
    };
    for (const language of configs.languages) {
      pageHeader[`label::${language}`] = 'Quantity'; // Row label
    }
    rows.push(buildRowValues(header, pageHeader));
    for (const item of items) {
      const titleRow = {
        type: 'note',
        name: `note_${item.name}_title`,
        appearance: 'h3 bold ',
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        titleRow[`label::${language}`] = `${item.label[language]}`;
      }
      rows.push(buildRowValues(header, titleRow));
      const noteRow = {
        type: 'note',
        name: `note_current_${item.name}_qty`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        noteRow[`label::${language}`] = messages[language]['stock_supply.item.stock_on_hand'];
        noteRow[`hint:${language}`] = '${' + `${item.name}_current` + '}';
      }
      rows.push(buildRowValues(header, noteRow));

      const rowQty = {
        type: 'decimal',
        name: `supply_${item.name}`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`,
        default: 0,
      };
      for (const language of configs.languages) {
        rowQty[`label::${language}`] = messages[language]['stock_supply.item.quantity_of'] + ' ' + item.unit;
      }
      rows.push(buildRowValues(header, rowQty));
    }
    rows.push(buildRowValues(header, {
      type: 'end group'
    }));
  }
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  addStockSupplySummaries(surveyWorkSheet, Object.values(configs.items), languages);
  addStockSupplyCalculation(surveyWorkSheet, Object.values(configs.items));
  const [, end] = getSheetGroupBeginEnd(surveyWorkSheet, 'out');
  const additionalDocRows = getAdditionalDoc(featureConfigs.form_name, languages, header, items, featureConfigs.confirm_supply.active);
  surveyWorkSheet.insertRows(
    end + 2,
    additionalDocRows,
    'i+'
  );
  await workbook.xlsx.writeFile(stockSupplyPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': `contact.contact_type === '${configs.levels[1].place_type}' && user.parent.contact_type === '${configs.levels[2].place_type}' && user.role === '${configs.levels[2].role}'`,
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: featureConfigs.title[lang]
      };
    }),
  };
  const stockSupplyPropertyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.properties.json`);
  fs.writeFileSync(stockSupplyPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${featureConfigs.title[configs.defaultLanguage]} form updated successfully`));
}

async function getStockSupplyConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock supply form ID',
      default: 'stock_supply'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock supply form title in ${language}`,
      default: 'Stock Supply'
    })),
    {
      type: 'confirm',
      name: 'confirm_supply.active',
      message: 'Activate supply confirmation',
      default: false,
    }
  ]);

  if (configs.confirm_supply.active) {
    const confirmationConfigs = await inquirer.prompt([
      {
        type: 'input',
        name: 'confirm_supply.form_name',
        message: 'Enter supply confirmation ID',
        default: 'stock_received'
      },
      ...languages.map((language) => ({
        type: 'input',
        name: `confirm_supply.title.${language}`,
        message: `Enter supply confirmation form title in ${language}`,
        default: 'Stock Received'
      })),
      {
        type: 'input',
        name: 'discrepancy.form_name',
        message: 'Enter discrepancy resolution form ID',
        default: 'stock_discrepancy_resolution',
      },
      ...languages.map((language) => ({
        type: 'input',
        name: `discrepancy.title.${language}`,
        message: `Enter discrepancy resolution form title in ${language}`,
        default: 'Stock Discrepancy Resolution'
      }))
    ]);
    confirmationConfigs['confirm_supply'].active = true;

    return {
      ...configs,
      ...confirmationConfigs,
    };
  }
  return configs;
}

module.exports = {
  addStockSupplyCalculation,
  addStockSupplySummaries,
  updateStockSupply,
  getStockSupplyConfigs,
};
