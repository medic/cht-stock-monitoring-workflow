const path = require('path');
const fs = require('fs-extra');
const rewire = require('rewire');

describe('Config Manager', () => {
  const testDir = path.join(__dirname, 'test-config-manager');

  beforeEach(() => {
    fs.ensureDirSync(testDir);
    process.chdir(testDir);
    // Clear require cache to ensure fresh module state
    jest.resetModules();
  });

  afterEach(() => {
    process.chdir(path.join(__dirname, '..'));
    fs.removeSync(testDir);
  });

  describe('isAlreadyInit', () => {
    it('should return false when config file does not exist', () => {
      const { isAlreadyInit } = require('../src/config-manager');
      expect(isAlreadyInit(testDir)).toBe(false);
    });

    it('should return true when config file exists', () => {
      fs.writeFileSync(path.join(testDir, 'stock-monitoring.config.json'), '{}');
      const { isAlreadyInit } = require('../src/config-manager');
      expect(isAlreadyInit(testDir)).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('should return undefined when not initialized', () => {
      const { getConfig } = require('../src/config-manager');
      const result = getConfig();
      expect(result).toBeUndefined();
    });

    it('should return parsed config when file exists', () => {
      const config = { version: '1.0.0', languages: ['en'] };
      fs.writeFileSync(path.join(testDir, 'stock-monitoring.config.json'), JSON.stringify(config));
      const { getConfig } = require('../src/config-manager');
      const result = getConfig();
      expect(result).toEqual(config);
    });

    it('should throw on invalid JSON', () => {
      fs.writeFileSync(path.join(testDir, 'stock-monitoring.config.json'), 'not json');
      const { getConfig } = require('../src/config-manager');
      expect(() => getConfig()).toThrow();
    });
  });

  describe('writeConfig', () => {
    it('should write config to file with valid configuration', () => {
      // Setup minimal required files for translation manager
      fs.ensureDirSync(path.join(testDir, 'translations'));
      fs.ensureDirSync(path.join(testDir, 'app_settings'));
      fs.writeFileSync(path.join(testDir, 'translations', 'messages-en.properties'), '');
      fs.writeFileSync(path.join(testDir, 'app_settings', 'base_settings.json'), JSON.stringify({
        locale: 'en',
        locales: [{ code: 'en' }]
      }));

      const config = {
        version: '1.0.0',
        languages: ['en'],
        levels: { facility: { place_type: 'clinic', role: 'nurse' } },
        items: {
          paracetamol: {
            name: 'paracetamol',
            label: { en: 'Paracetamol' },
            unit: { label: { en: 'Tablet' } },
            warning_total: 10,
            danger_total: 5
          }
        },
        features: {}
      };
      const { writeConfig } = require('../src/config-manager');
      writeConfig(config);

      const written = JSON.parse(fs.readFileSync(path.join(testDir, 'stock-monitoring.config.json'), 'utf-8'));
      // Version is auto-populated from package.json if config file doesn't exist
      expect(written.version).toBeDefined();
      expect(written.languages).toEqual(['en']);
      expect(written.items.paracetamol.name).toBe('paracetamol');
    });

    it('should throw ConfigValidationError for invalid config missing required keys', () => {
      const config = { version: '1.0.0', languages: ['en'], features: {} };
      const { writeConfig, ConfigValidationError } = require('../src/config-manager');
      expect(() => writeConfig(config)).toThrow(ConfigValidationError);
    });
  });
});
