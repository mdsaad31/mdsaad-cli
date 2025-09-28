/**
 * Caching Service
 * Provides file-based caching with TTL support for offline functionality
 */

const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const logger = require('./logger');
const config = require('./config');

class CacheService {
  constructor() {
    this.cacheDir = null;
    this.maxCacheSize = 100 * 1024 * 1024; // 100MB default
    this.cleanupInterval = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      // Get cache directory from config
      if (!config.isInitialized) {
        await config.initialize();
      }
      this.cacheDir = config.getCacheDir();
      
      // Ensure cache directory exists
      await fs.ensureDir(this.cacheDir);
      
      // Create subdirectories for different cache types
      await this.ensureCacheDirectories();
      
      // Start periodic cleanup
      this.startCleanupTimer();
      
      this.isInitialized = true;
      logger.verbose('Cache service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize cache service:', error.message);
      throw error;
    }
  }

  async ensureCacheDirectories() {
    const subdirs = ['weather', 'currency', 'ai', 'general', 'test'];
    
    for (const subdir of subdirs) {
      await fs.ensureDir(path.join(this.cacheDir, subdir));
    }
  }

  /**
   * Generate cache key from input parameters
   */
  generateKey(namespace, ...params) {
    const input = [namespace, ...params].join(':');
    return crypto.createHash('sha256').update(input).digest('hex').substring(0, 16);
  }

  /**
   * Sanitize cache key for file system compatibility
   */
  sanitizeKey(key) {
    // Replace invalid file system characters with safe alternatives
    return key
      .replace(/[<>:"|\?*]/g, '_')  // Replace invalid chars with underscore
      .replace(/\s+/g, '_')         // Replace spaces with underscore
      .replace(/\.+$/g, '')         // Remove trailing dots
      .substring(0, 200);           // Limit length
  }

  /**
   * Get cache file path for a key
   */
  getCacheFilePath(namespace, key) {
    const sanitizedKey = this.sanitizeKey(key);
    return path.join(this.cacheDir, namespace, `${sanitizedKey}.json`);
  }

  /**
   * Store data in cache with TTL
   */
  async set(namespace, key, data, ttl = 3600000) { // Default 1 hour TTL
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      // Ensure the namespace directory exists
      await fs.ensureDir(path.join(this.cacheDir, namespace));

      const originalKey = typeof key === 'string' ? key : this.generateKey(namespace, ...key);
      const cacheKey = this.sanitizeKey(originalKey);
      const filePath = this.getCacheFilePath(namespace, cacheKey);
      
      const cacheEntry = {
        key: originalKey,
        data: data,
        timestamp: Date.now(),
        ttl: ttl,
        expiresAt: Date.now() + ttl,
        namespace: namespace,
        size: JSON.stringify(data).length
      };
      
      await fs.writeJson(filePath, cacheEntry, { spaces: 2 });
      
      logger.verbose(`Cache entry stored: ${namespace}:${cacheKey} (TTL: ${ttl}ms)`);
      
      // Check cache size after write
      await this.checkCacheSize();
      
      return true;
      
    } catch (error) {
      logger.error('Failed to store cache entry:', error.message);
      return false;
    }
  }

  /**
   * Retrieve data from cache
   */
  async get(namespace, key) {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const originalKey = typeof key === 'string' ? key : this.generateKey(namespace, ...key);
      const cacheKey = this.sanitizeKey(originalKey);
      const filePath = this.getCacheFilePath(namespace, cacheKey);
      
      if (!await fs.pathExists(filePath)) {
        logger.verbose(`Cache miss: ${namespace}:${originalKey}`);
        return null;
      }
      
      const cacheEntry = await fs.readJson(filePath);
      
      // Check if entry has expired
      if (Date.now() > cacheEntry.expiresAt) {
        logger.verbose(`Cache expired: ${namespace}:${originalKey}`);
        await this.invalidate(namespace, key);
        return null;
      }
      
      logger.verbose(`Cache hit: ${namespace}:${originalKey} (age: ${Date.now() - cacheEntry.timestamp}ms)`);
      
      return {
        data: cacheEntry.data,
        timestamp: cacheEntry.timestamp,
        age: Date.now() - cacheEntry.timestamp,
        ttl: cacheEntry.ttl
      };
      
    } catch (error) {
      logger.error('Failed to retrieve cache entry:', error.message);
      return null;
    }
  }

  /**
   * Check if cache entry exists and is valid
   */
  async has(namespace, key) {
    const entry = await this.get(namespace, key);
    return entry !== null;
  }

  /**
   * Remove specific cache entry
   */
  async invalidate(namespace, key) {
    try {
      const originalKey = typeof key === 'string' ? key : this.generateKey(namespace, ...key);
      const cacheKey = this.sanitizeKey(originalKey);
      const filePath = this.getCacheFilePath(namespace, cacheKey);
      
      if (await fs.pathExists(filePath)) {
        await fs.remove(filePath);
        logger.verbose(`Cache entry invalidated: ${namespace}:${originalKey}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error('Failed to invalidate cache entry:', error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries in a namespace
   */
  async clearNamespace(namespace) {
    try {
      const namespacePath = path.join(this.cacheDir, namespace);
      
      if (await fs.pathExists(namespacePath)) {
        await fs.emptyDir(namespacePath);
        logger.info(`Cache namespace cleared: ${namespace}`);
        return true;
      }
      
      return false;
      
    } catch (error) {
      logger.error(`Failed to clear cache namespace ${namespace}:`, error.message);
      return false;
    }
  }

  /**
   * Clear all cache entries
   */
  async clearAll() {
    try {
      await fs.emptyDir(this.cacheDir);
      await this.ensureCacheDirectories();
      logger.info('All cache entries cleared');
      return true;
      
    } catch (error) {
      logger.error('Failed to clear all cache:', error.message);
      return false;
    }
  }

  /**
   * Alias for clearAll() - for backward compatibility
   */
  async clear() {
    return this.clearAll();
  }

  /**
   * Clean up expired entries
   */
  async cleanup() {
    try {
      let cleanedCount = 0;
      const namespaces = await fs.readdir(this.cacheDir);
      
      for (const namespace of namespaces) {
        const namespacePath = path.join(this.cacheDir, namespace);
        const stats = await fs.stat(namespacePath);
        
        if (!stats.isDirectory()) continue;
        
        const files = await fs.readdir(namespacePath);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const filePath = path.join(namespacePath, file);
          
          try {
            const cacheEntry = await fs.readJson(filePath);
            
            if (Date.now() > cacheEntry.expiresAt) {
              await fs.remove(filePath);
              cleanedCount++;
              logger.verbose(`Cleaned expired cache entry: ${namespace}:${cacheEntry.key}`);
            }
            
          } catch (error) {
            // Remove corrupted cache files
            await fs.remove(filePath);
            cleanedCount++;
            logger.warn(`Removed corrupted cache file: ${filePath}`);
          }
        }
      }
      
      if (cleanedCount > 0) {
        logger.info(`Cache cleanup completed: ${cleanedCount} entries removed`);
      }
      
      return cleanedCount;
      
    } catch (error) {
      logger.error('Cache cleanup failed:', error.message);
      return 0;
    }
  }

  /**
   * Check cache size and cleanup if necessary
   */
  async checkCacheSize() {
    try {
      const stats = await this.getStats();
      
      if (stats.totalSize > this.maxCacheSize) {
        logger.warn(`Cache size exceeded limit (${stats.totalSize} > ${this.maxCacheSize})`);
        
        // Remove oldest entries first
        await this.cleanupBySize();
      }
      
    } catch (error) {
      logger.error('Cache size check failed:', error.message);
    }
  }

  /**
   * Cleanup cache entries by size (LRU strategy)
   */
  async cleanupBySize() {
    try {
      const allEntries = [];
      const namespaces = await fs.readdir(this.cacheDir);
      
      // Collect all cache entries with their file info
      for (const namespace of namespaces) {
        const namespacePath = path.join(this.cacheDir, namespace);
        const stats = await fs.stat(namespacePath);
        
        if (!stats.isDirectory()) continue;
        
        const files = await fs.readdir(namespacePath);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const filePath = path.join(namespacePath, file);
          const fileStats = await fs.stat(filePath);
          
          try {
            const cacheEntry = await fs.readJson(filePath);
            allEntries.push({
              filePath,
              timestamp: cacheEntry.timestamp,
              size: fileStats.size,
              namespace: cacheEntry.namespace,
              key: cacheEntry.key
            });
          } catch (error) {
            // Remove corrupted files
            await fs.remove(filePath);
          }
        }
      }
      
      // Sort by timestamp (oldest first)
      allEntries.sort((a, b) => a.timestamp - b.timestamp);
      
      let removedSize = 0;
      let removedCount = 0;
      const targetSize = this.maxCacheSize * 0.8; // Clean to 80% of max size
      
      for (const entry of allEntries) {
        await fs.remove(entry.filePath);
        removedSize += entry.size;
        removedCount++;
        
        const currentStats = await this.getStats();
        if (currentStats.totalSize <= targetSize) {
          break;
        }
      }
      
      logger.info(`Cache size cleanup: removed ${removedCount} entries (${removedSize} bytes)`);
      
    } catch (error) {
      logger.error('Cache size cleanup failed:', error.message);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      const stats = {
        totalEntries: 0,
        totalSize: 0,
        namespaces: {},
        oldestEntry: null,
        newestEntry: null,
        expiredEntries: 0
      };
      
      const namespaces = await fs.readdir(this.cacheDir);
      
      for (const namespace of namespaces) {
        const namespacePath = path.join(this.cacheDir, namespace);
        const dirStats = await fs.stat(namespacePath);
        
        if (!dirStats.isDirectory()) continue;
        
        stats.namespaces[namespace] = {
          entries: 0,
          size: 0,
          expired: 0
        };
        
        const files = await fs.readdir(namespacePath);
        
        for (const file of files) {
          if (!file.endsWith('.json')) continue;
          
          const filePath = path.join(namespacePath, file);
          const fileStats = await fs.stat(filePath);
          
          try {
            const cacheEntry = await fs.readJson(filePath);
            
            stats.totalEntries++;
            stats.totalSize += fileStats.size;
            stats.namespaces[namespace].entries++;
            stats.namespaces[namespace].size += fileStats.size;
            
            // Check if expired
            const isExpired = Date.now() > cacheEntry.expiresAt;
            if (isExpired) {
              stats.expiredEntries++;
              stats.namespaces[namespace].expired++;
            }
            
            // Track oldest/newest
            if (!stats.oldestEntry || cacheEntry.timestamp < stats.oldestEntry) {
              stats.oldestEntry = cacheEntry.timestamp;
            }
            if (!stats.newestEntry || cacheEntry.timestamp > stats.newestEntry) {
              stats.newestEntry = cacheEntry.timestamp;
            }
            
          } catch (error) {
            // Count corrupted files
            stats.totalSize += fileStats.size;
          }
        }
      }
      
      return stats;
      
    } catch (error) {
      logger.error('Failed to get cache statistics:', error.message);
      return {
        totalEntries: 0,
        totalSize: 0,
        namespaces: {},
        oldestEntry: null,
        newestEntry: null,
        expiredEntries: 0,
        error: error.message
      };
    }
  }

  /**
   * Set maximum cache size
   */
  setMaxSize(sizeInBytes) {
    this.maxCacheSize = sizeInBytes;
    logger.info(`Cache max size set to: ${sizeInBytes} bytes`);
  }

  /**
   * Start periodic cleanup timer
   */
  startCleanupTimer() {
    // Run cleanup every hour
    this.cleanupInterval = setInterval(async () => {
      await this.cleanup();
    }, 3600000);
    
    logger.verbose('Cache cleanup timer started (1 hour interval)');
  }

  /**
   * Stop periodic cleanup timer
   */
  stopCleanupTimer() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.verbose('Cache cleanup timer stopped');
    }
  }

  /**
   * Cache middleware for API responses
   */
  middleware(namespace, ttl = 3600000) {
    return async (key, fetchFunction) => {
      // Try to get from cache first
      const cached = await this.get(namespace, key);
      
      if (cached) {
        logger.verbose(`Serving from cache: ${namespace}:${key}`);
        return {
          ...cached.data,
          _cached: true,
          _cacheAge: cached.age,
          _cacheTimestamp: cached.timestamp
        };
      }
      
      // Not in cache, fetch fresh data
      try {
        const freshData = await fetchFunction();
        
        // Store in cache for future use
        await this.set(namespace, key, freshData, ttl);
        
        return {
          ...freshData,
          _cached: false,
          _cacheTimestamp: Date.now()
        };
        
      } catch (error) {
        logger.error(`Failed to fetch fresh data for ${namespace}:${key}:`, error.message);
        throw error;
      }
    };
  }

  /**
   * Check if cache is compatible with current version
   */
  isCompatible() {
    try {
      // Always return true for now - cache is backward compatible
      return true;
    } catch (error) {
      logger.error('Cache compatibility check failed:', error.message);
      return false;
    }
  }

  /**
   * Get cache directory path
   */
  getCacheDir() {
    return this.cacheDir;
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      this.stopCleanupTimer();
      
      // Final cleanup
      await this.cleanup();
      
      logger.info('Cache service shutdown completed');
      
    } catch (error) {
      logger.error('Cache service shutdown error:', error.message);
    }
  }
}

module.exports = new CacheService();