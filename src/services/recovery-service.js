/**
 * Recovery Service
 * Handles graceful degradation and fallback mechanisms
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const outputFormatter = require('./output-formatter');
const errorHandler = require('./error-handler');

class RecoveryService {
  constructor() {
    this.fallbackData = new Map();
    this.offlineMode = false;
    this.degradationLevel = 0; // 0 = full, 1 = limited, 2 = basic, 3 = minimal
    this.fallbackStrategies = new Map();
    this.recoveryAttempts = new Map();
    
    this.initializeFallbackStrategies();
  }

  /**
   * Initialize fallback strategies for different services
   */
  initializeFallbackStrategies() {
    // Weather service fallback
    this.fallbackStrategies.set('weather', {
      priority: ['weatherapi', 'openweather', 'cached', 'default'],
      fallbackData: {
        temperature: 'N/A',
        condition: 'Weather data unavailable',
        humidity: 'N/A',
        pressure: 'N/A'
      },
      cacheKey: 'weather_last_known',
      gracefulMessage: '🔌 Using offline weather data'
    });

    // AI service fallback
    this.fallbackStrategies.set('ai', {
      priority: ['openai', 'google', 'anthropic', 'cached', 'offline'],
      fallbackData: {
        response: 'AI services are currently unavailable. Please try again later or check your internet connection.',
        model: 'offline-mode'
      },
      cacheKey: 'ai_last_responses',
      gracefulMessage: '🔌 AI services unavailable - using offline mode'
    });

    // Currency conversion fallback
    this.fallbackStrategies.set('currency', {
      priority: ['exchangerate-api', 'fixer', 'cached', 'static'],
      fallbackData: {
        'USD_EUR': 0.85,
        'USD_GBP': 0.76,
        'USD_JPY': 149.8,
        'EUR_GBP': 0.89,
        'EUR_JPY': 176.2,
        'GBP_JPY': 196.8
      },
      cacheKey: 'currency_rates',
      gracefulMessage: '🔌 Using cached exchange rates'
    });

    // Configuration fallback
    this.fallbackStrategies.set('config', {
      priority: ['file', 'backup', 'defaults'],
      fallbackData: {
        language: 'en',
        theme: 'default',
        units: 'metric'
      },
      gracefulMessage: '⚙️ Using default configuration'
    });
  }

  /**
   * Attempt service recovery with fallback chain
   */
  async attemptRecovery(serviceName, operation, ...args) {
    const strategy = this.fallbackStrategies.get(serviceName);
    if (!strategy) {
      throw new Error(`No recovery strategy found for service: ${serviceName}`);
    }

    const attemptKey = `${serviceName}_${operation}`;
    let attempts = this.recoveryAttempts.get(attemptKey) || 0;
    
    for (const provider of strategy.priority) {
      try {
        attempts++;
        this.recoveryAttempts.set(attemptKey, attempts);

        console.log(outputFormatter.loading(`Trying ${provider} for ${serviceName}...`));
        
        const result = await this.tryProvider(serviceName, provider, operation, ...args);
        
        if (result) {
          // Reset attempt counter on success
          this.recoveryAttempts.delete(attemptKey);
          return result;
        }
      } catch (error) {
        console.log(outputFormatter.warning(`${provider} failed: ${error.message}`));
        
        // Continue to next provider
        continue;
      }
    }

    // All providers failed - use fallback data
    return this.useFallbackData(serviceName, strategy);
  }

  /**
   * Try a specific provider for a service
   */
  async tryProvider(serviceName, provider, operation, ...args) {
    switch (provider) {
      case 'cached':
        return await this.tryCache(serviceName, operation, ...args);
      
      case 'default':
      case 'static':
      case 'offline':
        return await this.tryStaticFallback(serviceName, operation, ...args);
      
      default:
        // Try the actual service provider
        return await this.tryServiceProvider(serviceName, provider, operation, ...args);
    }
  }

  /**
   * Try cached data
   */
  async tryCache(serviceName, operation, ...args) {
    try {
      const cacheService = require('./cache');
      const cacheKey = `${serviceName}_${operation}_${JSON.stringify(args)}`;
      
      const cachedResult = await cacheService.get(cacheKey);
      if (cachedResult) {
        console.log(outputFormatter.info('📦 Using cached data'));
        return cachedResult;
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Try static fallback data
   */
  async tryStaticFallback(serviceName, operation, ...args) {
    const strategy = this.fallbackStrategies.get(serviceName);
    if (!strategy.fallbackData) {
      return null;
    }

    console.log(outputFormatter.warning(strategy.gracefulMessage));
    
    // For currency conversions, calculate from static rates
    if (serviceName === 'currency' && args.length >= 2) {
      const [from, to] = args;
      const rate = this.getStaticExchangeRate(from, to, strategy.fallbackData);
      if (rate) {
        return { rate, source: 'static', timestamp: new Date().toISOString() };
      }
    }

    return strategy.fallbackData;
  }

  /**
   * Try actual service provider
   */
  async tryServiceProvider(serviceName, provider, operation, ...args) {
    try {
      switch (serviceName) {
        case 'weather':
          return await this.tryWeatherProvider(provider, operation, ...args);
        case 'ai':
          return await this.tryAIProvider(provider, operation, ...args);
        case 'currency':
          return await this.tryCurrencyProvider(provider, operation, ...args);
        default:
          throw new Error(`Unknown service: ${serviceName}`);
      }
    } catch (error) {
      // Convert provider-specific errors to recovery errors
      throw errorHandler.createError(
        `${provider} provider failed: ${error.message}`,
        'PROVIDER_ERROR',
        { provider, service: serviceName, operation }
      );
    }
  }

  /**
   * Try weather provider
   */
  async tryWeatherProvider(provider, operation, location) {
    const weatherService = require('./weather');
    
    // This would integrate with the actual weather service
    // For now, simulate the call
    if (provider === 'weatherapi' || provider === 'openweather') {
      return await weatherService.getCurrentWeather(location);
    }
    
    throw new Error(`Weather provider ${provider} not available`);
  }

  /**
   * Try AI provider
   */
  async tryAIProvider(provider, operation, prompt, options = {}) {
    // This would integrate with AI services
    // For now, simulate different providers
    
    if (provider === 'openai' && process.env.OPENAI_API_KEY) {
      // Would make actual OpenAI call
      throw new Error('OpenAI API key not configured');
    }
    
    if (provider === 'google' && process.env.GOOGLE_API_KEY) {
      // Would make actual Google AI call
      throw new Error('Google AI not configured');
    }

    throw new Error(`AI provider ${provider} not available`);
  }

  /**
   * Try currency provider
   */
  async tryCurrencyProvider(provider, operation, from, to, amount = 1) {
    // This would integrate with currency services
    // For now, simulate the behavior
    
    if (provider === 'exchangerate-api') {
      // Would make actual API call
      throw new Error('ExchangeRate API not available');
    }
    
    throw new Error(`Currency provider ${provider} not available`);
  }

  /**
   * Get static exchange rate from fallback data
   */
  getStaticExchangeRate(from, to, staticRates) {
    const key1 = `${from}_${to}`;
    const key2 = `${to}_${from}`;
    
    if (staticRates[key1]) {
      return staticRates[key1];
    }
    
    if (staticRates[key2]) {
      return 1 / staticRates[key2];
    }
    
    // Try via USD conversion
    const fromUSD = staticRates[`USD_${from}`];
    const toUSD = staticRates[`USD_${to}`];
    
    if (fromUSD && toUSD) {
      return toUSD / fromUSD;
    }
    
    return null;
  }

  /**
   * Use fallback data when all providers fail
   */
  useFallbackData(serviceName, strategy) {
    console.log(outputFormatter.warning('⚠️ All providers failed - using fallback data'));
    console.log(outputFormatter.info(strategy.gracefulMessage || 'Using offline mode'));
    
    this.offlineMode = true;
    this.degradationLevel = Math.max(this.degradationLevel, 2);
    
    return {
      ...strategy.fallbackData,
      _source: 'fallback',
      _degraded: true,
      _timestamp: new Date().toISOString()
    };
  }

  /**
   * Enable offline mode with graceful degradation
   */
  enableOfflineMode() {
    this.offlineMode = true;
    this.degradationLevel = 3;
    
    console.log(outputFormatter.info('🔌 Offline mode enabled'));
    console.log('   • Limited functionality available');
    console.log('   • Using cached and static data');
    console.log('   • Some features may be unavailable');
  }

  /**
   * Check if service is available
   */
  async checkServiceHealth(serviceName) {
    try {
      // Simple connectivity test
      const result = await this.attemptRecovery(serviceName, 'health-check');
      return {
        available: !result._degraded,
        degraded: result._degraded || false,
        source: result._source || 'unknown'
      };
    } catch (error) {
      return {
        available: false,
        degraded: true,
        error: error.message
      };
    }
  }

  /**
   * Get recovery statistics
   */
  getRecoveryStats() {
    const stats = {
      offlineMode: this.offlineMode,
      degradationLevel: this.degradationLevel,
      totalAttempts: Array.from(this.recoveryAttempts.values()).reduce((sum, count) => sum + count, 0),
      serviceAttempts: Object.fromEntries(this.recoveryAttempts),
      fallbacksActive: this.fallbackData.size
    };

    return stats;
  }

  /**
   * Reset recovery state
   */
  reset() {
    this.offlineMode = false;
    this.degradationLevel = 0;
    this.recoveryAttempts.clear();
    this.fallbackData.clear();
    
    console.log(outputFormatter.success('🔄 Recovery state reset'));
  }

  /**
   * Create circuit breaker for service calls
   */
  createCircuitBreaker(serviceName, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitoringPeriod = 300000
    } = options;

    return {
      failures: 0,
      lastFailure: null,
      state: 'closed', // closed, open, half-open
      
      async call(operation) {
        if (this.state === 'open') {
          const timeSinceLastFailure = Date.now() - this.lastFailure;
          if (timeSinceLastFailure < resetTimeout) {
            throw new Error(`Circuit breaker open for ${serviceName}`);
          } else {
            this.state = 'half-open';
          }
        }

        try {
          const result = await operation();
          
          if (this.state === 'half-open') {
            this.state = 'closed';
            this.failures = 0;
          }
          
          return result;
        } catch (error) {
          this.failures++;
          this.lastFailure = Date.now();
          
          if (this.failures >= failureThreshold) {
            this.state = 'open';
            console.log(outputFormatter.warning(`🔴 Circuit breaker opened for ${serviceName}`));
          }
          
          throw error;
        }
      }
    };
  }
}

module.exports = new RecoveryService();