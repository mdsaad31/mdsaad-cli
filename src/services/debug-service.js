/**
 * Debug Service
 * Provides detailed debugging information and diagnostics
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const outputFormatter = require('./output-formatter');

class DebugService {
  constructor() {
    this.debugMode = false;
    this.verboseMode = false;
    this.debugLog = [];
    this.maxLogSize = 500;
    this.debugFile = path.join(os.homedir(), '.mdsaad', 'debug.log');
    this.performanceMarkers = new Map();
    this.systemInfo = null;
  }

  /**
   * Initialize debug service
   */
  async initialize() {
    try {
      await fs.ensureDir(path.dirname(this.debugFile));
      this.systemInfo = await this.collectSystemInfo();
      return true;
    } catch (error) {
      console.warn('DebugService initialization warning:', error.message);
      return false;
    }
  }

  /**
   * Enable debug mode
   */
  enableDebug() {
    this.debugMode = true;
    console.log(outputFormatter.info('🐛 Debug mode enabled'));
  }

  /**
   * Enable verbose mode
   */
  enableVerbose() {
    this.verboseMode = true;
    console.log(outputFormatter.info('📝 Verbose mode enabled'));
  }

  /**
   * Disable debug mode
   */
  disableDebug() {
    this.debugMode = false;
    console.log(outputFormatter.info('🐛 Debug mode disabled'));
  }

  /**
   * Log debug message
   */
  debug(message, data = null, category = 'general') {
    if (!this.debugMode && !this.verboseMode) {
      return;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : null,
      stack: this.debugMode ? new Error().stack : null,
    };

    this.debugLog.push(logEntry);

    // Keep log size manageable
    if (this.debugLog.length > this.maxLogSize) {
      this.debugLog = this.debugLog.slice(-this.maxLogSize);
    }

    // Display in debug mode
    if (this.debugMode) {
      console.log(
        outputFormatter.debug(`[${category.toUpperCase()}] ${message}`, data)
      );
    } else if (this.verboseMode) {
      console.log(outputFormatter.info(`🔍 ${message}`));
    }

    // Write to file asynchronously
    this.writeDebugLog().catch(() => {
      // Ignore write errors to prevent infinite loops
    });
  }

  /**
   * Log performance marker
   */
  markPerformance(label, operation = 'start') {
    const timestamp = process.hrtime.bigint();
    const key = `${label}_${operation}`;

    this.performanceMarkers.set(key, timestamp);

    if (operation === 'end') {
      const startKey = `${label}_start`;
      if (this.performanceMarkers.has(startKey)) {
        const duration =
          Number(timestamp - this.performanceMarkers.get(startKey)) / 1000000; // Convert to ms
        this.debug(
          `Performance: ${label} took ${duration.toFixed(2)}ms`,
          null,
          'performance'
        );

        if (duration > 1000) {
          console.log(
            outputFormatter.warning(
              `⏱️ Slow operation detected: ${label} (${duration.toFixed(2)}ms)`
            )
          );
        }
      }
    }
  }

  /**
   * Collect comprehensive system information
   */
  async collectSystemInfo() {
    const info = {
      timestamp: new Date().toISOString(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        hostname: os.hostname(),
        uptime: os.uptime(),
        loadavg: os.loadavg(),
        totalmem: os.totalmem(),
        freemem: os.freemem(),
        cpus: os.cpus().length,
      },
      node: {
        version: process.version,
        platform: process.platform,
        arch: process.arch,
        versions: process.versions,
        execPath: process.execPath,
        cwd: process.cwd(),
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        path: process.env.PATH
          ? process.env.PATH.split(path.delimiter).length + ' entries'
          : 'not set',
        shell: process.env.SHELL || process.env.ComSpec,
        home: os.homedir(),
        tmpdir: os.tmpdir(),
      },
    };

    // Check for package.json
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (await fs.pathExists(packageJsonPath)) {
        const packageJson = await fs.readJson(packageJsonPath);
        info.package = {
          name: packageJson.name,
          version: packageJson.version,
          dependencies: Object.keys(packageJson.dependencies || {}).length,
          devDependencies: Object.keys(packageJson.devDependencies || {})
            .length,
        };
      }
    } catch (error) {
      info.package = { error: 'Could not read package.json' };
    }

    // Check network connectivity
    try {
      const { spawn } = require('child_process');
      info.network = await this.checkNetworkConnectivity();
    } catch (error) {
      info.network = { error: 'Could not check network connectivity' };
    }

    return info;
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    return new Promise(resolve => {
      const testUrls = ['8.8.8.8', 'google.com'];
      const results = {};
      let completed = 0;

      testUrls.forEach(url => {
        const start = Date.now();
        const timeout = setTimeout(() => {
          results[url] = { reachable: false, timeout: true };
          if (++completed === testUrls.length) resolve(results);
        }, 5000);

        // Simple DNS lookup test
        const dns = require('dns');
        dns.lookup(url, err => {
          clearTimeout(timeout);
          results[url] = {
            reachable: !err,
            latency: Date.now() - start,
            error: err ? err.message : null,
          };
          if (++completed === testUrls.length) resolve(results);
        });
      });
    });
  }

  /**
   * Generate comprehensive diagnostic report
   */
  async generateDiagnosticReport() {
    console.log(outputFormatter.header('🔧 Diagnostic Report'));

    // System information
    console.log(outputFormatter.subheader('System Information'));
    console.log(outputFormatter.formatObject('System', this.systemInfo.system));

    console.log(outputFormatter.subheader('Node.js Information'));
    console.log(outputFormatter.formatObject('Node.js', this.systemInfo.node));

    console.log(outputFormatter.subheader('Environment'));
    console.log(
      outputFormatter.formatObject('Environment', this.systemInfo.environment)
    );

    // Configuration status
    console.log(outputFormatter.subheader('Configuration Status'));
    try {
      const configManager = require('./config-manager');
      const configSummary = configManager.getSummary();
      console.log(outputFormatter.formatObject('Configuration', configSummary));
    } catch (error) {
      console.log(
        outputFormatter.error('Could not load configuration:', error.message)
      );
    }

    // Service status
    console.log(outputFormatter.subheader('Service Status'));
    await this.checkServiceStatuses();

    // Recent errors
    console.log(outputFormatter.subheader('Recent Debug Log'));
    this.displayRecentDebugLog();

    // Performance metrics
    console.log(outputFormatter.subheader('Performance Metrics'));
    this.displayPerformanceMetrics();

    console.log(outputFormatter.success('📋 Diagnostic report complete'));
  }

  /**
   * Check status of various services
   */
  async checkServiceStatuses() {
    const services = ['cache', 'config-manager', 'weather', 'error-handler'];

    for (const serviceName of services) {
      try {
        const service = require(`./${serviceName}`);
        const status = service.isInitialized
          ? '✅ Active'
          : '⚠️ Not initialized';
        console.log(`   ${serviceName.padEnd(15)}: ${status}`);
      } catch (error) {
        console.log(`   ${serviceName.padEnd(15)}: ❌ Not available`);
      }
    }
  }

  /**
   * Display recent debug log entries
   */
  displayRecentDebugLog(limit = 10) {
    const recentEntries = this.debugLog.slice(-limit);

    if (recentEntries.length === 0) {
      console.log(outputFormatter.info('No recent debug entries'));
      return;
    }

    recentEntries.forEach(entry => {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      console.log(`   ${time} [${entry.category}] ${entry.message}`);
      if (entry.data && this.debugMode) {
        console.log(outputFormatter.code(entry.data, 'json'));
      }
    });
  }

  /**
   * Display performance metrics
   */
  displayPerformanceMetrics() {
    if (this.performanceMarkers.size === 0) {
      console.log(outputFormatter.info('No performance markers recorded'));
      return;
    }

    const metrics = [];
    for (const [key, timestamp] of this.performanceMarkers) {
      if (key.endsWith('_end')) {
        const operation = key.replace('_end', '');
        const startKey = `${operation}_start`;
        if (this.performanceMarkers.has(startKey)) {
          const duration =
            Number(timestamp - this.performanceMarkers.get(startKey)) / 1000000;
          metrics.push([operation, `${duration.toFixed(2)}ms`]);
        }
      }
    }

    if (metrics.length > 0) {
      console.log(
        outputFormatter.formatTable('Performance Metrics', metrics, {
          headers: ['Operation', 'Duration'],
        })
      );
    }
  }

  /**
   * Write debug log to file
   */
  async writeDebugLog() {
    try {
      const logData = this.debugLog
        .map(
          entry =>
            `${entry.timestamp} [${entry.category}] ${entry.message}${entry.data ? '\n' + entry.data : ''}`
        )
        .join('\n\n');

      await fs.writeFile(this.debugFile, logData);
    } catch (error) {
      // Silently fail to prevent recursion
    }
  }

  /**
   * Clear debug log
   */
  clearDebugLog() {
    this.debugLog = [];
    this.performanceMarkers.clear();
    console.log(outputFormatter.success('🗑️ Debug log cleared'));
  }

  /**
   * Export diagnostic data
   */
  async exportDiagnostics(filePath) {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      systemInfo: this.systemInfo,
      debugLog: this.debugLog,
      performanceMarkers: Array.from(this.performanceMarkers.entries()),
      configuration: {},
      errors: [],
    };

    // Add configuration data
    try {
      const configManager = require('./config-manager');
      diagnostics.configuration = configManager.getSummary();
    } catch (error) {
      diagnostics.configuration = { error: error.message };
    }

    // Add error log data
    try {
      const errorHandler = require('./error-handler');
      diagnostics.errors = errorHandler.getErrorStatistics(7);
    } catch (error) {
      diagnostics.errors = { error: error.message };
    }

    await fs.writeJson(filePath, diagnostics, { spaces: 2 });
    console.log(
      outputFormatter.success(`📊 Diagnostics exported to: ${filePath}`)
    );
  }

  /**
   * Validate system requirements
   */
  validateSystemRequirements() {
    const requirements = {
      node: { min: '14.0.0', recommended: '18.0.0' },
      memory: { min: 512 * 1024 * 1024, recommended: 1024 * 1024 * 1024 }, // 512MB min, 1GB recommended
      diskSpace: { min: 100 * 1024 * 1024 }, // 100MB min
    };

    const issues = [];
    const warnings = [];

    // Check Node.js version
    const nodeVersion = process.version.replace('v', '');
    if (this.compareVersions(nodeVersion, requirements.node.min) < 0) {
      issues.push(
        `Node.js version ${nodeVersion} is below minimum required ${requirements.node.min}`
      );
    } else if (
      this.compareVersions(nodeVersion, requirements.node.recommended) < 0
    ) {
      warnings.push(
        `Node.js version ${nodeVersion} is below recommended ${requirements.node.recommended}`
      );
    }

    // Check memory
    const freeMemory = os.freemem();
    if (freeMemory < requirements.memory.min) {
      issues.push(
        `Available memory ${Math.round(freeMemory / 1024 / 1024)}MB is below minimum ${Math.round(requirements.memory.min / 1024 / 1024)}MB`
      );
    } else if (freeMemory < requirements.memory.recommended) {
      warnings.push(
        `Available memory ${Math.round(freeMemory / 1024 / 1024)}MB is below recommended ${Math.round(requirements.memory.recommended / 1024 / 1024)}MB`
      );
    }

    return { issues, warnings };
  }

  /**
   * Compare semantic versions
   */
  compareVersions(version1, version2) {
    const v1parts = version1.split('.').map(Number);
    const v2parts = version2.split('.').map(Number);

    for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;

      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }

    return 0;
  }
}

module.exports = new DebugService();
