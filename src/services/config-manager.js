/**
 * Enhanced Configuration Manager
 * Manages user preferences, themes, API keys, and settings
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.mdsaad');
    this.configFile = path.join(this.configDir, 'config.json');
    this.keysFile = path.join(this.configDir, 'keys.json');
    this.preferencesFile = path.join(this.configDir, 'preferences.json');
    this.historyFile = path.join(this.configDir, 'history.json');
    
    this.defaultConfig = {
      version: '1.0.0',
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      
      // Display preferences
      display: {
        theme: 'default',
        colorScheme: 'auto', // auto, light, dark
        animations: true,
        emojis: true,
        progressBars: true,
        tables: true,
        formatting: 'enhanced' // basic, enhanced, minimal
      },
      
      // Output preferences
      output: {
        verbose: false,
        debug: false,
        showTimestamps: false,
        showMetrics: true,
        pageSize: 20,
        maxWidth: 120,
        wrapText: true
      },
      
      // Language and localization
      locale: {
        language: 'en',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        dateFormat: 'YYYY-MM-DD',
        timeFormat: '24h',
        currency: 'USD'
      },
      
      // Command defaults
      commands: {
        weather: {
          defaultLocation: null,
          units: 'metric',
          showAlerts: true,
          cacheTime: 300 // 5 minutes
        },
        ai: {
          defaultModel: 'gemini',
          defaultProvider: 'google',
          temperature: 0.7,
          maxTokens: 1000,
          stream: true,
          context: true
        },
        convert: {
          defaultPrecision: 4,
          showRates: false,
          autoFavorites: true,
          cacheTime: 3600 // 1 hour
        },
        calculate: {
          precision: 10,
          showHistory: false,
          angleUnit: 'radians' // radians, degrees
        }
      },
      
      // Performance settings
      performance: {
        caching: true,
        cacheTTL: 3600,
        maxCacheSize: 100,
        requestTimeout: 30000,
        retryAttempts: 3,
        rateLimiting: true
      },
      
      // Privacy settings
      privacy: {
        trackUsage: false,
        shareErrors: false,
        logLevel: 'info', // error, warn, info, debug
        anonymizeData: true
      }
    };

    this.defaultPreferences = {
      favorites: {
        conversions: [],
        locations: [],
        calculations: [],
        aiPrompts: []
      },
      
      shortcuts: {},
      
      customCommands: {},
      
      themes: {
        custom: {}
      }
    };

    this.config = null;
    this.preferences = null;
    this.keys = null;
  }

  /**
   * Initialize configuration system
   */
  async initialize() {
    try {
      await fs.ensureDir(this.configDir);
      
      // Load or create config files
      await this.loadConfig();
      await this.loadPreferences();
      await this.loadKeys();
      
      console.log('✅ Configuration system initialized');
    } catch (error) {
      console.error('❌ Failed to initialize configuration:', error.message);
      throw error;
    }
  }

  /**
   * Load main configuration
   */
  async loadConfig() {
    try {
      if (await fs.pathExists(this.configFile)) {
        const configData = await fs.readJson(this.configFile);
        this.config = this.mergeWithDefaults(configData, this.defaultConfig);
      } else {
        this.config = { ...this.defaultConfig };
        await this.saveConfig();
      }
    } catch (error) {
      console.warn('Using default configuration due to error:', error.message);
      this.config = { ...this.defaultConfig };
    }
  }

  /**
   * Load user preferences
   */
  async loadPreferences() {
    try {
      if (await fs.pathExists(this.preferencesFile)) {
        this.preferences = await fs.readJson(this.preferencesFile);
      } else {
        this.preferences = { ...this.defaultPreferences };
        await this.savePreferences();
      }
    } catch (error) {
      console.warn('Using default preferences due to error:', error.message);
      this.preferences = { ...this.defaultPreferences };
    }
  }

  /**
   * Load API keys (encrypted)
   */
  async loadKeys() {
    try {
      if (await fs.pathExists(this.keysFile)) {
        const encryptedData = await fs.readJson(this.keysFile);
        this.keys = this.decryptKeys(encryptedData);
      } else {
        this.keys = {};
        await this.saveKeys();
      }
    } catch (error) {
      console.warn('Using empty keys due to error:', error.message);
      this.keys = {};
    }
  }

  /**
   * Save configuration
   */
  async saveConfig() {
    this.config.lastUpdated = new Date().toISOString();
    await fs.writeJson(this.configFile, this.config, { spaces: 2 });
  }

  /**
   * Save preferences
   */
  async savePreferences() {
    await fs.writeJson(this.preferencesFile, this.preferences, { spaces: 2 });
  }

  /**
   * Save API keys (encrypted)
   */
  async saveKeys() {
    const encryptedData = this.encryptKeys(this.keys);
    await fs.writeJson(this.keysFile, encryptedData, { spaces: 2 });
  }

  /**
   * Get configuration value
   */
  get(path, defaultValue = null) {
    return this.getNestedValue(this.config, path, defaultValue);
  }

  /**
   * Set configuration value
   */
  async set(path, value) {
    this.setNestedValue(this.config, path, value);
    await this.saveConfig();
  }

  /**
   * Get preference value
   */
  getPreference(path, defaultValue = null) {
    return this.getNestedValue(this.preferences, path, defaultValue);
  }

  /**
   * Set preference value
   */
  async setPreference(path, value) {
    this.setNestedValue(this.preferences, path, value);
    await this.savePreferences();
  }

  /**
   * Get API key
   */
  getKey(service) {
    return this.keys[service] || null;
  }

  /**
   * Set API key
   */
  async setKey(service, key) {
    this.keys[service] = key;
    await this.saveKeys();
  }

  /**
   * Remove API key
   */
  async removeKey(service) {
    delete this.keys[service];
    await this.saveKeys();
  }

  /**
   * Add to favorites
   */
  async addFavorite(category, item) {
    if (!this.preferences.favorites[category]) {
      this.preferences.favorites[category] = [];
    }
    
    // Check if already exists
    const exists = this.preferences.favorites[category].some(fav => 
      JSON.stringify(fav) === JSON.stringify(item)
    );
    
    if (!exists) {
      this.preferences.favorites[category].push({
        ...item,
        addedAt: new Date().toISOString()
      });
      await this.savePreferences();
    }
  }

  /**
   * Remove from favorites
   */
  async removeFavorite(category, item) {
    if (this.preferences.favorites[category]) {
      this.preferences.favorites[category] = this.preferences.favorites[category]
        .filter(fav => JSON.stringify(fav) !== JSON.stringify(item));
      await this.savePreferences();
    }
  }

  /**
   * Get favorites
   */
  getFavorites(category) {
    return this.preferences.favorites[category] || [];
  }

  /**
   * Export configuration
   */
  async exportConfig(filePath, includeKeys = false) {
    const exportData = {
      config: this.config,
      preferences: this.preferences,
      timestamp: new Date().toISOString()
    };

    if (includeKeys) {
      exportData.keys = this.keys;
    }

    await fs.writeJson(filePath, exportData, { spaces: 2 });
    return exportData;
  }

  /**
   * Import configuration
   */
  async importConfig(filePath, overwrite = false) {
    const importData = await fs.readJson(filePath);
    
    if (overwrite) {
      this.config = importData.config || this.config;
      this.preferences = importData.preferences || this.preferences;
      if (importData.keys) {
        this.keys = importData.keys;
      }
    } else {
      // Merge configurations
      this.config = this.mergeWithDefaults(importData.config, this.config);
      this.preferences = { ...this.preferences, ...importData.preferences };
      if (importData.keys) {
        this.keys = { ...this.keys, ...importData.keys };
      }
    }

    await Promise.all([
      this.saveConfig(),
      this.savePreferences(),
      this.saveKeys()
    ]);
  }

  /**
   * Reset to defaults
   */
  async reset(component = 'all') {
    switch (component) {
      case 'config':
        this.config = { ...this.defaultConfig };
        await this.saveConfig();
        break;
      case 'preferences':
        this.preferences = { ...this.defaultPreferences };
        await this.savePreferences();
        break;
      case 'keys':
        this.keys = {};
        await this.saveKeys();
        break;
      case 'all':
        this.config = { ...this.defaultConfig };
        this.preferences = { ...this.defaultPreferences };
        this.keys = {};
        await Promise.all([
          this.saveConfig(),
          this.savePreferences(),
          this.saveKeys()
        ]);
        break;
    }
  }

  /**
   * Get configuration summary
   */
  getSummary() {
    return {
      version: this.config.version,
      created: this.config.created,
      lastUpdated: this.config.lastUpdated,
      theme: this.config.display.theme,
      language: this.config.locale.language,
      keysConfigured: Object.keys(this.keys).length,
      favoritesCount: Object.values(this.preferences.favorites)
        .reduce((sum, favs) => sum + favs.length, 0)
    };
  }

  // Helper methods

  getNestedValue(obj, path, defaultValue = null) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return defaultValue;
      }
    }
    
    return current;
  }

  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
  }

  mergeWithDefaults(source, defaults) {
    const result = { ...defaults };
    
    for (const key in source) {
      if (typeof source[key] === 'object' && !Array.isArray(source[key]) && 
          typeof result[key] === 'object' && !Array.isArray(result[key])) {
        result[key] = this.mergeWithDefaults(source[key], result[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  }

  encryptKeys(keys) {
    if (Object.keys(keys).length === 0) return {};
    
    const algorithm = 'aes-256-gcm';
    const password = os.hostname() + os.userInfo().username;
    const salt = crypto.randomBytes(16);
    const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipherGCM(algorithm, key, iv);
    
    let encrypted = cipher.update(JSON.stringify(keys), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      algorithm,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      data: encrypted
    };
  }

  decryptKeys(encryptedData) {
    if (!encryptedData.data) return {};
    
    try {
      const { algorithm, salt, iv, authTag, data } = encryptedData;
      const password = os.hostname() + os.userInfo().username;
      const key = crypto.pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256');
      
      const decipher = crypto.createDecipherGCM(algorithm, key, Buffer.from(iv, 'hex'));
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(data, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.warn('Failed to decrypt keys, using empty set');
      return {};
    }
  }
}

module.exports = new ConfigManager();