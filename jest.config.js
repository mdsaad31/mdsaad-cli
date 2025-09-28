module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directories for tests and source code
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js',
    '**/tests/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/coverage/',
    '<rootDir>/tests/setup.js',
    '<rootDir>/tests/weather.test.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli.js', // Exclude main entry point from coverage
    '!src/**/*.test.js',
    '!src/assets/**',
    '!src/**/*.d.ts',
    '!src/**/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json-summary'
  ],
  coverageThreshold: {
    global: {
      branches: 75,
      functions: 75,
      lines: 75,
      statements: 75
    }
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // Module name mapping for easier imports in tests
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  
  // Timeout for tests (increased for performance tests)
  testTimeout: 10000,
  
  // Verbose output
  verbose: process.env.CI === 'true' || process.env.NODE_ENV === 'test',
  
  // Global variables
  globals: {
    'NODE_ENV': 'test'
  },
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Performance monitoring
  detectLeaks: false, // Disabled for performance
  detectOpenHandles: true
};