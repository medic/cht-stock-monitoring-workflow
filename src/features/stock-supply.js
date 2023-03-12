const { getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations, getNumberOfParent } = require('../utils');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const inquirer = require('inquirer');
const { SUPPLY_ADDITIONAL_DOC } = require('../constants');

function getLabelColumns(languages, messages) {
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
        messages[language]['stock_supply.summary_header'],
        messages[language]['stock_supply.submit_note'],
        messages[language]['stock_supply.confirmation.summary_note'],
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
      relevant: '${' + `supply_${item.name}` + '} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + `supply_${item.name}` + '} ' + `${item.unit}** </h5>`; // Row label
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

function addStockConfirmCalculation(workSheet, items) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'out');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_confirmed`, // Row name
      calculation: 'if(${have_receive_' + item.name + "_qty} = 'yes',${" + item.name + '_received},${' + item.name + '_real_qty})',
    }))
  ];

  //Insert item
  workSheet.insertRows(
    end,
    itemRows,
    'i+'
  );
}

function addStockConfirmSummaries(workSheet, items, languages) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const itemRows = [];
  for (const item of items) {
    const itemRow = {
      type: 'note', // Row type
      name: `s_${item.name}`, // Row name
      required: '',
      relevant: '${' + item.name + '_received} > 0',
      appearance: '',
    };
    for (const language of languages) {
      itemRow[`label::${language}`] = `<h5 style="text-align:center;"> ${item.label[language]}: **` + '${' + `${item.name}_confirmed` + '} ' + `${item.unit}** </h5>`; // Row label
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

function getAdditionalDoc(formName, languages, header, items) {
  return [
    buildRowValues(header, {
      type: 'begin group',
      name: SUPPLY_ADDITIONAL_DOC,
      appearance: 'field-list',
      'instance::db-doc': 'true',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'form',
      calculation: `"${SUPPLY_ADDITIONAL_DOC}"`
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'place_id',
      calculation: '${supply_place_id}'
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
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: '_id',
      calculation: '${supply_place_id}'
    }),
    buildRowValues(header, {
      type: 'end group',
      name: 'contact',
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'fields',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    }),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_out`, // Row name
      calculation: '${' + item.name + '_supply}',
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
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: 'selected(${' + selectionFieldName + `}, '${item.name}')`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `supply_${item.name}`,
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

async function updateStockConfirmation(configs, messages) {
  const processDir = process.cwd();
  const supplyConfigs = configs.features.stock_supply;
  const confirmConfigs = supplyConfigs.confirm_supply;
  const items = Object.values(configs.items);
  const { languages } = configs;

  const stockConfirmPath = path.join(processDir, 'forms', 'app', `${confirmConfigs.form_name}.xlsx`);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockConfirmPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockConfirmPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const choiceWorkSheet = workbook.getWorksheet('choices');
  const settingWorkSheet = workbook.getWorksheet('settings');

  const choiceLabelColumns = configs.languages.map((l) => [
    `label::${l}`
  ]);
  let choiceLastColumn = 2;
  for (const choiceLabelColumn of choiceLabelColumns) {
    choiceWorkSheet.getColumn(choiceLastColumn + 1).values = choiceLabelColumn;
    choiceLastColumn++;
  }
  const choiceHeader = choiceWorkSheet.getRow(1).values;
  choiceHeader.shift();
  const choices = ['yes', 'no'].map((ch) => {
    const row = {
      list_name: 'yes_no',
      name: ch,
    };
    for (const language of configs.languages) {
      row[`label::${language}`] = messages[language][`stock_supply.choices.yes_no.${ch}`];
    }
    return buildRowValues(choiceHeader, row);
  });
  choiceWorkSheet.insertRows(
    2,
    choices,
    'i+'
  );

  const [labelColumns, hintColumns] = getLabelColumns(configs.languages, messages);
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

  // Add calculation
  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  const inputs = items.map((item) => {
    const itemCalc = {
      type: 'hidden',
      name: `${item.name}_received`,
    };
    for (const language of configs.languages) {
      itemCalc[`label::${language}`] = 'NO_LABEL'; // Row label
    }
    return buildRowValues(header, itemCalc);
  });
  inputs.push(
    buildRowValues(header, {
      type: 'hidden',
      name: 'supply_place_id',
      ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
    })
  );
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 2);
  surveyWorkSheet.insertRows(
    position + 1,
    inputs,
    'i+'
  );

  const rows = [];
  if (configs.useItemCategory) {
    const categories = Object.values(configs.categories);
    for (const category of categories) {
      const categoryItems = items.filter((it) => it.category === category.name);
      const catHeader = {
        type: 'begin group',
        name: `category_${category.name}`,
        relevant: categoryItems.map((item) => '${' + item.name + '_received} > 0').join(' or '),
        appearance: 'field-list',
      };
      for (const language of configs.languages) {
        catHeader[`label::${language}`] = category.label[language]; // Row label
      }
      rows.push(buildRowValues(header, catHeader));
      for (const categoryItem of categoryItems) {
        const confirmationRow = {
          type: 'select_one yes_no',
          name: `have_receive_${categoryItem.name}_qty`,
          required: 'yes',
          relevant: '${' + categoryItem.name + '_received} > 0'
        };
        for (const language of configs.languages) {
          let msg = messages[language]['stock_supply.confirmation.item_received_question'];
          msg = msg.replace('{{qty}}', '${' + categoryItem.name + '_received}');
          msg = msg.replace('{{unit}}', categoryItem.unit);
          msg = msg.replace('{{item}}', categoryItem.label[language]);
          confirmationRow[`label::${language}`] = msg;
        }
        rows.push(buildRowValues(header, confirmationRow));

        const qtyRow = {
          type: 'decimal',
          name: `${categoryItem.name}_real_qty`,
          required: 'yes',
          constraint: '. != ${' + categoryItem.name + '_received}',
          relevant: '${have_receive_' + categoryItem.name + "_qty} = 'no'"
        };
        for (const language of configs.languages) {
          qtyRow[`label::${language}`] = messages[language]['stock_supply.confirmation.qty_received_question'];
        }
        rows.push(buildRowValues(header, qtyRow));
      }
      rows.push(buildRowValues(header, {
        type: 'end group'
      }));
    }
  } else {
    for (const item of items) {
      const confirmationRow = {
        type: 'select_one yes_no',
        name: `have_receive_${item.name}_qty`,
        required: 'yes',
        relevant: '${' + item.name + '_received} > 0',
        ...languages.reduce((prev, language) => ({
          ...prev,
          [`label::${language}`]: messages[language]['stock_supply.confirmation.item_received_question'].replace('{{qty}}', '${' + item.name + '_received}').replace('{{unit}}', item.unit).replace('{{item}}', item.label[language]),
        }), {})
      };
      rows.push(buildRowValues(header, confirmationRow));

      const qtyRow = {
        type: 'decimal',
        name: `${item.name}_real_qty`,
        required: 'yes',
        constraint: '. != ${' + item.name + '_received}',
        relevant: '${have_receive_' + item.name + "_qty} = 'no'"
      };
      for (const language of configs.languages) {
        qtyRow[`label::${language}`] = messages[language]['stock_supply.confirmation.qty_received_question'];
      }
      rows.push(buildRowValues(header, qtyRow));
    }
    rows.push(buildRowValues(header, {
      type: 'end group'
    }));
  }
  const [placePosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
  surveyWorkSheet.insertRows(
    placePosition + 1,
    rows,
    'i+'
  );
  addStockConfirmCalculation(surveyWorkSheet, items);
  addStockConfirmSummaries(surveyWorkSheet, items, languages);

  settingWorkSheet.getRow(2).getCell(1).value = confirmConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = confirmConfigs.form_name;

  await workbook.xlsx.writeFile(stockConfirmPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': false,
      'expression': `user.role === '${configs.levels[1].role}'`,
    },
    title: languages.map((lang) => {
      return {
        locale: lang,
        content: confirmConfigs.title[lang]
      };
    }),
  };
  const configStockPropertyPath = path.join(processDir, 'forms', 'app', `${confirmConfigs.form_name}.properties.json`);
  fs.writeFileSync(configStockPropertyPath, JSON.stringify(formProperties, null, 4));
  console.log(chalk.green(`INFO ${confirmConfigs.title[configs.defaultLanguage]} form updated successfully`));
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
  surveyWorkSheet.getColumn(lastColumnIndex + 1).values = [
    `instance::db-doc`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 2).values = [
    `instance::db-doc-ref`,
  ];
  surveyWorkSheet.getColumn(lastColumnIndex + 3).values = ['choice_filter'];
  settingWorkSheet.getRow(2).getCell(1).value = featureConfigs.title[configs.defaultLanguage];
  settingWorkSheet.getRow(2).getCell(2).value = featureConfigs.form_name;

  //Add choices
  const choiceLabelColumns = configs.languages.map((l) => [
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

  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  // Get level 2
  const nbParents = getNumberOfParent(configs.levels[1].place_type, configs.levels[2].place_type);
  const contactParentRows = [];
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: `parent`,
        appearance: `hidden`,
        ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
      }),
      buildRowValues(header, {
        type: 'string',
        name: `_id`,
        ...languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {})
      })
    );
  }
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
      buildRowValues(header, {
        type: 'end group',
      })
    );
  }
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', 2);
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactParentRows,
    'i+'
  );
  const rows = items.map((item) => {
    return buildRowValues(header, {
      type: 'calculate',
      name: `${item.name}_current`,
      calculation: `instance('contact-summary')/context/stock_monitoring_${item.name}_qty`
    });
  });
  rows.push(
    buildRowValues(header, {
      type: 'calculate',
      name: `supply_place_id`,
      calculation: `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`
    })
  );
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 2);
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
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_return.forms.select_items'] }), {})
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
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        titleRow[`label::${language}`] = `<h3 style="text-align:center; font-weight:bold; background-color:#93C47E;">${item.label[language]}</h3>`;
      }
      rows.push(buildRowValues(header, titleRow));
      const noteRow = {
        type: 'note',
        name: `note_current_${item.name}_qty`,
        relevant: 'selected(${selected_items},' + `'${item.name}')`
      };
      for (const language of configs.languages) {
        noteRow[`label::${language}`] = messages[language]['stock_supply.item.stock_on_hand'];
        noteRow[`hint:${language}`] = '${' + `stock_monitoring_${item.name}_qty` + '}';
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
  addStockSupplyCalculation(surveyWorkSheet, Object.values(configs.items), languages);
  const [, end] = getSheetGroupBeginEnd(surveyWorkSheet, 'out');
  const additionalDocRows = getAdditionalDoc(featureConfigs.form_name, languages, header, items);
  surveyWorkSheet.insertRows(
    end + 2,
    additionalDocRows,
    'i+'
  );
  if (!featureConfigs.confirm_supply.active) {
    //TODO: Add additional docs and auto deduct
  }
  await workbook.xlsx.writeFile(stockSupplyPath);

  // Add stock count form properties
  const formProperties = {
    'icon': 'icon-healthcare-medicine',
    'context': {
      'person': false,
      'place': true,
      'expression': `contact.contact_type === '${configs.levels[1].place_type}' && user.role === '${configs.levels[2].role}'`,
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
  if (configs.features.stock_supply && configs.features.stock_supply.confirm_supply) {
    await updateStockConfirmation(configs, messages);
  }
}

async function getStockSupplyConfigs({
  languages,
}) {
  const configs = await inquirer.prompt([
    {
      type: 'input',
      name: 'form_name',
      message: 'Enter stock supply form ID'
    },
    ...languages.map((language) => ({
      type: 'input',
      name: `title.${language}`,
      message: `Enter stock supply form title in ${language}`,
      default: 'Stock supply'
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
      },
      ...languages.map((language) => ({
        type: 'input',
        name: `confirm_supply.title.${language}`,
        message: `Enter supply confirmation form title in ${language}`,
        default: 'Stock received'
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
