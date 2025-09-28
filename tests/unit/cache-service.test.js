/**
 * Unit Tests for Cache Service
 */

const path = require('path');
const fs = require('fs-extra');

// Mock the cache service path to use test directory
jest.mock('../../src/services/cache-service', () => {
  const mockPath = require('path');
  const originalModule = jest.requireActual('../../src/services/cache-service');

  // Override cache directory for testing
  const mockCacheService = {
    ...originalModule,
    cacheDir:
      global.testUtils?.TEST_CACHE_DIR ||
      mockPath.join(__dirname, '../../test-cache'),
  };

  return mockCacheService;
});

const cacheService = require('../../src/services/cache-service');

describe('Cache Service', () => {
  beforeEach(async () => {
    await global.testUtils.setupTestDirs();
    // Clear any existing cache entries
    if (cacheService.clear) {
      await cacheService.clear();
    }
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
  });

  describe('basic cache operations', () => {
    test('should store and retrieve simple values', async () => {
      const key = 'test-key';
      const value = 'test-value';

      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toBe(value);
    });

    test('should store and retrieve complex objects', async () => {
      const key = 'complex-object';
      const value = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: {
          deep: {
            value: 'nested-data',
          },
        },
      };

      await cacheService.set(key, value);
      const retrieved = await cacheService.get(key);

      expect(retrieved).toEqual(value);
    });

    test('should return null for non-existent keys', async () => {
      const retrieved = await cacheService.get('non-existent-key');
      expect(retrieved).toBeNull();
    });

    test('should return default value for non-existent keys', async () => {
      const defaultValue = 'default';
      const retrieved = await cacheService.get(
        'non-existent-key',
        defaultValue
      );
      expect(retrieved).toBe(defaultValue);
    });

    test('should delete cache entries', async () => {
      const key = 'delete-test';
      const value = 'to-be-deleted';

      await cacheService.set(key, value);
      expect(await cacheService.get(key)).toBe(value);

      await cacheService.delete(key);
      expect(await cacheService.get(key)).toBeNull();
    });

    test('should check if cache entries exist', async () => {
      const key = 'exists-test';
      const value = 'exists';

      expect(await cacheService.has(key)).toBe(false);

      await cacheService.set(key, value);
      expect(await cacheService.has(key)).toBe(true);

      await cacheService.delete(key);
      expect(await cacheService.has(key)).toBe(false);
    });
  });

  describe('cache expiration', () => {
    test('should handle TTL expiration', async () => {
      const key = 'ttl-test';
      const value = 'expires';
      const ttl = 100; // 100ms

      await cacheService.set(key, value, ttl);
      expect(await cacheService.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(await cacheService.get(key)).toBeNull();
    });

    test('should handle explicit expiration timestamps', async () => {
      const key = 'expires-test';
      const value = 'will-expire';
      const expiresAt = Date.now() + 100; // 100ms from now

      await cacheService.set(key, value, null, expiresAt);
      expect(await cacheService.get(key)).toBe(value);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(await cacheService.get(key)).toBeNull();
    });

    test('should not expire entries without expiration', async () => {
      const key = 'no-expiry-test';
      const value = 'never-expires';

      await cacheService.set(key, value);
      expect(await cacheService.get(key)).toBe(value);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(await cacheService.get(key)).toBe(value);
    });
  });

  describe('cache cleanup', () => {
    test('should clean up expired entries', async () => {
      // Add expired entries
      const expiredKeys = ['expired-1', 'expired-2', 'expired-3'];
      for (const key of expiredKeys) {
        await cacheService.set(key, 'expired', 1); // 1ms TTL
      }

      // Add non-expired entries
      const activeKeys = ['active-1', 'active-2'];
      for (const key of activeKeys) {
        await cacheService.set(key, 'active');
      }

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 10));

      // Run cleanup
      await cacheService.cleanup();

      // Check that expired entries are gone
      for (const key of expiredKeys) {
        expect(await cacheService.get(key)).toBeNull();
      }

      // Check that active entries remain
      for (const key of activeKeys) {
        expect(await cacheService.get(key)).toBe('active');
      }

      // Cleanup test entries
      for (const key of activeKeys) {
        await cacheService.delete(key);
      }
    });

    test('should clear all cache entries', async () => {
      // Add multiple entries
      const entries = {
        'clear-test-1': 'value1',
        'clear-test-2': 'value2',
        'clear-test-3': { data: 'object' },
      };

      for (const [key, value] of Object.entries(entries)) {
        await cacheService.set(key, value);
      }

      // Verify entries exist
      for (const key of Object.keys(entries)) {
        expect(await cacheService.has(key)).toBe(true);
      }

      // Clear all
      await cacheService.clear();

      // Verify entries are gone
      for (const key of Object.keys(entries)) {
        expect(await cacheService.has(key)).toBe(false);
      }
    });
  });

  describe('cache metadata', () => {
    test('should store and retrieve cache metadata', async () => {
      const key = 'metadata-test';
      const value = 'test-data';
      const metadata = {
        source: 'test',
        version: '1.0',
        tags: ['test', 'metadata'],
      };

      await cacheService.set(key, value, null, null, metadata);
      const entry = await cacheService.getWithMetadata(key);

      expect(entry.data).toBe(value);
      expect(entry.metadata).toEqual(metadata);
      expect(entry.createdAt).toBeInstanceOf(Date);
    });

    test('should list all cache keys', async () => {
      const testKeys = ['list-test-1', 'list-test-2', 'list-test-3'];

      // Add test entries
      for (const key of testKeys) {
        await cacheService.set(key, `value-${key}`);
      }

      const allKeys = await cacheService.keys();

      for (const key of testKeys) {
        expect(allKeys).toContain(key);
      }

      // Cleanup
      for (const key of testKeys) {
        await cacheService.delete(key);
      }
    });

    test('should get cache statistics', async () => {
      // Clear cache first
      await cacheService.clear();

      const stats = await cacheService.stats();
      expect(stats.totalEntries).toBe(0);

      // Add some entries
      await cacheService.set('stats-test-1', 'value1');
      await cacheService.set('stats-test-2', 'value2');

      const newStats = await cacheService.stats();
      expect(newStats.totalEntries).toBe(2);
      expect(newStats.totalSize).toBeGreaterThan(0);

      // Cleanup
      await cacheService.clear();
    });
  });

  describe('error handling', () => {
    test('should handle invalid keys gracefully', async () => {
      const invalidKeys = [null, undefined, '', 123, {}, []];

      for (const invalidKey of invalidKeys) {
        await expect(cacheService.set(invalidKey, 'value')).rejects.toThrow();
        await expect(cacheService.get(invalidKey)).rejects.toThrow();
      }
    });

    test('should handle serialization errors', async () => {
      const key = 'serialization-test';

      // Create circular reference
      const circular = { a: 1 };
      circular.self = circular;

      await expect(cacheService.set(key, circular)).rejects.toThrow();
    });

    test('should handle file system errors gracefully', async () => {
      // Try to use invalid cache directory
      const originalCacheDir = cacheService.cacheDir;

      if (process.platform !== 'win32') {
        // On Unix systems, try to use a path that can't be created
        cacheService.cacheDir = '/root/invalid/path';

        await expect(cacheService.set('test', 'value')).rejects.toThrow();

        // Restore original cache directory
        cacheService.cacheDir = originalCacheDir;
      }
    });
  });

  describe('concurrent access', () => {
    test('should handle concurrent reads and writes', async () => {
      const key = 'concurrent-test';
      const concurrentOperations = 20;

      const promises = [];

      // Mix of read and write operations
      for (let i = 0; i < concurrentOperations; i++) {
        if (i % 2 === 0) {
          promises.push(cacheService.set(`concurrent-${i}`, `value-${i}`));
        } else {
          promises.push(cacheService.get(`concurrent-${Math.floor(i / 2)}`));
        }
      }

      const results = await Promise.all(promises);
      expect(results).toHaveLength(concurrentOperations);

      // Cleanup
      for (let i = 0; i < concurrentOperations; i += 2) {
        await cacheService.delete(`concurrent-${i}`);
      }
    });

    test('should handle rapid cache updates', async () => {
      const key = 'rapid-updates';
      const updateCount = 50;

      const promises = [];
      for (let i = 0; i < updateCount; i++) {
        promises.push(cacheService.set(key, `value-${i}`));
      }

      await Promise.all(promises);

      // The final value should be one of the set values
      const finalValue = await cacheService.get(key);
      expect(finalValue).toMatch(/^value-\d+$/);

      await cacheService.delete(key);
    });
  });

  describe('performance', () => {
    test('should handle large cache entries efficiently', async () => {
      const key = 'large-entry';
      const largeData = {
        array: new Array(10000)
          .fill(0)
          .map((_, i) => ({ id: i, value: Math.random() })),
        text: 'x'.repeat(100000), // 100KB string
      };

      const startTime = Date.now();

      await cacheService.set(key, largeData);
      const retrieved = await cacheService.get(key);

      const endTime = Date.now();

      expect(retrieved.array).toHaveLength(10000);
      expect(retrieved.text).toHaveLength(100000);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second

      await cacheService.delete(key);
    });

    test('should maintain performance with many cache entries', async () => {
      const entryCount = 1000;
      const startTime = Date.now();

      // Create many entries
      const promises = [];
      for (let i = 0; i < entryCount; i++) {
        promises.push(
          cacheService.set(`perf-test-${i}`, { index: i, data: `value-${i}` })
        );
      }

      await Promise.all(promises);

      // Read all entries
      const readPromises = [];
      for (let i = 0; i < entryCount; i++) {
        readPromises.push(cacheService.get(`perf-test-${i}`));
      }

      const results = await Promise.all(readPromises);
      const endTime = Date.now();

      expect(results).toHaveLength(entryCount);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete in under 10 seconds

      // Cleanup
      await cacheService.clear();
    });
  });

  describe('cache persistence', () => {
    test('should persist cache between service restarts', async () => {
      const key = 'persistence-test';
      const value = { data: 'persistent-data', timestamp: Date.now() };

      // Set cache entry
      await cacheService.set(key, value);

      // Simulate service restart by creating new cache service instance
      delete require.cache[require.resolve('../../src/services/cache-service')];
      const newCacheService = require('../../src/services/cache-service');

      // Value should still exist
      const retrieved = await newCacheService.get(key);
      expect(retrieved).toEqual(value);

      await newCacheService.delete(key);
    });
  });
});
