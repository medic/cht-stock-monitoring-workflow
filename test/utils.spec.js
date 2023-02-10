const assert = require('chai').assert;
const path = require('path');
const { getWorkSheet, getRowWithName } = require('../src/utils');

describe('Utils', function () {
  describe('#getRowWithName()', function () {
    it('should return null when row with name not present', async function () {
      const stockCountTemplatePath = path.join(__dirname, '../templates/stock_count.xlsx');
      const workSheet = await getWorkSheet(stockCountTemplatePath);
      assert.isNotNull(workSheet);

      const rowWithName = getRowWithName(workSheet, 'romuald');
      assert.isNull(rowWithName);
    });
    it('should return row with property name when row with name is present', async function () {
      const stockCountTemplatePath = path.join(__dirname, '../templates/stock_count.xlsx');
      const workSheet = await getWorkSheet(stockCountTemplatePath);
      assert.isNotNull(workSheet);

      const rowWithName = getRowWithName(workSheet, 'items');
      assert.isNotNull(rowWithName);
      assert.deepEqual({ name: 'items' }, { name: 'items' });
    });
  });
});
