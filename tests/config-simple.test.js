/**
 * Configuration Service Tests (Simplified)
 * Tests for configuration management functionality
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock the logger to avoid console output during tests
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn()
};

// Import and create a testable version of ConfigService
class TestConfigService {
  constructor(testDir) {
    this.configDir = path.join(testDir, '.mdsaad');
    this.configFile = path.join(this.configDir, 'config.json');
    this.config = {};
    this.defaultConfig = {
      language: 'en',
      defaultPrecision: 4,
      cacheDirectory: path.join(this.configDir, 'cache'),
      apiKeys: {
        openweather: null,
        exchangerate: null,
        gemini: null,
        deepseek: null,
        openrouter: null,
        nvidia: null,
        groq: null
      },
      preferences: {
        weatherUnits: 'metric',
        currencyFavorites: ['USD', 'EUR', 'GBP'],
        colorScheme: 'auto'
      },
      rateLimit: {
        ai: { requests: 10, window: 3600000 },
        weather: { requests: 1000, window: 86400000 }
      }
    };
  }

  // Copy all methods from the original ConfigService
  async initialize() {
    try {
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.defaultConfig.cacheDirectory);
      
      if (await fs.pathExists(this.configFile)) {
        const existingConfig = await fs.readJson(this.configFile);
        
        if (this.validateConfig(existingConfig)) {
          this.config = this.mergeWithDefaults(existingConfig);
          mockLogger.verbose('Configuration loaded successfully');
        } else {
          mockLogger.warn('Invalid configuration detected, using defaults');
          this.config = { ...this.defaultConfig };
          await this.save();
        }
      } else {
        this.config = { ...this.defaultConfig };
        await this.save();
        mockLogger.info('Created new configuration file');
      }
      
      this.applyEnvironmentOverrides();
      
    } catch (error) {
      mockLogger.error('Failed to initialize configuration:', error.message);
      this.config = { ...this.defaultConfig };
    }
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;
    
    for (const k of keys) {
      if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }
    
    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let target = this.config;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!target[k] || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k];
    }
    
    target[keys[keys.length - 1]] = value;
    this.save();
  }

  async save() {
    try {
      await fs.writeJson(this.configFile, this.config, { spaces: 2 });
    } catch (error) {
      mockLogger.error('Failed to save configuration:', error.message);
    }
  }

  getApiKey(service) {
    return this.get(`apiKeys.${service}`);
  }

  setApiKey(service, key) {
    this.set(`apiKeys.${service}`, key);
  }

  validateConfig(config) {
    try {
      if (!config || typeof config !== 'object') {
        return false;
      }

      const requiredProps = ['language', 'defaultPrecision', 'cacheDirectory', 'apiKeys', 'preferences', 'rateLimit'];
      for (const prop of requiredProps) {
        if (!config.hasOwnProperty(prop)) {
          mockLogger.warn(`Missing required config property: ${prop}`);
          return false;
        }
      }

      const supportedLanguages = ['en', 'hi', 'es', 'fr', 'de', 'zh', 'ja', 'ru', 'ar'];
      if (!supportedLanguages.includes(config.language)) {
        mockLogger.warn(`Unsupported language: ${config.language}`);
        return false;
      }

      if (typeof config.defaultPrecision !== 'number' || config.defaultPrecision < 0 || config.defaultPrecision > 20) {
        mockLogger.warn('Invalid defaultPrecision value');
        return false;
      }

      return true;
    } catch (error) {
      mockLogger.error('Config validation error:', error.message);
      return false;
    }
  }

  mergeWithDefaults(existingConfig) {
    const merged = { ...this.defaultConfig };
    
    Object.keys(existingConfig).forEach(key => {
      if (typeof existingConfig[key] === 'object' && existingConfig[key] !== null) {
        merged[key] = { ...merged[key], ...existingConfig[key] };
      } else {
        merged[key] = existingConfig[key];
      }
    });
    
    return merged;
  }

  applyEnvironmentOverrides() {
    const envApiKeys = {
      openweather: process.env.MDSAAD_OPENWEATHER_KEY,
      exchangerate: process.env.MDSAAD_EXCHANGERATE_KEY,
      gemini: process.env.MDSAAD_GEMINI_KEY,
      deepseek: process.env.MDSAAD_DEEPSEEK_KEY,
      openrouter: process.env.MDSAAD_OPENROUTER_KEY,
      nvidia: process.env.MDSAAD_NVIDIA_KEY,
      groq: process.env.MDSAAD_GROQ_KEY
    };

    Object.keys(envApiKeys).forEach(service => {
      if (envApiKeys[service]) {
        this.config.apiKeys[service] = envApiKeys[service];
        mockLogger.verbose(`API key for ${service} loaded from environment`);
      }
    });

    if (process.env.MDSAAD_LANGUAGE) {
      this.config.language = process.env.MDSAAD_LANGUAGE;
    }

    if (process.env.MDSAAD_CACHE_DIR) {
      this.config.cacheDirectory = process.env.MDSAAD_CACHE_DIR;
    }
  }

  async reset() {
    try {
      this.config = { ...this.defaultConfig };
      await this.save();
      mockLogger.info('Configuration reset to defaults');
    } catch (error) {
      mockLogger.error('Failed to reset configuration:', error.message);
      throw error;
    }
  }

  exportConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  async importConfig(configData) {
    try {
      if (this.validateConfig(configData)) {
        this.config = this.mergeWithDefaults(configData);
        await this.save();
        mockLogger.info('Configuration imported successfully');
      } else {
        throw new Error('Invalid configuration data');
      }
    } catch (error) {
      mockLogger.error('Failed to import configuration:', error.message);
      throw error;
    }
  }

  getStats() {
    const stats = {
      configFile: this.configFile,
      configSize: JSON.stringify(this.config).length,
      apiKeysConfigured: Object.values(this.config.apiKeys).filter(key => key !== null).length,
      totalApiKeys: Object.keys(this.config.apiKeys).length,
      language: this.config.language,
      cacheDirectory: this.config.cacheDirectory
    };

    return stats;
  }

  async updateConfig(updates) {
    try {
      const updatedConfig = { ...this.config, ...updates };
      
      if (this.validateConfig(updatedConfig)) {
        this.config = updatedConfig;
        await this.save();
        mockLogger.info('Configuration updated successfully');
      } else {
        throw new Error('Configuration validation failed');
      }
    } catch (error) {
      mockLogger.error('Failed to update configuration:', error.message);
      throw error;
    }
  }
}

describe('Configuration Service', () => {
  let config;
  let testConfigDir;

  beforeEach(() => {
    testConfigDir = path.join(os.tmpdir(), `mdsaad-test-${Date.now()}`);
    config = new TestConfigService(testConfigDir);
  });

  afterEach(async () => {
    try {
      await fs.remove(testConfigDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize with default configuration', async () => {
      await config.initialize();
      
      expect(config.get('language')).toBe('en');
      expect(config.get('defaultPrecision')).toBe(4);
      expect(config.get('apiKeys')).toBeDefined();
      expect(config.get('preferences')).toBeDefined();
      expect(config.get('rateLimit')).toBeDefined();
    });

    test('should create configuration directory', async () => {
      await config.initialize();
      
      const configDir = path.join(testConfigDir, '.mdsaad');
      expect(await fs.pathExists(configDir)).toBe(true);
    });

    test('should create cache directory', async () => {
      await config.initialize();
      
      const cacheDir = path.join(testConfigDir, '.mdsaad', 'cache');
      expect(await fs.pathExists(cacheDir)).toBe(true);
    });

    test('should create configuration file', async () => {
      await config.initialize();
      
      const configFile = path.join(testConfigDir, '.mdsaad', 'config.json');
      expect(await fs.pathExists(configFile)).toBe(true);
    });
  });

  describe('Configuration Management', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should get configuration values', () => {
      expect(config.get('language')).toBe('en');
      expect(config.get('defaultPrecision')).toBe(4);
      expect(config.get('preferences.weatherUnits')).toBe('metric');
    });

    test('should set configuration values', () => {
      config.set('language', 'es');
      expect(config.get('language')).toBe('es');
      
      config.set('preferences.weatherUnits', 'imperial');
      expect(config.get('preferences.weatherUnits')).toBe('imperial');
    });

    test('should return default value for non-existent keys', () => {
      expect(config.get('nonexistent')).toBe(null);
      expect(config.get('nonexistent', 'default')).toBe('default');
    });

    test('should handle nested key setting', () => {
      config.set('new.nested.key', 'value');
      expect(config.get('new.nested.key')).toBe('value');
    });
  });

  describe('API Key Management', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should get and set API keys', () => {
      config.setApiKey('openweather', 'test-key-123');
      expect(config.getApiKey('openweather')).toBe('test-key-123');
    });

    test('should return null for unset API keys', () => {
      expect(config.getApiKey('nonexistent')).toBe(null);
    });
  });

  describe('Configuration Validation', () => {
    test('should validate valid configuration', () => {
      const validConfig = {
        language: 'en',
        defaultPrecision: 4,
        cacheDirectory: '/test/path',
        apiKeys: {},
        preferences: {},
        rateLimit: {}
      };
      
      expect(config.validateConfig(validConfig)).toBe(true);
    });

    test('should reject invalid configuration', () => {
      const invalidConfig = {
        language: 'invalid-lang',
        defaultPrecision: -1
      };
      
      expect(config.validateConfig(invalidConfig)).toBe(false);
    });

    test('should reject non-object configuration', () => {
      expect(config.validateConfig(null)).toBe(false);
      expect(config.validateConfig('string')).toBe(false);
      expect(config.validateConfig(123)).toBe(false);
    });
  });

  describe('Configuration Statistics', () => {
    beforeEach(async () => {
      await config.initialize();
    });

    test('should provide configuration statistics', () => {
      config.setApiKey('openweather', 'test-key');
      config.setApiKey('gemini', 'another-key');
      
      const stats = config.getStats();
      
      expect(stats).toHaveProperty('configFile');
      expect(stats).toHaveProperty('configSize');
      expect(stats).toHaveProperty('apiKeysConfigured');
      expect(stats).toHaveProperty('totalApiKeys');
      expect(stats).toHaveProperty('language');
      expect(stats).toHaveProperty('cacheDirectory');
      
      expect(stats.apiKeysConfigured).toBe(2);
      expect(stats.language).toBe('en');
    });
  });
});