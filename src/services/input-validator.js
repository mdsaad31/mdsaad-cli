/**
 * Input Validation and Sanitization Service
 * Provides comprehensive input validation and sanitization for all user inputs
 */

const path = require('path');
const crypto = require('crypto');

class InputValidator {
  constructor() {
    // Common validation patterns
    this.patterns = {
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      url: /^https?:\/\/([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/,
      alphanumeric: /^[a-zA-Z0-9]+$/,
      numeric: /^-?\d*\.?\d+$/,
      filename: /^[^<>:"/\\|?*\x00-\x1f]+$/,
      apiKey: /^[a-zA-Z0-9_-]+$/,
      languageCode: /^[a-z]{2}(-[A-Z]{2})?$/,
      currencyCode: /^[A-Z]{3}$/,
      coordinates: /^-?\d{1,3}\.\d{1,10},-?\d{1,3}\.\d{1,10}$/
    };

    // Maximum length limits
    this.limits = {
      expression: 1000,
      cityName: 100,
      apiKey: 200,
      filename: 255,
      prompt: 10000,
      command: 50,
      argument: 500
    };

    // Dangerous patterns to block
    this.dangerousPatterns = [
      /\.\./g,  // Path traversal
      /<script/gi,  // XSS
      /javascript:/gi,  // XSS
      /on\w+\s*=/gi,  // Event handlers
      /eval\s*\(/gi,  // Code execution
      /function\s*\(/gi,  // Function definitions
      /\$\{.*\}/g,  // Template literals
      /`.*`/g,  // Backticks
      /rm\s+-rf/gi,  // Dangerous commands
      /del\s+\/[sqf]/gi,  // Windows delete commands
      /shutdown/gi,  // System commands
      /reboot/gi,  // System commands
      /format\s+[c-z]:/gi,  // Format commands
    ];
  }

  /**
   * Validate input against a specific type
   */
  validate(input, type, options = {}) {
    if (input === null || input === undefined) {
      if (options.required) {
        throw new Error(`${type} is required`);
      }
      return null;
    }

    // Convert to string for validation
    const str = String(input).trim();

    // Check length limits
    const limit = this.limits[type] || options.maxLength;
    if (limit && str.length > limit) {
      throw new Error(`${type} exceeds maximum length of ${limit} characters`);
    }

    // Check minimum length
    if (options.minLength && str.length < options.minLength) {
      throw new Error(`${type} must be at least ${options.minLength} characters`);
    }

    // Pattern validation
    switch (type) {
      case 'email':
        if (!this.patterns.email.test(str)) {
          throw new Error('Invalid email format');
        }
        break;

      case 'url':
        if (!this.patterns.url.test(str)) {
          throw new Error('Invalid URL format');
        }
        break;

      case 'apiKey':
        if (!this.patterns.apiKey.test(str)) {
          throw new Error('API key contains invalid characters');
        }
        break;

      case 'languageCode':
        if (!this.patterns.languageCode.test(str)) {
          throw new Error('Invalid language code format (expected: en, en-US)');
        }
        break;

      case 'currencyCode':
        if (!this.patterns.currencyCode.test(str)) {
          throw new Error('Invalid currency code format (expected: USD, EUR, etc.)');
        }
        break;

      case 'coordinates':
        if (!this.patterns.coordinates.test(str)) {
          throw new Error('Invalid coordinates format (expected: lat,lng)');
        }
        break;

      case 'filename':
        if (!this.patterns.filename.test(str)) {
          throw new Error('Filename contains invalid characters');
        }
        break;

      case 'expression':
        this.validateMathExpression(str);
        break;

      case 'cityName':
        this.validateCityName(str);
        break;

      case 'numeric':
        if (!this.patterns.numeric.test(str)) {
          throw new Error('Invalid numeric format');
        }
        break;

      case 'alphanumeric':
        if (!this.patterns.alphanumeric.test(str)) {
          throw new Error('Must contain only alphanumeric characters');
        }
        break;

      case 'command':
        this.validateCommand(str);
        break;

      case 'prompt':
        this.validatePrompt(str);
        break;

      default:
        // Generic validation for unknown types
        this.validateGeneric(str, options);
    }

    return str;
  }

  /**
   * Sanitize input by removing or encoding dangerous content
   */
  sanitize(input, type = 'generic') {
    if (input === null || input === undefined) {
      return null;
    }

    let sanitized = String(input).trim();

    // Remove dangerous patterns
    this.dangerousPatterns.forEach(pattern => {
      sanitized = sanitized.replace(pattern, '');
    });

    // Type-specific sanitization
    switch (type) {
      case 'html':
        sanitized = this.sanitizeHtml(sanitized);
        break;

      case 'path':
        sanitized = this.sanitizePath(sanitized);
        break;

      case 'filename':
        sanitized = this.sanitizeFilename(sanitized);
        break;

      case 'expression':
        sanitized = this.sanitizeExpression(sanitized);
        break;

      case 'prompt':
        sanitized = this.sanitizePrompt(sanitized);
        break;

      default:
        sanitized = this.sanitizeGeneric(sanitized);
    }

    return sanitized;
  }

  /**
   * Validate mathematical expressions
   */
  validateMathExpression(expression) {
    // Check for dangerous function calls
    const dangerousFunc = ['eval', 'Function', 'import', 'require'];
    for (const func of dangerousFunc) {
      if (expression.includes(func)) {
        throw new Error(`Expression contains dangerous function: ${func}`);
      }
    }

    // Check for valid characters only
    const validChars = /^[0-9+\-*/().\s,a-zA-Z_]+$/;
    if (!validChars.test(expression)) {
      throw new Error('Expression contains invalid characters');
    }

    // Check parentheses balance
    let openCount = 0;
    for (const char of expression) {
      if (char === '(') openCount++;
      if (char === ')') openCount--;
      if (openCount < 0) {
        throw new Error('Unbalanced parentheses in expression');
      }
    }
    if (openCount !== 0) {
      throw new Error('Unbalanced parentheses in expression');
    }
  }

  /**
   * Validate city names
   */
  validateCityName(cityName) {
    // Check for minimum reasonable length first
    if (cityName.length < 1) {
      throw new Error('City name cannot be empty');
    }

    // Allow letters (including Unicode), spaces, hyphens, apostrophes, and dots
    const validChars = /^[\p{L}\s\-'.]+$/u;
    if (!validChars.test(cityName)) {
      throw new Error('City name contains invalid characters');
    }
  }

  /**
   * Validate command names
   */
  validateCommand(command) {
    const validCommands = [
      'calculate', 'weather', 'convert', 'show', 'ai', 'language',
      'enhanced', 'debug', 'maintenance', 'performance', 'platform',
      'plugin', 'update', 'help', 'version'
    ];

    if (!validCommands.includes(command)) {
      throw new Error(`Unknown command: ${command}`);
    }
  }

  /**
   * Validate AI prompts
   */
  validatePrompt(prompt) {
    // Check for attempts to break out of context
    const jailbreakPatterns = [
      /ignore\s+previous\s+instructions/gi,
      /system\s+prompt/gi,
      /you\s+are\s+now/gi,
      /pretend\s+to\s+be/gi,
      /act\s+as/gi,
      /roleplay/gi
    ];

    for (const pattern of jailbreakPatterns) {
      if (pattern.test(prompt)) {
        throw new Error('Prompt contains potentially unsafe content');
      }
    }

    // Check for personal information requests
    const piiPatterns = [
      /password/gi,
      /credit\s+card/gi,
      /social\s+security/gi,
      /ssn/gi,
      /bank\s+account/gi,
      /api\s+key/gi
    ];

    for (const pattern of piiPatterns) {
      if (pattern.test(prompt)) {
        console.warn('Warning: Prompt may be requesting sensitive information');
      }
    }
  }

  /**
   * Generic validation for unknown types
   */
  validateGeneric(input, options = {}) {
    // Check for null bytes
    if (input.includes('\0')) {
      throw new Error('Input contains null bytes');
    }

    // Check for control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
      throw new Error('Input contains control characters');
    }

    // Custom pattern validation
    if (options.pattern && !options.pattern.test(input)) {
      throw new Error('Input does not match required pattern');
    }

    // Whitelist validation
    if (options.whitelist && !options.whitelist.includes(input)) {
      throw new Error('Input is not in allowed list');
    }

    // Blacklist validation
    if (options.blacklist && options.blacklist.includes(input)) {
      throw new Error('Input is not allowed');
    }
  }

  /**
   * Sanitize HTML content
   */
  sanitizeHtml(html) {
    return html
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  /**
   * Sanitize file paths
   */
  sanitizePath(filePath) {
    // Remove path traversal attempts
    let sanitized = filePath.replace(/\.\./g, '');
    
    // Normalize path separators
    sanitized = path.normalize(sanitized);
    
    // Remove leading path separators
    sanitized = sanitized.replace(/^[\/\\]+/, '');
    
    return sanitized;
  }

  /**
   * Sanitize filenames
   */
  sanitizeFilename(filename) {
    // Replace invalid filename characters
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
      .replace(/^\.+/, '')  // Remove leading dots
      .substring(0, 255);   // Limit length
  }

  /**
   * Sanitize mathematical expressions
   */
  sanitizeExpression(expression) {
    // Remove potentially dangerous content while preserving math functions
    return expression
      .replace(/eval/gi, '')
      .replace(/function/gi, '')
      .replace(/import/gi, '')
      .replace(/require/gi, '')
      .replace(/\$\{.*\}/g, '')
      .trim();
  }

  /**
   * Sanitize AI prompts
   */
  sanitizePrompt(prompt) {
    // Remove potential prompt injection attempts
    return prompt
      .replace(/ignore\s+previous\s+instructions/gi, '')
      .replace(/system\s+prompt/gi, '')
      .replace(/you\s+are\s+now/gi, '')
      .trim();
  }

  /**
   * Generic sanitization
   */
  sanitizeGeneric(input) {
    return input
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')  // Remove control chars
      .replace(/\0/g, '');  // Remove null bytes
  }

  /**
   * Validate and sanitize input in one call
   */
  process(input, type, options = {}) {
    // First sanitize
    const sanitized = this.sanitize(input, type);
    
    // Then validate
    const validated = this.validate(sanitized, type, options);
    
    return validated;
  }

  /**
   * Create a hash for sensitive data
   */
  hash(input) {
    return crypto.createHash('sha256').update(String(input)).digest('hex');
  }

  /**
   * Rate limiting check
   */
  checkRateLimit(identifier, maxRequests = 10, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!this.rateLimitStore) {
      this.rateLimitStore = new Map();
    }
    
    // Clean up old entries
    for (const [key, requests] of this.rateLimitStore) {
      this.rateLimitStore.set(key, requests.filter(time => time > windowStart));
    }
    
    // Get current requests for identifier
    const requests = this.rateLimitStore.get(identifier) || [];
    
    if (requests.length >= maxRequests) {
      throw new Error(`Rate limit exceeded. Maximum ${maxRequests} requests per ${windowMs}ms`);
    }
    
    // Add current request
    requests.push(now);
    this.rateLimitStore.set(identifier, requests);
    
    return true;
  }
}

module.exports = InputValidator;