/**
 * API Management Service
 * Centralized API provider management with failover, rate limiting, and monitoring
 */

const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');
const configService = require('./config');
const cacheService = require('./cache');
const loggerService = require('./logger');

class APIManager {
  constructor() {
    this.providers = new Map();
    this.rateLimiters = new Map();
    this.requestCounts = new Map();
    this.failureTracking = new Map();
    this.circuitBreakers = new Map();
    this.initialized = false;
  }

  /**
   * Initialize API manager with configuration
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Load API configurations
      await this.loadProviderConfigurations();

      // Initialize rate limiters
      this.initializeRateLimiters();

      // Initialize circuit breakers
      this.initializeCircuitBreakers();

      // Start monitoring background tasks
      this.startMonitoring();

      this.initialized = true;
      loggerService.info('API Manager initialized successfully');
    } catch (error) {
      loggerService.error('Failed to initialize API Manager:', error.message);
      throw error;
    }
  }

  /**
   * Register an API provider
   */
  registerProvider(name, config) {
    const provider = {
      name,
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      headers: config.headers || {},
      timeout: config.timeout || 30000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      rateLimit: config.rateLimit || { requests: 100, window: 3600000 }, // 100 req/hour default
      priority: config.priority || 1,
      healthCheck: config.healthCheck,
      enabled: config.enabled !== false,
    };

    this.providers.set(name, provider);
    this.initializeProviderTracking(name);

    loggerService.info(`API Provider registered: ${name}`);
    return provider;
  }

  /**
   * Initialize provider tracking systems
   */
  initializeProviderTracking(providerName) {
    // Rate limiter tracking
    this.rateLimiters.set(providerName, {
      requests: [],
      blocked: false,
      blockedUntil: null,
    });

    // Request counting
    this.requestCounts.set(providerName, {
      total: 0,
      successful: 0,
      failed: 0,
      lastRequest: null,
    });

    // Failure tracking for circuit breaker
    this.failureTracking.set(providerName, {
      consecutiveFailures: 0,
      lastFailure: null,
      totalFailures: 0,
    });

    // Circuit breaker state
    this.circuitBreakers.set(providerName, {
      state: 'CLOSED', // CLOSED, OPEN, HALF_OPEN
      openedAt: null,
      nextAttemptAt: null,
    });
  }

  /**
   * Make API request with automatic provider selection and failover
   */
  async makeRequest(service, endpoint, options = {}) {
    if (!this.initialized) {
      await this.initialize();
    }

    const {
      method = 'GET',
      data = null,
      headers = {},
      timeout = null,
      preferredProvider = null,
      maxRetries = 3,
    } = options;

    let providers = this.getAvailableProviders(service);

    // Sort providers by priority and health
    providers = this.sortProvidersByPriority(providers);

    // If preferred provider specified, try it first
    if (preferredProvider && this.providers.has(preferredProvider)) {
      const preferred = this.providers.get(preferredProvider);
      if (preferred.enabled && this.isProviderHealthy(preferredProvider)) {
        providers = [
          preferredProvider,
          ...providers.filter(p => p !== preferredProvider),
        ];
      }
    }

    let lastError = null;

    for (const providerName of providers) {
      try {
        // Check rate limits
        if (!this.checkRateLimit(providerName)) {
          loggerService.warn(
            `Rate limit exceeded for provider: ${providerName}`
          );
          continue;
        }

        // Check circuit breaker
        if (!this.isCircuitClosed(providerName)) {
          loggerService.warn(
            `Circuit breaker open for provider: ${providerName}`
          );
          continue;
        }

        const result = await this.executeRequest(providerName, endpoint, {
          method,
          data,
          headers,
          timeout,
        });

        // Record successful request
        this.recordSuccess(providerName);

        return result;
      } catch (error) {
        lastError = error;
        this.recordFailure(providerName, error);

        loggerService.warn(`Provider ${providerName} failed:`, error.message);

        // If this was the last provider, throw the error
        if (providers.indexOf(providerName) === providers.length - 1) {
          throw new Error(
            `All API providers failed. Last error: ${error.message}`
          );
        }

        // Continue to next provider
        continue;
      }
    }

    throw new Error(`No available API providers for service: ${service}`);
  }

  /**
   * Execute actual HTTP request
   */
  async executeRequest(providerName, endpoint, options) {
    const provider = this.providers.get(providerName);
    const requestId = this.generateRequestId();

    const requestConfig = {
      method: options.method,
      url: `${provider.baseURL}${endpoint}`,
      headers: {
        ...provider.headers,
        ...options.headers,
      },
      timeout: options.timeout || provider.timeout,
      data: options.data,
    };

    // Add API key if available
    if (provider.apiKey) {
      requestConfig.headers['Authorization'] = `Bearer ${provider.apiKey}`;
    }

    const startTime = Date.now();

    try {
      loggerService.debug(`Making request to ${providerName}:`, {
        requestId,
        method: options.method,
        endpoint,
        provider: providerName,
      });

      const response = await axios(requestConfig);
      const duration = Date.now() - startTime;

      // Log successful request
      await this.logRequest(
        requestId,
        providerName,
        endpoint,
        options,
        response,
        duration
      );

      return {
        data: response.data,
        status: response.status,
        headers: response.headers,
        provider: providerName,
        requestId,
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log failed request
      await this.logRequest(
        requestId,
        providerName,
        endpoint,
        options,
        null,
        duration,
        error
      );

      throw error;
    }
  }

  /**
   * Check rate limit for provider
   */
  checkRateLimit(providerName) {
    const provider = this.providers.get(providerName);
    const limiter = this.rateLimiters.get(providerName);

    if (!provider || !limiter) return false;

    const now = Date.now();
    const windowStart = now - provider.rateLimit.window;

    // Clean old requests
    limiter.requests = limiter.requests.filter(time => time > windowStart);

    // Check if we're blocked
    if (limiter.blocked && limiter.blockedUntil > now) {
      return false;
    }

    // Check current request count
    if (limiter.requests.length >= provider.rateLimit.requests) {
      limiter.blocked = true;
      limiter.blockedUntil = now + provider.rateLimit.window;
      return false;
    }

    // Add current request
    limiter.requests.push(now);
    limiter.blocked = false;
    limiter.blockedUntil = null;

    return true;
  }

  /**
   * Check if circuit breaker is closed (allowing requests)
   */
  isCircuitClosed(providerName) {
    const breaker = this.circuitBreakers.get(providerName);
    const failure = this.failureTracking.get(providerName);

    if (!breaker || !failure) return true;

    const now = Date.now();

    switch (breaker.state) {
      case 'CLOSED':
        return true;

      case 'OPEN':
        // Check if we should transition to HALF_OPEN
        if (breaker.nextAttemptAt && now >= breaker.nextAttemptAt) {
          breaker.state = 'HALF_OPEN';
          loggerService.info(
            `Circuit breaker transitioning to HALF_OPEN: ${providerName}`
          );
          return true;
        }
        return false;

      case 'HALF_OPEN':
        return true;

      default:
        return true;
    }
  }

  /**
   * Record successful request
   */
  recordSuccess(providerName) {
    const counts = this.requestCounts.get(providerName);
    const failures = this.failureTracking.get(providerName);
    const breaker = this.circuitBreakers.get(providerName);

    if (counts) {
      counts.total++;
      counts.successful++;
      counts.lastRequest = Date.now();
    }

    if (failures) {
      failures.consecutiveFailures = 0;
    }

    if (breaker && breaker.state === 'HALF_OPEN') {
      breaker.state = 'CLOSED';
      loggerService.info(
        `Circuit breaker closed after successful request: ${providerName}`
      );
    }
  }

  /**
   * Record failed request
   */
  recordFailure(providerName, error) {
    const counts = this.requestCounts.get(providerName);
    const failures = this.failureTracking.get(providerName);
    const breaker = this.circuitBreakers.get(providerName);

    if (counts) {
      counts.total++;
      counts.failed++;
      counts.lastRequest = Date.now();
    }

    if (failures) {
      failures.consecutiveFailures++;
      failures.totalFailures++;
      failures.lastFailure = Date.now();
    }

    // Check if we should open circuit breaker
    if (breaker && failures && failures.consecutiveFailures >= 5) {
      breaker.state = 'OPEN';
      breaker.openedAt = Date.now();
      breaker.nextAttemptAt = Date.now() + 60000; // 1 minute

      loggerService.warn(
        `Circuit breaker opened due to consecutive failures: ${providerName}`
      );
    }
  }

  /**
   * Get available providers for a service
   */
  getAvailableProviders(service) {
    return Array.from(this.providers.keys()).filter(name => {
      const provider = this.providers.get(name);
      return provider.enabled && this.isProviderHealthy(name);
    });
  }

  /**
   * Check if provider is healthy
   */
  isProviderHealthy(providerName) {
    const breaker = this.circuitBreakers.get(providerName);
    const limiter = this.rateLimiters.get(providerName);

    // Check circuit breaker
    if (breaker && breaker.state === 'OPEN') {
      return false;
    }

    // Check rate limiting
    if (limiter && limiter.blocked && limiter.blockedUntil > Date.now()) {
      return false;
    }

    return true;
  }

  /**
   * Sort providers by priority and health
   */
  sortProvidersByPriority(providers) {
    return providers.sort((a, b) => {
      const providerA = this.providers.get(a);
      const providerB = this.providers.get(b);

      // Higher priority first
      if (providerA.priority !== providerB.priority) {
        return providerB.priority - providerA.priority;
      }

      // Then by health (less failures first)
      const failuresA = this.failureTracking.get(a)?.consecutiveFailures || 0;
      const failuresB = this.failureTracking.get(b)?.consecutiveFailures || 0;

      return failuresA - failuresB;
    });
  }

  /**
   * Log request details
   */
  async logRequest(
    requestId,
    providerName,
    endpoint,
    options,
    response,
    duration,
    error = null
  ) {
    const logEntry = {
      requestId,
      timestamp: new Date().toISOString(),
      provider: providerName,
      endpoint,
      method: options.method,
      duration,
      success: !error,
      status: response ? response.status : null,
      error: error ? error.message : null,
    };

    try {
      // Cache the log entry for monitoring
      await cacheService.set(
        `api_log_${requestId}`,
        logEntry,
        'logs',
        86400000
      ); // 24 hours

      // Also log to console in debug mode
      if (configService.get('debug', false)) {
        loggerService.debug('API Request Log:', logEntry);
      }
    } catch (logError) {
      loggerService.warn('Failed to log API request:', logError.message);
    }
  }

  /**
   * Generate unique request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get API statistics
   */
  getStatistics() {
    const stats = {
      providers: {},
      overall: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageResponseTime: 0,
        uptime: Date.now() - this.initTime || 0,
      },
    };

    for (const [name, provider] of this.providers) {
      const counts = this.requestCounts.get(name);
      const failures = this.failureTracking.get(name);
      const breaker = this.circuitBreakers.get(name);
      const limiter = this.rateLimiters.get(name);

      stats.providers[name] = {
        enabled: provider.enabled,
        priority: provider.priority,
        requests: counts || { total: 0, successful: 0, failed: 0 },
        failures: failures || { consecutiveFailures: 0, totalFailures: 0 },
        circuitBreaker: breaker?.state || 'CLOSED',
        rateLimited: limiter?.blocked || false,
        healthy: this.isProviderHealthy(name),
      };

      if (counts) {
        stats.overall.totalRequests += counts.total;
        stats.overall.successfulRequests += counts.successful;
        stats.overall.failedRequests += counts.failed;
      }
    }

    return stats;
  }

  /**
   * Load provider configurations from config
   */
  async loadProviderConfigurations() {
    const providers = configService.get('apiProviders', {});

    for (const [name, config] of Object.entries(providers)) {
      if (config.enabled !== false) {
        this.registerProvider(name, config);
      }
    }

    // Set default providers if none configured
    if (this.providers.size === 0) {
      await this.setupDefaultProviders();
    }
  }

  /**
   * Setup default provider configurations
   */
  async setupDefaultProviders() {
    const defaultProviders = {
      gemini: {
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        rateLimit: { requests: 60, window: 60000 }, // 60 req/min
        priority: 5,
        enabled: false,
      },
      openrouter: {
        baseURL: 'https://openrouter.ai/api/v1',
        rateLimit: { requests: 100, window: 60000 }, // 100 req/min
        priority: 4,
        enabled: false,
      },
      deepseek: {
        baseURL: 'https://api.deepseek.com/beta',
        rateLimit: { requests: 50, window: 60000 }, // 50 req/min
        priority: 3,
        enabled: false,
      },
    };

    for (const [name, config] of Object.entries(defaultProviders)) {
      this.registerProvider(name, config);
    }

    // Save to config for user customization
    configService.set('apiProviders', defaultProviders);
  }

  /**
   * Initialize rate limiters
   */
  initializeRateLimiters() {
    // Rate limiters are initialized when providers are registered
    loggerService.debug('Rate limiters initialized');
  }

  /**
   * Initialize circuit breakers
   */
  initializeCircuitBreakers() {
    // Circuit breakers are initialized when providers are registered
    loggerService.debug('Circuit breakers initialized');
  }

  /**
   * Start monitoring background tasks
   */
  startMonitoring() {
    // Clean up old rate limit entries every 5 minutes
    setInterval(() => {
      this.cleanupRateLimitData();
    }, 300000);

    // Health check providers every 10 minutes
    setInterval(() => {
      this.performHealthChecks();
    }, 600000);

    this.initTime = Date.now();
  }

  /**
   * Cleanup old rate limit data
   */
  cleanupRateLimitData() {
    const now = Date.now();

    for (const [providerName, limiter] of this.rateLimiters) {
      const provider = this.providers.get(providerName);
      if (provider) {
        const windowStart = now - provider.rateLimit.window;
        limiter.requests = limiter.requests.filter(time => time > windowStart);
      }
    }
  }

  /**
   * Perform health checks on providers
   */
  async performHealthChecks() {
    for (const [name, provider] of this.providers) {
      if (provider.healthCheck && provider.enabled) {
        try {
          await axios({
            method: 'GET',
            url: provider.healthCheck,
            timeout: 5000,
          });

          loggerService.debug(`Health check passed: ${name}`);
        } catch (error) {
          loggerService.warn(`Health check failed: ${name}`, error.message);
          this.recordFailure(name, error);
        }
      }
    }
  }

  /**
   * Enable/disable a provider
   */
  setProviderEnabled(providerName, enabled) {
    const provider = this.providers.get(providerName);
    if (provider) {
      provider.enabled = enabled;
      loggerService.info(
        `Provider ${providerName} ${enabled ? 'enabled' : 'disabled'}`
      );
    }
  }

  /**
   * Get provider information
   */
  getProvider(providerName) {
    return this.providers.get(providerName);
  }

  /**
   * List all providers
   */
  listProviders() {
    return Array.from(this.providers.keys());
  }

  /**
   * Reset circuit breaker for a provider
   */
  resetCircuitBreaker(providerName) {
    const breaker = this.circuitBreakers.get(providerName);
    const failures = this.failureTracking.get(providerName);

    if (breaker) {
      breaker.state = 'CLOSED';
      breaker.openedAt = null;
      breaker.nextAttemptAt = null;
    }

    if (failures) {
      failures.consecutiveFailures = 0;
    }

    loggerService.info(`Circuit breaker reset for provider: ${providerName}`);
  }
}

module.exports = new APIManager();
