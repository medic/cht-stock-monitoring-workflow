const { getNoLabelsColums, getSheetGroupBeginEnd, buildRowValues, getRowWithValueAtPosition, getTranslations, getNumberOfSteps, getDefaultSurveyLabels,
  getContactParentHierarchy
} = require('../common');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs-extra');
const ExcelJS = require('exceljs');
const { SUPPLY_ADDITIONAL_DOC } = require('../constants');

function addOrderSupplyCalculation(workSheet, items) {
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

function addOrderSupplySummaries(workSheet, items, languages, categories = []) {
  const [, end] = getSheetGroupBeginEnd(workSheet, 'summary');
  const header = workSheet.getRow(1).values;
  header.shift();
  const rows = [];
  if (categories.length > 0) {
    for (const category of categories) {
      const categoryItems = items.filter(it => it.category === category.name);
      rows.push(
        buildRowValues(header, {
          type: 'note',
          name: `${category.name}_summary`,
          appearance: 'h1 blue',
          relevant: categoryItems.map((item) => '${' + item.name + '_ordered} > 0').join(' or '),
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
        }),
        ...categoryItems.map((item) => (buildRowValues(header, {
          type: 'note',
          name: `${item.name}_summary`,
          appearance: 'li',
          relevant: '${' + `${item.name}_ordered` + '} > 0',
          ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.label[language]}: ` + '${' + `supply_${item.name}}` }), {})
        }))),
      );
    }
  } else {
    rows.push(
      ...items.map((item) => ({
        type: 'note',
        name: `${item.name}_summary`,
        appearance: 'li',
        relevant: '${' + `${item.name}_ordered` + '} > 0',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: `${item.name[language]}: ` + '${' + `supply_${item.name}}` }), {})
      }))
    );
  }

  //Insert item
  workSheet.insertRows(
    end,
    rows,
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
      name: 'place_id',
      calculation: '${supply_place_id}'
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 's_order_id',
      calculation: '${order_id}'
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
      type: 'calculate',
      name: 'supplier_id',
      calculation: '${user_contact_id}'
    }),
    buildRowValues(header, {
      type: 'begin group',
      name: 'contact',
      ...getNoLabelsColums(languages)
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
      ...getNoLabelsColums(languages)
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'need_confirmation',
      calculation: needConfirmation ? '"yes"' : '"no"'
    }),
    ...items.map((item) => buildRowValues(header, {
      type: 'calculate', // Row type
      name: `${item.name}_in`, // Row name
      calculation: '${' + `${item.name}_supply}`,
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

function getItemRows(header, languages, items, messages) {
  return items.map((item) => {
    return [
      buildRowValues(header, {
        type: 'begin group',
        name: `___${item.name}`,
        relevant: '${' + item.name + '_ordered} > 0',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: item.label[language] }), {})
      }),
      buildRowValues(header, {
        type: 'note',
        name: `supply_${item.name}_note`,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.supply.message.qty_ordered'].replace('{{qty}}', '${' + `${item.name}_ordered}`) }), {})
      }),
      buildRowValues(header, {
        type: 'decimal',
        name: `supply_${item.name}`,
        required: 'yes',
        default: 0,
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.supply.message.qty'] }), {})
      }),
      buildRowValues(header, {
        type: 'end group',
      }),
    ];
  });
}

async function updateOrderStockSupply(configs) {
  const processDir = process.cwd();
  const featureConfigs = configs.features.stock_order.stock_supply;
  const supplyConfigs = configs.features.stock_supply;
  const { languages } = configs;
  const messages = getTranslations();
  const stockSupplyPath = path.join(processDir, 'forms', 'app', `${featureConfigs.form_name}.xlsx`);
  const items = Object.values(configs.items);
  const categories = Object.values(configs.categories);
  fs.copyFileSync(path.join(__dirname, '../../templates/stock_supply.xlsx'), stockSupplyPath);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(stockSupplyPath);
  const surveyWorkSheet = workbook.getWorksheet('survey');
  const settingWorkSheet = workbook.getWorksheet('settings');

  // Add language column
  const [labelColumns, hintColumns ] = getDefaultSurveyLabels('stock_order.supply', messages, languages);

  // Add languages and hints columns
  const [, firstRowData] = getRowWithValueAtPosition(surveyWorkSheet, 'type', 0);
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

  const header = surveyWorkSheet.getRow(1).values;
  header.shift();
  // Get level 2
  const nbParents = getNumberOfSteps(configs.levels[1].place_type, configs.levels[2].place_type);
  const contactParentRows = getContactParentHierarchy(nbParents, header, languages);
  const [contactPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'contact', 1);
  surveyWorkSheet.insertRows(
    contactPosition + 3,
    contactParentRows,
    'i+'
  );

  // Add inputs
  const inputs = [
    ...items.map((item) => buildRowValues(header, {
      type: 'hidden',
      name: `${item.name}_ordered`,
      ...getNoLabelsColums(languages)
    })),
    buildRowValues(header, {
      type: 'hidden',
      name: 'order_id',
      ...getNoLabelsColums(languages)
    })
  ];
  const [inputPosition,] = getRowWithValueAtPosition(surveyWorkSheet, 'inputs', 1);
  surveyWorkSheet.insertRows(
    inputPosition + 1,
    inputs,
    'i+'
  );

  const rows = [
    buildRowValues(header, {
      type: 'calculate',
      name: 'supply_place_id',
      calculation: `../inputs/contact/_id`
    }),
    buildRowValues(header, {
      type: 'calculate',
      name: 'user_contact_id',
      calculation: `../inputs/user/contact_id`
    })
  ];
  const [position,] = getRowWithValueAtPosition(surveyWorkSheet, 'place_id', 1);
  surveyWorkSheet.getRow(position).getCell(8).value = `../inputs/contact/${Array(nbParents).fill('parent').join('/')}/_id`;
  if (configs.useItemCategory) {
    rows.push(
      ...categories.map((category) => {
        const categoryItems = items.filter((item) => item.category === category.name);
        return [
          buildRowValues(header, {
            type: 'begin group',
            name: category.name,
            appearance: 'field-list',
            relevant: categoryItems.map((item) => '${' + item.name + '_ordered} > 0').join(' or '),
            ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: category.label[language] }), {})
          }),
          ...getItemRows(
            header,
            languages,
            categoryItems,
            messages,
          ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
          buildRowValues(header, {
            type: 'end group',
          }),
        ];
      }).reduce((prev, categoryRows) => ([...prev, ...categoryRows]), []),
    );
  } else {
    rows.push(
      buildRowValues(header, {
        type: 'begin group',
        name: 'supply_order',
        appearance: 'field-list',
        ...languages.reduce((prev, language) => ({ ...prev, [`label::${language}`]: messages[language]['stock_order.label.add_item_qty'] }), {})
      }),
      ...getItemRows(
        header,
        languages,
        items,
        messages,
      ).reduce((prev, itemRows) => ([...prev, ...itemRows]), []),
      buildRowValues(header, {
        type: 'end group',
      }),
    );
  }
  surveyWorkSheet.insertRows(
    position + 1,
    rows,
    'i+'
  );
  addOrderSupplySummaries(surveyWorkSheet, Object.values(configs.items), languages, categories);
  addOrderSupplyCalculation(surveyWorkSheet, Object.values(configs.items));
  const [, end] = getSheetGroupBeginEnd(surveyWorkSheet, 'out');
  const additionalDocRows = getAdditionalDoc(featureConfigs.form_name, languages, header, items, supplyConfigs.confirm_supply.active);
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
      'place': false,
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

module.exports = {
  updateOrderStockSupply,
};
