/**
 * Configuration Management Service
 * Handles user preferences, API keys, and application settings
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const logger = require('./logger');

class ConfigService {
  constructor() {
    this.configDir = path.join(os.homedir(), '.mdsaad');
    this.configFile = path.join(this.configDir, 'config.json');
    this.config = {};
    this.isInitialized = false;
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
        groq: null,
      },
      preferences: {
        weatherUnits: 'metric',
        currencyFavorites: ['USD', 'EUR', 'GBP'],
        colorScheme: 'auto',
      },
      rateLimit: {
        ai: { requests: 10, window: 3600000 }, // 10 requests per hour
        weather: { requests: 1000, window: 86400000 }, // 1000 requests per day
      },
    };
  }

  async initialize() {
    try {
      // Ensure config directory exists
      await fs.ensureDir(this.configDir);
      await fs.ensureDir(this.defaultConfig.cacheDirectory);

      // Load existing config or create default
      if (await fs.pathExists(this.configFile)) {
        const existingConfig = await fs.readJson(this.configFile);

        // Validate the existing config
        if (this.validateConfig(existingConfig)) {
          this.config = this.mergeWithDefaults(existingConfig);
          logger.verbose('Configuration loaded successfully');
        } else {
          logger.warn('Invalid configuration detected, using defaults');
          this.config = { ...this.defaultConfig };
          await this.save();
        }
      } else {
        this.config = { ...this.defaultConfig };
        await this.save();
        logger.info('Created new configuration file');
      }

      // Set up environment variable overrides
      this.applyEnvironmentOverrides();

      this.isInitialized = true;
    } catch (error) {
      logger.error('Failed to initialize configuration:', error.message);
      this.config = { ...this.defaultConfig };
      this.isInitialized = true;
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

  getAll() {
    return { ...this.config };
  }

  setAll(newConfig) {
    this.config = { ...newConfig };
    this.save();
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
      console.error('Failed to save configuration:', error.message);
    }
  }

  getConfigPath() {
    return this.configFile;
  }

  getCacheDir() {
    const cacheDir = this.get('cacheDirectory');
    if (!cacheDir) {
      // Fallback to default cache directory
      return path.join(this.configDir, 'cache');
    }
    return cacheDir;
  }

  getApiKey(service) {
    return this.get(`apiKeys.${service}`);
  }

  setApiKey(service, key) {
    this.set(`apiKeys.${service}`, key);
  }

  /**
   * Validate configuration structure and values
   */
  validateConfig(config) {
    try {
      // Check if config is an object
      if (!config || typeof config !== 'object') {
        return false;
      }

      // Validate required top-level properties
      const requiredProps = [
        'language',
        'defaultPrecision',
        'cacheDirectory',
        'apiKeys',
        'preferences',
        'rateLimit',
      ];
      for (const prop of requiredProps) {
        if (!config.hasOwnProperty(prop)) {
          logger.warn(`Missing required config property: ${prop}`);
          return false;
        }
      }

      // Validate language
      const supportedLanguages = [
        'en',
        'hi',
        'es',
        'fr',
        'de',
        'zh',
        'ja',
        'ru',
        'ar',
      ];
      if (!supportedLanguages.includes(config.language)) {
        logger.warn(`Unsupported language: ${config.language}`);
        return false;
      }

      // Validate precision
      if (
        typeof config.defaultPrecision !== 'number' ||
        config.defaultPrecision < 0 ||
        config.defaultPrecision > 20
      ) {
        logger.warn('Invalid defaultPrecision value');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Config validation error:', error.message);
      return false;
    }
  }

  /**
   * Merge existing config with defaults to add new properties
   */
  mergeWithDefaults(existingConfig) {
    const merged = { ...this.defaultConfig };

    // Deep merge nested objects
    Object.keys(existingConfig).forEach(key => {
      if (
        typeof existingConfig[key] === 'object' &&
        existingConfig[key] !== null
      ) {
        merged[key] = { ...merged[key], ...existingConfig[key] };
      } else {
        merged[key] = existingConfig[key];
      }
    });

    return merged;
  }

  /**
   * Apply environment variable overrides for CI/CD
   */
  applyEnvironmentOverrides() {
    // API Keys from environment
    const envApiKeys = {
      openweather: process.env.MDSAAD_OPENWEATHER_KEY,
      exchangerate: process.env.MDSAAD_EXCHANGERATE_KEY,
      gemini: process.env.MDSAAD_GEMINI_KEY,
      deepseek: process.env.MDSAAD_DEEPSEEK_KEY,
      openrouter: process.env.MDSAAD_OPENROUTER_KEY,
      nvidia: process.env.MDSAAD_NVIDIA_KEY,
      groq: process.env.MDSAAD_GROQ_KEY,
    };

    Object.keys(envApiKeys).forEach(service => {
      if (envApiKeys[service]) {
        this.config.apiKeys[service] = envApiKeys[service];
        logger.verbose(`API key for ${service} loaded from environment`);
      }
    });

    // Other environment overrides
    if (process.env.MDSAAD_LANGUAGE) {
      this.config.language = process.env.MDSAAD_LANGUAGE;
    }

    if (process.env.MDSAAD_CACHE_DIR) {
      this.config.cacheDirectory = process.env.MDSAAD_CACHE_DIR;
    }
  }

  /**
   * Reset configuration to defaults
   */
  async reset() {
    try {
      this.config = { ...this.defaultConfig };
      await this.save();
      logger.info('Configuration reset to defaults');
    } catch (error) {
      logger.error('Failed to reset configuration:', error.message);
      throw error;
    }
  }

  /**
   * Export configuration for backup
   */
  exportConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Import configuration from backup
   */
  async importConfig(configData) {
    try {
      if (this.validateConfig(configData)) {
        this.config = this.mergeWithDefaults(configData);
        await this.save();
        logger.info('Configuration imported successfully');
      } else {
        throw new Error('Invalid configuration data');
      }
    } catch (error) {
      logger.error('Failed to import configuration:', error.message);
      throw error;
    }
  }

  /**
   * Get configuration statistics
   */
  getStats() {
    const stats = {
      configFile: this.configFile,
      configSize: JSON.stringify(this.config).length,
      apiKeysConfigured: Object.values(this.config.apiKeys).filter(
        key => key !== null
      ).length,
      totalApiKeys: Object.keys(this.config.apiKeys).length,
      language: this.config.language,
      cacheDirectory: this.config.cacheDirectory,
    };

    return stats;
  }

  /**
   * Update configuration with validation
   */
  async updateConfig(updates) {
    try {
      const updatedConfig = { ...this.config, ...updates };

      if (this.validateConfig(updatedConfig)) {
        this.config = updatedConfig;
        await this.save();
        logger.info('Configuration updated successfully');
      } else {
        throw new Error('Configuration validation failed');
      }
    } catch (error) {
      logger.error('Failed to update configuration:', error.message);
      throw error;
    }
  }
}

module.exports = new ConfigService();
