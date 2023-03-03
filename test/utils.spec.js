const assert = require('chai').assert;
const path = require('path');
const { getWorkSheet, getRowWithValueAtPosition, getSheetGroupBeginEnd } = require('../src/utils');

let stockCountWorkSheet = null;

describe('Utils', function () {
  before(async function () {
    const stockCountTemplatePath = path.join(__dirname, '../templates/stock_count.xlsx');
    stockCountWorkSheet = await getWorkSheet(stockCountTemplatePath);
    assert.isNotNull(stockCountWorkSheet);
  });
  describe('#getSheetGroupBeginEnd()', function () {
    it('group name = romuald - begin = -1, end = -1', function () {
      const [begin, end] = getSheetGroupBeginEnd(stockCountWorkSheet, 'romuald');
      assert.equal(begin, -1);
      assert.equal(end, -1);
    });
    it('group name = inputs - begin = 2, end = 12', function () {
      const [begin, end] = getSheetGroupBeginEnd(stockCountWorkSheet, 'inputs');
      assert.equal(begin, 2);
      assert.equal(end, 12);
    });
  });
  describe('#getRowWithValueAtPosition()', function () {
    it('row name = romulad - rowWithName = null', async function () {
      const [,rowWithName] = getRowWithValueAtPosition(stockCountWorkSheet, 'romuald');
      assert.isNull(rowWithName);
    });
    it('row name = items - rowWithName.name = items', async function () {
      const [,rowWithName] = getRowWithValueAtPosition(stockCountWorkSheet, 'items');
      assert.isNotNull(rowWithName);
      assert.deepEqual(rowWithName.name, 'items');
    });
  });
});
