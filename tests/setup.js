/**
 * Jest Test Setup
 * Global test configuration and utilities
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.CI = 'true'; // Disable animations and interactive features

// Set up temporary directories for testing
const TEST_DIR = path.join(os.tmpdir(), 'mdsaad-test', Date.now().toString());
const TEST_CONFIG_DIR = path.join(TEST_DIR, '.mdsaad');
const TEST_CACHE_DIR = path.join(TEST_CONFIG_DIR, 'cache');

// Override default directories for testing
process.env.MDSAAD_CONFIG_DIR = TEST_CONFIG_DIR;
process.env.MDSAAD_CACHE_DIR = TEST_CACHE_DIR;

// Global test utilities
global.testUtils = {
  TEST_DIR,
  TEST_CONFIG_DIR,
  TEST_CACHE_DIR,
  
  /**
   * Setup test directories
   */
  async setupTestDirs() {
    await fs.ensureDir(TEST_DIR);
    await fs.ensureDir(TEST_CONFIG_DIR);
    await fs.ensureDir(TEST_CACHE_DIR);
  },
  
  /**
   * Cleanup test directories
   */
  async cleanupTestDirs() {
    try {
      await fs.remove(TEST_DIR);
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  },
  
  /**
   * Create mock configuration
   */
  async createMockConfig(config = {}) {
    const defaultConfig = {
      language: 'en',
      theme: 'default',
      cacheEnabled: true,
      debugMode: false,
      ...config
    };
    
    const configPath = path.join(TEST_CONFIG_DIR, 'config.json');
    await fs.writeJson(configPath, defaultConfig);
    return configPath;
  },
  
  /**
   * Create mock cache entry
   */
  async createMockCache(key, data, ttl = 3600000) {
    const cacheData = {
      data,
      timestamp: Date.now(),
      ttl
    };
    
    const cachePath = path.join(TEST_CACHE_DIR, `${key}.json`);
    await fs.writeJson(cachePath, cacheData);
    return cachePath;
  },
  
  /**
   * Mock console methods for testing output
   */
  mockConsole() {
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;
    
    const logs = [];
    const errors = [];
    const warnings = [];
    
    console.log = jest.fn((...args) => {
      logs.push(args.join(' '));
    });
    
    console.error = jest.fn((...args) => {
      errors.push(args.join(' '));
    });
    
    console.warn = jest.fn((...args) => {
      warnings.push(args.join(' '));
    });
    
    return {
      logs,
      errors,
      warnings,
      restore() {
        console.log = originalLog;
        console.error = originalError;
        console.warn = originalWarn;
      }
    };
  },
  
  /**
   * Wait for a specified amount of time
   */
  wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },
  
  /**
   * Create a mock HTTP server response
   */
  mockApiResponse(data, status = 200) {
    return {
      data,
      status,
      statusText: status === 200 ? 'OK' : 'Error',
      headers: {
        'content-type': 'application/json'
      },
      config: {},
      request: {}
    };
  },
  
  /**
   * Generate random test data
   */
  randomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  },
  
  /**
   * Generate random number in range
   */
  randomNumber(min = 0, max = 100) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
};

// Global test matchers
expect.extend({
  /**
   * Check if value is a valid color code
   */
  toBeValidColorCode(received) {
    const colorCodeRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$|^rgb\(\d+,\s*\d+,\s*\d+\)$|^rgba\(\d+,\s*\d+,\s*\d+,\s*[\d.]+\)$/;
    const pass = colorCodeRegex.test(received);
    
    return {
      message: () =>
        pass
          ? `expected ${received} not to be a valid color code`
          : `expected ${received} to be a valid color code`,
      pass
    };
  },
  
  /**
   * Check if value is within a numeric range
   */
  toBeWithinRange(received, floor, ceiling) {
    const pass = received >= floor && received <= ceiling;
    return {
      message: () =>
        pass
          ? `expected ${received} not to be within range ${floor} - ${ceiling}`
          : `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass
    };
  },
  
  /**
   * Check if array contains objects with specific properties
   */
  toContainObjectWithProperty(received, property, value) {
    const pass = received.some(item => 
      typeof item === 'object' && item[property] === value
    );
    
    return {
      message: () =>
        pass
          ? `expected array not to contain object with ${property}: ${value}`
          : `expected array to contain object with ${property}: ${value}`,
      pass
    };
  }
});

// Mock network requests by default in tests
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    defaults: {
      headers: {
        common: {}
      }
    }
  })),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
}));

// Global setup
beforeAll(async () => {
  await global.testUtils.setupTestDirs();
});

// Global cleanup
afterAll(async () => {
  await global.testUtils.cleanupTestDirs();
});

// Setup before each test
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset environment variables
  process.env.NODE_ENV = 'test';
  delete process.env.DEBUG;
  delete process.env.VERBOSE;
});

// Cleanup after each test
afterEach(() => {
  // Restore any mocked functions
  jest.restoreAllMocks();
});

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Increase default timeout for slower operations
jest.setTimeout(10000);