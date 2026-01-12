# Code Conventions

This document outlines the coding conventions and standards for the CHT Stock Monitoring Workflow project.

## File Naming

### Standard: kebab-case for files

All JavaScript source files should use **kebab-case** (lowercase with hyphens):

```
✓ stock-count.js
✓ config-manager.js
✓ translation-manager.js
✓ add-item.js

✗ stockCount.js
✗ stock_count.js
✗ StockCount.js
```

### Exceptions

- `constants.js` - Single-word files don't need hyphens
- Test files: `*.spec.js` suffix (e.g., `config-manager.spec.js`)
- Benchmark files: `*.bench.js` suffix (e.g., `performance.bench.js`)

## Function Naming

### Standard: camelCase for functions

```javascript
// ✓ Correct
function getStockCount() {}
function updateTranslations() {}
function validateConfig() {}

// ✗ Incorrect
function get_stock_count() {}
function GetStockCount() {}
```

### Naming Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `get*` | Retrieve data | `getConfig()`, `getTranslations()` |
| `update*` | Modify existing data | `updateStockCount()`, `updateForm()` |
| `create*` | Create new data | `createConfigBackup()` |
| `validate*` | Validate data | `validateConfig()`, `validateItem()` |
| `is*` / `has*` | Boolean checks | `isAlreadyInit()`, `hasFeature()` |
| `build*` | Construct objects | `buildRowValues()`, `buildItem()` |

## Variable Naming

### Constants

Use `SCREAMING_SNAKE_CASE` for true constants:

```javascript
const TRANSLATION_PREFIX = 'cht-stock-monitoring-workflow.';
const MAX_RETRIES = 3;

const COMMANDS = {
  INIT: 'init',
  BUILD: 'build',
};
```

### Boolean Variables

Prefix with `is`, `has`, `should`, or `can`:

```javascript
// ✓ Correct
const isValid = true;
const hasItems = items.length > 0;
const shouldMigrate = version < currentVersion;

// ✗ Incorrect
const valid = true;
const itemsExist = items.length > 0;
```

### Collections

Use plural nouns for arrays/collections:

```javascript
const items = [];        // Array of items
const languages = ['en', 'fr'];
const categoryMap = {};  // Object used as map
```

## Module Structure

### Export Pattern

Prefer named exports over default exports:

```javascript
// ✓ Preferred
module.exports = {
  getConfig,
  writeConfig,
  validateConfig,
};

// Use sparingly
module.exports = MyClass;
```

### Import Order

1. Node.js built-in modules
2. External dependencies
3. Internal modules (absolute paths)
4. Internal modules (relative paths)

```javascript
// 1. Built-in
const path = require('path');
const fs = require('fs');

// 2. External
const chalk = require('chalk');
const ExcelJS = require('exceljs');

// 3. Internal
const { getConfig } = require('./config-manager');
const { COMMANDS } = require('./constants');
```

## Error Handling

### Custom Error Classes

Create specific error classes for different error types:

```javascript
class ConfigValidationError extends Error {
  constructor(message, path = null) {
    super(message);
    this.name = 'ConfigValidationError';
    this.path = path;
  }
}
```

### Error Messages

- Be specific about what went wrong
- Include context (file path, item name, etc.)
- Suggest a fix when possible

```javascript
// ✓ Good
throw new Error(`Item "${itemName}" must have a label object`);

// ✗ Bad
throw new Error('Invalid item');
```

## Comments and Documentation

### JSDoc for Public Functions

All exported functions should have JSDoc:

```javascript
/**
 * Get configuration from stock-monitoring.config.json
 * @param {Object} [options] - Options for loading config
 * @param {boolean} [options.validateOnLoad=false] - Whether to validate
 * @returns {Object|undefined} The configuration object
 * @throws {Error} If the config file cannot be read
 * @example
 * const config = getConfig({ validateOnLoad: true });
 */
function getConfig(options = {}) {
  // ...
}
```

### Inline Comments

- Explain **why**, not **what**
- Use for complex logic or non-obvious decisions

```javascript
// ✓ Good - explains why
// Create backup before writing to prevent data loss on failure
const backupPath = createConfigBackup(configFilePath);

// ✗ Bad - states the obvious
// Create a backup
const backupPath = createConfigBackup(configFilePath);
```

## Testing

### Test File Location

Tests should mirror the source structure:

```
src/
  config-manager.js
  excel-utils.js
test/
  config-manager.spec.js
  excel-utils.spec.js
```

### Test Naming

Use descriptive test names that explain the expected behavior:

```javascript
describe('Config Manager', () => {
  describe('getConfig', () => {
    it('should return undefined when not initialized', () => {});
    it('should throw on invalid JSON', () => {});
  });
});
```

## Async/Await

### Prefer async/await over callbacks

```javascript
// ✓ Preferred
async function updateStockCount(configs) {
  try {
    await workbook.xlsx.readFile(path);
    // ...
    await workbook.xlsx.writeFile(path);
  } catch (err) {
    console.error(`Failed: ${err.message}`);
    throw err;
  }
}

// ✗ Avoid callback hell
workbook.xlsx.readFile(path, (err, data) => {
  if (err) { /* ... */ }
  // Nested callbacks...
});
```

## Magic Values

### Avoid magic strings and numbers

```javascript
// ✓ Good
const { COMMANDS, ADD_TYPES } = require('./constants');

if (action === COMMANDS.INIT) {
  // ...
}

// ✗ Bad
if (action === 'init') {
  // ...
}
```

---

## File Operations

### Async vs Sync I/O

This CLI tool uses a mix of async and sync file operations:

**Async operations** (preferred for large files):
```javascript
// Excel files are always read/written asynchronously
await workbook.xlsx.readFile(path);
await workbook.xlsx.writeFile(path);
```

**Sync operations** (acceptable for small config files):
```javascript
// Small JSON files (<1KB) use sync for simplicity
fs.writeFileSync(propertyPath, JSON.stringify(config, null, 4));
const config = JSON.parse(fs.readFileSync(configPath));
```

**Design Decision**: Sync operations are intentionally used for small config/properties files because:
1. These files are typically <1KB (fast I/O)
2. CLI tools run sequentially, not concurrently
3. Sync code is simpler and equally performant for small files
4. Heavy I/O (Excel files) is already async

---

## Migration Notes

### Legacy Code

Some legacy code may not follow these conventions. When modifying legacy code:

1. Follow existing patterns within that file for consistency
2. Consider refactoring if making significant changes
3. Document any backward compatibility constraints

### Backward Compatibility

Some values are kept for backward compatibility even if they contain typos:

```javascript
// Note: Value 'descrepancy_doc' is intentionally kept misspelled for backward
// compatibility with existing CHT deployments. Do not change without migration.
DISCREPANCY_ADD_DOC: 'descrepancy_doc',
```
