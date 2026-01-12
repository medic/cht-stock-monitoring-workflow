/**
 * Excel utility functions for working with ExcelJS worksheets
 * Used for reading, writing, and manipulating Excel form data in XLSForm format
 * @module excel-utils
 */

/**
 * Prefix used for all stock monitoring workflow translation keys.
 * This prefix is added to translation keys to namespace them within the CHT app.
 * @constant {string}
 */
const TRANSLATION_PREFIX = 'cht-stock-monitoring-workflow.';

/**
 * Check if an Excel cell value is rich text format
 * Rich text values in ExcelJS have a richText property containing an array of text segments
 * @param {*} value - The cell value to check
 * @returns {boolean} True if the value is rich text, false otherwise
 * @example
 * // Rich text value
 * isRichValue({ richText: [{ text: 'Hello' }] }); // Returns true
 *
 * @example
 * // Plain string value
 * isRichValue('Hello'); // Returns false
 */
function isRichValue(value) {
  return Boolean(value && Array.isArray(value.richText));
}

/**
 * Convert rich text cell value to a plain string
 * Concatenates all text segments from a rich text object into a single string
 * @param {Object} rich - Rich text object with richText array property
 * @param {Array<{text: string}>} rich.richText - Array of text segments with text property
 * @returns {string} Concatenated plain text string
 * @example
 * const richText = { richText: [{ text: 'Hello ' }, { text: 'World' }] };
 * richToString(richText); // Returns 'Hello World'
 */
function richToString(rich) {
  return rich.richText.map(({ text }) => text).join('');
}

/**
 * Get a cell value from a row at the specified column position
 * Handles both plain string and rich text values, trimming whitespace from strings
 * @param {import('exceljs').Row} row - ExcelJS row object
 * @param {number} position - Column position (0-indexed after internal shift for ExcelJS array format)
 * @returns {string|null} The cell value as a string, or null if empty/invalid
 * @example
 * const row = worksheet.getRow(1);
 * const value = getRowValue(row, 0); // Gets value from first column
 */
function getRowValue(row, position) {
  const values = [...row.values];
  values.shift();
  const value = values[position];
  if (value && typeof value === 'string') {
    return value.trim();
  }
  // If it's object (rich text) return the first value
  if (value && isRichValue(value)) {
    return richToString(value);
  }
  return null;
}

/**
 * Find a row with a specific value at a given column position
 * Searches through worksheet rows and returns the first row where the value at the
 * specified position matches the search value
 * @param {import('exceljs').Worksheet} workSheet - ExcelJS worksheet to search
 * @param {string} value - Value to search for in the specified column
 * @param {number} [namePosition=1] - Column position to check (0-indexed)
 * @returns {[number, Object|null]} Tuple of [rowNumber, rowData] where rowData is an object
 *   with column headers as keys, or [-1, null] if not found
 * @example
 * const [rowNum, rowData] = getRowWithValueAtPosition(worksheet, 'patient_id', 1);
 * if (rowNum !== -1) {
 *   console.log('Found at row:', rowNum);
 *   console.log('Row data:', rowData);
 * }
 */
function getRowWithValueAtPosition(workSheet, value, namePosition = 1) {
  let columns = [];

  // Get header row
  const headerRow = workSheet.getRow(1);
  columns = [...headerRow.values];
  columns.shift(); // First element is undefined in ExcelJS

  // Search through rows using for loop (allows early exit)
  for (let rowNumber = 1; rowNumber <= workSheet.rowCount; rowNumber++) {
    const row = workSheet.getRow(rowNumber);
    const rowValue = getRowValue(row, namePosition);

    if (rowValue === value) {
      const rowData = {};
      for (let i = 0; i < columns.length; i++) {
        rowData[columns[i]] = row.values[i + 1];
      }
      return [rowNumber, rowData];
    }
  }

  return [-1, null];
}

/**
 * Get the begin and end row indices for an XLSForm group
 * Handles nested groups correctly by tracking group depth to find the matching end group
 * @param {import('exceljs').Worksheet} workSheet - ExcelJS worksheet (XLSForm survey sheet)
 * @param {string} name - Group name to find (value in name column at begin group row)
 * @param {number} [namePosition=1] - Column position of the name column (0-indexed)
 * @returns {[number, number]} Tuple of [beginGroupRowNumber, endGroupRowNumber], or [-1, -1] if group not found
 * @example
 * // Find the row range for a group named 'patient_info'
 * const [beginRow, endRow] = getSheetGroupBeginEnd(surveySheet, 'patient_info');
 * if (beginRow !== -1) {
 *   console.log(`Group spans rows ${beginRow} to ${endRow}`);
 * }
 */
function getSheetGroupBeginEnd(workSheet, name, namePosition = 1) {
  let endGroupRowNumber = -1;
  const [beginGroupRowNumber] = getRowWithValueAtPosition(workSheet, name, namePosition);
  if (beginGroupRowNumber !== -1) {
    let groupEndFound = false;
    let index = beginGroupRowNumber + 1;
    let otherBeginGroup = 0;
    while (!groupEndFound && index <= workSheet.rowCount) {
      const row = workSheet.getRow(index);
      if (row.values.includes('begin group')) {
        otherBeginGroup++;
      } else if(row.values.includes('end group')) {
        if (otherBeginGroup === 0) {
          endGroupRowNumber = index;
          groupEndFound = true;
        } else {
          otherBeginGroup--;
        }
      }
      index++;
    }
  }
  return [beginGroupRowNumber, endGroupRowNumber];
}

/**
 * Find the row number of the first row with a given name within a specified interval
 * Uses recursive search through the worksheet rows starting from begin+1
 * @param {import('exceljs').Worksheet} workSheet - ExcelJS worksheet to search in
 * @param {string} name - Name value to search for (will be trimmed before comparison)
 * @param {number} begin - Start row of the interval (exclusive - search starts at begin+1)
 * @param {number} end - End row of the interval (inclusive)
 * @param {number} [namePosition=2] - Column position of the name (1-indexed for row.values array)
 * @returns {number} Row number if found, -1 if not found within the interval
 * @example
 * // Search for 'quantity' field between rows 10 and 50
 * const rowNum = getRowNumberWithNameInInterval(worksheet, 'quantity', 10, 50);
 */
function getRowNumberWithNameInInterval(workSheet, name, begin, end, namePosition = 2) {
  const row = workSheet.getRow(begin + 1);
  if (row.values[namePosition] && row.values[namePosition].trim() === name) {
    return begin + 1;
  }
  if (begin+1 < end) {
    return getRowNumberWithNameInInterval(workSheet, name, begin+1, end);
  }
  return -1;
}

/**
 * Find the row number of the last 'end group' row in a worksheet
 * Iterates through all rows to find the final end group marker in an XLSForm
 * @param {import('exceljs').Worksheet} workSheet - ExcelJS worksheet to search (typically survey sheet)
 * @param {number} [typeColumnIndex=0] - Column index for the type column (0-indexed after shift)
 * @returns {number} Row number of the last 'end group', or -1 if no end group found
 * @example
 * const lastEndGroup = getLastGroupIndex(surveySheet);
 * // Insert new rows before the last end group
 */
function getLastGroupIndex(workSheet, typeColumnIndex = 0) {
  let lastEndGroupIndex = -1;
  workSheet.eachRow((row, rowNumber) => {
    const value = getRowValue(row, typeColumnIndex);
    if (value === 'end group') {
      lastEndGroupIndex = rowNumber;
    }
  });
  return lastEndGroupIndex;
}

/**
 * Build a row values array based on header column order
 * Maps an object of named values to an array matching the header structure,
 * filling empty strings for missing values
 * @param {Array<string>} header - Array of column header names defining the column order
 * @param {Object.<string, string>} values - Object with column names as keys and cell values as values
 * @returns {Array<string>} Array of values in header column order, with empty strings for missing values
 * @example
 * const header = ['type', 'name', 'label::en'];
 * const values = { type: 'text', name: 'patient_name', 'label::en': 'Patient Name' };
 * const row = buildRowValues(header, values);
 * // Returns ['text', 'patient_name', 'Patient Name']
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

/**
 * Add category and item choices to an XLSForm choices worksheet
 * Creates choice list entries for both categories and items with multilingual labels
 * @param {Array<Object>} categories - Array of category objects
 * @param {string} categories[].name - Category identifier/value
 * @param {Object.<string, string>} categories[].label - Labels keyed by language code
 * @param {Array<Object>} items - Array of item objects
 * @param {string} items[].name - Item identifier/value
 * @param {Object.<string, string>} items[].label - Labels keyed by language code
 * @param {string} items[].category - Category name for filtering
 * @param {import('exceljs').Worksheet} choiceWorkSheet - ExcelJS worksheet for choices sheet
 * @param {Array<string>} languages - Array of language codes (e.g., ['en', 'fr', 'sw'])
 * @example
 * const categories = [{ name: 'medication', label: { en: 'Medication', fr: 'Medicament' } }];
 * const items = [{ name: 'paracetamol', label: { en: 'Paracetamol', fr: 'Paracetamol' }, category: 'medication' }];
 * addCategoryItemsToChoice(categories, items, choicesSheet, ['en', 'fr']);
 */
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

/**
 * Build contact parent hierarchy rows for XLSForm
 * Creates nested begin/end group structures for parent contacts in the contact hierarchy,
 * used to capture parent contact IDs when submitting forms
 * @param {number} nbParents - Number of parent levels to create (depth of hierarchy)
 * @param {Array<string>} formHeader - Header row values for building rows (column names)
 * @param {Array<string>} languages - Array of language codes for NO_LABEL columns
 * @returns {Array<Array<string>>} Array of row value arrays representing the parent hierarchy groups
 * @example
 * // Create a 2-level parent hierarchy
 * const rows = getContactParentHierarchy(2, surveyHeader, ['en', 'fr']);
 * // Inserts: begin group parent, string _id, begin group parent, string _id, end group, end group
 */
function getContactParentHierarchy(nbParents, formHeader, languages) {
  const contactParentRows = [];
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
      buildRowValues(formHeader, {
        type: 'begin group',
        name: `parent`,
        appearance: `hidden`,
        ...getNoLabelsColums(languages)
      }),
      buildRowValues(formHeader, {
        type: 'string',
        name: '_id',
        ...getNoLabelsColums(languages)
      }),
    );
  }
  for (let i = 0; i < nbParents; i++) {
    contactParentRows.push(
      buildRowValues(formHeader, {
        type: 'end group',
      })
    );
  }
  return contactParentRows;
}

/**
 * Get default survey label and hint columns for a feature form
 * Generates label and hint column arrays for the standard form structure including
 * patient info, source fields, summary headers, and notes
 * @param {string} feature - Feature name for message lookup (e.g., 'stock_count', 'stock_supply')
 * @param {Object.<string, Object>} messages - Messages object keyed by language code, containing feature-specific messages
 * @param {Array<string>} languages - Array of language codes (e.g., ['en', 'fr'])
 * @returns {[Array<Array<string>>, Array<Array<string>>]} Tuple of [labelColumns, hintColumns] where each is an array of column data arrays
 * @example
 * const [labelCols, hintCols] = getDefaultSurveyLabels('stock_count', messages, ['en', 'fr']);
 * // labelCols[0] is the 'label::en' column, labelCols[1] is 'label::fr'
 */
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
        `hint::${language}`,
      ]
    );
  }

  return [labelColumns, hintColumns];
}

/**
 * Create an object with NO_LABEL values for all language label columns
 * Used for hidden fields or fields that should not display a label in the form
 * @param {Array<string>} languages - Array of language codes (e.g., ['en', 'fr', 'sw'])
 * @returns {Object.<string, string>} Object with 'label::language' keys and 'NO_LABEL' values
 * @example
 * const noLabels = getNoLabelsColums(['en', 'fr']);
 * // Returns { 'label::en': 'NO_LABEL', 'label::fr': 'NO_LABEL' }
 */
const getNoLabelsColums = languages => languages.reduce((prev, next) => ({ ...prev, [`label::${next}`]: 'NO_LABEL' }), {});

/**
 * Generate the display string for an item count with unit labels
 * Handles both set-based items (e.g., "3 boxes 5 tablets") and simple unit items (e.g., "15 tablets")
 * Returns XLSForm variable references wrapped in markdown bold syntax
 * @param {Object} item - Item configuration object
 * @param {string} item.name - Item name/identifier used in variable names
 * @param {boolean} item.isInSet - Whether item uses set packaging (box/blister)
 * @param {Object} [item.set] - Set configuration (required if isInSet is true)
 * @param {Object.<string, string>} item.set.label - Set labels keyed by language code
 * @param {Object} item.unit - Unit configuration
 * @param {Object.<string, string>} item.unit.label - Unit labels keyed by language code
 * @param {string} language - Language code for labels (e.g., 'en', 'fr')
 * @param {string} [suffix=''] - Suffix to append to variable names (e.g., '_in', '_out')
 * @param {string} [unitSuffix='___count'] - Suffix for unit count variable name
 * @returns {string} Formatted display string with XLSForm variable references in markdown bold
 * @example
 * // For set-based item
 * const item = { name: 'paracetamol', isInSet: true, set: { label: { en: 'Boxes' } }, unit: { label: { en: 'Tablets' } } };
 * getItemCount(item, 'en'); // Returns '**${paracetamol___set} boxes ${paracetamol___unit} tablets**'
 *
 * @example
 * // For simple unit item
 * const item = { name: 'gloves', isInSet: false, unit: { label: { en: 'Pairs' } } };
 * getItemCount(item, 'en'); // Returns '**${gloves___count} pairs**'
 */
const getItemCount = (item, language, suffix = '', unitSuffix = '___count') => item.isInSet ? '**${'+`${item.name}${suffix}___set`+'} '+item.set.label[language].toLowerCase()+' ${'+`${item.name}${suffix}___unit`+'} '+item.unit.label[language].toLowerCase()+'**' : '**${'+`${item.name}${unitSuffix}`+'} '+item.unit.label[language].toLowerCase()+'**';

module.exports = {
  TRANSLATION_PREFIX,
  isRichValue,
  richToString,
  getRowValue,
  getRowWithValueAtPosition,
  getSheetGroupBeginEnd,
  getRowNumberWithNameInInterval,
  getLastGroupIndex,
  buildRowValues,
  addCategoryItemsToChoice,
  getContactParentHierarchy,
  getDefaultSurveyLabels,
  getNoLabelsColums,
  getItemCount,
};
