/**
 * Performance Monitoring Service
 * Tracks performance metrics, memory usage, and provides optimization insights
 */

const os = require('os');
const fs = require('fs-extra');
const path = require('path');
const debugService = require('./debug-service');

class PerformanceService {
  constructor() {
    this.isInitialized = false;
    this.metrics = new Map();
    this.memorySnapshots = [];
    this.startupTime = null;
    this.commandTimes = new Map();
    this.resourceThresholds = {
      memoryWarning: 100 * 1024 * 1024, // 100MB
      memoryCritical: 500 * 1024 * 1024, // 500MB
      cpuWarning: 80, // 80% CPU usage
      startupWarning: 1000, // 1 second startup
      commandWarning: 5000, // 5 seconds per command
    };
    this.monitoringInterval = null;
    this.performanceLog = [];
    this.maxLogEntries = 100;
  }

  /**
   * Initialize performance monitoring
   */
  async initialize() {
    try {
      this.startupTime = Date.now();
      this.captureInitialSnapshot();
      this.startMemoryMonitoring();
      this.isInitialized = true;

      debugService.debug('Performance monitoring initialized');
      return true;
    } catch (error) {
      console.warn(
        'Performance monitoring initialization failed:',
        error.message
      );
      return false;
    }
  }

  /**
   * Capture initial system snapshot
   */
  captureInitialSnapshot() {
    const snapshot = {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      cpu: os.loadavg(),
      uptime: os.uptime(),
      platform: os.platform(),
      nodeVersion: process.version,
      pid: process.pid,
    };

    this.memorySnapshots.push(snapshot);
    this.logPerformanceEvent('startup', 'System snapshot captured', snapshot);
  }

  /**
   * Start continuous memory monitoring
   */
  startMemoryMonitoring() {
    // Monitor every 30 seconds in background
    this.monitoringInterval = setInterval(() => {
      try {
        this.checkResourceUsage();
        this.trimOldSnapshots();
      } catch (error) {
        debugService.debug('Memory monitoring error', { error: error.message });
      }
    }, 30000);

    // Don't keep the process alive just for monitoring
    if (
      this.monitoringInterval &&
      typeof this.monitoringInterval.unref === 'function'
    ) {
      this.monitoringInterval.unref();
    }
  }

  /**
   * Stop performance monitoring
   */
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logPerformanceEvent('shutdown', 'Performance monitoring stopped', {
      totalRuntime: Date.now() - this.startupTime,
      totalCommands: this.commandTimes.size,
      peakMemory: this.getPeakMemoryUsage(),
    });
  }

  /**
   * Mark the start of a performance measurement
   */
  markStart(label) {
    const startTime = process.hrtime.bigint();
    this.metrics.set(label, {
      start: startTime,
      memory: process.memoryUsage(),
    });
    debugService.debug(`Performance mark start: ${label}`);
  }

  /**
   * Mark the end of a performance measurement and return duration
   */
  markEnd(label) {
    const metric = this.metrics.get(label);
    if (!metric) {
      debugService.debug(`Performance mark not found: ${label}`);
      return null;
    }

    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - metric.start) / 1000000; // Convert to milliseconds
    const endMemory = process.memoryUsage();

    const result = {
      label,
      duration,
      memoryUsed: endMemory.heapUsed - metric.memory.heapUsed,
      startMemory: metric.memory,
      endMemory,
    };

    this.metrics.delete(label);
    this.logPerformanceEvent('measurement', label, result);

    // Check for performance warnings
    if (duration > this.resourceThresholds.commandWarning) {
      this.logPerformanceEvent('warning', `Slow operation: ${label}`, {
        duration,
      });
    }

    return result;
  }

  /**
   * Measure the execution time of a function
   */
  async measureAsync(label, asyncFunction) {
    this.markStart(label);
    try {
      const result = await asyncFunction();
      const metrics = this.markEnd(label);
      return { result, metrics };
    } catch (error) {
      this.markEnd(label);
      throw error;
    }
  }

  /**
   * Measure the execution time of a synchronous function
   */
  measureSync(label, syncFunction) {
    this.markStart(label);
    try {
      const result = syncFunction();
      const metrics = this.markEnd(label);
      return { result, metrics };
    } catch (error) {
      this.markEnd(label);
      throw error;
    }
  }

  /**
   * Check current resource usage and log warnings
   */
  checkResourceUsage() {
    const memory = process.memoryUsage();
    const snapshot = {
      timestamp: Date.now(),
      memory,
      cpu: os.loadavg(),
      uptime: process.uptime(),
    };

    this.memorySnapshots.push(snapshot);

    // Check memory thresholds
    if (memory.heapUsed > this.resourceThresholds.memoryCritical) {
      this.logPerformanceEvent('critical', 'High memory usage detected', {
        heapUsed: memory.heapUsed,
        threshold: this.resourceThresholds.memoryCritical,
      });
    } else if (memory.heapUsed > this.resourceThresholds.memoryWarning) {
      this.logPerformanceEvent('warning', 'Elevated memory usage', {
        heapUsed: memory.heapUsed,
        threshold: this.resourceThresholds.memoryWarning,
      });
    }

    // Check for memory leaks (steadily increasing memory)
    if (this.memorySnapshots.length >= 5) {
      const recentSnapshots = this.memorySnapshots.slice(-5);
      const memoryTrend = this.analyzeMemoryTrend(recentSnapshots);

      if (memoryTrend.isIncreasing && memoryTrend.rate > 10 * 1024 * 1024) {
        // 10MB increase
        this.logPerformanceEvent(
          'warning',
          'Potential memory leak detected',
          memoryTrend
        );
      }
    }
  }

  /**
   * Analyze memory usage trend
   */
  analyzeMemoryTrend(snapshots) {
    if (snapshots.length < 2) return { isIncreasing: false, rate: 0 };

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const timeDiff = last.timestamp - first.timestamp;
    const memoryDiff = last.memory.heapUsed - first.memory.heapUsed;

    return {
      isIncreasing: memoryDiff > 0,
      rate: memoryDiff / (timeDiff / 1000), // Bytes per second
      totalIncrease: memoryDiff,
      duration: timeDiff,
    };
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats() {
    const memory = process.memoryUsage();
    const totalSystem = os.totalmem();
    const freeSystem = os.freemem();

    return {
      process: {
        heap: {
          used: memory.heapUsed,
          total: memory.heapTotal,
          usedMB: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
          totalMB: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        },
        rss: {
          used: memory.rss,
          usedMB: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
        },
        external: memory.external,
      },
      system: {
        total: totalSystem,
        free: freeSystem,
        used: totalSystem - freeSystem,
        usedPercent: Math.round(
          ((totalSystem - freeSystem) / totalSystem) * 100
        ),
        totalGB: Math.round((totalSystem / 1024 / 1024 / 1024) * 100) / 100,
        freeGB: Math.round((freeSystem / 1024 / 1024 / 1024) * 100) / 100,
      },
    };
  }

  /**
   * Get CPU usage statistics
   */
  getCPUStats() {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      cores: cpus.length,
      model: cpus[0] ? cpus[0].model : 'Unknown',
      speed: cpus[0] ? cpus[0].speed : 0,
      loadAverage: {
        '1min': Math.round(loadAvg[0] * 100) / 100,
        '5min': Math.round(loadAvg[1] * 100) / 100,
        '15min': Math.round(loadAvg[2] * 100) / 100,
      },
      usage: this.calculateCPUUsage(cpus),
    };
  }

  /**
   * Calculate CPU usage percentage
   */
  calculateCPUUsage(cpus) {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~((100 * idle) / total);

    return Math.max(0, Math.min(100, usage));
  }

  /**
   * Get startup performance metrics
   */
  getStartupMetrics() {
    if (!this.startupTime) return null;

    const startupDuration = Date.now() - this.startupTime;
    const isOptimal = startupDuration < this.resourceThresholds.startupWarning;

    return {
      duration: startupDuration,
      isOptimal,
      threshold: this.resourceThresholds.startupWarning,
      nodeStartup: process.uptime() * 1000,
      status: isOptimal ? 'optimal' : 'slow',
    };
  }

  /**
   * Get peak memory usage
   */
  getPeakMemoryUsage() {
    if (this.memorySnapshots.length === 0) return null;

    const peak = this.memorySnapshots.reduce((max, snapshot) => {
      return snapshot.memory.heapUsed > max.memory.heapUsed ? snapshot : max;
    }, this.memorySnapshots[0]);

    return {
      timestamp: peak.timestamp,
      heapUsed: peak.memory.heapUsed,
      heapUsedMB: Math.round((peak.memory.heapUsed / 1024 / 1024) * 100) / 100,
      rss: peak.memory.rss,
    };
  }

  /**
   * Generate performance report
   */
  generateReport() {
    const memory = this.getMemoryStats();
    const cpu = this.getCPUStats();
    const startup = this.getStartupMetrics();
    const peak = this.getPeakMemoryUsage();

    const report = {
      timestamp: new Date().toISOString(),
      runtime: this.startupTime ? Date.now() - this.startupTime : 0,
      startup,
      memory,
      cpu,
      peak,
      commands: {
        total: this.commandTimes.size,
        average: this.getAverageCommandTime(),
        slowest: this.getSlowestCommand(),
      },
      recommendations: this.generateRecommendations(memory, cpu, startup),
      log: this.performanceLog.slice(-10), // Last 10 entries
    };

    return report;
  }

  /**
   * Generate performance recommendations
   */
  generateRecommendations(memory, cpu, startup) {
    const recommendations = [];

    // Memory recommendations
    if (memory.process.heap.usedMB > 50) {
      recommendations.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage (${memory.process.heap.usedMB}MB). Consider clearing caches or restarting.`,
      });
    }

    // CPU recommendations
    if (cpu.usage > this.resourceThresholds.cpuWarning) {
      recommendations.push({
        type: 'cpu',
        severity: 'warning',
        message: `High CPU usage (${cpu.usage}%). System may be under load.`,
      });
    }

    // Startup recommendations
    if (startup && !startup.isOptimal) {
      recommendations.push({
        type: 'startup',
        severity: 'info',
        message: `Slow startup (${startup.duration}ms). Consider reducing plugins or clearing caches.`,
      });
    }

    // General recommendations
    if (this.memorySnapshots.length > 50) {
      recommendations.push({
        type: 'monitoring',
        severity: 'info',
        message:
          'Long-running session detected. Performance data is being collected for optimization.',
      });
    }

    return recommendations;
  }

  /**
   * Get average command execution time
   */
  getAverageCommandTime() {
    if (this.commandTimes.size === 0) return 0;

    const times = Array.from(this.commandTimes.values());
    const total = times.reduce((sum, time) => sum + time, 0);
    return Math.round(total / times.length);
  }

  /**
   * Get slowest command
   */
  getSlowestCommand() {
    if (this.commandTimes.size === 0) return null;

    let slowest = null;
    let maxTime = 0;

    for (const [command, time] of this.commandTimes.entries()) {
      if (time > maxTime) {
        maxTime = time;
        slowest = command;
      }
    }

    return { command: slowest, duration: maxTime };
  }

  /**
   * Log performance event
   */
  logPerformanceEvent(type, message, data = null) {
    const entry = {
      timestamp: Date.now(),
      type,
      message,
      data,
    };

    this.performanceLog.push(entry);

    // Trim log if too long
    if (this.performanceLog.length > this.maxLogEntries) {
      this.performanceLog = this.performanceLog.slice(-this.maxLogEntries);
    }

    debugService.debug(`Performance event: ${type} - ${message}`, data);
  }

  /**
   * Record command execution time
   */
  recordCommandTime(command, duration) {
    this.commandTimes.set(command, duration);

    if (duration > this.resourceThresholds.commandWarning) {
      this.logPerformanceEvent(
        'warning',
        `Slow command execution: ${command}`,
        { duration }
      );
    }
  }

  /**
   * Clean up old snapshots to prevent memory buildup
   */
  trimOldSnapshots() {
    // Keep only last 100 snapshots
    if (this.memorySnapshots.length > 100) {
      this.memorySnapshots = this.memorySnapshots.slice(-100);
    }
  }

  /**
   * Optimize garbage collection
   */
  suggestGarbageCollection() {
    if (global.gc && typeof global.gc === 'function') {
      try {
        const beforeMemory = process.memoryUsage().heapUsed;
        global.gc();
        const afterMemory = process.memoryUsage().heapUsed;
        const freed = beforeMemory - afterMemory;

        this.logPerformanceEvent('gc', 'Manual garbage collection performed', {
          freedBytes: freed,
          freedMB: Math.round((freed / 1024 / 1024) * 100) / 100,
        });

        return { success: true, freedBytes: freed };
      } catch (error) {
        debugService.debug('Garbage collection failed', {
          error: error.message,
        });
        return { success: false, error: error.message };
      }
    }

    return { success: false, error: 'Garbage collection not available' };
  }

  /**
   * Get optimization suggestions based on current state
   */
  getOptimizationSuggestions() {
    const suggestions = [];
    const memory = this.getMemoryStats();
    const cpu = this.getCPUStats();

    // Memory optimizations
    if (memory.process.heap.usedMB > 100) {
      suggestions.push({
        category: 'memory',
        priority: 'high',
        suggestion: 'Clear caches and restart CLI for optimal performance',
        command: 'mdsaad maintenance --clean-cache',
      });
    }

    if (memory.process.heap.usedMB > 50) {
      suggestions.push({
        category: 'memory',
        priority: 'medium',
        suggestion: 'Consider running garbage collection',
        command: 'Run with --expose-gc flag and trigger GC',
      });
    }

    // CPU optimizations
    if (cpu.usage > 80) {
      suggestions.push({
        category: 'cpu',
        priority: 'high',
        suggestion: 'System is under high load. Close unnecessary applications',
        command: null,
      });
    }

    // Command optimizations
    const slowest = this.getSlowestCommand();
    if (slowest && slowest.duration > 3000) {
      suggestions.push({
        category: 'commands',
        priority: 'medium',
        suggestion: `Optimize ${slowest.command} command usage or use cached results`,
        command: `mdsaad ${slowest.command} --help`,
      });
    }

    return suggestions;
  }
}

module.exports = new PerformanceService();
