/**
 * Configuration Service Unit Tests
 */

const fs = require('fs-extra');
const path = require('path');
const config = require('../../src/services/config');

describe('Configuration Service', () => {
  beforeEach(async () => {
    // Reset configuration state
    await config.reset();
    await global.testUtils.setupTestDirs();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
  });

  describe('initialization', () => {
    test('should initialize with default configuration', async () => {
      await config.initialize();

      expect(config.get('language')).toBe('en');
      expect(config.get('theme')).toBe('default');
      expect(config.get('cacheEnabled')).toBe(true);
    });

    test('should create config directory if it does not exist', async () => {
      await config.initialize();

      const configExists = await fs.pathExists(
        global.testUtils.TEST_CONFIG_DIR
      );
      expect(configExists).toBe(true);
    });

    test('should load existing configuration file', async () => {
      const customConfig = {
        language: 'es',
        theme: 'dark',
        cacheEnabled: false,
      };

      await global.testUtils.createMockConfig(customConfig);
      await config.initialize();

      expect(config.get('language')).toBe('es');
      expect(config.get('theme')).toBe('dark');
      expect(config.get('cacheEnabled')).toBe(false);
    });
  });

  describe('get and set operations', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should get configuration values', () => {
      expect(config.get('language')).toBe('en');
      expect(config.get('nonexistent')).toBeUndefined();
      expect(config.get('nonexistent', 'default')).toBe('default');
    });

    test('should set configuration values', () => {
      config.set('language', 'fr');
      expect(config.get('language')).toBe('fr');
    });

    test('should set nested configuration values', () => {
      config.set('api.weather.key', 'test-key');
      expect(config.get('api.weather.key')).toBe('test-key');
    });

    test('should handle complex objects', () => {
      const complexValue = {
        enabled: true,
        settings: {
          timeout: 5000,
          retries: 3,
        },
      };

      config.set('complex', complexValue);
      expect(config.get('complex')).toEqual(complexValue);
    });
  });

  describe('configuration persistence', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should save configuration to file', async () => {
      config.set('language', 'de');
      config.set('theme', 'dark');

      await config.save();

      const configPath = path.join(
        global.testUtils.TEST_CONFIG_DIR,
        'config.json'
      );
      const savedConfig = await fs.readJson(configPath);

      expect(savedConfig.language).toBe('de');
      expect(savedConfig.theme).toBe('dark');
    });

    test('should handle save errors gracefully', async () => {
      // Make directory read-only to force save error
      const configPath = path.join(
        global.testUtils.TEST_CONFIG_DIR,
        'config.json'
      );

      // Mock fs.writeJson to throw error
      jest
        .spyOn(fs, 'writeJson')
        .mockRejectedValueOnce(new Error('Permission denied'));

      await expect(config.save()).resolves.not.toThrow();
    });
  });

  describe('API key management', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should set and get API keys', () => {
      config.setApiKey('weather', 'weather-api-key');
      expect(config.getApiKey('weather')).toBe('weather-api-key');
    });

    test('should return null for non-existent API keys', () => {
      expect(config.getApiKey('nonexistent')).toBeNull();
    });

    test('should list all API keys', () => {
      config.setApiKey('weather', 'weather-key');
      config.setApiKey('currency', 'currency-key');

      const keys = config.listApiKeys();
      expect(keys).toEqual(['weather', 'currency']);
    });

    test('should remove API keys', () => {
      config.setApiKey('temp', 'temp-key');
      expect(config.getApiKey('temp')).toBe('temp-key');

      config.removeApiKey('temp');
      expect(config.getApiKey('temp')).toBeNull();
    });
  });

  describe('configuration validation', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should validate language codes', () => {
      expect(config.isValidLanguage('en')).toBe(true);
      expect(config.isValidLanguage('es')).toBe(true);
      expect(config.isValidLanguage('invalid')).toBe(false);
    });

    test('should validate theme names', () => {
      expect(config.isValidTheme('default')).toBe(true);
      expect(config.isValidTheme('dark')).toBe(true);
      expect(config.isValidTheme('invalid')).toBe(false);
    });

    test('should validate configuration values', () => {
      expect(() => config.set('language', 'invalid')).toThrow();
      expect(() => config.set('theme', 'invalid')).toThrow();
      expect(() => config.set('cacheEnabled', 'not-boolean')).toThrow();
    });
  });

  describe('configuration reset', () => {
    test('should reset configuration to defaults', async () => {
      await config.initialize();

      config.set('language', 'es');
      config.set('theme', 'dark');
      config.setApiKey('test', 'test-key');

      await config.reset();

      expect(config.get('language')).toBe('en');
      expect(config.get('theme')).toBe('default');
      expect(config.getApiKey('test')).toBeNull();
    });

    test('should remove configuration file on reset', async () => {
      await config.initialize();
      await config.save();

      const configPath = path.join(
        global.testUtils.TEST_CONFIG_DIR,
        'config.json'
      );
      expect(await fs.pathExists(configPath)).toBe(true);

      await config.reset();
      expect(await fs.pathExists(configPath)).toBe(false);
    });
  });

  describe('configuration export/import', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should export configuration', () => {
      config.set('language', 'fr');
      config.setApiKey('test', 'test-key');

      const exported = config.export();

      expect(exported.language).toBe('fr');
      expect(exported.apiKeys.test).toBe('test-key');
    });

    test('should import configuration', () => {
      const importData = {
        language: 'de',
        theme: 'dark',
        apiKeys: {
          weather: 'weather-key',
        },
      };

      config.import(importData);

      expect(config.get('language')).toBe('de');
      expect(config.get('theme')).toBe('dark');
      expect(config.getApiKey('weather')).toBe('weather-key');
    });

    test('should validate imported configuration', () => {
      const invalidImport = {
        language: 'invalid',
        theme: 'invalid',
      };

      expect(() => config.import(invalidImport)).toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle missing config directory', async () => {
      // Remove the test directory
      await fs.remove(global.testUtils.TEST_DIR);

      await expect(config.initialize()).resolves.not.toThrow();

      // Directory should be created
      expect(await fs.pathExists(global.testUtils.TEST_CONFIG_DIR)).toBe(true);
    });

    test('should handle corrupted config file', async () => {
      // Create corrupted config file
      const configPath = path.join(
        global.testUtils.TEST_CONFIG_DIR,
        'config.json'
      );
      await fs.writeFile(configPath, 'invalid json content');

      await expect(config.initialize()).resolves.not.toThrow();

      // Should fall back to defaults
      expect(config.get('language')).toBe('en');
    });

    test('should handle read permission errors', async () => {
      // Create config file then mock read error
      await global.testUtils.createMockConfig();

      jest
        .spyOn(fs, 'readJson')
        .mockRejectedValueOnce(new Error('Permission denied'));

      await expect(config.initialize()).resolves.not.toThrow();
    });
  });

  describe('configuration watching', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should detect configuration changes', async () => {
      let changeDetected = false;

      config.onChange(() => {
        changeDetected = true;
      });

      config.set('language', 'es');

      // Wait for change detection
      await global.testUtils.wait(50);

      expect(changeDetected).toBe(true);
    });

    test('should support multiple change listeners', async () => {
      let changes = 0;

      config.onChange(() => changes++);
      config.onChange(() => changes++);

      config.set('language', 'fr');

      await global.testUtils.wait(50);

      expect(changes).toBe(2);
    });
  });
});
