/**
 * Performance Service Unit Tests
 */

const performanceService = require('../../src/services/performance-service');

describe('Performance Service', () => {
  beforeEach(async () => {
    await performanceService.initialize();
  });

  afterEach(() => {
    performanceService.clearAllMeasurements();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      const result = await performanceService.initialize();
      expect(result).toBe(true);
      expect(performanceService.isInitialized).toBe(true);
    });

    test('should setup performance monitoring', async () => {
      await performanceService.initialize();

      const stats = performanceService.getPerformanceStatistics();
      expect(stats).toHaveProperty('startTime');
      expect(stats).toHaveProperty('measurements');
    });
  });

  describe('performance measurements', () => {
    test('should mark performance points', () => {
      performanceService.markStart('test-operation');
      performanceService.markEnd('test-operation');

      const measurement = performanceService.getMeasurement('test-operation');
      expect(measurement).toBeDefined();
      expect(measurement).toHaveProperty('duration');
      expect(measurement.duration).toBeGreaterThanOrEqual(0);
    });

    test('should handle multiple measurements', () => {
      performanceService.markStart('op1');
      performanceService.markStart('op2');
      performanceService.markEnd('op1');
      performanceService.markEnd('op2');

      const measurements = performanceService.getAllMeasurements();
      expect(Object.keys(measurements)).toContain('op1');
      expect(Object.keys(measurements)).toContain('op2');
    });

    test('should measure async operations', async () => {
      const result = await performanceService.measureAsync(
        'async-test',
        async () => {
          await global.testUtils.wait(50);
          return 'test-result';
        }
      );

      expect(result).toBe('test-result');

      const measurement = performanceService.getMeasurement('async-test');
      expect(measurement).toBeDefined();
      expect(measurement.duration).toBeGreaterThanOrEqual(50);
    });

    test('should measure sync operations', () => {
      const result = performanceService.measureSync('sync-test', () => {
        return 'sync-result';
      });

      expect(result).toBe('sync-result');

      const measurement = performanceService.getMeasurement('sync-test');
      expect(measurement).toBeDefined();
      expect(measurement.duration).toBeGreaterThanOrEqual(0);
    });

    test('should handle measurement errors', async () => {
      const errorFn = async () => {
        throw new Error('Test error');
      };

      await expect(
        performanceService.measureAsync('error-test', errorFn)
      ).rejects.toThrow('Test error');

      // Measurement should still exist
      const measurement = performanceService.getMeasurement('error-test');
      expect(measurement).toBeDefined();
    });
  });

  describe('memory monitoring', () => {
    test('should capture memory snapshots', async () => {
      const snapshot = await performanceService.capturePerformanceSnapshot();

      expect(snapshot).toHaveProperty('memory');
      expect(snapshot.memory).toHaveProperty('heapUsed');
      expect(snapshot.memory).toHaveProperty('heapTotal');
      expect(snapshot.memory).toHaveProperty('external');
      expect(snapshot.memory).toHaveProperty('rss');
    });

    test('should detect memory trends', async () => {
      // Capture multiple snapshots
      await performanceService.capturePerformanceSnapshot();
      await global.testUtils.wait(100);
      await performanceService.capturePerformanceSnapshot();
      await global.testUtils.wait(100);
      await performanceService.capturePerformanceSnapshot();

      const stats = performanceService.getPerformanceStatistics();
      expect(stats.memorySnapshots.length).toBeGreaterThanOrEqual(3);
    });

    test('should monitor memory leaks', async () => {
      const initialSnapshot =
        await performanceService.capturePerformanceSnapshot();

      // Simulate memory usage
      const largeArray = new Array(1000000).fill('test');

      const secondSnapshot =
        await performanceService.capturePerformanceSnapshot();

      expect(secondSnapshot.memory.heapUsed).toBeGreaterThan(
        initialSnapshot.memory.heapUsed
      );

      // Clean up
      largeArray.length = 0;
    });
  });

  describe('resource thresholds', () => {
    test('should check memory thresholds', async () => {
      const snapshot = await performanceService.capturePerformanceSnapshot();
      const threshold = performanceService.getResourceThreshold(
        'memory',
        '1min'
      );

      expect(typeof threshold).toBe('number');
      expect(threshold).toBeGreaterThan(0);
    });

    test('should update resource thresholds', () => {
      const newThreshold = 100 * 1024 * 1024; // 100MB
      performanceService.updateResourceThreshold(
        'memory',
        '1min',
        newThreshold
      );

      const threshold = performanceService.getResourceThreshold(
        'memory',
        '1min'
      );
      expect(threshold).toBe(newThreshold);
    });

    test('should detect threshold violations', async () => {
      // Set very low threshold
      performanceService.updateResourceThreshold('memory', '1min', 1); // 1 byte

      const snapshot = await performanceService.capturePerformanceSnapshot();
      const violations = performanceService.checkResourceThresholds(snapshot);

      expect(violations.length).toBeGreaterThan(0);
      expect(violations[0]).toHaveProperty('resource', 'memory');
    });
  });

  describe('performance optimization', () => {
    test('should suggest optimizations', () => {
      // Create some measurements
      performanceService.markStart('slow-op');
      performanceService.markEnd('slow-op');

      const suggestions = performanceService.getOptimizationSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });

    test('should suggest garbage collection', () => {
      const result = performanceService.suggestGarbageCollection();

      if (global.gc) {
        expect(result).toHaveProperty('success');
        expect(result).toHaveProperty('freedBytes');
      } else {
        expect(result.success).toBe(false);
      }
    });

    test('should provide startup metrics', () => {
      const metrics = performanceService.getStartupMetrics();

      expect(metrics).toHaveProperty('processStartTime');
      expect(metrics).toHaveProperty('initializationTime');
      expect(metrics.processStartTime).toBeGreaterThan(0);
    });
  });

  describe('statistics and reporting', () => {
    test('should provide performance statistics', () => {
      performanceService.markStart('test');
      performanceService.markEnd('test');

      const stats = performanceService.getPerformanceStatistics();

      expect(stats).toHaveProperty('startTime');
      expect(stats).toHaveProperty('measurements');
      expect(stats).toHaveProperty('memorySnapshots');
      expect(stats).toHaveProperty('resourceThresholds');
    });

    test('should log performance events', () => {
      const consoleMock = global.testUtils.mockConsole();

      performanceService.logPerformanceEvent('test', 'Test event', {
        data: 'test',
      });

      // In test mode, this should not produce console output
      consoleMock.restore();
    });

    test('should clear measurements', () => {
      performanceService.markStart('temp');
      performanceService.markEnd('temp');

      expect(performanceService.getMeasurement('temp')).toBeDefined();

      performanceService.clearAllMeasurements();

      expect(performanceService.getMeasurement('temp')).toBeNull();
    });
  });

  describe('CPU monitoring', () => {
    test('should calculate CPU usage', async () => {
      const snapshot = await performanceService.capturePerformanceSnapshot();

      expect(snapshot).toHaveProperty('cpu');
      expect(snapshot.cpu).toHaveProperty('usage');
      expect(snapshot.cpu.usage).toBeWithinRange(0, 100);
    });

    test('should provide load averages', async () => {
      const snapshot = await performanceService.capturePerformanceSnapshot();

      if (process.platform !== 'win32') {
        expect(snapshot.cpu).toHaveProperty('loadAverage');
        expect(Array.isArray(snapshot.cpu.loadAverage)).toBe(true);
      }
    });
  });

  describe('garbage collection monitoring', () => {
    test('should track GC statistics', () => {
      const gcStats = performanceService.getGarbageCollectionStats();

      expect(gcStats).toHaveProperty('collections');
      expect(gcStats).toHaveProperty('totalTime');
      expect(gcStats).toHaveProperty('averageTime');
    });

    test('should update GC statistics', () => {
      const beforeStats = performanceService.getGarbageCollectionStats();

      performanceService.updateGCStats(100); // 100ms GC time

      const afterStats = performanceService.getGarbageCollectionStats();

      expect(afterStats.collections).toBe(beforeStats.collections + 1);
      expect(afterStats.totalTime).toBe(beforeStats.totalTime + 100);
    });
  });

  describe('performance events', () => {
    test('should track performance events', () => {
      const eventsBefore = performanceService.getPerformanceEvents();

      performanceService.logPerformanceEvent('test-event', 'Test description', {
        value: 123,
      });

      const eventsAfter = performanceService.getPerformanceEvents();

      expect(eventsAfter.length).toBe(eventsBefore.length + 1);
      expect(eventsAfter[eventsAfter.length - 1]).toHaveProperty(
        'type',
        'test-event'
      );
    });

    test('should limit event history', () => {
      // Add many events
      for (let i = 0; i < 150; i++) {
        performanceService.logPerformanceEvent('test', `Event ${i}`);
      }

      const events = performanceService.getPerformanceEvents();
      expect(events.length).toBeLessThanOrEqual(100); // Should be limited to 100
    });
  });

  describe('error handling', () => {
    test('should handle invalid measurement names', () => {
      expect(() => performanceService.markStart('')).not.toThrow();
      expect(() => performanceService.markEnd('')).not.toThrow();
    });

    test('should handle missing start marks', () => {
      expect(() => performanceService.markEnd('nonexistent')).not.toThrow();

      const measurement = performanceService.getMeasurement('nonexistent');
      expect(measurement).toBeNull();
    });

    test('should handle duplicate marks', () => {
      performanceService.markStart('duplicate');
      performanceService.markStart('duplicate'); // Should not error
      performanceService.markEnd('duplicate');

      const measurement = performanceService.getMeasurement('duplicate');
      expect(measurement).toBeDefined();
    });

    test('should handle service shutdown gracefully', () => {
      expect(() => performanceService.shutdown()).not.toThrow();
    });
  });
});
