/**
 * Maintenance Service
 * Handles cache cleanup, diagnostics, and system maintenance tasks
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const outputFormatter = require('./output-formatter');
const debugService = require('./debug-service');
const configService = require('./config');
const cacheService = require('./cache');

class MaintenanceService {
  constructor() {
    this.mdsaadDir = path.join(os.homedir(), '.mdsaad');
    this.tempDir = path.join(this.mdsaadDir, 'temp');
    this.logsDir = path.join(this.mdsaadDir, 'logs');
    this.isInitialized = false;
  }

  /**
   * Initialize the maintenance service
   */
  async initialize() {
    try {
      await fs.ensureDir(this.mdsaadDir);
      await fs.ensureDir(this.tempDir);
      await fs.ensureDir(this.logsDir);
      this.isInitialized = true;
      debugService.debug('Maintenance service initialized');
      return true;
    } catch (error) {
      debugService.debug('Maintenance service initialization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Perform cache cleanup
   */
  async cleanupCache(options = {}) {
    const results = {
      totalFiles: 0,
      deletedFiles: 0,
      totalSize: 0,
      freedSpace: 0,
      errors: []
    };

    try {
      debugService.debug('Starting cache cleanup', options);

      // Get cache statistics before cleanup
      const cacheStats = await cacheService.getStats();
      results.totalFiles = cacheStats.files;
      results.totalSize = cacheStats.size;

      const cacheDir = cacheService.getCacheDir();
      
      if (await fs.pathExists(cacheDir)) {
        const files = await fs.readdir(cacheDir);
        
        for (const file of files) {
          const filePath = path.join(cacheDir, file);
          const stats = await fs.stat(filePath);
          
          let shouldDelete = false;
          
          if (options.all) {
            shouldDelete = true;
          } else if (options.expired) {
            // Check if cache entry is expired
            try {
              const cacheData = await fs.readJson(filePath);
              if (cacheData.expiresAt && new Date(cacheData.expiresAt) < new Date()) {
                shouldDelete = true;
              }
            } catch (error) {
              // Invalid cache file, delete it
              shouldDelete = true;
            }
          } else if (options.olderThan) {
            const ageInDays = (Date.now() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);
            if (ageInDays > options.olderThan) {
              shouldDelete = true;
            }
          }
          
          if (shouldDelete) {
            try {
              await fs.remove(filePath);
              results.deletedFiles++;
              results.freedSpace += stats.size;
            } catch (error) {
              results.errors.push(`Failed to delete ${file}: ${error.message}`);
            }
          }
        }
      }

      debugService.debug('Cache cleanup completed', results);
      return results;
    } catch (error) {
      debugService.debug('Cache cleanup failed', { error: error.message });
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Clean temporary files
   */
  async cleanupTempFiles() {
    const results = {
      deletedFiles: 0,
      freedSpace: 0,
      errors: []
    };

    try {
      if (await fs.pathExists(this.tempDir)) {
        const files = await fs.readdir(this.tempDir);
        
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          try {
            const stats = await fs.stat(filePath);
            await fs.remove(filePath);
            results.deletedFiles++;
            results.freedSpace += stats.size;
          } catch (error) {
            results.errors.push(`Failed to delete temp file ${file}: ${error.message}`);
          }
        }
      }

      debugService.debug('Temp files cleanup completed', results);
      return results;
    } catch (error) {
      debugService.debug('Temp files cleanup failed', { error: error.message });
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Clean old log files
   */
  async cleanupLogs(maxAgeDays = 30) {
    const results = {
      deletedFiles: 0,
      freedSpace: 0,
      errors: []
    };

    try {
      if (await fs.pathExists(this.logsDir)) {
        const files = await fs.readdir(this.logsDir);
        const cutoffDate = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);
        
        for (const file of files) {
          const filePath = path.join(this.logsDir, file);
          try {
            const stats = await fs.stat(filePath);
            if (stats.mtime.getTime() < cutoffDate) {
              await fs.remove(filePath);
              results.deletedFiles++;
              results.freedSpace += stats.size;
            }
          } catch (error) {
            results.errors.push(`Failed to delete log file ${file}: ${error.message}`);
          }
        }
      }

      debugService.debug('Log files cleanup completed', results);
      return results;
    } catch (error) {
      debugService.debug('Log files cleanup failed', { error: error.message });
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Run comprehensive system diagnostics
   */
  async runDiagnostics() {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      system: await this.getSystemInfo(),
      mdsaad: await this.getMdsaadInfo(),
      configuration: await this.getConfigurationStatus(),
      cache: await this.getCacheStatus(),
      network: await this.getNetworkStatus(),
      permissions: await this.getPermissionsStatus(),
      health: { overall: 'unknown', issues: [] }
    };

    // Analyze diagnostic results
    diagnostics.health = this.analyzeHealth(diagnostics);

    debugService.debug('Diagnostics completed', { 
      overall: diagnostics.health.overall, 
      issues: diagnostics.health.issues.length 
    });

    return diagnostics;
  }

  /**
   * Get system information
   */
  async getSystemInfo() {
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      nodeVersion: process.version,
      npmVersion: null,
      shell: process.env.SHELL || process.env.COMSPEC,
      home: os.homedir(),
      tempDir: os.tmpdir()
    };

    // Get npm version
    try {
      systemInfo.npmVersion = execSync('npm --version', { encoding: 'utf8', timeout: 5000 }).trim();
    } catch (error) {
      systemInfo.npmVersion = 'unknown';
    }

    return systemInfo;
  }

  /**
   * Get MDSAAD-specific information
   */
  async getMdsaadInfo() {
    const packageJson = require('../../package.json');
    
    const mdsaadInfo = {
      version: packageJson.version,
      installPath: __dirname,
      configDir: this.mdsaadDir,
      configExists: await fs.pathExists(path.join(this.mdsaadDir, 'config.json')),
      cacheDir: path.join(this.mdsaadDir, 'cache'),
      cacheExists: await fs.pathExists(path.join(this.mdsaadDir, 'cache')),
      pluginsDir: path.join(this.mdsaadDir, 'plugins'),
      pluginsExists: await fs.pathExists(path.join(this.mdsaadDir, 'plugins')),
      dependencies: packageJson.dependencies
    };

    return mdsaadInfo;
  }

  /**
   * Get configuration status
   */
  async getConfigurationStatus() {
    const configStatus = {
      exists: false,
      valid: false,
      version: null,
      keys: [],
      issues: []
    };

    try {
      const configPath = path.join(this.mdsaadDir, 'config.json');
      configStatus.exists = await fs.pathExists(configPath);

      if (configStatus.exists) {
        const config = configService.getAll();
        configStatus.valid = true;
        configStatus.version = config.version;
        configStatus.keys = Object.keys(config).filter(key => key !== 'version');

        // Check for required configurations
        const requiredKeys = ['language'];
        for (const key of requiredKeys) {
          if (!config[key]) {
            configStatus.issues.push(`Missing required configuration: ${key}`);
          }
        }
      } else {
        configStatus.issues.push('Configuration file does not exist');
      }
    } catch (error) {
      configStatus.valid = false;
      configStatus.issues.push(`Configuration error: ${error.message}`);
    }

    return configStatus;
  }

  /**
   * Get cache status
   */
  async getCacheStatus() {
    try {
      const stats = await cacheService.getStats();
      return {
        ...stats,
        healthy: true,
        issues: []
      };
    } catch (error) {
      return {
        files: 0,
        size: 0,
        healthy: false,
        issues: [`Cache error: ${error.message}`]
      };
    }
  }

  /**
   * Get network connectivity status
   */
  async getNetworkStatus() {
    const networkStatus = {
      connected: false,
      apiReachable: {},
      issues: []
    };

    // Test basic connectivity
    try {
      await this.testConnection('https://www.google.com', 5000);
      networkStatus.connected = true;
    } catch (error) {
      networkStatus.connected = false;
      networkStatus.issues.push('No internet connectivity');
    }

    // Test API endpoints
    const apis = [
      { name: 'WeatherAPI', url: 'https://api.weatherapi.com' },
      { name: 'ExchangeRate-API', url: 'https://api.exchangerate-api.com' },
      { name: 'npm Registry', url: 'https://registry.npmjs.org' }
    ];

    for (const api of apis) {
      try {
        await this.testConnection(api.url, 10000);
        networkStatus.apiReachable[api.name] = true;
      } catch (error) {
        networkStatus.apiReachable[api.name] = false;
        if (networkStatus.connected) {
          networkStatus.issues.push(`${api.name} not reachable`);
        }
      }
    }

    return networkStatus;
  }

  /**
   * Test network connection to a URL
   */
  testConnection(url, timeout = 5000) {
    const https = require('https');
    const { URL } = require('url');
    
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      
      const request = https.request({
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: '/',
        method: 'HEAD',
        timeout
      }, (response) => {
        resolve(response.statusCode < 400);
      });

      request.on('error', reject);
      request.on('timeout', () => {
        request.abort();
        reject(new Error('Connection timeout'));
      });

      request.end();
    });
  }

  /**
   * Get file system permissions status
   */
  async getPermissionsStatus() {
    const permissionsStatus = {
      configDirReadable: false,
      configDirWritable: false,
      tempDirWritable: false,
      issues: []
    };

    try {
      // Test config directory permissions
      await fs.access(this.mdsaadDir, fs.constants.R_OK);
      permissionsStatus.configDirReadable = true;
    } catch (error) {
      permissionsStatus.issues.push('Config directory not readable');
    }

    try {
      await fs.access(this.mdsaadDir, fs.constants.W_OK);
      permissionsStatus.configDirWritable = true;
    } catch (error) {
      permissionsStatus.issues.push('Config directory not writable');
    }

    try {
      await fs.access(this.tempDir, fs.constants.W_OK);
      permissionsStatus.tempDirWritable = true;
    } catch (error) {
      permissionsStatus.issues.push('Temp directory not writable');
    }

    return permissionsStatus;
  }

  /**
   * Analyze overall system health
   */
  analyzeHealth(diagnostics) {
    const health = {
      overall: 'healthy',
      issues: [],
      warnings: [],
      recommendations: []
    };

    // Check configuration health
    if (!diagnostics.configuration.valid) {
      health.overall = 'unhealthy';
      health.issues.push(...diagnostics.configuration.issues);
    }

    // Check cache health
    if (!diagnostics.cache.healthy) {
      health.overall = 'degraded';
      health.warnings.push(...diagnostics.cache.issues);
    }

    // Check network connectivity
    if (!diagnostics.network.connected) {
      health.overall = 'degraded';
      health.warnings.push('No internet connectivity - offline features only');
    }

    // Check permissions
    if (diagnostics.permissions.issues.length > 0) {
      health.overall = 'unhealthy';
      health.issues.push(...diagnostics.permissions.issues);
    }

    // Check disk space
    const freeSpacePercent = (diagnostics.system.freeMemory / diagnostics.system.totalMemory) * 100;
    if (freeSpacePercent < 10) {
      health.warnings.push('Low system memory available');
      if (health.overall === 'healthy') {
        health.overall = 'degraded';
      }
    }

    // Generate recommendations
    if (diagnostics.cache.files > 100) {
      health.recommendations.push('Consider cleaning cache with: mdsaad maintenance --clean-cache');
    }

    if (!diagnostics.network.connected) {
      health.recommendations.push('Check your internet connection for full functionality');
    }

    if (diagnostics.configuration.issues.length > 0) {
      health.recommendations.push('Fix configuration issues with: mdsaad config --setup');
    }

    return health;
  }

  /**
   * Migrate configuration to newer format
   */
  async migrateConfiguration() {
    try {
      const config = configService.getAll();
      let migrated = false;

      // Add version if missing
      if (!config.version) {
        config.version = '1.0.0';
        migrated = true;
      }

      // Migrate old API key formats
      if (config.weather_api_key && !config.weatherApiKey) {
        config.weatherApiKey = config.weather_api_key;
        delete config.weather_api_key;
        migrated = true;
      }

      // Save migrated configuration
      if (migrated) {
        await configService.setAll(config);
        debugService.debug('Configuration migrated successfully');
        return { success: true, migrated: true };
      }

      return { success: true, migrated: false };
    } catch (error) {
      debugService.debug('Configuration migration failed', { error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Reset all data to clean state
   */
  async resetAll(options = {}) {
    const results = {
      configReset: false,
      cacheCleared: false,
      tempCleared: false,
      logsCleared: false,
      errors: []
    };

    try {
      if (options.config !== false) {
        await fs.remove(path.join(this.mdsaadDir, 'config.json'));
        results.configReset = true;
      }

      if (options.cache !== false) {
        const cacheResults = await this.cleanupCache({ all: true });
        results.cacheCleared = cacheResults.deletedFiles > 0;
      }

      if (options.temp !== false) {
        const tempResults = await this.cleanupTempFiles();
        results.tempCleared = tempResults.deletedFiles > 0;
      }

      if (options.logs !== false) {
        const logResults = await this.cleanupLogs(0); // Delete all logs
        results.logsCleared = logResults.deletedFiles > 0;
      }

      debugService.debug('Reset completed', results);
      return results;
    } catch (error) {
      debugService.debug('Reset failed', { error: error.message });
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats() {
    const stats = {
      total: 0,
      config: 0,
      cache: 0,
      temp: 0,
      logs: 0,
      plugins: 0,
      other: 0
    };

    try {
      if (await fs.pathExists(this.mdsaadDir)) {
        const items = await fs.readdir(this.mdsaadDir, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(this.mdsaadDir, item.name);
          const size = await this.getDirectorySize(itemPath);
          
          stats.total += size;
          
          switch (item.name) {
            case 'config.json':
              stats.config += size;
              break;
            case 'cache':
              stats.cache += size;
              break;
            case 'temp':
              stats.temp += size;
              break;
            case 'logs':
              stats.logs += size;
              break;
            case 'plugins':
              stats.plugins += size;
              break;
            default:
              stats.other += size;
          }
        }
      }

      return stats;
    } catch (error) {
      debugService.debug('Failed to get storage stats', { error: error.message });
      return stats;
    }
  }

  /**
   * Get directory size recursively
   */
  async getDirectorySize(dirPath) {
    try {
      const stats = await fs.stat(dirPath);
      
      if (stats.isFile()) {
        return stats.size;
      }
      
      if (stats.isDirectory()) {
        const files = await fs.readdir(dirPath);
        let totalSize = 0;
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          totalSize += await this.getDirectorySize(filePath);
        }
        
        return totalSize;
      }
      
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Format bytes for display
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

module.exports = new MaintenanceService();