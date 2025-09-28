/**
 * Security Tests - Input Validation, API Key Management, Network Security
 */

const InputValidator = require('../../src/services/input-validator');
const SecurityManager = require('../../src/services/security-manager');
const NetworkSecurity = require('../../src/services/network-security');
const SecurityCommand = require('../../src/commands/security');
const fs = require('fs-extra');
const path = require('path');

describe('Security Services', () => {
  let inputValidator;
  let securityManager;
  let networkSecurity;
  let mockConsole;

  beforeEach(async () => {
    await global.testUtils.setupTestDirs();
    
    inputValidator = new InputValidator();
    securityManager = new SecurityManager();
    networkSecurity = new NetworkSecurity();

    // Override config directory for testing
    securityManager.configDir = global.testUtils.TEST_CONFIG_DIR;
    securityManager.keyFile = path.join(global.testUtils.TEST_CONFIG_DIR, '.keys');

    mockConsole = global.testUtils.mockConsole();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
    mockConsole.restore();
  });

  describe('Input Validator', () => {
    test('should validate email addresses correctly', () => {
      expect(inputValidator.validate('user@example.com', 'email')).toBe('user@example.com');
      expect(inputValidator.validate('test.email+tag@domain.co.uk', 'email')).toBe('test.email+tag@domain.co.uk');
      
      expect(() => inputValidator.validate('invalid-email', 'email')).toThrow('Invalid email format');
      expect(() => inputValidator.validate('user@', 'email')).toThrow('Invalid email format');
    });

    test('should validate URL formats correctly', () => {
      expect(inputValidator.validate('https://example.com', 'url')).toBe('https://example.com');
      expect(inputValidator.validate('http://api.service.com/v1/data', 'url')).toBe('http://api.service.com/v1/data');
      
      expect(() => inputValidator.validate('invalid-url', 'url')).toThrow('Invalid URL format');
      expect(() => inputValidator.validate('ftp://file.com', 'url')).toThrow('Invalid URL format');
    });

    test('should validate API keys correctly', () => {
      expect(inputValidator.validate('abc123_key-456', 'apiKey')).toBe('abc123_key-456');
      expect(inputValidator.validate('VALID_API_KEY_123', 'apiKey')).toBe('VALID_API_KEY_123');
      
      expect(() => inputValidator.validate('invalid@key!', 'apiKey')).toThrow('API key contains invalid characters');
      expect(() => inputValidator.validate('key with spaces', 'apiKey')).toThrow('API key contains invalid characters');
    });

    test('should validate mathematical expressions safely', () => {
      expect(inputValidator.validate('2 + 2 * 3', 'expression')).toBe('2 + 2 * 3');
      expect(inputValidator.validate('sin(pi/2) + cos(0)', 'expression')).toBe('sin(pi/2) + cos(0)');
      expect(inputValidator.validate('(10 + 5) / 3', 'expression')).toBe('(10 + 5) / 3');
      
      expect(() => inputValidator.validate('eval(alert("xss"))', 'expression')).toThrow('dangerous function');
      expect(() => inputValidator.validate('2 + 2)', 'expression')).toThrow('Unbalanced parentheses');
      expect(() => inputValidator.validate('2 + 2$', 'expression')).toThrow('invalid characters');
    });

    test('should validate city names correctly', () => {
      expect(inputValidator.validate('New York', 'cityName')).toBe('New York');
      expect(inputValidator.validate("O'Connor", 'cityName')).toBe("O'Connor");
      expect(inputValidator.validate('São Paulo', 'cityName')).toBe('São Paulo');
      
      expect(() => inputValidator.validate('City123', 'cityName')).toThrow('invalid characters');
      expect(() => inputValidator.validate('', 'cityName')).toThrow('cannot be empty');
    });

    test('should validate currency codes correctly', () => {
      expect(inputValidator.validate('USD', 'currencyCode')).toBe('USD');
      expect(inputValidator.validate('EUR', 'currencyCode')).toBe('EUR');
      
      expect(() => inputValidator.validate('usd', 'currencyCode')).toThrow('Invalid currency code format');
      expect(() => inputValidator.validate('USDD', 'currencyCode')).toThrow('Invalid currency code format');
    });

    test('should sanitize dangerous input', () => {
      const dangerousInput = '<script>alert("xss")</script>Hello';
      const sanitized = inputValidator.sanitize(dangerousInput, 'html');
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).toContain('Hello');
    });

    test('should handle path traversal attempts', () => {
      const maliciousPath = '../../etc/passwd';
      const sanitized = inputValidator.sanitize(maliciousPath, 'path');
      expect(sanitized).not.toContain('../');
    });

    test('should implement rate limiting', () => {
      const identifier = 'test-user-rate-limit';
      
      // Should allow requests within limit
      for (let i = 0; i < 4; i++) {
        expect(inputValidator.checkRateLimit(identifier, 5, 60000)).toBe(true);
      }
      
      // Should block requests over limit - add one more to reach limit
      inputValidator.checkRateLimit(identifier, 5, 60000); // 5th request
      expect(() => inputValidator.checkRateLimit(identifier, 5, 60000)).toThrow('Rate limit exceeded');
    });

    test('should process input with validation and sanitization', () => {
      const input = '  test@example.com  ';
      const result = inputValidator.process(input, 'email');
      expect(result).toBe('test@example.com');
    });

    test('should handle length limits', () => {
      const longInput = 'a'.repeat(1001);
      expect(() => inputValidator.validate(longInput, 'expression')).toThrow('exceeds maximum length');
      
      const validInput = 'a'.repeat(100);
      expect(inputValidator.validate(validInput, 'expression')).toBe(validInput);
    });
  });

  describe('Security Manager', () => {
    test('should initialize security manager', async () => {
      const result = await securityManager.initialize();
      expect(result).toBe(true);
      expect(await fs.pathExists(securityManager.configDir)).toBe(true);
    });

    test('should encrypt and decrypt data correctly', () => {
      const originalText = 'sensitive data 123';
      const encrypted = securityManager.encrypt(originalText);
      
      expect(encrypted.encrypted).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      
      const decrypted = securityManager.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    test('should store and retrieve API keys securely', async () => {
      await securityManager.initialize();
      
      const service = 'test-service';
      const apiKey = 'test-api-key-12345';
      
      // Store API key
      const stored = await securityManager.storeApiKey(service, apiKey);
      expect(stored).toBe(true);
      
      // Retrieve API key
      const retrieved = await securityManager.getApiKey(service);
      expect(retrieved).toBe(apiKey);
      
      // Verify key file exists and has content
      expect(await fs.pathExists(securityManager.keyFile)).toBe(true);
      
      // Remove API key
      const removed = await securityManager.removeApiKey(service);
      expect(removed).toBe(true);
      
      // Verify key is gone
      const notFound = await securityManager.getApiKey(service);
      expect(notFound).toBeNull();
    });

    test('should list stored API keys without revealing actual keys', async () => {
      await securityManager.initialize();
      
      const services = ['service1', 'service2', 'service3'];
      
      // Store multiple keys
      for (const service of services) {
        await securityManager.storeApiKey(service, `key-${service}`);
      }
      
      const keys = await securityManager.listApiKeys();
      expect(keys).toHaveLength(3);
      
      keys.forEach(key => {
        expect(key).toHaveProperty('service');
        expect(key).toHaveProperty('createdAt');
        expect(key).toHaveProperty('lastUsed');
        expect(key).toHaveProperty('isExpired');
        expect(services).toContain(key.service);
      });
    });

    test('should handle password hashing and verification', () => {
      const password = 'securePassword123!';
      const hashed = securityManager.hashPassword(password);
      
      expect(hashed.hash).toBeTruthy();
      expect(hashed.salt).toBeTruthy();
      expect(hashed.hash).toHaveLength(128); // 64 bytes as hex
      
      const isValid = securityManager.verifyPassword(password, hashed.hash, hashed.salt);
      expect(isValid).toBe(true);
      
      const isInvalid = securityManager.verifyPassword('wrongPassword', hashed.hash, hashed.salt);
      expect(isInvalid).toBe(false);
    });

    test('should implement login attempt rate limiting', () => {
      const identifier = 'test-user';
      
      // Should allow initial attempts
      expect(securityManager.checkLoginAttempts(identifier)).toBe(true);
      
      // Record failed attempts
      for (let i = 0; i < 5; i++) {
        securityManager.recordFailedAttempt(identifier);
      }
      
      // Should block after max attempts
      expect(() => securityManager.checkLoginAttempts(identifier)).toThrow('Too many failed attempts');
      
      // Clear attempts should reset
      securityManager.clearLoginAttempts(identifier);
      expect(securityManager.checkLoginAttempts(identifier)).toBe(true);
    });

    test('should generate secure tokens', () => {
      const token1 = securityManager.generateToken();
      const token2 = securityManager.generateToken();
      
      expect(token1).toHaveLength(64); // 32 bytes as hex
      expect(token2).toHaveLength(64);
      expect(token1).not.toBe(token2);
      
      const customLength = securityManager.generateToken(16);
      expect(customLength).toHaveLength(32); // 16 bytes as hex
    });

    test('should clean up expired keys', async () => {
      await securityManager.initialize();
      
      // Create test keys with mock old dates
      const keyData = [{
        service: 'old-service',
        encrypted: { encrypted: 'test', iv: 'test', authTag: 'test' },
        createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days old
        lastUsed: new Date().toISOString()
      }];
      
      await fs.writeJSON(securityManager.keyFile, keyData);
      
      const cleaned = await securityManager.cleanupExpiredKeys();
      expect(cleaned).toBe(1);
    });

    test('should generate security report', async () => {
      await securityManager.initialize();
      
      // Add some test keys
      await securityManager.storeApiKey('test1', 'key1');
      await securityManager.storeApiKey('test2', 'key2');
      
      const report = await securityManager.generateSecurityReport();
      
      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('configDir');
      expect(report).toHaveProperty('keyFile');
      expect(report).toHaveProperty('settings');
      expect(report).toHaveProperty('apiKeys');
      expect(report).toHaveProperty('securityLevel');
      
      expect(report.apiKeys).toHaveLength(2);
      expect(['HIGH', 'MEDIUM', 'LOW']).toContain(report.securityLevel);
    });
  });

  describe('Network Security', () => {
    test('should create secure HTTP agent with proper settings', () => {
      const agent = networkSecurity.createSecureAgent();
      
      expect(agent).toBeTruthy();
      expect(agent.keepAlive).toBe(true);
      expect(agent.options.timeout).toBe(30000);
      expect(agent.options.secureProtocol).toBe('TLSv1_2_method');
    });

    test('should validate request headers', () => {
      const headers = {
        'Authorization': 'Bearer token',
        'X-Forwarded-For': '192.168.1.1', // Should be removed
        'Content-Type': 'application/json'
      };
      
      const validatedHeaders = networkSecurity.validateHeaders(headers);
      
      expect(validatedHeaders).toHaveProperty('User-Agent');
      expect(validatedHeaders).toHaveProperty('Authorization');
      expect(validatedHeaders).toHaveProperty('Content-Type');
      expect(validatedHeaders).not.toHaveProperty('x-forwarded-for');
      expect(validatedHeaders['User-Agent']).toBe('mdsaad-cli/1.0.0');
    });

    test('should implement rate limiting for network requests', () => {
      const hostname = 'test-api.example.com';
      
      // Should allow requests within burst limit
      for (let i = 0; i < 10; i++) {
        expect(networkSecurity.checkRateLimit(hostname)).toBe(true);
      }
      
      // Next request should exceed burst limit (10+1=11 > 10)
      expect(() => networkSecurity.checkRateLimit(hostname)).toThrow('Burst limit exceeded');
    });

    test('should sign and verify requests', () => {
      const data = { message: 'test data' };
      const signature = networkSecurity.signRequest(data);
      
      expect(signature).toMatch(/^\d+\.[a-f0-9]+$/); // timestamp.signature format
      
      const verified = networkSecurity.verifyResponse(data, signature);
      expect(verified).toBe(true);
      
      const invalidVerification = networkSecurity.verifyResponse({ modified: 'data' }, signature);
      expect(invalidVerification).toBe(false);
    });

    test('should sanitize API response data', () => {
      const maliciousResponse = {
        data: 'normal data',
        __proto__: { dangerous: 'property' },
        script: '<script>alert("xss")</script>',
        javascript: 'javascript:alert("xss")',
        onclick: 'onclick=alert("xss")'
      };
      
      const sanitized = networkSecurity.sanitizeResponse(maliciousResponse);
      
      expect(sanitized).toHaveProperty('data');
      expect(sanitized.data).toBe('normal data');
      expect(Object.keys(sanitized)).not.toContain('__proto__');
      expect(sanitized.script).not.toContain('<script>');
      expect(sanitized.javascript).not.toContain('javascript:');
      expect(sanitized.onclick).not.toContain('onclick=');
    });

    test('should validate API response structure', () => {
      const validResponse = {
        success: true,
        data: 'test',
        count: 1
      };
      
      const expectedStructure = {
        success: 'boolean',
        data: 'string',
        count: 'number'
      };
      
      expect(networkSecurity.validateApiResponse(validResponse, expectedStructure)).toBe(true);
      
      const invalidResponse = {
        success: 'true', // Wrong type
        data: 'test'
        // Missing count
      };
      
      expect(() => networkSecurity.validateApiResponse(invalidResponse, expectedStructure))
        .toThrow('Invalid type');
    });

    test('should generate network security audit', () => {
      const audit = networkSecurity.audit();
      
      expect(audit).toHaveProperty('timestamp');
      expect(audit).toHaveProperty('userAgent');
      expect(audit).toHaveProperty('timeout');
      expect(audit).toHaveProperty('allowedProtocols');
      expect(audit).toHaveProperty('recommendations');
      
      expect(audit.userAgent).toBe('mdsaad-cli/1.0.0');
      expect(audit.allowedProtocols).toContain('https:');
      expect(Array.isArray(audit.recommendations)).toBe(true);
    });

    test('should handle secure WebSocket configuration', () => {
      const wsUrl = 'wss://api.example.com/ws';
      const options = { headers: { 'Custom': 'header' } };
      
      const secureOptions = networkSecurity.createSecureWebSocket(wsUrl, options);
      
      expect(secureOptions.headers).toHaveProperty('User-Agent');
      expect(secureOptions.headers).toHaveProperty('Origin');
      expect(secureOptions.headers).toHaveProperty('Custom');
      expect(secureOptions.rejectUnauthorized).toBe(true);
      
      // Should reject non-secure WebSocket
      expect(() => networkSecurity.createSecureWebSocket('ws://insecure.com'))
        .toThrow('Only secure WebSocket connections');
    });

    test('should clear and manage rate limits', () => {
      const hostname = 'test.api.com';
      
      // Create some rate limit data
      networkSecurity.checkRateLimit(hostname);
      expect(networkSecurity.rateLimits.size).toBeGreaterThan(0);
      
      // Clear rate limits
      networkSecurity.clearRateLimits();
      expect(networkSecurity.rateLimits.size).toBe(0);
      
      // Set custom rate limit
      networkSecurity.setRateLimit(hostname, { requests: 5, window: 1000 });
      expect(networkSecurity.rateLimits.has(hostname)).toBe(true);
    });
  });

  describe('Security Command Integration', () => {
    let command;

    beforeEach(() => {
      command = new SecurityCommand();
      // Override security manager config dir for testing
      command.securityManager.configDir = global.testUtils.TEST_CONFIG_DIR;
      command.securityManager.keyFile = path.join(global.testUtils.TEST_CONFIG_DIR, '.keys');
    });

    test('should show security status', async () => {
      const result = await command.execute('status', { verbose: true });
      expect(result).toBe(true);
      expect(mockConsole.logs.some(log => log.includes('Security Status'))).toBe(true);
    });

    test('should perform security audit', async () => {
      const result = await command.execute('audit', { verbose: true });
      expect(result).toBe(true);
      expect(mockConsole.logs.some(log => log.includes('Security Audit'))).toBe(true);
    });

    test('should generate security report', async () => {
      const result = await command.execute('report', { verbose: true });
      expect(result).toBeTruthy();
      expect(mockConsole.logs.some(log => log.includes('Security Report'))).toBe(true);
    });

    test('should manage API keys', async () => {
      // Set API key
      const setResult = await command.setApiKey('testservice', { key: 'testkey123' });
      expect(setResult).toBe(true);
      
      // List API keys
      const listResult = await command.listApiKeys();
      expect(listResult).toBe(true);
      expect(mockConsole.logs.some(log => log.includes('testservice'))).toBe(true);
      
      // Remove API key
      const removeResult = await command.removeApiKey('testservice');
      expect(removeResult).toBe(true);
    });

    test('should validate input through command', async () => {
      const validResult = await command.validateInput({ 
        validate: 'test@example.com', 
        type: 'email',
        verbose: true 
      });
      expect(validResult).toBe(true);
      
      const invalidResult = await command.validateInput({ 
        validate: 'invalid-email', 
        type: 'email' 
      });
      expect(invalidResult).toBe(false);
    });

    test('should perform cleanup operations', async () => {
      const result = await command.performCleanup({ verbose: true });
      expect(result).toBeGreaterThanOrEqual(0); // Returns number of items cleaned
      expect(mockConsole.logs.some(log => log.includes('Cleaning up'))).toBe(true);
    });

    test('should handle command errors gracefully', async () => {
      // Mock an error in security manager
      command.securityManager.initialize = jest.fn().mockRejectedValue(new Error('Test error'));
      
      const result = await command.execute('status');
      expect(result).toBe(false);
      expect(mockConsole.errors.some(error => error.includes('Security operation failed'))).toBe(true);
    });
  });

  describe('Security Integration', () => {
    test('should integrate input validation with other services', () => {
      const validator = new InputValidator();
      const security = new SecurityManager();
      
      // Test that services can work together
      const input = 'test-api-key-123';
      const validated = validator.validate(input, 'apiKey');
      expect(validated).toBe(input);
      
      const encrypted = security.encrypt(validated);
      expect(encrypted.encrypted).toBeTruthy();
      
      const decrypted = security.decrypt(encrypted);
      expect(decrypted).toBe(validated);
    });

    test('should handle security in network requests', () => {
      const network = new NetworkSecurity();
      const validator = new InputValidator();
      
      // Validate URL before making request
      const url = 'https://api.example.com/data';
      validator.validate(url, 'url');
      
      // Prepare secure request
      const options = network.validateHeaders({
        'Authorization': 'Bearer token'
      });
      
      expect(options).toHaveProperty('User-Agent');
      expect(options).toHaveProperty('Authorization');
    });

    test('should provide comprehensive security for CLI operations', async () => {
      const validator = new InputValidator();
      const security = new SecurityManager();
      const network = new NetworkSecurity();
      
      await security.initialize();
      
      // Simulate secure CLI operation flow
      const userInput = 'calculate 2+2';
      const [command, expression] = userInput.split(' ', 2);
      
      // Validate command
      validator.validate(command, 'command');
      
      // Validate expression
      validator.validate(expression, 'expression');
      
      // Check rate limiting
      validator.checkRateLimit('user-123', 10, 60000);
      
      // Network security for API calls (if needed)
      network.checkRateLimit('api.example.com');
      
      // All should pass without errors
      expect(true).toBe(true);
    });
  });
});