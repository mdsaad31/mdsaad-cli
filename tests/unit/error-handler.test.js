/**
 * Unit Tests for Error Handler Service
 */

const ErrorHandler = require('../../src/services/error-handler');
const fs = require('fs-extra');
const path = require('path');

describe('Error Handler Service', () => {
  let errorHandler;
  let mockConsole;
  
  beforeEach(async () => {
    await global.testUtils.setupTestDirs();
    errorHandler = new ErrorHandler();
    
    // Mock console methods
    mockConsole = {
      error: jest.fn(),
      warn: jest.fn(),
      log: jest.fn()
    };
    
    jest.spyOn(console, 'error').mockImplementation(mockConsole.error);
    jest.spyOn(console, 'warn').mockImplementation(mockConsole.warn);
    jest.spyOn(console, 'log').mockImplementation(mockConsole.log);
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
    jest.restoreAllMocks();
  });

  describe('error classification', () => {
    test('should classify network errors correctly', () => {
      const networkError = new Error('ECONNREFUSED');
      networkError.code = 'ECONNREFUSED';

      const classification = errorHandler.classifyError(networkError);

      expect(classification.type).toBe('NETWORK_ERROR');
      expect(classification.severity).toBe('HIGH');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify API errors correctly', () => {
      const apiError = new Error('Invalid API key');
      apiError.status = 401;
      apiError.response = { data: { error: 'Unauthorized' } };

      const classification = errorHandler.classifyError(apiError);

      expect(classification.type).toBe('API_ERROR');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify validation errors correctly', () => {
      const validationError = new Error('Invalid input format');
      validationError.name = 'ValidationError';

      const classification = errorHandler.classifyError(validationError);

      expect(classification.type).toBe('VALIDATION_ERROR');
      expect(classification.severity).toBe('LOW');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify file system errors correctly', () => {
      const fsError = new Error('ENOENT: no such file or directory');
      fsError.code = 'ENOENT';
      fsError.path = '/nonexistent/file.txt';

      const classification = errorHandler.classifyError(fsError);

      expect(classification.type).toBe('FILE_SYSTEM_ERROR');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.recoverable).toBe(true);
    });

    test('should classify unknown errors as system errors', () => {
      const unknownError = new Error('Something went wrong');

      const classification = errorHandler.classifyError(unknownError);

      expect(classification.type).toBe('SYSTEM_ERROR');
      expect(classification.severity).toBe('HIGH');
      expect(classification.recoverable).toBe(false);
    });

    test('should classify timeout errors correctly', () => {
      const timeoutError = new Error('Request timeout');
      timeoutError.code = 'TIMEOUT';

      const classification = errorHandler.classifyError(timeoutError);

      expect(classification.type).toBe('TIMEOUT_ERROR');
      expect(classification.severity).toBe('MEDIUM');
      expect(classification.recoverable).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle errors with recovery strategies', async () => {
      const networkError = new Error('Connection failed');
      networkError.code = 'ECONNREFUSED';

      const result = await errorHandler.handleError(networkError);

      expect(result.handled).toBe(true);
      expect(result.recovered).toBe(false); // No recovery action implemented
      expect(result.classification.type).toBe('NETWORK_ERROR');
    });

    test('should log errors with appropriate levels', async () => {
      const criticalError = new Error('Critical system failure');
      criticalError.severity = 'CRITICAL';

      await errorHandler.handleError(criticalError);

      expect(mockConsole.error).toHaveBeenCalled();
    });

    test('should provide recovery suggestions', () => {
      const apiError = new Error('API rate limit exceeded');
      apiError.status = 429;

      const suggestions = errorHandler.getRecoverySuggestions(apiError);

      expect(suggestions).toContain('retry');
      expect(suggestions).toContain('rate limit');
    });

    test('should handle multiple errors gracefully', async () => {
      const errors = [
        new Error('Network error'),
        new Error('Validation error'),
        new Error('API error')
      ];

      const results = await Promise.all(
        errors.map(error => errorHandler.handleError(error))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.handled).toBe(true);
      });
    });
  });

  describe('error context', () => {
    test('should capture error context information', () => {
      const error = new Error('Test error');
      const context = {
        operation: 'test-operation',
        userInput: 'test input',
        timestamp: Date.now()
      };

      const enrichedError = errorHandler.enrichError(error, context);

      expect(enrichedError.context).toEqual(context);
      expect(enrichedError.originalMessage).toBe(error.message);
    });

    test('should include stack trace in error context', () => {
      const error = new Error('Test error with stack');
      
      const enrichedError = errorHandler.enrichError(error);

      expect(enrichedError.stack).toBeTruthy();
      expect(enrichedError.stack).toContain('Test error with stack');
    });

    test('should sanitize sensitive information from context', () => {
      const error = new Error('API error');
      const context = {
        apiKey: 'secret-api-key-12345',
        password: 'user-password',
        operation: 'api-call'
      };

      const sanitizedError = errorHandler.sanitizeError(error, context);

      expect(sanitizedError.context.apiKey).toBe('[REDACTED]');
      expect(sanitizedError.context.password).toBe('[REDACTED]');
      expect(sanitizedError.context.operation).toBe('api-call');
    });
  });

  describe('error reporting', () => {
    test('should format errors for user display', () => {
      const error = new Error('API connection failed');
      error.code = 'ECONNREFUSED';

      const userMessage = errorHandler.formatUserMessage(error);

      expect(userMessage).not.toContain('ECONNREFUSED');
      expect(userMessage.toLowerCase()).toContain('connection');
      expect(userMessage.toLowerCase()).toContain('network');
    });

    test('should create detailed error reports', () => {
      const error = new Error('Detailed error test');
      const context = {
        operation: 'calculate',
        input: '2+2',
        timestamp: Date.now()
      };

      const report = errorHandler.createErrorReport(error, context);

      expect(report.error).toBeTruthy();
      expect(report.context).toEqual(context);
      expect(report.classification).toBeTruthy();
      expect(report.suggestions).toBeInstanceOf(Array);
      expect(report.timestamp).toBeInstanceOf(Date);
    });

    test('should export error logs', async () => {
      const logFile = path.join(global.testUtils.TEST_CONFIG_DIR, 'error-export.json');
      
      // Generate some errors
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      await errorHandler.exportLogs(logFile);

      expect(await fs.pathExists(logFile)).toBe(true);
      
      const exportData = await fs.readJSON(logFile);
      expect(exportData.errors).toBeInstanceOf(Array);
      expect(exportData.errors.length).toBeGreaterThan(0);
    });
  });

  describe('recovery mechanisms', () => {
    test('should implement retry mechanism', async () => {
      let attempts = 0;
      const flakyOperation = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Temporary failure');
        }
        return 'success';
      };

      const result = await errorHandler.withRetry(flakyOperation, { maxRetries: 3 });

      expect(result).toBe('success');
      expect(attempts).toBe(3);
    });

    test('should implement exponential backoff', async () => {
      const startTime = Date.now();
      let attempts = 0;

      const failingOperation = async () => {
        attempts++;
        throw new Error('Always fails');
      };

      try {
        await errorHandler.withRetry(failingOperation, { 
          maxRetries: 3, 
          backoff: 'exponential',
          baseDelay: 10 
        });
      } catch (error) {
        // Expected to fail
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(attempts).toBe(4); // Initial + 3 retries
      expect(totalTime).toBeGreaterThan(60); // Should have delays (10 + 20 + 40 = 70ms minimum)
    });

    test('should provide fallback operations', async () => {
      const primaryOperation = async () => {
        throw new Error('Primary failed');
      };

      const fallbackOperation = async () => {
        return 'fallback result';
      };

      const result = await errorHandler.withFallback(primaryOperation, fallbackOperation);

      expect(result).toBe('fallback result');
    });

    test('should circuit breaker pattern', async () => {
      const failingService = async () => {
        throw new Error('Service unavailable');
      };

      const circuitBreaker = errorHandler.createCircuitBreaker(failingService, {
        failureThreshold: 3,
        timeout: 100
      });

      // Should fail and increment failure count
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker();
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should now be open
      await expect(circuitBreaker()).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('error analytics', () => {
    test('should track error frequency', async () => {
      const errors = [
        new Error('Network error'),
        new Error('Network error'),
        new Error('API error'),
        new Error('Validation error')
      ];

      for (const error of errors) {
        await errorHandler.handleError(error);
      }

      const analytics = await errorHandler.getAnalytics();

      expect(analytics.totalErrors).toBe(4);
      expect(analytics.errorsByType.NETWORK_ERROR).toBe(2);
      expect(analytics.errorsByType.API_ERROR).toBe(1);
    });

    test('should identify error trends', async () => {
      const now = Date.now();
      
      // Create errors with timestamps
      const errors = [
        { error: new Error('Trend error 1'), timestamp: now - 1000 },
        { error: new Error('Trend error 2'), timestamp: now - 500 },
        { error: new Error('Trend error 3'), timestamp: now }
      ];

      for (const { error, timestamp } of errors) {
        error.timestamp = timestamp;
        await errorHandler.handleError(error);
      }

      const trends = await errorHandler.getTrends();

      expect(trends.recentErrors).toBeGreaterThan(0);
      expect(trends.errorRate).toBeGreaterThan(0);
    });

    test('should generate error summary reports', async () => {
      // Generate various types of errors
      const errorTypes = ['Network', 'API', 'Validation', 'System'];
      
      for (let i = 0; i < 20; i++) {
        const errorType = errorTypes[i % errorTypes.length];
        const error = new Error(`${errorType} error ${i}`);
        await errorHandler.handleError(error);
      }

      const summary = await errorHandler.getSummary();

      expect(summary.totalErrors).toBe(20);
      expect(summary.topErrors).toBeInstanceOf(Array);
      expect(summary.timeRange).toBeTruthy();
    });
  });

  describe('error prevention', () => {
    test('should validate inputs to prevent errors', () => {
      const validationRules = {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1 },
          age: { type: 'number', minimum: 0 }
        },
        required: ['name']
      };

      const validInput = { name: 'John', age: 30 };
      const invalidInput = { age: -5 };

      expect(errorHandler.validateInput(validInput, validationRules)).toBe(true);
      expect(() => errorHandler.validateInput(invalidInput, validationRules)).toThrow();
    });

    test('should provide input sanitization', () => {
      const maliciousInput = {
        name: '<script>alert("xss")</script>',
        description: 'Normal text',
        code: 'rm -rf /'
      };

      const sanitized = errorHandler.sanitizeInput(maliciousInput);

      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.description).toBe('Normal text');
      expect(sanitized.code).not.toContain('rm -rf');
    });

    test('should implement rate limiting', async () => {
      const rateLimiter = errorHandler.createRateLimiter({ 
        maxRequests: 3, 
        windowMs: 1000 
      });

      // Should allow first 3 requests
      for (let i = 0; i < 3; i++) {
        expect(await rateLimiter.checkLimit('test-user')).toBe(true);
      }

      // Should reject 4th request
      expect(await rateLimiter.checkLimit('test-user')).toBe(false);
    });
  });

  describe('debugging support', () => {
    test('should provide debug information', () => {
      const error = new Error('Debug test error');
      
      const debugInfo = errorHandler.getDebugInfo(error);

      expect(debugInfo.errorMessage).toBe(error.message);
      expect(debugInfo.stack).toBeTruthy();
      expect(debugInfo.timestamp).toBeInstanceOf(Date);
      expect(debugInfo.nodeVersion).toBeTruthy();
      expect(debugInfo.platform).toBeTruthy();
    });

    test('should capture system state during errors', async () => {
      const error = new Error('System state error');
      
      const systemState = await errorHandler.captureSystemState(error);

      expect(systemState.memory).toBeTruthy();
      expect(systemState.memory.heapUsed).toBeGreaterThan(0);
      expect(systemState.uptime).toBeGreaterThan(0);
      expect(systemState.loadAverage).toBeInstanceOf(Array);
    });

    test('should create diagnostic dumps', async () => {
      const dumpFile = path.join(global.testUtils.TEST_CONFIG_DIR, 'diagnostic-dump.json');
      
      const error = new Error('Diagnostic test error');
      await errorHandler.handleError(error);

      await errorHandler.createDiagnosticDump(dumpFile);

      expect(await fs.pathExists(dumpFile)).toBe(true);
      
      const dump = await fs.readJSON(dumpFile);
      expect(dump.errors).toBeTruthy();
      expect(dump.systemInfo).toBeTruthy();
      expect(dump.timestamp).toBeTruthy();
    });
  });
});