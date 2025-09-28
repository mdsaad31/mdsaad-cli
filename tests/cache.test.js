/**
 * Cache Service Tests
 * Comprehensive tests for the caching functionality
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Mock the logger and config services
jest.mock('../src/services/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn()
}));

jest.mock('../src/services/config', () => ({
  initialize: jest.fn(),
  getCacheDir: jest.fn().mockReturnValue(require('path').join(require('os').tmpdir(), `mdsaad-cache-test-${Date.now()}`))
}));

// Import the cache service after mocking
const cache = require('../src/services/cache');

describe('Cache Service', () => {
  let testCacheDir;

  beforeEach(async () => {
    // Reset cache service state
    cache.isInitialized = false;
    cache.cacheDir = null;
    
    // Get a fresh test directory
    testCacheDir = path.join(os.tmpdir(), `mdsaad-cache-test-${Date.now()}-${Math.random()}`);
    
    // Mock config to return our test directory
    require('../src/services/config').getCacheDir.mockReturnValue(testCacheDir);
    
    await cache.initialize();
  });

  afterEach(async () => {
    // Stop cleanup timer
    cache.stopCleanupTimer();
    
    // Clean up test directory
    try {
      await fs.remove(testCacheDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Initialization', () => {
    test('should initialize cache service successfully', () => {
      expect(cache.isInitialized).toBe(true);
      expect(cache.cacheDir).toBe(testCacheDir);
    });

    test('should create cache directories', async () => {
      const subdirs = ['weather', 'currency', 'ai', 'general'];
      
      for (const subdir of subdirs) {
        const dirPath = path.join(testCacheDir, subdir);
        expect(await fs.pathExists(dirPath)).toBe(true);
      }
    });
  });

  describe('Key Generation', () => {
    test('should generate consistent cache keys', () => {
      const key1 = cache.generateKey('weather', 'london', 'current');
      const key2 = cache.generateKey('weather', 'london', 'current');
      const key3 = cache.generateKey('weather', 'paris', 'current');
      
      expect(key1).toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key1).toHaveLength(16);
    });

    test('should handle different parameter types', () => {
      const key1 = cache.generateKey('test', 123, true, { city: 'london' });
      const key2 = cache.generateKey('test', 123, true, { city: 'london' });
      
      expect(key1).toBe(key2);
    });
  });

  describe('Basic Cache Operations', () => {
    test('should store and retrieve data', async () => {
      const testData = { temperature: 25, humidity: 60, city: 'London' };
      
      // Store data
      const stored = await cache.set('weather', 'london-current', testData, 10000);
      expect(stored).toBe(true);
      
      // Retrieve data
      const cached = await cache.get('weather', 'london-current');
      expect(cached).toBeTruthy();
      expect(cached.data).toEqual(testData);
      expect(cached.timestamp).toBeGreaterThan(Date.now() - 1000);
      expect(cached.age).toBeLessThan(1000);
    });

    test('should return null for non-existent cache entries', async () => {
      const cached = await cache.get('weather', 'non-existent');
      expect(cached).toBe(null);
    });

    test('should handle cache expiration', async () => {
      const testData = { test: 'data' };
      
      // Store with very short TTL
      await cache.set('test', 'expire-test', testData, 10); // 10ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Should return null after expiration
      const cached = await cache.get('test', 'expire-test');
      expect(cached).toBe(null);
    });

    test('should check if cache entry exists', async () => {
      const testData = { test: 'data' };
      
      // Should not exist initially
      expect(await cache.has('test', 'exists-test')).toBe(false);
      
      // Store data
      await cache.set('test', 'exists-test', testData);
      
      // Should exist now
      expect(await cache.has('test', 'exists-test')).toBe(true);
    });
  });

  describe('Cache Invalidation', () => {
    test('should invalidate specific cache entries', async () => {
      const testData = { test: 'data' };
      
      // Store data
      await cache.set('test', 'invalidate-test', testData);
      expect(await cache.has('test', 'invalidate-test')).toBe(true);
      
      // Invalidate
      const invalidated = await cache.invalidate('test', 'invalidate-test');
      expect(invalidated).toBe(true);
      expect(await cache.has('test', 'invalidate-test')).toBe(false);
    });

    test('should clear entire namespace', async () => {
      // Store multiple entries
      await cache.set('weather', 'london', { temp: 20 });
      await cache.set('weather', 'paris', { temp: 22 });
      await cache.set('currency', 'usd-eur', { rate: 0.85 });
      
      // Clear weather namespace
      const cleared = await cache.clearNamespace('weather');
      expect(cleared).toBe(true);
      
      // Weather entries should be gone
      expect(await cache.has('weather', 'london')).toBe(false);
      expect(await cache.has('weather', 'paris')).toBe(false);
      
      // Currency entry should remain
      expect(await cache.has('currency', 'usd-eur')).toBe(true);
    });

    test('should clear all cache entries', async () => {
      // Store entries in multiple namespaces
      await cache.set('weather', 'london', { temp: 20 });
      await cache.set('currency', 'usd-eur', { rate: 0.85 });
      await cache.set('ai', 'response-1', { text: 'hello' });
      
      // Clear all
      const cleared = await cache.clearAll();
      expect(cleared).toBe(true);
      
      // All entries should be gone
      expect(await cache.has('weather', 'london')).toBe(false);
      expect(await cache.has('currency', 'usd-eur')).toBe(false);
      expect(await cache.has('ai', 'response-1')).toBe(false);
    });
  });

  describe('Cache Cleanup', () => {
    test('should clean up expired entries', async () => {
      // Store entries with different TTLs
      await cache.set('test', 'expire-1', { data: '1' }, 10); // 10ms
      await cache.set('test', 'expire-2', { data: '2' }, 10); // 10ms
      await cache.set('test', 'keep-1', { data: '3' }, 10000); // 10s
      
      // Wait for some to expire
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Run cleanup
      const cleanedCount = await cache.cleanup();
      expect(cleanedCount).toBeGreaterThan(0);
      
      // Expired entries should be gone
      expect(await cache.has('test', 'expire-1')).toBe(false);
      expect(await cache.has('test', 'expire-2')).toBe(false);
      
      // Non-expired should remain
      expect(await cache.has('test', 'keep-1')).toBe(true);
    });

    test('should remove corrupted cache files', async () => {
      // Create a corrupted cache file manually
      const corruptedPath = path.join(testCacheDir, 'test', 'corrupted.json');
      await fs.writeFile(corruptedPath, 'invalid json content');
      
      // Cleanup should remove corrupted file
      const cleanedCount = await cache.cleanup();
      expect(cleanedCount).toBeGreaterThan(0);
      expect(await fs.pathExists(corruptedPath)).toBe(false);
    });
  });

  describe('Cache Statistics', () => {
    test('should provide comprehensive cache statistics', async () => {
      // Store test data
      await cache.set('weather', 'london', { temp: 20 });
      await cache.set('weather', 'paris', { temp: 22 });
      await cache.set('currency', 'usd-eur', { rate: 0.85 });
      
      const stats = await cache.getStats();
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.namespaces).toHaveProperty('weather');
      expect(stats.namespaces).toHaveProperty('currency');
      expect(stats.namespaces.weather.entries).toBe(2);
      expect(stats.namespaces.currency.entries).toBe(1);
      expect(stats.oldestEntry).toBeTruthy();
      expect(stats.newestEntry).toBeTruthy();
    });

    test('should track expired entries in statistics', async () => {
      // Store expired entry
      await cache.set('test', 'expired', { data: 'test' }, 10); // 10ms TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 50));
      
      const stats = await cache.getStats();
      expect(stats.expiredEntries).toBeGreaterThan(0);
    });
  });

  describe('Cache Middleware', () => {
    test('should serve from cache when available', async () => {
      const fetchFunction = jest.fn().mockResolvedValue({ result: 'fresh data' });
      const middleware = cache.middleware('test', 10000);
      
      // First call should fetch fresh data
      const result1 = await middleware('test-key', fetchFunction);
      expect(result1.result).toBe('fresh data');
      expect(result1._cached).toBe(false);
      expect(fetchFunction).toHaveBeenCalledTimes(1);
      
      // Second call should serve from cache
      const result2 = await middleware('test-key', fetchFunction);
      expect(result2.result).toBe('fresh data');
      expect(result2._cached).toBe(true);
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Not called again
    });

    test('should handle fetch function errors', async () => {
      const fetchFunction = jest.fn().mockRejectedValue(new Error('API Error'));
      const middleware = cache.middleware('test', 10000);
      
      await expect(middleware('error-key', fetchFunction)).rejects.toThrow('API Error');
    });
  });

  describe('Cache Size Management', () => {
    test('should set and respect maximum cache size', () => {
      const originalSize = cache.maxCacheSize;
      
      cache.setMaxSize(1024); // 1KB
      expect(cache.maxCacheSize).toBe(1024);
      
      // Restore original size
      cache.maxCacheSize = originalSize;
    });
  });

  describe('Array Key Support', () => {
    test('should handle array keys properly', async () => {
      const testData = { temp: 25 };
      const keyArray = ['weather', 'london', 'current', '2023'];
      
      // Store with array key
      await cache.set('weather', keyArray, testData);
      
      // Retrieve with same array key
      const cached = await cache.get('weather', keyArray);
      expect(cached.data).toEqual(testData);
      
      // Should generate consistent keys for same array
      const key1 = cache.generateKey('weather', ...keyArray);
      const key2 = cache.generateKey('weather', ...keyArray);
      expect(key1).toBe(key2);
    });
  });

  describe('Graceful Shutdown', () => {
    test('should shutdown gracefully', async () => {
      // Store some test data
      await cache.set('test', 'shutdown-test', { data: 'test' });
      
      // Shutdown should complete without errors
      await expect(cache.shutdown()).resolves.not.toThrow();
    });
  });
});