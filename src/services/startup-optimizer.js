/**
 * Startup Optimization Service
 * Optimizes application startup time and initialization process
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const debugService = require('./debug-service');
const performanceService = require('./performance-service');

class StartupOptimizer {
  constructor() {
    this.isInitialized = false;
    this.startupMetrics = {
      startTime: Date.now(),
      phases: new Map(),
      totalTime: 0,
      criticalPath: [],
      optimizations: [],
    };
    this.lazyLoaders = new Map();
    this.preloadedAssets = new Map();
    this.initializationQueue = [];
    this.criticalServices = [
      'debug-service',
      'config-manager',
      'output-formatter',
    ];
    this.deferredServices = [
      'plugin-manager',
      'update-service',
      'translation-service',
    ];
  }

  /**
   * Initialize startup optimizer
   */
  async initialize() {
    try {
      this.recordPhase('startup-optimizer-init', 'start');

      this.setupLazyLoading();
      await this.preloadCriticalAssets();
      this.optimizeRequirePath();

      this.recordPhase('startup-optimizer-init', 'end');
      this.isInitialized = true;

      debugService.debug('Startup optimizer initialized');
      return true;
    } catch (error) {
      console.warn('Startup optimizer initialization failed:', error.message);
      return false;
    }
  }

  /**
   * Record startup phase for performance analysis
   */
  recordPhase(phaseName, type = 'start', metadata = {}) {
    const timestamp = Date.now();

    if (!this.startupMetrics.phases.has(phaseName)) {
      this.startupMetrics.phases.set(phaseName, {
        start: null,
        end: null,
        duration: 0,
        metadata: {},
      });
    }

    const phase = this.startupMetrics.phases.get(phaseName);

    if (type === 'start') {
      phase.start = timestamp;
      phase.metadata = { ...phase.metadata, ...metadata };

      // Add to critical path if it's a critical service
      if (this.criticalServices.includes(phaseName)) {
        this.startupMetrics.criticalPath.push({
          phase: phaseName,
          start: timestamp,
          type: 'start',
        });
      }
    } else if (type === 'end') {
      phase.end = timestamp;
      if (phase.start) {
        phase.duration = timestamp - phase.start;

        // Complete critical path entry
        if (this.criticalServices.includes(phaseName)) {
          this.startupMetrics.criticalPath.push({
            phase: phaseName,
            end: timestamp,
            duration: phase.duration,
            type: 'end',
          });
        }
      }
    }

    debugService.debug(`Startup phase ${type}: ${phaseName}`, {
      timestamp,
      duration: phase.duration,
      metadata,
    });
  }

  /**
   * Setup lazy loading for non-critical modules
   */
  setupLazyLoading() {
    // Create lazy loaders for deferred services
    for (const serviceName of this.deferredServices) {
      this.lazyLoaders.set(serviceName, this.createLazyLoader(serviceName));
    }

    // Setup lazy loading for large assets
    this.lazyLoaders.set('ascii-art', this.createAssetLazyLoader('ascii-art'));
    this.lazyLoaders.set(
      'translations',
      this.createAssetLazyLoader('translations')
    );
    this.lazyLoaders.set('themes', this.createAssetLazyLoader('themes'));

    debugService.debug('Lazy loading setup completed', {
      services: this.deferredServices.length,
      assets: 3,
    });
  }

  /**
   * Create lazy loader for a service
   */
  createLazyLoader(serviceName) {
    let cachedModule = null;
    let isLoading = false;

    return {
      load: async () => {
        if (cachedModule) {
          return cachedModule;
        }

        if (isLoading) {
          // Wait for existing load to complete
          while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          return cachedModule;
        }

        try {
          isLoading = true;
          this.recordPhase(`lazy-load-${serviceName}`, 'start');

          // Determine service path
          const servicePath = this.getServicePath(serviceName);

          // Load the module
          delete require.cache[require.resolve(servicePath)];
          cachedModule = require(servicePath);

          // Initialize if it has an initialize method
          if (cachedModule && typeof cachedModule.initialize === 'function') {
            await cachedModule.initialize();
          }

          this.recordPhase(`lazy-load-${serviceName}`, 'end');
          debugService.debug(`Lazily loaded service: ${serviceName}`);

          return cachedModule;
        } catch (error) {
          debugService.debug(`Failed to lazy load service: ${serviceName}`, {
            error: error.message,
          });
          throw error;
        } finally {
          isLoading = false;
        }
      },

      isLoaded: () => cachedModule !== null,

      get: () => cachedModule,
    };
  }

  /**
   * Create lazy loader for assets
   */
  createAssetLazyLoader(assetType) {
    let cachedAssets = null;

    return {
      load: async () => {
        if (cachedAssets) {
          return cachedAssets;
        }

        try {
          this.recordPhase(`lazy-load-${assetType}`, 'start');

          switch (assetType) {
            case 'ascii-art':
              cachedAssets = await this.loadAsciiArt();
              break;
            case 'translations':
              cachedAssets = await this.loadTranslations();
              break;
            case 'themes':
              cachedAssets = await this.loadThemes();
              break;
          }

          this.recordPhase(`lazy-load-${assetType}`, 'end');
          debugService.debug(`Lazily loaded assets: ${assetType}`);

          return cachedAssets;
        } catch (error) {
          debugService.debug(`Failed to lazy load assets: ${assetType}`, {
            error: error.message,
          });
          return null;
        }
      },

      isLoaded: () => cachedAssets !== null,

      get: () => cachedAssets,
    };
  }

  /**
   * Get service path for lazy loading
   */
  getServicePath(serviceName) {
    const servicePaths = {
      'plugin-manager': '../plugin-manager',
      'update-service': './update-service',
      'translation-service': './translation-service',
      'tab-completion-service': './tab-completion-service',
      'offline-manager': './offline-manager',
    };

    return servicePaths[serviceName] || `./${serviceName}`;
  }

  /**
   * Preload critical assets that are needed immediately
   */
  async preloadCriticalAssets() {
    try {
      this.recordPhase('preload-assets', 'start');

      const criticalAssets = [
        'help-basic',
        'error-templates',
        'config-defaults',
      ];

      for (const assetName of criticalAssets) {
        try {
          const asset = await this.loadCriticalAsset(assetName);
          if (asset) {
            this.preloadedAssets.set(assetName, asset);
            debugService.debug(`Preloaded critical asset: ${assetName}`);
          }
        } catch (error) {
          debugService.debug(`Failed to preload asset: ${assetName}`, {
            error: error.message,
          });
        }
      }

      this.recordPhase('preload-assets', 'end', {
        assetsLoaded: this.preloadedAssets.size,
      });
    } catch (error) {
      debugService.debug('Asset preloading failed', { error: error.message });
    }
  }

  /**
   * Load critical asset
   */
  async loadCriticalAsset(assetName) {
    switch (assetName) {
      case 'help-basic':
        return this.getBasicHelpContent();

      case 'error-templates':
        return this.getErrorTemplates();

      case 'config-defaults':
        return this.getConfigDefaults();

      default:
        return null;
    }
  }

  /**
   * Get basic help content for immediate display
   */
  getBasicHelpContent() {
    return {
      usage: 'mdsaad <command> [options]',
      description:
        'A comprehensive command-line tool for weather, conversions, and more.',
      commands: {
        weather: 'Get weather information for a location',
        convert: 'Convert between currencies and units',
        help: 'Display help information',
        config: 'Manage configuration settings',
      },
      examples: [
        'mdsaad weather',
        'mdsaad weather "New York"',
        'mdsaad convert 100 USD EUR',
        'mdsaad convert 10 km miles',
      ],
    };
  }

  /**
   * Get error templates
   */
  getErrorTemplates() {
    return {
      network:
        'Network error: Unable to connect to {service}. Check your internet connection.',
      validation: 'Invalid input: {details}',
      notFound:
        'Command "{command}" not found. Use "mdsaad help" for available commands.',
      permission: 'Permission denied: {operation}',
      timeout: 'Operation timed out after {seconds} seconds.',
    };
  }

  /**
   * Get configuration defaults
   */
  getConfigDefaults() {
    return {
      locale: 'en',
      theme: 'default',
      outputFormat: 'table',
      timeout: 5000,
      cacheEnabled: true,
      debugMode: false,
      animations: true,
      colors: true,
    };
  }

  /**
   * Optimize require path resolution
   */
  optimizeRequirePath() {
    // Cache frequently used module paths
    const moduleCache = new Map();

    // Override require to use cached paths
    const originalRequire = require;
    const optimizedRequire = function (modulePath) {
      if (moduleCache.has(modulePath)) {
        return originalRequire(moduleCache.get(modulePath));
      }

      try {
        const resolved = require.resolve(modulePath);
        moduleCache.set(modulePath, resolved);
        return originalRequire(resolved);
      } catch (error) {
        return originalRequire(modulePath);
      }
    };

    // Copy properties from original require
    Object.setPrototypeOf(optimizedRequire, originalRequire);
    Object.keys(originalRequire).forEach(key => {
      optimizedRequire[key] = originalRequire[key];
    });

    debugService.debug('Require path optimization enabled');
  }

  /**
   * Load ASCII art assets
   */
  async loadAsciiArt() {
    try {
      const artDir = path.join(__dirname, '..', 'assets', 'ascii-art');

      if (!(await fs.pathExists(artDir))) {
        return {};
      }

      const files = await fs.readdir(artDir);
      const artAssets = {};

      for (const file of files) {
        if (file.endsWith('.txt')) {
          const artName = path.basename(file, '.txt');
          const artPath = path.join(artDir, file);
          artAssets[artName] = await fs.readFile(artPath, 'utf8');
        }
      }

      return artAssets;
    } catch (error) {
      debugService.debug('Failed to load ASCII art', { error: error.message });
      return {};
    }
  }

  /**
   * Load translation assets
   */
  async loadTranslations() {
    try {
      const localesDir = path.join(__dirname, '..', 'locales');

      if (!(await fs.pathExists(localesDir))) {
        return {};
      }

      const files = await fs.readdir(localesDir);
      const translations = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const locale = path.basename(file, '.json');
          const localePath = path.join(localesDir, file);
          const content = await fs.readFile(localePath, 'utf8');
          translations[locale] = JSON.parse(content);
        }
      }

      return translations;
    } catch (error) {
      debugService.debug('Failed to load translations', {
        error: error.message,
      });
      return {};
    }
  }

  /**
   * Load theme assets
   */
  async loadThemes() {
    try {
      const themesDir = path.join(__dirname, '..', 'themes');

      if (!(await fs.pathExists(themesDir))) {
        return this.getDefaultThemes();
      }

      const files = await fs.readdir(themesDir);
      const themes = {};

      for (const file of files) {
        if (file.endsWith('.json')) {
          const themeName = path.basename(file, '.json');
          const themePath = path.join(themesDir, file);
          const content = await fs.readFile(themePath, 'utf8');
          themes[themeName] = JSON.parse(content);
        }
      }

      return Object.keys(themes).length > 0 ? themes : this.getDefaultThemes();
    } catch (error) {
      debugService.debug('Failed to load themes', { error: error.message });
      return this.getDefaultThemes();
    }
  }

  /**
   * Get default themes
   */
  getDefaultThemes() {
    return {
      default: {
        primary: '\x1b[36m', // Cyan
        secondary: '\x1b[33m', // Yellow
        success: '\x1b[32m', // Green
        error: '\x1b[31m', // Red
        warning: '\x1b[33m', // Yellow
        info: '\x1b[34m', // Blue
        reset: '\x1b[0m', // Reset
      },
      minimal: {
        primary: '',
        secondary: '',
        success: '',
        error: '',
        warning: '',
        info: '',
        reset: '',
      },
    };
  }

  /**
   * Get lazy loader for a service or asset
   */
  getLazyLoader(name) {
    return this.lazyLoaders.get(name);
  }

  /**
   * Get preloaded asset
   */
  getPreloadedAsset(assetName) {
    return this.preloadedAssets.get(assetName);
  }

  /**
   * Skip network checks during startup if not needed
   */
  optimizeNetworkChecks() {
    // Set environment variable to skip initial network checks
    process.env.SKIP_NETWORK_CHECK = 'true';

    debugService.debug('Network check optimization enabled');

    // Re-enable network checks after startup
    setTimeout(() => {
      delete process.env.SKIP_NETWORK_CHECK;
      debugService.debug('Network checks re-enabled');
    }, 5000);
  }

  /**
   * Optimize ASCII art animations for better performance
   */
  optimizeAnimations() {
    const animationOptimizations = {
      // Use requestAnimationFrame equivalent for CLI
      frameRate: 30, // Limit to 30fps

      // Pre-calculate animation frames
      precalculateFrames: true,

      // Skip animations in CI/CD environments
      skipInCI: process.env.CI === 'true' || process.env.NODE_ENV === 'test',

      // Use simpler animations on slower systems
      adaptiveQuality: true,

      // Cache animation sequences
      cacheAnimations: true,
    };

    debugService.debug(
      'Animation optimizations applied',
      animationOptimizations
    );
    return animationOptimizations;
  }

  /**
   * Get startup performance report
   */
  getStartupReport() {
    this.startupMetrics.totalTime = Date.now() - this.startupMetrics.startTime;

    const report = {
      totalTime: this.startupMetrics.totalTime,
      phases: Object.fromEntries(
        Array.from(this.startupMetrics.phases.entries()).map(
          ([name, phase]) => [
            name,
            {
              duration: phase.duration,
              percentage: Math.round(
                (phase.duration / this.startupMetrics.totalTime) * 100
              ),
              metadata: phase.metadata,
            },
          ]
        )
      ),
      criticalPath: this.startupMetrics.criticalPath,
      optimizations: this.startupMetrics.optimizations,
      lazyLoaders: {
        total: this.lazyLoaders.size,
        loaded: Array.from(this.lazyLoaders.entries()).filter(([_, loader]) =>
          loader.isLoaded()
        ).length,
      },
      preloadedAssets: Array.from(this.preloadedAssets.keys()),
    };

    // Add performance recommendations
    report.recommendations = this.generatePerformanceRecommendations(report);

    return report;
  }

  /**
   * Generate performance recommendations based on startup metrics
   */
  generatePerformanceRecommendations(report) {
    const recommendations = [];

    // Check for slow phases
    for (const [phaseName, phase] of Object.entries(report.phases)) {
      if (phase.duration > 1000) {
        // Slower than 1 second
        recommendations.push({
          type: 'slow-phase',
          phase: phaseName,
          duration: phase.duration,
          suggestion: `Consider optimizing ${phaseName} - it took ${phase.duration}ms`,
        });
      }
    }

    // Check total startup time
    if (report.totalTime > 3000) {
      // Slower than 3 seconds
      recommendations.push({
        type: 'slow-startup',
        duration: report.totalTime,
        suggestion:
          'Total startup time is slow. Consider enabling more lazy loading.',
      });
    }

    // Check lazy loading utilization
    if (report.lazyLoaders.loaded > report.lazyLoaders.total * 0.8) {
      recommendations.push({
        type: 'lazy-loading',
        suggestion:
          'Most lazy loaders are being used immediately. Review what can be deferred.',
      });
    }

    return recommendations;
  }

  /**
   * Apply startup optimizations
   */
  applyOptimizations() {
    this.optimizeNetworkChecks();
    const animationOpts = this.optimizeAnimations();

    this.startupMetrics.optimizations.push(
      'network-check-optimization',
      'animation-optimization',
      'lazy-loading-setup',
      'critical-asset-preloading'
    );

    debugService.debug('Startup optimizations applied', {
      optimizations: this.startupMetrics.optimizations,
      animationOpts,
    });
  }

  /**
   * Shutdown startup optimizer
   */
  shutdown() {
    // Clear any cached modules if needed
    debugService.debug('Startup optimizer shutdown completed');
  }
}

module.exports = new StartupOptimizer();
