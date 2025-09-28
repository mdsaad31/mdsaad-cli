/**
 * Performance and Load Testing for Critical Operations
 */

const { performance } = require('perf_hooks');
const os = require('os');
const path = require('path');

// Import services for direct testing
const calculateCommand = require('../../src/commands/calculate');
const configService = require('../../src/services/config-manager');
const performanceService = require('../../src/services/performance-service');
const cacheService = require('../../src/services/cache-service');
const conversionService = require('../../src/services/conversion-service');

describe('Performance and Load Tests', () => {
  let originalConsole;

  beforeAll(async () => {
    originalConsole = console.log;
    console.log = jest.fn(); // Suppress console output during performance tests
    await global.testUtils.setupTestDirs();
  });

  afterAll(async () => {
    console.log = originalConsole;
    await global.testUtils.cleanupTestDirs();
  });

  beforeEach(async () => {
    // Clear any existing performance metrics
    if (performanceService.clearMetrics) {
      performanceService.clearMetrics();
    }
  });

  describe('calculation performance', () => {
    test('should handle high-volume arithmetic calculations', async () => {
      const startTime = performance.now();
      const results = [];

      // Perform 1000 calculations
      for (let i = 0; i < 1000; i++) {
        const expression = `${i} + ${i * 2} * sqrt(${i + 1})`;
        const result = await calculateCommand.handler({ expression, precision: 2 });
        results.push(result);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / 1000;

      expect(results).toHaveLength(1000);
      expect(totalTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(avgTime).toBeLessThan(5); // Average under 5ms per calculation

      console.log(`Completed 1000 calculations in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });

    test('should handle complex mathematical expressions efficiently', async () => {
      const complexExpressions = [
        'sin(pi/4) * cos(pi/3) + tan(pi/6)',
        'log(exp(5)) + sqrt(pow(3, 4))',
        '(factorial(5) + fibonacci(10)) / golden_ratio',
        'integral(x^2, 0, 5) + derivative(x^3, 2)',
        'matrix([[1,2],[3,4]]) * matrix([[5,6],[7,8]])'
      ];

      const startTime = performance.now();

      for (const expression of complexExpressions) {
        const iterationStart = performance.now();
        
        try {
          await calculateCommand.handler({ expression, precision: 6 });
          const iterationTime = performance.now() - iterationStart;
          expect(iterationTime).toBeLessThan(100); // Each complex calc under 100ms
        } catch (error) {
          // Some expressions might not be supported, that's okay
          console.log(`Expression not supported: ${expression}`);
        }
      }

      const totalTime = performance.now() - startTime;
      expect(totalTime).toBeLessThan(1000); // All complex calculations under 1 second
    });

    test('should maintain performance under concurrent calculations', async () => {
      const concurrentCount = 50;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentCount }, (_, i) => {
        return calculateCommand.handler({ 
          expression: `${i} * pi + sqrt(${i + 100})`, 
          precision: 4 
        });
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(concurrentCount);
      expect(endTime - startTime).toBeLessThan(2000); // Concurrent ops under 2 seconds
    });
  });

  describe('cache performance', () => {
    test('should handle high-volume cache operations', async () => {
      const operations = 1000;
      const startTime = performance.now();

      // Write operations
      for (let i = 0; i < operations; i++) {
        await cacheService.set(`test_key_${i}`, { 
          data: `test_value_${i}`, 
          timestamp: Date.now(),
          metadata: { index: i }
        });
      }

      const writeTime = performance.now() - startTime;

      // Read operations
      const readStart = performance.now();
      for (let i = 0; i < operations; i++) {
        const value = await cacheService.get(`test_key_${i}`);
        expect(value).toBeTruthy();
      }

      const readTime = performance.now() - readStart;
      const totalTime = writeTime + readTime;

      expect(writeTime).toBeLessThan(3000); // Writes under 3 seconds
      expect(readTime).toBeLessThan(1000); // Reads under 1 second
      expect(totalTime).toBeLessThan(4000); // Total under 4 seconds

      console.log(`Cache performance: ${operations} writes in ${writeTime.toFixed(2)}ms, reads in ${readTime.toFixed(2)}ms`);

      // Cleanup
      for (let i = 0; i < operations; i++) {
        await cacheService.delete(`test_key_${i}`);
      }
    });

    test('should handle cache cleanup efficiently', async () => {
      // Create a lot of cache entries
      for (let i = 0; i < 500; i++) {
        await cacheService.set(`cleanup_test_${i}`, { 
          data: `value_${i}`,
          expires: Date.now() - 1000 // Already expired
        });
      }

      const startTime = performance.now();
      await cacheService.cleanup();
      const cleanupTime = performance.now() - startTime;

      expect(cleanupTime).toBeLessThan(2000); // Cleanup under 2 seconds
    });

    test('should maintain performance with large cache entries', async () => {
      const largeData = {
        array: new Array(10000).fill(0).map((_, i) => ({ id: i, value: Math.random() })),
        string: 'x'.repeat(50000), // 50KB string
        nested: {
          level1: {
            level2: {
              level3: new Array(1000).fill({ data: 'test'.repeat(100) })
            }
          }
        }
      };

      const startTime = performance.now();

      // Store large entry
      await cacheService.set('large_entry', largeData);
      
      // Retrieve large entry
      const retrieved = await cacheService.get('large_entry');
      
      const endTime = performance.now();

      expect(retrieved).toBeTruthy();
      expect(retrieved.array).toHaveLength(10000);
      expect(endTime - startTime).toBeLessThan(500); // Large cache ops under 500ms

      // Cleanup
      await cacheService.delete('large_entry');
    });
  });

  describe('configuration performance', () => {
    test('should handle rapid configuration changes', async () => {
      const operations = 200;
      const startTime = performance.now();

      for (let i = 0; i < operations; i++) {
        await configService.set(`perf_test_key_${i}`, `value_${i}`);
        const value = await configService.get(`perf_test_key_${i}`);
        expect(value).toBe(`value_${i}`);
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(3000); // Rapid config changes under 3 seconds

      // Cleanup
      const config = await configService.getAll();
      for (const key of Object.keys(config)) {
        if (key.startsWith('perf_test_key_')) {
          await configService.delete(key);
        }
      }
    });

    test('should handle concurrent configuration access', async () => {
      const concurrentOps = 25;
      const startTime = performance.now();

      const promises = Array.from({ length: concurrentOps }, async (_, i) => {
        await configService.set(`concurrent_${i}`, { data: i, timestamp: Date.now() });
        return configService.get(`concurrent_${i}`);
      });

      const results = await Promise.all(promises);
      const endTime = performance.now();

      expect(results).toHaveLength(concurrentOps);
      expect(endTime - startTime).toBeLessThan(1000); // Concurrent config ops under 1 second

      // Cleanup
      for (let i = 0; i < concurrentOps; i++) {
        await configService.delete(`concurrent_${i}`);
      }
    });
  });

  describe('conversion performance', () => {
    test('should handle batch unit conversions efficiently', async () => {
      const conversions = [
        { amount: 100, from: 'meters', to: 'feet' },
        { amount: 50, from: 'kg', to: 'pounds' },
        { amount: 25, from: 'celsius', to: 'fahrenheit' },
        { amount: 1000, from: 'seconds', to: 'minutes' },
        { amount: 5, from: 'miles', to: 'kilometers' }
      ];

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const conversion of conversions) {
          const result = await conversionService.convertUnits(
            conversion.amount,
            conversion.from,
            conversion.to
          );
          expect(typeof result).toBe('number');
        }
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / (iterations * conversions.length);

      expect(totalTime).toBeLessThan(5000); // Batch conversions under 5 seconds
      expect(avgTime).toBeLessThan(1); // Average under 1ms per conversion

      console.log(`Completed ${iterations * conversions.length} conversions in ${totalTime.toFixed(2)}ms (avg: ${avgTime.toFixed(2)}ms)`);
    });

    test('should handle currency conversion lookup performance', async () => {
      // Mock exchange rate data for performance testing
      await global.testUtils.createMockCache('exchange_rates_USD', {
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          EUR: 0.85, GBP: 0.73, JPY: 110.0, CAD: 1.25, AUD: 1.35,
          CHF: 0.92, CNY: 6.45, SEK: 8.75, NZD: 1.45, MXN: 20.1
        }
      });

      const currencies = ['EUR', 'GBP', 'JPY', 'CAD', 'AUD'];
      const iterations = 50;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        for (const currency of currencies) {
          const result = await conversionService.convertCurrency(100, 'USD', currency);
          expect(typeof result).toBe('number');
        }
      }

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(2000); // Currency lookups under 2 seconds
    });
  });

  describe('memory performance', () => {
    test('should not leak memory during intensive operations', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      for (let i = 0; i < 100; i++) {
        // Create and process large datasets
        const largeArray = new Array(10000).fill(0).map((_, idx) => ({
          id: idx,
          data: Math.random().toString(36).repeat(10)
        }));

        // Perform calculations on the data
        await calculateCommand.handler({ 
          expression: `${largeArray.length} * pi + sqrt(${i})` 
        });

        // Store in cache temporarily
        await cacheService.set(`temp_${i}`, largeArray);
        
        // Clean up immediately
        await cacheService.delete(`temp_${i}`);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseKB = memoryIncrease / 1024;

      expect(memoryIncreaseKB).toBeLessThan(10240); // Memory increase under 10MB
      
      console.log(`Memory usage: Initial ${(initialMemory.heapUsed / 1024).toFixed(2)}KB, Final ${(finalMemory.heapUsed / 1024).toFixed(2)}KB, Increase ${memoryIncreaseKB.toFixed(2)}KB`);
    });

    test('should handle memory-efficient cache operations', async () => {
      const initialMemory = process.memoryUsage();
      const cacheKeys = [];

      // Fill cache with substantial data
      for (let i = 0; i < 1000; i++) {
        const key = `memory_test_${i}`;
        const data = {
          id: i,
          payload: new Array(100).fill(0).map(() => Math.random()),
          timestamp: Date.now()
        };
        
        await cacheService.set(key, data);
        cacheKeys.push(key);
      }

      const peakMemory = process.memoryUsage();

      // Clear all cache entries
      for (const key of cacheKeys) {
        await cacheService.delete(key);
      }

      // Force cleanup
      await cacheService.cleanup();
      
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      
      const peakIncrease = (peakMemory.heapUsed - initialMemory.heapUsed) / 1024;
      const finalIncrease = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024;

      expect(peakIncrease).toBeGreaterThan(0); // Should use memory during operations
      expect(finalIncrease).toBeLessThan(peakIncrease * 0.5); // Should release most memory after cleanup

      console.log(`Cache memory test: Peak increase ${peakIncrease.toFixed(2)}KB, Final increase ${finalIncrease.toFixed(2)}KB`);
    });
  });

  describe('CPU performance', () => {
    test('should handle CPU-intensive calculations efficiently', async () => {
      const cpuIntensiveExpressions = [
        'factorial(10) + factorial(9)',
        'fibonacci(20) * golden_ratio',
        'sin(1) + cos(1) + tan(1)', // Repeated 100 times
        'log(exp(10)) * sqrt(1000000)'
      ];

      const startTime = performance.now();
      let operations = 0;

      // Run CPU-intensive operations for a time-bounded period
      const timeLimit = 2000; // 2 seconds

      while (performance.now() - startTime < timeLimit) {
        for (const expression of cpuIntensiveExpressions) {
          try {
            await calculateCommand.handler({ expression, precision: 8 });
            operations++;
          } catch (error) {
            // Some expressions might not be supported
            continue;
          }
        }
      }

      const totalTime = performance.now() - startTime;
      const opsPerSecond = (operations / totalTime) * 1000;

      expect(operations).toBeGreaterThan(10); // Should complete at least 10 operations
      expect(opsPerSecond).toBeGreaterThan(5); // At least 5 operations per second

      console.log(`CPU performance: ${operations} operations in ${totalTime.toFixed(2)}ms (${opsPerSecond.toFixed(2)} ops/sec)`);
    });

    test('should maintain responsiveness under load', async () => {
      const startTime = performance.now();
      const responseTimes = [];

      // Simulate multiple concurrent operations
      const concurrentPromises = Array.from({ length: 10 }, async (_, i) => {
        const opStart = performance.now();
        
        // Mix of different operation types
        if (i % 3 === 0) {
          await calculateCommand.handler({ expression: `${i} * pi + sqrt(${i + 1})` });
        } else if (i % 3 === 1) {
          await cacheService.set(`load_test_${i}`, { data: i, timestamp: Date.now() });
        } else {
          await configService.get('language', 'en');
        }
        
        const responseTime = performance.now() - opStart;
        responseTimes.push(responseTime);
        return responseTime;
      });

      await Promise.all(concurrentPromises);
      const totalTime = performance.now() - startTime;

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      expect(avgResponseTime).toBeLessThan(100); // Average response under 100ms
      expect(maxResponseTime).toBeLessThan(500); // Max response under 500ms
      expect(totalTime).toBeLessThan(1000); // Total concurrent ops under 1 second

      console.log(`Load test: Avg response ${avgResponseTime.toFixed(2)}ms, Max ${maxResponseTime.toFixed(2)}ms, Total ${totalTime.toFixed(2)}ms`);

      // Cleanup
      for (let i = 0; i < 10; i++) {
        if (i % 3 === 1) {
          await cacheService.delete(`load_test_${i}`);
        }
      }
    });
  });

  describe('startup performance', () => {
    test('should measure module loading performance', async () => {
      const loadTimes = {};
      const modules = [
        'config-manager',
        'cache-service',
        'performance-service',
        'conversion-service'
      ];

      for (const moduleName of modules) {
        const startTime = performance.now();
        
        // Clear module from cache to measure fresh load time
        const modulePath = require.resolve(`../../src/services/${moduleName}`);
        delete require.cache[modulePath];
        
        // Reload module
        require(`../../src/services/${moduleName}`);
        
        const loadTime = performance.now() - startTime;
        loadTimes[moduleName] = loadTime;
        
        expect(loadTime).toBeLessThan(50); // Each module should load under 50ms
      }

      const totalLoadTime = Object.values(loadTimes).reduce((a, b) => a + b, 0);
      expect(totalLoadTime).toBeLessThan(200); // All modules under 200ms

      console.log('Module load times:', Object.entries(loadTimes).map(([name, time]) => 
        `${name}: ${time.toFixed(2)}ms`
      ).join(', '));
    });
  });

  describe('system resource monitoring', () => {
    test('should monitor system resources during operations', async () => {
      const initialStats = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime()
      };

      // Perform resource-intensive operations
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          calculateCommand.handler({ expression: `${i} * pi + sqrt(factorial(${Math.min(i, 8)}))` })
        );
      }

      await Promise.all(operations);

      const finalStats = {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(initialStats.cpu),
        uptime: process.uptime()
      };

      // Memory checks
      const memoryIncrease = finalStats.memory.heapUsed - initialStats.memory.heapUsed;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Under 50MB increase

      // CPU usage should be reasonable
      const cpuPercent = (finalStats.cpu.user + finalStats.cpu.system) / 1000; // Convert to ms
      expect(cpuPercent).toBeLessThan(5000); // Under 5 seconds of CPU time

      console.log(`Resource usage: Memory +${(memoryIncrease / 1024).toFixed(2)}KB, CPU ${cpuPercent.toFixed(2)}ms`);
    });
  });

  describe('scalability tests', () => {
    test('should scale linearly with operation count', async () => {
      const testSizes = [10, 50, 100];
      const results = {};

      for (const size of testSizes) {
        const startTime = performance.now();
        
        const promises = Array.from({ length: size }, (_, i) => 
          calculateCommand.handler({ expression: `${i} + ${i * 2}` })
        );
        
        await Promise.all(promises);
        
        const endTime = performance.now();
        results[size] = endTime - startTime;
      }

      // Check that scaling is roughly linear
      const ratio50to10 = results[50] / results[10];
      const ratio100to50 = results[100] / results[50];

      expect(ratio50to10).toBeLessThan(8); // 50 ops shouldn't take 8x longer than 10 ops
      expect(ratio100to50).toBeLessThan(4); // 100 ops shouldn't take 4x longer than 50 ops

      console.log(`Scalability: 10 ops: ${results[10].toFixed(2)}ms, 50 ops: ${results[50].toFixed(2)}ms, 100 ops: ${results[100].toFixed(2)}ms`);
    });
  });
});