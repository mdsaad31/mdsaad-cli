# mdsaad CLI - API Reference

This document provides comprehensive API reference for developers who want to extend or integrate with the mdsaad CLI tool.

## Table of Contents

- [Core Services](#core-services)
- [Security Services](#security-services)
- [Plugin System](#plugin-system)
- [Command Development](#command-development)
- [Configuration API](#configuration-api)
- [Performance API](#performance-api)
- [Error Handling](#error-handling)
- [Examples](#examples)

## Core Services

### Logger Service

The centralized logging service for the entire application.

#### Methods

```javascript
const logger = require('mdsaad-cli/src/services/logger');

// Log levels: error, warn, info, verbose, debug
logger.error('Error message', error);
logger.warn('Warning message');
logger.info('Info message');
logger.verbose('Verbose message');
logger.debug('Debug message');

// Set log level
logger.setLevel('debug');

// Get current log level
const level = logger.getLevel();
```

### Configuration Service

Manages application configuration with hierarchical settings.

#### Methods

```javascript
const config = require('mdsaad-cli/src/services/config');

// Initialize configuration
await config.initialize();

// Get configuration value
const value = config.get('key', defaultValue);

// Set configuration value
config.set('key', value);

// Get all configuration
const allConfig = config.getAll();

// Reset to defaults
config.reset();

// Save configuration to disk
await config.save();
```

### Internationalization Service

Multi-language support service.

#### Methods

```javascript
const i18n = require('mdsaad-cli/src/services/i18n');

// Initialize with default language
await i18n.initialize();

// Set language
await i18n.setLanguage('fr');

// Translate text
const text = i18n.translate('key', { param: 'value' });

// Check if language is supported
const supported = i18n.isLanguageSupported('es');

// Get available languages
const languages = i18n.getAvailableLanguages();
```

## Security Services

### Input Validator

Comprehensive input validation and sanitization service.

#### Class: InputValidator

```javascript
const { InputValidator } = require('mdsaad-cli/src/services/input-validator');

const validator = new InputValidator();
```

#### Methods

##### validate(input, type, options)

Validates input against specified type with optional configuration.

**Parameters:**

- `input` (string): Input to validate
- `type` (string): Validation type ('email', 'url', 'apiKey', 'expression', 'cityName', 'currencyCode', 'command', 'path')
- `options` (object): Optional validation configuration

**Returns:** Validated input string

**Throws:** Error if validation fails

```javascript
// Email validation
const email = validator.validate('user@example.com', 'email');

// URL validation with custom options
const url = validator.validate('https://api.example.com', 'url', {
  allowHttp: false,
  maxLength: 200,
});

// Mathematical expression validation
const expr = validator.validate('sin(pi/2) + cos(0)', 'expression');
```

##### sanitize(input, type)

Sanitizes input by removing or encoding potentially dangerous content.

**Parameters:**

- `input` (string): Input to sanitize
- `type` (string): Sanitization type ('html', 'sql', 'path', 'text')

**Returns:** Sanitized string

```javascript
const safe = validator.sanitize('<script>alert("xss")</script>', 'html');
const safePath = validator.sanitize('../../etc/passwd', 'path');
```

##### checkRateLimit(identifier, limit, windowMs)

Checks and enforces rate limiting per identifier.

**Parameters:**

- `identifier` (string): Unique identifier (user ID, IP, etc.)
- `limit` (number): Maximum requests allowed
- `windowMs` (number): Time window in milliseconds

**Returns:** Boolean indicating if request is allowed

**Throws:** Error if rate limit exceeded

```javascript
// Allow 100 requests per minute
const allowed = validator.checkRateLimit('user-123', 100, 60000);
```

### Security Manager

Centralized security management with encrypted storage.

#### Class: SecurityManager

```javascript
const { SecurityManager } = require('mdsaad-cli/src/services/security-manager');

const security = new SecurityManager();
await security.initialize();
```

#### Methods

##### encrypt(text)

Encrypts text using AES-256-GCM encryption.

**Parameters:**

- `text` (string): Text to encrypt

**Returns:** Object with encrypted data, IV, and authentication tag

```javascript
const encrypted = security.encrypt('sensitive data');
// Returns: { encrypted: '...', iv: '...', authTag: '...' }
```

##### decrypt(encryptedData)

Decrypts previously encrypted data.

**Parameters:**

- `encryptedData` (object): Object with encrypted, iv, and authTag properties

**Returns:** Decrypted string

```javascript
const decrypted = security.decrypt(encrypted);
```

##### storeApiKey(service, apiKey)

Securely stores an API key for a service.

**Parameters:**

- `service` (string): Service name
- `apiKey` (string): API key to store

**Returns:** Boolean indicating success

```javascript
await security.storeApiKey('weather-api', 'your-api-key-here');
```

##### getApiKey(service)

Retrieves a stored API key for a service.

**Parameters:**

- `service` (string): Service name

**Returns:** API key string or null if not found

```javascript
const apiKey = await security.getApiKey('weather-api');
```

##### generateSecurityReport()

Generates comprehensive security report.

**Returns:** Security report object

```javascript
const report = await security.generateSecurityReport();
console.log(report.securityLevel); // 'HIGH', 'MEDIUM', or 'LOW'
```

### Network Security

Secure HTTP communications and network security measures.

#### Class: NetworkSecurity

```javascript
const { NetworkSecurity } = require('mdsaad-cli/src/services/network-security');

const network = new NetworkSecurity();
```

#### Methods

##### createSecureAgent()

Creates a secure HTTPS agent with proper TLS configuration.

**Returns:** HTTPS agent configured for security

```javascript
const agent = network.createSecureAgent();
// Use with axios or other HTTP clients
```

##### validateHeaders(headers)

Validates and sanitizes HTTP headers.

**Parameters:**

- `headers` (object): HTTP headers object

**Returns:** Sanitized headers object with security headers added

```javascript
const secureHeaders = network.validateHeaders({
  Authorization: 'Bearer token',
  'Content-Type': 'application/json',
});
```

##### secureRequest(url, options)

Makes a secure HTTP request with built-in security measures.

**Parameters:**

- `url` (string): Request URL
- `options` (object): Request options

**Returns:** Promise resolving to response data

```javascript
const response = await network.secureRequest('https://api.example.com/data', {
  method: 'GET',
  headers: { Authorization: 'Bearer token' },
});
```

## Plugin System

### Plugin Manager

Manages plugins and their lifecycle.

#### Methods

```javascript
const pluginManager = require('mdsaad-cli/src/services/plugin-manager');

// Initialize plugin system
await pluginManager.initialize();

// Install plugin
await pluginManager.installPlugin('plugin-name');

// Load plugin
await pluginManager.loadPlugin('plugin-name');

// Get plugin statistics
const stats = pluginManager.getStatistics();
```

### Plugin Development

#### Plugin Structure

A plugin must export an object with the following structure:

```javascript
module.exports = {
  name: 'my-plugin',
  version: '1.0.0',
  description: 'My awesome plugin',

  // Plugin metadata
  author: 'Your Name',
  homepage: 'https://github.com/you/my-plugin',
  repository: 'https://github.com/you/my-plugin.git',

  // Required permissions
  permissions: ['network', 'filesystem'],

  // Plugin commands
  commands: {
    'my-command': {
      description: 'My custom command',
      handler: async (args, options) => {
        // Command implementation
        console.log('Hello from my plugin!');
        return true;
      },
    },
  },

  // Plugin services
  services: {
    'my-service': class MyService {
      async initialize() {
        // Service initialization
      }

      async process(data) {
        // Service logic
        return processedData;
      }
    },
  },

  // Plugin lifecycle hooks
  async initialize(cli) {
    // Called when plugin is loaded
    console.log('Plugin initialized');
  },

  async cleanup() {
    // Called when plugin is unloaded
    console.log('Plugin cleaned up');
  },
};
```

#### Plugin Security Context

Plugins receive a security context for secure operations:

```javascript
// In plugin command handler
async function handler(args, options, context) {
  const { validator, securityManager, networkSecurity } = context.security;

  // Validate input
  const validInput = validator.validate(args[0], 'email');

  // Get API key securely
  const apiKey = await securityManager.getApiKey('my-service');

  // Make secure network request
  const response = await networkSecurity.secureRequest(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  return response;
}
```

## Command Development

### Base Command Class

All commands should extend the base command class or follow its pattern:

```javascript
class MyCommand {
  constructor() {
    this.name = 'my-command';
    this.description = 'Description of my command';
  }

  // Receive security context from CLI
  setSecurity(securityContext) {
    this.validator = securityContext.validator;
    this.securityManager = securityContext.securityManager;
    this.networkSecurity = securityContext.networkSecurity;
  }

  async execute(...args) {
    try {
      // Validate inputs
      const [input, options] = args;
      const validInput = this.validator.process(input, 'text');

      // Implement command logic
      const result = await this.processCommand(validInput, options);

      return result;
    } catch (error) {
      logger.error('Command execution failed:', error);
      throw error;
    }
  }

  async processCommand(input, options) {
    // Command implementation
    return { success: true, data: 'Command completed' };
  }
}

module.exports = MyCommand;
```

### Command Registration

Commands are automatically registered based on the file structure:

```
src/commands/
├── my-command.js     # Registers 'my-command'
├── nested/
│   └── sub-command.js # Registers 'nested:sub-command'
```

## Configuration API

### Configuration Schema

The configuration follows a hierarchical structure:

```javascript
{
  // Global settings
  "language": "en",
  "theme": "default",
  "debug": false,

  // Security configuration
  "security": {
    "rateLimit": {
      "enabled": true,
      "requests": 100,
      "window": 60000
    },
    "encryption": {
      "algorithm": "aes-256-gcm",
      "keyLength": 32
    }
  },

  // Performance settings
  "performance": {
    "enableOptimizations": true,
    "cacheSize": "50MB",
    "startupTimeout": 5000
  },

  // Service configurations
  "ai": {
    "defaultProvider": "openai",
    "defaultModel": "gpt-3.5-turbo",
    "temperature": 0.7
  },

  "weather": {
    "defaultUnits": "metric",
    "defaultLanguage": "en"
  }
}
```

### Environment Variables

Configuration can be overridden using environment variables:

- `MDSAAD_DEBUG=true` - Enable debug mode
- `MDSAAD_LANGUAGE=fr` - Set language
- `MDSAAD_CONFIG_DIR=/path/to/config` - Custom config directory
- `MDSAAD_LOG_LEVEL=verbose` - Set log level
- `MDSAAD_SECURITY_DISABLED=true` - Disable security (not recommended)

## Performance API

### Performance Service

Monitor and optimize performance:

```javascript
const performanceService = require('mdsaad-cli/src/services/performance-service');

// Initialize performance monitoring
await performanceService.initialize();

// Mark performance measurement points
performanceService.markStart('operation-name');
// ... perform operation ...
performanceService.markEnd('operation-name');

// Get measurement
const measurement = performanceService.getMeasurement('operation-name');
console.log(`Operation took ${measurement.duration}ms`);

// Log performance event
performanceService.logPerformanceEvent('category', 'description', {
  customData: 'value',
});

// Get performance report
const report = performanceService.getPerformanceReport();
```

### Resource Manager

Manage system resources:

```javascript
const resourceManager = require('mdsaad-cli/src/services/resource-manager');

// Initialize resource monitoring
await resourceManager.initialize();

// Execute operation with resource management
const result = await resourceManager.manageOperation(async () => {
  // Your operation here
  return await performExpensiveOperation();
});

// Get resource statistics
const stats = resourceManager.getResourceStats();
console.log(`Memory usage: ${stats.memoryUsage.heapUsed} bytes`);
```

## Error Handling

### Standard Error Format

All errors follow a consistent format:

```javascript
class CLIError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'CLIError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}
```

### Error Categories

- **ValidationError**: Input validation failures
- **SecurityError**: Security-related errors
- **NetworkError**: Network communication errors
- **ConfigurationError**: Configuration issues
- **PluginError**: Plugin-related errors
- **PerformanceError**: Performance issues

### Error Handling Best Practices

```javascript
try {
  const result = await someOperation();
  return result;
} catch (error) {
  // Log error with context
  logger.error('Operation failed', {
    operation: 'someOperation',
    error: error.message,
    stack: error.stack,
  });

  // Transform to user-friendly error
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    throw new CLIError(
      'Too many requests. Please wait before trying again.',
      'RATE_LIMIT',
      { retryAfter: error.retryAfter }
    );
  }

  // Re-throw with additional context
  throw error;
}
```

## Examples

### Creating a Secure Plugin

```javascript
// my-secure-plugin/index.js
module.exports = {
  name: 'secure-example',
  version: '1.0.0',
  description: 'Example of secure plugin development',

  commands: {
    'secure-fetch': async (args, options, context) => {
      const { validator, securityManager, networkSecurity } = context.security;

      // Validate URL input
      const url = validator.validate(args[0], 'url');

      // Get API key securely
      const apiKey = await securityManager.getApiKey('my-api');
      if (!apiKey) {
        throw new Error(
          'API key not configured. Run: mdsaad security keys set my-api'
        );
      }

      // Make secure request
      try {
        const response = await networkSecurity.secureRequest(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        console.log('Data fetched successfully:', response.data);
        return true;
      } catch (error) {
        logger.error('Secure fetch failed:', error.message);
        return false;
      }
    },
  },

  async initialize(cli) {
    console.log('Secure plugin initialized with security context');
  },
};
```

### Creating a Custom Command

```javascript
// src/commands/my-command.js
const logger = require('../services/logger');

class MyCommand {
  constructor() {
    this.name = 'my-command';
    this.description = 'Custom command with security integration';
  }

  setSecurity(securityContext) {
    this.validator = securityContext.validator;
    this.securityManager = securityContext.securityManager;
    this.networkSecurity = securityContext.networkSecurity;
  }

  async execute(input, options = {}) {
    try {
      // Rate limiting
      this.validator.checkRateLimit('my-command', 10, 60000);

      // Input validation
      const validInput = this.validator.validate(input, 'text', {
        maxLength: 500,
        allowNumbers: true,
        allowSpecialChars: false,
      });

      // Process command
      const result = await this.processInput(validInput, options);

      logger.info('Command executed successfully');
      return result;
    } catch (error) {
      logger.error('Command failed:', error.message);
      throw error;
    }
  }

  async processInput(input, options) {
    // Implementation here
    return { processed: input, options };
  }
}

module.exports = new MyCommand();
```

### Integrating with Performance Monitoring

```javascript
const performanceService = require('../services/performance-service');

class PerformanceAwareCommand {
  async execute(input, options) {
    // Start performance tracking
    performanceService.markStart('my-command-execution');

    try {
      const result = await this.heavyOperation(input);

      // Log successful completion
      performanceService.logPerformanceEvent(
        'command',
        'my-command completed',
        {
          inputLength: input.length,
          resultSize: JSON.stringify(result).length,
        }
      );

      return result;
    } finally {
      // End performance tracking
      performanceService.markEnd('my-command-execution');

      // Log performance metrics
      const measurement = performanceService.getMeasurement(
        'my-command-execution'
      );
      if (measurement && measurement.duration > 1000) {
        logger.warn(`Command took ${measurement.duration}ms to complete`);
      }
    }
  }
}
```

This API reference provides comprehensive documentation for extending and integrating with the mdsaad CLI tool. All APIs are designed with security, performance, and maintainability in mind.
