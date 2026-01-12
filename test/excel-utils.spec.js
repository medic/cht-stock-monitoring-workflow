const { buildRowValues, getNoLabelsColums } = require('../src/excel-utils');

describe('Excel Utils', () => {
  describe('buildRowValues', () => {
    it('should build row values in header order', () => {
      const header = ['type', 'name', 'label'];
      const values = { type: 'integer', name: 'count', label: 'Count' };
      const result = buildRowValues(header, values);
      expect(result).toEqual(['integer', 'count', 'Count']);
    });

    it('should handle missing values', () => {
      const header = ['type', 'name', 'label', 'hint'];
      const values = { type: 'integer', name: 'count' };
      const result = buildRowValues(header, values);
      expect(result).toEqual(['integer', 'count', '', '']);
    });

    it('should handle null header cells', () => {
      const header = ['type', null, 'name'];
      const values = { type: 'integer', name: 'count' };
      const result = buildRowValues(header, values);
      expect(result).toEqual(['integer', '', 'count']);
    });
  });

  describe('getNoLabelsColums', () => {
    it('should generate NO_LABEL for each language', () => {
      const result = getNoLabelsColums(['en', 'fr']);
      expect(result).toEqual({
        'label::en': 'NO_LABEL',
        'label::fr': 'NO_LABEL'
      });
    });

    it('should handle single language', () => {
      const result = getNoLabelsColums(['en']);
      expect(result).toEqual({ 'label::en': 'NO_LABEL' });
    });
  });
});
