/**
 * Offline Manager Service
 * Handles offline functionality, caching, and graceful degradation
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const debugService = require('./debug-service');
const performanceService = require('./performance-service');

class OfflineManager {
  constructor() {
    this.isInitialized = false;
    this.isOnline = true;
    this.offlineCapabilities = new Map();
    this.cachedData = new Map();
    this.offlineStrategies = new Map();
    this.cacheDirectory = path.join(
      os.homedir(),
      '.mdsaad-cli',
      'offline-cache'
    );
    this.networkTimeouts = {
      quick: 2000, // 2 seconds for quick checks
      normal: 5000, // 5 seconds for normal operations
      extended: 10000, // 10 seconds for complex operations
    };
    this.lastNetworkCheck = 0;
    this.networkCheckInterval = 30000; // 30 seconds
  }

  /**
   * Initialize offline manager
   */
  async initialize() {
    try {
      await this.setupCacheDirectory();
      await this.setupOfflineCapabilities();
      await this.loadCachedData();
      this.setupNetworkMonitoring();

      this.isInitialized = true;
      debugService.debug('Offline manager initialized');
      return true;
    } catch (error) {
      console.warn('Offline manager initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Setup cache directory
   */
  async setupCacheDirectory() {
    try {
      await fs.ensureDir(this.cacheDirectory);

      // Create subdirectories for different types of cached data
      const subdirs = [
        'weather',
        'currency',
        'translations',
        'api-responses',
        'assets',
      ];
      for (const subdir of subdirs) {
        await fs.ensureDir(path.join(this.cacheDirectory, subdir));
      }

      debugService.debug('Cache directory setup completed', {
        path: this.cacheDirectory,
      });
    } catch (error) {
      throw new Error(`Failed to setup cache directory: ${error.message}`);
    }
  }

  /**
   * Setup offline capabilities for different features
   */
  async setupOfflineCapabilities() {
    // Weather service offline capability
    this.offlineCapabilities.set('weather', {
      canWorkOffline: true,
      cacheKey: 'weather-data',
      fallbackStrategy: 'cached-data',
      gracefulDegradation: 'show-last-known-weather',
      offlineMessage: 'Showing cached weather data (last updated: {timestamp})',
    });

    // Currency conversion offline capability
    this.offlineCapabilities.set('currency', {
      canWorkOffline: true,
      cacheKey: 'exchange-rates',
      fallbackStrategy: 'cached-rates',
      gracefulDegradation: 'use-last-known-rates',
      offlineMessage: 'Using cached exchange rates (last updated: {timestamp})',
    });

    // Unit conversion offline capability
    this.offlineCapabilities.set('units', {
      canWorkOffline: true,
      cacheKey: 'unit-definitions',
      fallbackStrategy: 'static-definitions',
      gracefulDegradation: 'use-built-in-conversions',
      offlineMessage: 'Using built-in unit conversion tables',
    });

    // Translation service offline capability
    this.offlineCapabilities.set('translations', {
      canWorkOffline: true,
      cacheKey: 'translation-data',
      fallbackStrategy: 'cached-translations',
      gracefulDegradation: 'show-english-fallback',
      offlineMessage: 'Using cached translations',
    });

    // Help system offline capability
    this.offlineCapabilities.set('help', {
      canWorkOffline: true,
      cacheKey: 'help-content',
      fallbackStrategy: 'built-in-help',
      gracefulDegradation: 'show-basic-help',
      offlineMessage: 'Showing offline help content',
    });

    debugService.debug('Offline capabilities configured', {
      features: Array.from(this.offlineCapabilities.keys()),
    });
  }

  /**
   * Load cached data from disk
   */
  async loadCachedData() {
    try {
      const cacheFiles = await fs.readdir(this.cacheDirectory, {
        withFileTypes: true,
      });

      for (const file of cacheFiles) {
        if (file.isFile() && file.name.endsWith('.json')) {
          const cacheKey = file.name.replace('.json', '');
          const filePath = path.join(this.cacheDirectory, file.name);

          try {
            const content = await fs.readFile(filePath, 'utf8');
            const data = JSON.parse(content);

            // Check if cache is still valid
            if (this.isCacheValid(data)) {
              this.cachedData.set(cacheKey, data);
              debugService.debug(`Loaded cached data: ${cacheKey}`, {
                timestamp: data.timestamp,
                size: content.length,
              });
            } else {
              // Remove expired cache
              await fs.unlink(filePath);
              debugService.debug(`Removed expired cache: ${cacheKey}`);
            }
          } catch (parseError) {
            debugService.debug(`Failed to parse cache file: ${file.name}`, {
              error: parseError.message,
            });
            // Remove corrupted cache file
            await fs.unlink(filePath).catch(() => {});
          }
        }
      }
    } catch (error) {
      debugService.debug('Failed to load cached data', {
        error: error.message,
      });
    }
  }

  /**
   * Setup network monitoring
   */
  setupNetworkMonitoring() {
    // Initial network check
    this.checkNetworkStatus();

    // Periodic network checks (but not too frequent)
    setInterval(() => {
      if (Date.now() - this.lastNetworkCheck > this.networkCheckInterval) {
        this.checkNetworkStatus();
      }
    }, this.networkCheckInterval);
  }

  /**
   * Check network status with timeout
   */
  async checkNetworkStatus() {
    this.lastNetworkCheck = Date.now();

    try {
      const { spawn } = require('child_process');
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'ping' : 'ping';
      const args = isWindows ? ['-n', '1', '8.8.8.8'] : ['-c', '1', '8.8.8.8'];

      const result = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Network check timeout'));
        }, this.networkTimeouts.quick);

        const process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        process.on('close', code => {
          clearTimeout(timeout);
          resolve(code === 0);
        });

        process.on('error', error => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      const wasOnline = this.isOnline;
      this.isOnline = result;

      if (wasOnline !== this.isOnline) {
        debugService.debug(
          `Network status changed: ${this.isOnline ? 'online' : 'offline'}`
        );

        if (this.isOnline) {
          await this.onNetworkReconnected();
        } else {
          await this.onNetworkDisconnected();
        }
      }
    } catch (error) {
      const wasOnline = this.isOnline;
      this.isOnline = false;

      if (wasOnline) {
        debugService.debug('Network check failed, assuming offline', {
          error: error.message,
        });
        await this.onNetworkDisconnected();
      }
    }
  }

  /**
   * Handle network reconnection
   */
  async onNetworkReconnected() {
    debugService.debug('Network reconnected, updating cached data');

    // Optionally refresh critical cached data
    // This would be implemented based on specific requirements
  }

  /**
   * Handle network disconnection
   */
  async onNetworkDisconnected() {
    debugService.debug('Network disconnected, switching to offline mode');

    // Prepare offline fallbacks
    await this.prepareOfflineFallbacks();
  }

  /**
   * Prepare offline fallbacks
   */
  async prepareOfflineFallbacks() {
    try {
      // Ensure we have essential offline data
      for (const [feature, capability] of this.offlineCapabilities.entries()) {
        if (
          capability.canWorkOffline &&
          !this.cachedData.has(capability.cacheKey)
        ) {
          await this.createEmergencyCache(feature, capability);
        }
      }
    } catch (error) {
      debugService.debug('Failed to prepare offline fallbacks', {
        error: error.message,
      });
    }
  }

  /**
   * Create emergency cache for essential features
   */
  async createEmergencyCache(feature, capability) {
    try {
      let emergencyData = null;

      switch (feature) {
        case 'units':
          emergencyData = this.getBuiltInUnitDefinitions();
          break;

        case 'help':
          emergencyData = this.getBuiltInHelpContent();
          break;

        case 'translations':
          emergencyData = this.getBuiltInTranslations();
          break;

        default:
          debugService.debug(
            `No emergency cache available for feature: ${feature}`
          );
          return;
      }

      if (emergencyData) {
        const cacheData = {
          data: emergencyData,
          timestamp: Date.now(),
          ttl: 7 * 24 * 60 * 60 * 1000, // 7 days for emergency cache
          type: 'emergency',
        };

        this.cachedData.set(capability.cacheKey, cacheData);
        await this.saveCacheToFile(capability.cacheKey, cacheData);

        debugService.debug(`Created emergency cache for: ${feature}`);
      }
    } catch (error) {
      debugService.debug(`Failed to create emergency cache for ${feature}`, {
        error: error.message,
      });
    }
  }

  /**
   * Get built-in unit definitions for offline use
   */
  getBuiltInUnitDefinitions() {
    return {
      length: {
        meter: 1,
        kilometer: 1000,
        centimeter: 0.01,
        millimeter: 0.001,
        inch: 0.0254,
        foot: 0.3048,
        yard: 0.9144,
        mile: 1609.344,
      },
      weight: {
        gram: 1,
        kilogram: 1000,
        pound: 453.592,
        ounce: 28.3495,
        ton: 1000000,
      },
      temperature: {
        celsius: c => c,
        fahrenheit: f => ((f - 32) * 5) / 9,
        kelvin: k => k - 273.15,
      },
      volume: {
        liter: 1,
        milliliter: 0.001,
        gallon: 3.78541,
        quart: 0.946353,
        pint: 0.473176,
        cup: 0.236588,
        fluid_ounce: 0.0295735,
      },
    };
  }

  /**
   * Get built-in help content for offline use
   */
  getBuiltInHelpContent() {
    return {
      commands: {
        weather: {
          description: 'Get weather information',
          usage: 'mdsaad weather [location]',
          examples: ['mdsaad weather', 'mdsaad weather "New York"'],
        },
        convert: {
          description: 'Convert between different units and currencies',
          usage: 'mdsaad convert <amount> <from> <to>',
          examples: [
            'mdsaad convert 100 USD EUR',
            'mdsaad convert 10 km miles',
          ],
        },
        help: {
          description: 'Show help information',
          usage: 'mdsaad help [command]',
          examples: ['mdsaad help', 'mdsaad help weather'],
        },
      },
      general: {
        description: 'mdsaad CLI - A comprehensive command-line tool',
        version: '1.0.0',
        support: 'For support, visit: https://github.com/user/mdsaad-cli',
      },
    };
  }

  /**
   * Get built-in translations for offline use
   */
  getBuiltInTranslations() {
    return {
      en: {
        'weather.title': 'Weather Information',
        'weather.temperature': 'Temperature',
        'weather.humidity': 'Humidity',
        'weather.wind': 'Wind',
        'convert.result': 'Conversion Result',
        'error.network': 'Network error occurred',
        'error.offline': 'Working in offline mode',
      },
    };
  }

  /**
   * Cache data for offline use
   */
  async cacheData(key, data, ttl = 3600000) {
    // Default 1 hour TTL
    try {
      const cacheData = {
        data: data,
        timestamp: Date.now(),
        ttl: ttl,
        type: 'normal',
      };

      this.cachedData.set(key, cacheData);
      await this.saveCacheToFile(key, cacheData);

      debugService.debug(`Cached data: ${key}`, {
        size: JSON.stringify(data).length,
        ttl: ttl,
      });

      return true;
    } catch (error) {
      debugService.debug(`Failed to cache data: ${key}`, {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get cached data
   */
  getCachedData(key) {
    const cached = this.cachedData.get(key);

    if (!cached) {
      return null;
    }

    if (!this.isCacheValid(cached)) {
      this.cachedData.delete(key);
      this.deleteCacheFile(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid(cached) {
    if (!cached || !cached.timestamp || !cached.ttl) {
      return false;
    }

    const age = Date.now() - cached.timestamp;
    return age < cached.ttl;
  }

  /**
   * Save cache data to file
   */
  async saveCacheToFile(key, data) {
    try {
      const filePath = path.join(this.cacheDirectory, `${key}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
      debugService.debug(`Failed to save cache file: ${key}`, {
        error: error.message,
      });
    }
  }

  /**
   * Delete cache file
   */
  async deleteCacheFile(key) {
    try {
      const filePath = path.join(this.cacheDirectory, `${key}.json`);
      await fs.unlink(filePath);
    } catch (error) {
      // Ignore errors when deleting cache files
    }
  }

  /**
   * Execute operation with offline fallback
   */
  async executeWithOfflineFallback(feature, onlineOperation, options = {}) {
    const capability = this.offlineCapabilities.get(feature);

    if (!capability) {
      // No offline capability defined, try online operation
      return await onlineOperation();
    }

    // Try online operation first if we think we're online
    if (this.isOnline && !options.forceOffline) {
      try {
        const result = await Promise.race([
          onlineOperation(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Operation timeout')),
              options.timeout || this.networkTimeouts.normal
            )
          ),
        ]);

        // Cache successful result for offline use
        if (result && capability.cacheKey) {
          await this.cacheData(capability.cacheKey, result, options.ttl);
        }

        return result;
      } catch (error) {
        debugService.debug(`Online operation failed for ${feature}`, {
          error: error.message,
        });

        // Mark as offline if network-related error
        if (this.isNetworkError(error)) {
          this.isOnline = false;
        }
      }
    }

    // Fall back to offline capability
    return await this.executeOfflineFallback(feature, capability, options);
  }

  /**
   * Execute offline fallback for a feature
   */
  async executeOfflineFallback(feature, capability, options = {}) {
    try {
      switch (capability.fallbackStrategy) {
        case 'cached-data':
        case 'cached-rates':
        case 'cached-translations':
          return this.useCachedData(capability, options);

        case 'static-definitions':
        case 'built-in-help':
          return this.useStaticData(feature, capability);

        case 'show-last-known-weather':
          return this.useLastKnownData(capability, 'weather');

        case 'use-last-known-rates':
          return this.useLastKnownData(capability, 'rates');

        case 'show-english-fallback':
          return this.useEnglishFallback(capability);

        default:
          throw new Error(
            `Unknown fallback strategy: ${capability.fallbackStrategy}`
          );
      }
    } catch (error) {
      debugService.debug(`Offline fallback failed for ${feature}`, {
        error: error.message,
      });
      return this.createErrorResponse(feature, capability, error);
    }
  }

  /**
   * Use cached data as fallback
   */
  useCachedData(capability, options) {
    const cached = this.getCachedData(capability.cacheKey);

    if (!cached) {
      throw new Error('No cached data available');
    }

    const cachedDataInfo = this.cachedData.get(capability.cacheKey);
    const lastUpdated = new Date(cachedDataInfo.timestamp).toLocaleString();

    return {
      ...cached,
      _offline: true,
      _message: capability.offlineMessage.replace('{timestamp}', lastUpdated),
      _lastUpdated: lastUpdated,
    };
  }

  /**
   * Use static built-in data as fallback
   */
  useStaticData(feature, capability) {
    let staticData = null;

    switch (feature) {
      case 'units':
        staticData = this.getBuiltInUnitDefinitions();
        break;
      case 'help':
        staticData = this.getBuiltInHelpContent();
        break;
      case 'translations':
        staticData = this.getBuiltInTranslations();
        break;
    }

    if (!staticData) {
      throw new Error(`No static data available for ${feature}`);
    }

    return {
      ...staticData,
      _offline: true,
      _message: capability.offlineMessage,
    };
  }

  /**
   * Use last known data
   */
  useLastKnownData(capability, dataType) {
    const cached = this.getCachedData(capability.cacheKey);

    if (!cached) {
      throw new Error(`No last known ${dataType} data available`);
    }

    return this.useCachedData(capability);
  }

  /**
   * Use English fallback for translations
   */
  useEnglishFallback(capability) {
    const englishTranslations = this.getBuiltInTranslations().en;

    return {
      translations: englishTranslations,
      _offline: true,
      _message: capability.offlineMessage,
    };
  }

  /**
   * Create error response for failed offline operations
   */
  createErrorResponse(feature, capability, error) {
    return {
      success: false,
      error: `Offline operation failed for ${feature}: ${error.message}`,
      _offline: true,
      _canWorkOffline: capability.canWorkOffline,
      _gracefulDegradation: capability.gracefulDegradation,
    };
  }

  /**
   * Check if error is network-related
   */
  isNetworkError(error) {
    const networkErrorMessages = [
      'network error',
      'timeout',
      'connection refused',
      'dns lookup failed',
      'enotfound',
      'econnrefused',
      'etimedout',
      'socket hang up',
    ];

    const errorMessage = error.message.toLowerCase();
    return networkErrorMessages.some(msg => errorMessage.includes(msg));
  }

  /**
   * Get offline status and capabilities
   */
  getOfflineStatus() {
    return {
      isOnline: this.isOnline,
      lastNetworkCheck: new Date(this.lastNetworkCheck).toISOString(),
      capabilities: Object.fromEntries(
        Array.from(this.offlineCapabilities.entries()).map(
          ([feature, capability]) => [
            feature,
            {
              canWorkOffline: capability.canWorkOffline,
              hasCachedData: this.cachedData.has(capability.cacheKey),
              fallbackStrategy: capability.fallbackStrategy,
            },
          ]
        )
      ),
      cacheStats: {
        totalEntries: this.cachedData.size,
        cacheDirectory: this.cacheDirectory,
        entries: Array.from(this.cachedData.keys()),
      },
    };
  }

  /**
   * Clear all cached data
   */
  async clearCache() {
    try {
      // Clear in-memory cache
      this.cachedData.clear();

      // Remove cache files
      const files = await fs.readdir(this.cacheDirectory);
      for (const file of files) {
        if (file.endsWith('.json')) {
          await fs.unlink(path.join(this.cacheDirectory, file));
        }
      }

      debugService.debug('All cached data cleared');
      return { success: true, message: 'Cache cleared successfully' };
    } catch (error) {
      debugService.debug('Failed to clear cache', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Shutdown offline manager
   */
  shutdown() {
    // Clear intervals if any
    // Save any pending cache data
    debugService.debug('Offline manager shutdown completed');
  }
}

module.exports = new OfflineManager();
