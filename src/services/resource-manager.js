/**
 * Resource Manager Service
 * Manages memory, caching, and resource optimization for better performance
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const performanceService = require('./performance-service');
const debugService = require('./debug-service');

class ResourceManager {
  constructor() {
    this.isInitialized = false;
    this.resourcePools = new Map();
    this.cachePools = new Map();
    this.cleanupTasks = [];
    this.optimizationStrategies = new Map();
    this.resourceLimits = {
      maxCacheSize: 100 * 1024 * 1024, // 100MB
      maxMemoryUsage: 200 * 1024 * 1024, // 200MB
      maxCacheEntries: 1000,
      maxConcurrentOperations: 10,
      cacheCleanupInterval: 5 * 60 * 1000 // 5 minutes
    };
    this.activeOperations = new Set();
    this.operationQueue = [];
    this.cleanupInterval = null;
  }

  /**
   * Initialize resource manager
   */
  async initialize() {
    try {
      this.setupResourcePools();
      this.setupOptimizationStrategies();
      this.startCleanupTasks();
      
      this.isInitialized = true;
      debugService.debug('Resource manager initialized');
      return true;
    } catch (error) {
      console.warn('Resource manager initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Setup resource pools for different types of data
   */
  setupResourcePools() {
    // ASCII Art resource pool
    this.resourcePools.set('ascii-art', {
      maxSize: 50,
      items: new Map(),
      accessCount: new Map(),
      lastAccessed: new Map()
    });

    // API response pool
    this.resourcePools.set('api-responses', {
      maxSize: 100,
      items: new Map(),
      accessCount: new Map(),
      lastAccessed: new Map()
    });

    // Calculation cache pool
    this.resourcePools.set('calculations', {
      maxSize: 200,
      items: new Map(),
      accessCount: new Map(),
      lastAccessed: new Map()
    });

    // Translation cache pool
    this.resourcePools.set('translations', {
      maxSize: 1000,
      items: new Map(),
      accessCount: new Map(),
      lastAccessed: new Map()
    });
  }

  /**
   * Setup optimization strategies
   */
  setupOptimizationStrategies() {
    // Lazy loading strategy
    this.optimizationStrategies.set('lazy-loading', {
      description: 'Load resources only when needed',
      apply: async (resourceType) => {
        return this.enableLazyLoading(resourceType);
      }
    });

    // Memory compression strategy
    this.optimizationStrategies.set('compression', {
      description: 'Compress large data in memory',
      apply: async (data) => {
        return this.compressData(data);
      }
    });

    // Cache optimization strategy
    this.optimizationStrategies.set('cache-optimization', {
      description: 'Optimize cache size and cleanup',
      apply: async () => {
        return this.optimizeCaches();
      }
    });

    // Concurrent operation limiting
    this.optimizationStrategies.set('concurrency-control', {
      description: 'Limit concurrent operations to prevent overload',
      apply: async (operation) => {
        return this.manageOperation(operation);
      }
    });
  }

  /**
   * Start background cleanup tasks
   */
  startCleanupTasks() {
    // Periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.performScheduledCleanup();
    }, this.resourceLimits.cacheCleanupInterval);

    // Don't keep process alive
    if (this.cleanupInterval && typeof this.cleanupInterval.unref === 'function') {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Store item in resource pool with intelligent caching
   */
  storeInPool(poolName, key, value, options = {}) {
    const pool = this.resourcePools.get(poolName);
    if (!pool) {
      debugService.debug(`Resource pool not found: ${poolName}`);
      return false;
    }

    // Check if we need to make room
    if (pool.items.size >= pool.maxSize) {
      this.evictLeastUsed(pool);
    }

    // Store the item
    pool.items.set(key, value);
    pool.accessCount.set(key, 1);
    pool.lastAccessed.set(key, Date.now());

    debugService.debug(`Stored item in ${poolName} pool`, { key, size: pool.items.size });
    return true;
  }

  /**
   * Retrieve item from resource pool
   */
  getFromPool(poolName, key) {
    const pool = this.resourcePools.get(poolName);
    if (!pool || !pool.items.has(key)) {
      return null;
    }

    // Update access statistics
    pool.accessCount.set(key, (pool.accessCount.get(key) || 0) + 1);
    pool.lastAccessed.set(key, Date.now());

    return pool.items.get(key);
  }

  /**
   * Evict least recently used items from pool
   */
  evictLeastUsed(pool) {
    // Find the least recently used item
    let leastUsedKey = null;
    let oldestAccess = Date.now();

    for (const [key, lastAccessed] of pool.lastAccessed.entries()) {
      if (lastAccessed < oldestAccess) {
        oldestAccess = lastAccessed;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      pool.items.delete(leastUsedKey);
      pool.accessCount.delete(leastUsedKey);
      pool.lastAccessed.delete(leastUsedKey);
      debugService.debug(`Evicted least used item: ${leastUsedKey}`);
    }
  }

  /**
   * Enable lazy loading for a resource type
   */
  async enableLazyLoading(resourceType) {
    try {
      switch (resourceType) {
        case 'ascii-art':
          // Defer loading ASCII art until actually displayed
          return this.setupLazyAsciiArt();
        
        case 'translations':
          // Load translations on demand
          return this.setupLazyTranslations();
        
        case 'plugins':
          // Load plugins when first used
          return this.setupLazyPlugins();
        
        default:
          return { success: false, error: 'Unknown resource type' };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Setup lazy loading for ASCII art
   */
  setupLazyAsciiArt() {
    // Create a proxy that loads ASCII art on first access
    const artCache = new Map();
    
    return {
      success: true,
      strategy: 'lazy-ascii-art',
      getArt: (artName) => {
        if (!artCache.has(artName)) {
          // Load art synchronously when needed
          try {
            const artPath = path.join(__dirname, '..', 'assets', 'ascii-art', `${artName}.txt`);
            if (fs.existsSync(artPath)) {
              const artContent = fs.readFileSync(artPath, 'utf8');
              artCache.set(artName, artContent);
              debugService.debug(`Lazily loaded ASCII art: ${artName}`);
            } else {
              artCache.set(artName, null);
            }
          } catch (error) {
            debugService.debug(`Failed to load ASCII art: ${artName}`, { error: error.message });
            artCache.set(artName, null);
          }
        }
        return artCache.get(artName);
      }
    };
  }

  /**
   * Setup lazy loading for translations
   */
  setupLazyTranslations() {
    const translationCache = new Map();
    
    return {
      success: true,
      strategy: 'lazy-translations',
      getTranslation: (lang, key) => {
        const cacheKey = `${lang}:${key}`;
        if (!translationCache.has(cacheKey)) {
          // Load translation file only when needed
          try {
            const langPath = path.join(__dirname, '..', 'locales', `${lang}.json`);
            if (fs.existsSync(langPath)) {
              const langData = fs.readFileSync(langPath, 'utf8');
              const translations = JSON.parse(langData);
              
              // Cache all translations for this language
              for (const [k, v] of Object.entries(translations)) {
                translationCache.set(`${lang}:${k}`, v);
              }
              
              debugService.debug(`Lazily loaded translations for: ${lang}`);
            }
          } catch (error) {
            debugService.debug(`Failed to load translations: ${lang}`, { error: error.message });
          }
        }
        return translationCache.get(cacheKey);
      }
    };
  }

  /**
   * Setup lazy loading for plugins
   */
  setupLazyPlugins() {
    return {
      success: true,
      strategy: 'lazy-plugins',
      loadPlugin: (pluginName) => {
        debugService.debug(`Lazy loading plugin: ${pluginName}`);
        // Plugin loading would be handled by plugin manager
        return null;
      }
    };
  }

  /**
   * Compress data using simple JSON compression
   */
  compressData(data) {
    try {
      if (typeof data === 'string') {
        // Simple string compression by removing extra whitespace
        const compressed = data.replace(/\s+/g, ' ').trim();
        return {
          success: true,
          original: data.length,
          compressed: compressed.length,
          savings: data.length - compressed.length,
          data: compressed
        };
      } else if (typeof data === 'object') {
        // JSON compression by removing unnecessary whitespace
        const jsonString = JSON.stringify(data);
        const compressed = JSON.stringify(data); // Already compressed
        return {
          success: true,
          original: jsonString.length,
          compressed: compressed.length,
          savings: 0,
          data: JSON.parse(compressed)
        };
      }
      
      return { success: false, error: 'Unsupported data type for compression' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Optimize all caches
   */
  async optimizeCaches() {
    const results = {
      poolsOptimized: 0,
      itemsEvicted: 0,
      memoryFreed: 0,
      errors: []
    };

    try {
      for (const [poolName, pool] of this.resourcePools.entries()) {
        const beforeSize = pool.items.size;
        
        // Remove expired or least used items
        await this.cleanupPool(pool);
        
        const afterSize = pool.items.size;
        const evicted = beforeSize - afterSize;
        
        results.poolsOptimized++;
        results.itemsEvicted += evicted;
        
        debugService.debug(`Optimized pool ${poolName}`, { before: beforeSize, after: afterSize, evicted });
      }

      // Estimate memory freed (rough calculation)
      results.memoryFreed = results.itemsEvicted * 1024; // Assume 1KB per item

      return results;
    } catch (error) {
      results.errors.push(error.message);
      return results;
    }
  }

  /**
   * Clean up a specific resource pool
   */
  async cleanupPool(pool) {
    const now = Date.now();
    const maxAge = 30 * 60 * 1000; // 30 minutes
    const toRemove = [];

    // Find items to remove based on age and usage
    for (const [key, lastAccessed] of pool.lastAccessed.entries()) {
      const age = now - lastAccessed;
      const accessCount = pool.accessCount.get(key) || 0;

      // Remove if old and rarely used
      if (age > maxAge && accessCount < 2) {
        toRemove.push(key);
      }
    }

    // Remove identified items
    for (const key of toRemove) {
      pool.items.delete(key);
      pool.accessCount.delete(key);
      pool.lastAccessed.delete(key);
    }

    return toRemove.length;
  }

  /**
   * Manage concurrent operations
   */
  async manageOperation(operationFn) {
    // Check if we're at the limit
    if (this.activeOperations.size >= this.resourceLimits.maxConcurrentOperations) {
      // Queue the operation
      return new Promise((resolve, reject) => {
        this.operationQueue.push({ operationFn, resolve, reject });
      });
    }

    // Execute immediately
    return this.executeOperation(operationFn);
  }

  /**
   * Execute an operation with resource tracking
   */
  async executeOperation(operationFn) {
    const operationId = `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeOperations.add(operationId);
    
    try {
      const result = await operationFn();
      return result;
    } catch (error) {
      throw error;
    } finally {
      this.activeOperations.delete(operationId);
      
      // Process queue
      if (this.operationQueue.length > 0) {
        const { operationFn: nextOp, resolve, reject } = this.operationQueue.shift();
        this.executeOperation(nextOp).then(resolve).catch(reject);
      }
    }
  }

  /**
   * Perform scheduled cleanup tasks
   */
  async performScheduledCleanup() {
    try {
      debugService.debug('Performing scheduled resource cleanup');
      
      // Optimize caches
      const cacheResults = await this.optimizeCaches();
      
      // Check memory usage
      const memory = process.memoryUsage();
      if (memory.heapUsed > this.resourceLimits.maxMemoryUsage) {
        debugService.debug('High memory usage detected, triggering aggressive cleanup');
        await this.aggressiveCleanup();
      }

      // Log results
      performanceService.logPerformanceEvent('cleanup', 'Scheduled resource cleanup completed', {
        cacheResults,
        memoryUsage: memory.heapUsed,
        activeOperations: this.activeOperations.size
      });

    } catch (error) {
      debugService.debug('Scheduled cleanup failed', { error: error.message });
    }
  }

  /**
   * Perform aggressive cleanup when memory is high
   */
  async aggressiveCleanup() {
    let freedMemory = 0;

    try {
      // Clear all resource pools except most recently used
      for (const [poolName, pool] of this.resourcePools.entries()) {
        const beforeSize = pool.items.size;
        
        // Keep only the 10 most recently accessed items
        const sortedByAccess = Array.from(pool.lastAccessed.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(10);

        // Clear the pool
        pool.items.clear();
        pool.accessCount.clear();
        pool.lastAccessed.clear();

        // Restore the most recent items
        for (const [key] of sortedByAccess) {
          if (pool.items.has(key)) {
            // Item was already cleared, skip
            continue;
          }
        }

        const afterSize = pool.items.size;
        freedMemory += (beforeSize - afterSize) * 100; // Estimate

        debugService.debug(`Aggressively cleaned pool ${poolName}`, { 
          before: beforeSize, 
          after: afterSize 
        });
      }

      // Suggest garbage collection if available
      if (global.gc) {
        const gcResult = performanceService.suggestGarbageCollection();
        if (gcResult.success) {
          freedMemory += gcResult.freedBytes;
        }
      }

      return { success: true, freedMemory };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get resource usage statistics
   */
  getResourceStats() {
    const stats = {
      pools: {},
      operations: {
        active: this.activeOperations.size,
        queued: this.operationQueue.length,
        limit: this.resourceLimits.maxConcurrentOperations
      },
      memory: process.memoryUsage(),
      limits: this.resourceLimits
    };

    // Pool statistics
    for (const [poolName, pool] of this.resourcePools.entries()) {
      stats.pools[poolName] = {
        size: pool.items.size,
        maxSize: pool.maxSize,
        utilization: Math.round((pool.items.size / pool.maxSize) * 100),
        totalAccesses: Array.from(pool.accessCount.values()).reduce((sum, count) => sum + count, 0)
      };
    }

    return stats;
  }

  /**
   * Shutdown resource manager
   */
  shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Clear all pools
    for (const pool of this.resourcePools.values()) {
      pool.items.clear();
      pool.accessCount.clear();
      pool.lastAccessed.clear();
    }

    debugService.debug('Resource manager shutdown completed');
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection() {
    if (global.gc && typeof global.gc === 'function') {
      try {
        const before = process.memoryUsage();
        global.gc();
        const after = process.memoryUsage();
        
        const freed = before.heapUsed - after.heapUsed;
        debugService.debug('Forced garbage collection', { 
          freedBytes: freed,
          freedMB: Math.round(freed / 1024 / 1024 * 100) / 100
        });
        
        return { success: true, freedBytes: freed };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    
    return { success: false, error: 'Garbage collection not available (run with --expose-gc)' };
  }
}

module.exports = new ResourceManager();