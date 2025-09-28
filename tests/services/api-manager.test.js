/**
 * Tests for API Manager Service
 */

const APIManager = require('../../src/services/api-manager');
const axios = require('axios');

// Mock dependencies
jest.mock('axios');
jest.mock('../../src/services/config', () => ({
  get: jest.fn((key, defaultValue) => {
    if (key === 'apiProviders') return {};
    if (key === 'debug') return false;
    return defaultValue;
  }),
  set: jest.fn(),
}));

jest.mock('../../src/services/cache', () => ({
  set: jest.fn(),
  get: jest.fn(),
}));

jest.mock('../../src/services/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe('API Manager Service', () => {
  let apiManager;

  beforeEach(async () => {
    // Reset the API manager instance
    apiManager = require('../../src/services/api-manager');

    // Clear all registered providers
    apiManager.providers.clear();
    apiManager.rateLimiters.clear();
    apiManager.requestCounts.clear();
    apiManager.failureTracking.clear();
    apiManager.circuitBreakers.clear();
    apiManager.initialized = false;

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Provider Registration', () => {
    test('should register a provider successfully', () => {
      const config = {
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
        timeout: 5000,
        rateLimit: { requests: 100, window: 3600000 },
      };

      const provider = apiManager.registerProvider('test-provider', config);

      expect(provider.name).toBe('test-provider');
      expect(provider.baseURL).toBe(config.baseURL);
      expect(provider.apiKey).toBe(config.apiKey);
      expect(provider.enabled).toBe(true);
      expect(apiManager.providers.has('test-provider')).toBe(true);
    });

    test('should initialize provider tracking systems', () => {
      const config = { baseURL: 'https://api.example.com' };
      apiManager.registerProvider('test-provider', config);

      expect(apiManager.rateLimiters.has('test-provider')).toBe(true);
      expect(apiManager.requestCounts.has('test-provider')).toBe(true);
      expect(apiManager.failureTracking.has('test-provider')).toBe(true);
      expect(apiManager.circuitBreakers.has('test-provider')).toBe(true);
    });

    test('should set default values for missing config options', () => {
      const config = { baseURL: 'https://api.example.com' };
      const provider = apiManager.registerProvider('test-provider', config);

      expect(provider.timeout).toBe(30000);
      expect(provider.retryCount).toBe(3);
      expect(provider.priority).toBe(1);
      expect(provider.enabled).toBe(true);
      expect(provider.rateLimit).toEqual({ requests: 100, window: 3600000 });
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      const config = {
        baseURL: 'https://api.example.com',
        rateLimit: { requests: 2, window: 1000 }, // 2 requests per second for testing
      };
      apiManager.registerProvider('test-provider', config);
    });

    test('should allow requests within rate limit', () => {
      expect(apiManager.checkRateLimit('test-provider')).toBe(true);
      expect(apiManager.checkRateLimit('test-provider')).toBe(true);
    });

    test('should block requests exceeding rate limit', () => {
      // Use up the rate limit
      apiManager.checkRateLimit('test-provider');
      apiManager.checkRateLimit('test-provider');

      // This should be blocked
      expect(apiManager.checkRateLimit('test-provider')).toBe(false);
    });

    test('should reset rate limit after time window', done => {
      // Use up the rate limit
      apiManager.checkRateLimit('test-provider');
      apiManager.checkRateLimit('test-provider');

      expect(apiManager.checkRateLimit('test-provider')).toBe(false);

      // Wait for window to reset
      setTimeout(() => {
        expect(apiManager.checkRateLimit('test-provider')).toBe(true);
        done();
      }, 1100);
    }, 2000);
  });

  describe('Circuit Breaker', () => {
    beforeEach(() => {
      const config = { baseURL: 'https://api.example.com' };
      apiManager.registerProvider('test-provider', config);
    });

    test('should start with closed circuit breaker', () => {
      expect(apiManager.isCircuitClosed('test-provider')).toBe(true);
    });

    test('should open circuit breaker after consecutive failures', () => {
      const error = new Error('API Error');

      // Record 5 consecutive failures
      for (let i = 0; i < 5; i++) {
        apiManager.recordFailure('test-provider', error);
      }

      expect(apiManager.isCircuitClosed('test-provider')).toBe(false);

      const breaker = apiManager.circuitBreakers.get('test-provider');
      expect(breaker.state).toBe('OPEN');
    });

    test('should close circuit breaker after successful request', () => {
      const error = new Error('API Error');

      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        apiManager.recordFailure('test-provider', error);
      }

      // Set to half-open manually
      const breaker = apiManager.circuitBreakers.get('test-provider');
      breaker.state = 'HALF_OPEN';

      // Record success
      apiManager.recordSuccess('test-provider');

      expect(breaker.state).toBe('CLOSED');
    });
  });

  describe('Request Execution', () => {
    beforeEach(() => {
      const config = {
        baseURL: 'https://api.example.com',
        apiKey: 'test-key',
      };
      apiManager.registerProvider('test-provider', config);
    });

    test('should make successful API request', async () => {
      const mockResponse = {
        data: { message: 'success' },
        status: 200,
        headers: {},
      };

      axios.mockResolvedValue(mockResponse);

      const result = await apiManager.executeRequest('test-provider', '/test', {
        method: 'GET',
      });

      expect(result.data).toEqual(mockResponse.data);
      expect(result.status).toBe(200);
      expect(result.provider).toBe('test-provider');
      expect(typeof result.requestId).toBe('string');
      expect(typeof result.duration).toBe('number');
    });

    test('should include authorization header when API key is provided', async () => {
      const mockResponse = { data: {}, status: 200, headers: {} };
      axios.mockResolvedValue(mockResponse);

      await apiManager.executeRequest('test-provider', '/test', {
        method: 'GET',
      });

      expect(axios).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        })
      );
    });

    test('should handle API request failures', async () => {
      const error = new Error('Network Error');
      axios.mockRejectedValue(error);

      await expect(
        apiManager.executeRequest('test-provider', '/test', { method: 'GET' })
      ).rejects.toThrow('Network Error');
    });
  });

  describe('Provider Failover', () => {
    beforeEach(() => {
      // Register multiple providers with different priorities
      apiManager.registerProvider('primary', {
        baseURL: 'https://primary.api.com',
        priority: 5,
      });

      apiManager.registerProvider('secondary', {
        baseURL: 'https://secondary.api.com',
        priority: 3,
      });

      apiManager.registerProvider('tertiary', {
        baseURL: 'https://tertiary.api.com',
        priority: 1,
      });
    });

    test('should sort providers by priority', () => {
      const providers = ['primary', 'secondary', 'tertiary'];
      const sorted = apiManager.sortProvidersByPriority(providers);

      expect(sorted).toEqual(['primary', 'secondary', 'tertiary']);
    });

    test('should try providers in order until one succeeds', async () => {
      const mockResponse = {
        data: { message: 'success' },
        status: 200,
        headers: {},
      };

      axios
        .mockRejectedValueOnce(new Error('Primary failed'))
        .mockRejectedValueOnce(new Error('Secondary failed'))
        .mockResolvedValue(mockResponse);

      const result = await apiManager.makeRequest('test-service', '/endpoint');

      expect(result.provider).toBe('tertiary');
      expect(axios).toHaveBeenCalledTimes(3);
    });

    test('should fail if all providers fail', async () => {
      axios.mockRejectedValue(new Error('All providers failed'));

      await expect(
        apiManager.makeRequest('test-service', '/endpoint')
      ).rejects.toThrow('All API providers failed');
    });
  });

  describe('Provider Health', () => {
    beforeEach(() => {
      apiManager.registerProvider('test-provider', {
        baseURL: 'https://api.example.com',
      });
    });

    test('should consider provider healthy initially', () => {
      expect(apiManager.isProviderHealthy('test-provider')).toBe(true);
    });

    test('should consider provider unhealthy when circuit breaker is open', () => {
      const breaker = apiManager.circuitBreakers.get('test-provider');
      breaker.state = 'OPEN';

      expect(apiManager.isProviderHealthy('test-provider')).toBe(false);
    });

    test('should consider provider unhealthy when rate limited', () => {
      const limiter = apiManager.rateLimiters.get('test-provider');
      limiter.blocked = true;
      limiter.blockedUntil = Date.now() + 10000;

      expect(apiManager.isProviderHealthy('test-provider')).toBe(false);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      apiManager.registerProvider('test-provider', {
        baseURL: 'https://api.example.com',
      });
    });

    test('should provide comprehensive statistics', () => {
      // Record some requests
      apiManager.recordSuccess('test-provider');
      apiManager.recordFailure('test-provider', new Error('Test error'));

      const stats = apiManager.getStatistics();

      expect(stats.providers['test-provider']).toBeDefined();
      expect(stats.providers['test-provider'].requests.total).toBe(2);
      expect(stats.providers['test-provider'].requests.successful).toBe(1);
      expect(stats.providers['test-provider'].requests.failed).toBe(1);
      expect(stats.overall.totalRequests).toBe(2);
      expect(stats.overall.successfulRequests).toBe(1);
      expect(stats.overall.failedRequests).toBe(1);
    });

    test('should track provider health in statistics', () => {
      const stats = apiManager.getStatistics();

      expect(stats.providers['test-provider'].healthy).toBe(true);
      expect(stats.providers['test-provider'].enabled).toBe(true);
      expect(stats.providers['test-provider'].circuitBreaker).toBe('CLOSED');
      expect(stats.providers['test-provider'].rateLimited).toBe(false);
    });
  });

  describe('Provider Management', () => {
    beforeEach(() => {
      apiManager.registerProvider('test-provider', {
        baseURL: 'https://api.example.com',
      });
    });

    test('should enable and disable providers', () => {
      apiManager.setProviderEnabled('test-provider', false);
      expect(apiManager.getProvider('test-provider').enabled).toBe(false);

      apiManager.setProviderEnabled('test-provider', true);
      expect(apiManager.getProvider('test-provider').enabled).toBe(true);
    });

    test('should list all providers', () => {
      apiManager.registerProvider('provider2', { baseURL: 'https://api2.com' });

      const providers = apiManager.listProviders();
      expect(providers).toContain('test-provider');
      expect(providers).toContain('provider2');
      expect(providers).toHaveLength(2);
    });

    test('should reset circuit breaker', () => {
      // Open the circuit breaker
      const error = new Error('Test error');
      for (let i = 0; i < 5; i++) {
        apiManager.recordFailure('test-provider', error);
      }

      expect(apiManager.isCircuitClosed('test-provider')).toBe(false);

      // Reset it
      apiManager.resetCircuitBreaker('test-provider');

      expect(apiManager.isCircuitClosed('test-provider')).toBe(true);

      const breaker = apiManager.circuitBreakers.get('test-provider');
      expect(breaker.state).toBe('CLOSED');
    });
  });

  describe('Request ID Generation', () => {
    test('should generate unique request IDs', () => {
      const id1 = apiManager.generateRequestId();
      const id2 = apiManager.generateRequestId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^req_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^req_\d+_[a-z0-9]+$/);
    });
  });
});
