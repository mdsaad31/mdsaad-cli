/**
 * Security Command
 * Provides security management and monitoring functionality
 */

const SecurityManager = require('../services/security-manager');
const InputValidator = require('../services/input-validator');
const NetworkSecurity = require('../services/network-security');
const chalk = require('chalk');

class SecurityCommand {
  constructor() {
    this.securityManager = new SecurityManager();
    this.inputValidator = new InputValidator();
    this.networkSecurity = new NetworkSecurity();
  }

  /**
   * Command definition for Commander.js
   */
  static getDefinition() {
    return {
      command: 'security',
      description: 'Security management and monitoring tools',
      options: [
        {
          flags: '--audit',
          description: 'Perform security audit',
        },
        {
          flags: '--report',
          description: 'Generate security report',
        },
        {
          flags: '--cleanup',
          description: 'Clean up expired security data',
        },
        {
          flags: '--keys',
          description: 'Manage API keys',
        },
        {
          flags: '--set-key <service>',
          description: 'Set API key for service',
        },
        {
          flags: '--remove-key <service>',
          description: 'Remove API key for service',
        },
        {
          flags: '--list-keys',
          description: 'List stored API keys',
        },
        {
          flags: '--validate <input>',
          description: 'Validate input for security',
        },
        {
          flags: '--type <type>',
          description: 'Input type for validation',
        },
      ],
    };
  }

  /**
   * Execute security command
   */
  async execute(action = 'status', options = {}) {
    try {
      await this.securityManager.initialize();

      switch (action) {
        case 'audit':
          return await this.performAudit(options);
        case 'report':
          return await this.generateReport(options);
        case 'cleanup':
          return await this.performCleanup(options);
        case 'keys':
          return await this.manageKeys(options);
        case 'validate':
          return await this.validateInput(options);
        case 'status':
        default:
          return await this.showStatus(options);
      }
    } catch (error) {
      console.error(chalk.red('❌ Security operation failed:'), error.message);
      if (options.verbose) {
        console.error(error.stack);
      }
      return false;
    }
  }

  /**
   * Show security status
   */
  async showStatus(options = {}) {
    console.log(chalk.blue('🔒 Security Status\n'));

    // Check security manager status
    const isInitialized = await this.securityManager.initialize();
    console.log(
      `Security Manager: ${isInitialized ? chalk.green('✓ Active') : chalk.red('✗ Failed')}`
    );

    // Check stored API keys
    const apiKeys = await this.securityManager.listApiKeys();
    console.log(`Stored API Keys: ${chalk.cyan(apiKeys.length)}`);

    if (apiKeys.length > 0 && options.verbose) {
      console.log('\nAPI Key Details:');
      apiKeys.forEach(key => {
        const status = key.isExpired
          ? chalk.red('Expired')
          : chalk.green('Valid');
        console.log(
          `  • ${key.service}: ${status} (Last used: ${new Date(key.lastUsed).toLocaleDateString()})`
        );
      });
    }

    // Check for expired keys
    const expiredKeys = apiKeys.filter(k => k.isExpired);
    if (expiredKeys.length > 0) {
      console.log(
        chalk.yellow(
          `\n⚠️  Warning: ${expiredKeys.length} expired API keys found`
        )
      );
      console.log(chalk.dim('Run with --cleanup to remove expired keys'));
    }

    // Network security status
    const networkAudit = this.networkSecurity.audit();
    console.log(`\nNetwork Security:`);
    console.log(
      `  • Allowed Protocols: ${networkAudit.allowedProtocols.join(', ')}`
    );
    console.log(`  • Request Timeout: ${networkAudit.timeout}ms`);
    console.log(
      `  • Active Rate Limits: ${networkAudit.rateLimits.activeEndpoints}`
    );

    if (networkAudit.recommendations.length > 0 && options.verbose) {
      console.log(chalk.yellow('\nSecurity Recommendations:'));
      networkAudit.recommendations.forEach(rec => {
        console.log(chalk.dim(`  • ${rec}`));
      });
    }

    return true;
  }

  /**
   * Perform comprehensive security audit
   */
  async performAudit(options = {}) {
    console.log(chalk.blue('🔍 Performing Security Audit...\n'));

    const auditResults = {
      timestamp: new Date().toISOString(),
      securityManager: null,
      networkSecurity: null,
      inputValidator: null,
      overall: 'PASS',
    };

    // Security Manager audit
    try {
      auditResults.securityManager =
        await this.securityManager.generateSecurityReport();
      console.log(chalk.green('✓ Security Manager audit complete'));
    } catch (error) {
      console.log(chalk.red('✗ Security Manager audit failed:'), error.message);
      auditResults.overall = 'FAIL';
    }

    // Network Security audit
    try {
      auditResults.networkSecurity = this.networkSecurity.audit();
      console.log(chalk.green('✓ Network Security audit complete'));
    } catch (error) {
      console.log(chalk.red('✗ Network Security audit failed:'), error.message);
      auditResults.overall = 'FAIL';
    }

    // Input Validator audit
    try {
      auditResults.inputValidator = this.auditInputValidator();
      console.log(chalk.green('✓ Input Validator audit complete'));
    } catch (error) {
      console.log(chalk.red('✗ Input Validator audit failed:'), error.message);
      auditResults.overall = 'FAIL';
    }

    // Display results
    console.log(`\n${chalk.bold('Audit Results:')}`);
    console.log(
      `Overall Status: ${auditResults.overall === 'PASS' ? chalk.green('PASS') : chalk.red('FAIL')}`
    );

    if (options.verbose && auditResults.securityManager) {
      console.log(
        `\nSecurity Level: ${this.getSecurityLevelColor(auditResults.securityManager.securityLevel)}`
      );
      console.log(
        `API Keys: ${auditResults.securityManager.apiKeys.length} total, ${auditResults.securityManager.expiredKeysCount} expired`
      );

      if (auditResults.securityManager.warnings) {
        console.log(chalk.yellow('\nWarnings:'));
        auditResults.securityManager.warnings.forEach(warning => {
          console.log(chalk.dim(`  • ${warning}`));
        });
      }
    }

    return auditResults.overall === 'PASS';
  }

  /**
   * Generate detailed security report
   */
  async generateReport(options = {}) {
    console.log(chalk.blue('📊 Generating Security Report...\n'));

    const report = {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      system: process.platform,
      nodeVersion: process.version,
      security: await this.securityManager.generateSecurityReport(),
      network: this.networkSecurity.audit(),
      validator: this.auditInputValidator(),
    };

    console.log(chalk.bold('🔒 mdsaad CLI Security Report'));
    console.log(
      chalk.dim(`Generated: ${new Date(report.timestamp).toLocaleString()}\n`)
    );

    // Security summary
    console.log(chalk.bold('Security Summary:'));
    console.log(
      `  Security Level: ${this.getSecurityLevelColor(report.security.securityLevel)}`
    );
    console.log(`  API Keys: ${report.security.apiKeys.length} stored`);
    console.log(`  Expired Keys: ${report.security.expiredKeysCount}`);
    console.log(
      `  Network Protocols: ${report.network.allowedProtocols.join(', ')}`
    );

    // Detailed sections
    if (options.verbose) {
      console.log(`\n${chalk.bold('API Key Details:')}`);
      report.security.apiKeys.forEach(key => {
        const status = key.isExpired
          ? chalk.red('EXPIRED')
          : chalk.green('VALID');
        console.log(`  • ${key.service}: ${status}`);
        console.log(`    Created: ${new Date(key.createdAt).toLocaleString()}`);
        console.log(
          `    Last Used: ${new Date(key.lastUsed).toLocaleString()}`
        );
      });

      console.log(`\n${chalk.bold('Network Security:')}`);
      console.log(`  • User Agent: ${report.network.userAgent}`);
      console.log(`  • Timeout: ${report.network.timeout}ms`);
      console.log(`  • Max Redirects: ${report.network.maxRedirects}`);
      console.log(
        `  • Pinned Certificates: ${report.network.pinnedCertificates.length}`
      );

      console.log(`\n${chalk.bold('Input Validation:')}`);
      console.log(`  • Validation Patterns: ${report.validator.patterns}`);
      console.log(`  • Length Limits: ${report.validator.limits}`);
      console.log(
        `  • Dangerous Patterns: ${report.validator.dangerousPatterns}`
      );
    }

    // Recommendations
    const recommendations = this.generateRecommendations(report);
    if (recommendations.length > 0) {
      console.log(`\n${chalk.yellow('🔧 Security Recommendations:')}`);
      recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    return report;
  }

  /**
   * Clean up expired security data
   */
  async performCleanup(options = {}) {
    console.log(chalk.blue('🧹 Cleaning up security data...\n'));

    let totalCleaned = 0;

    // Clean expired API keys
    try {
      const expiredKeys = await this.securityManager.cleanupExpiredKeys();
      if (expiredKeys > 0) {
        console.log(chalk.green(`✓ Removed ${expiredKeys} expired API keys`));
        totalCleaned += expiredKeys;
      } else {
        console.log(chalk.dim('• No expired API keys found'));
      }
    } catch (error) {
      console.log(chalk.red('✗ Failed to clean API keys:'), error.message);
    }

    // Clear network rate limits
    try {
      this.networkSecurity.clearRateLimits();
      console.log(chalk.green('✓ Cleared network rate limit data'));
    } catch (error) {
      console.log(chalk.red('✗ Failed to clear rate limits:'), error.message);
    }

    // Clear input validator rate limits
    try {
      if (this.inputValidator.rateLimitStore) {
        this.inputValidator.rateLimitStore.clear();
        console.log(chalk.green('✓ Cleared input validator rate limits'));
      }
    } catch (error) {
      console.log(
        chalk.red('✗ Failed to clear validator rate limits:'),
        error.message
      );
    }

    console.log(`\n${chalk.bold('Cleanup Summary:')}`);
    console.log(`Total items cleaned: ${chalk.cyan(totalCleaned)}`);

    return totalCleaned;
  }

  /**
   * Manage API keys
   */
  async manageKeys(options = {}) {
    if (options.setKey) {
      return await this.setApiKey(options.setKey, options);
    } else if (options.removeKey) {
      return await this.removeApiKey(options.removeKey, options);
    } else if (options.listKeys) {
      return await this.listApiKeys(options);
    } else {
      return await this.showKeyManagementHelp();
    }
  }

  /**
   * Set API key for service
   */
  async setApiKey(service, options = {}) {
    console.log(chalk.blue(`🔑 Setting API key for ${service}...\n`));

    // Validate service name
    try {
      this.inputValidator.validate(service, 'alphanumeric', {
        minLength: 2,
        maxLength: 50,
      });
    } catch (error) {
      console.log(chalk.red('✗ Invalid service name:'), error.message);
      return false;
    }

    // Get API key from user (in a real implementation, this would be from stdin)
    const apiKey = options.key || 'demo-key-' + Date.now();

    try {
      // Validate API key
      this.inputValidator.validate(apiKey, 'apiKey');

      // Store securely
      await this.securityManager.storeApiKey(service, apiKey);

      console.log(chalk.green(`✓ API key for ${service} stored securely`));
      return true;
    } catch (error) {
      console.log(chalk.red('✗ Failed to store API key:'), error.message);
      return false;
    }
  }

  /**
   * Remove API key for service
   */
  async removeApiKey(service, options = {}) {
    console.log(chalk.blue(`🗑️  Removing API key for ${service}...\n`));

    try {
      const success = await this.securityManager.removeApiKey(service);
      if (success) {
        console.log(chalk.green(`✓ API key for ${service} removed`));
      } else {
        console.log(chalk.yellow(`⚠️  No API key found for ${service}`));
      }
      return success;
    } catch (error) {
      console.log(chalk.red('✗ Failed to remove API key:'), error.message);
      return false;
    }
  }

  /**
   * List stored API keys
   */
  async listApiKeys(options = {}) {
    console.log(chalk.blue('🔑 Stored API Keys\n'));

    try {
      const keys = await this.securityManager.listApiKeys();

      if (keys.length === 0) {
        console.log(chalk.dim('No API keys stored'));
        return true;
      }

      console.log(`Found ${chalk.cyan(keys.length)} stored API keys:\n`);

      keys.forEach(key => {
        const status = key.isExpired
          ? chalk.red('EXPIRED')
          : chalk.green('VALID');
        const age = Math.floor(
          (new Date() - new Date(key.createdAt)) / (1000 * 60 * 60 * 24)
        );

        console.log(`${chalk.bold(key.service)}`);
        console.log(`  Status: ${status}`);
        console.log(`  Age: ${age} days`);
        console.log(
          `  Last Used: ${new Date(key.lastUsed).toLocaleDateString()}`
        );
        console.log('');
      });

      return true;
    } catch (error) {
      console.log(chalk.red('✗ Failed to list API keys:'), error.message);
      return false;
    }
  }

  /**
   * Validate input
   */
  async validateInput(options = {}) {
    const input = options.validate;
    const type = options.type || 'generic';

    console.log(chalk.blue(`🔍 Validating input as ${type}...\n`));

    try {
      const result = this.inputValidator.process(input, type);
      console.log(chalk.green('✓ Input validation passed'));

      if (options.verbose) {
        console.log(`Original: ${chalk.dim(input)}`);
        console.log(`Validated: ${chalk.cyan(result)}`);
      }

      return true;
    } catch (error) {
      console.log(chalk.red('✗ Input validation failed:'), error.message);
      return false;
    }
  }

  /**
   * Show key management help
   */
  async showKeyManagementHelp() {
    console.log(chalk.blue('🔑 API Key Management\n'));
    console.log('Available commands:');
    console.log('  --set-key <service>    Set API key for service');
    console.log('  --remove-key <service> Remove API key for service');
    console.log('  --list-keys            List all stored API keys');
    console.log('');
    console.log('Supported services:');
    console.log('  • weather    - WeatherAPI.com');
    console.log('  • currency   - ExchangeRate-API');
    console.log('  • gemini     - Google Gemini AI');
    console.log('  • openai     - OpenAI API');
    console.log('  • groq       - Groq API');
    console.log('');
    return true;
  }

  /**
   * Audit input validator
   */
  auditInputValidator() {
    return {
      patterns: Object.keys(this.inputValidator.patterns).length,
      limits: Object.keys(this.inputValidator.limits).length,
      dangerousPatterns: this.inputValidator.dangerousPatterns.length,
      status: 'ACTIVE',
    };
  }

  /**
   * Get colored security level
   */
  getSecurityLevelColor(level) {
    switch (level) {
      case 'HIGH':
        return chalk.green(level);
      case 'MEDIUM':
        return chalk.yellow(level);
      case 'LOW':
        return chalk.red(level);
      default:
        return chalk.dim(level);
    }
  }

  /**
   * Generate security recommendations
   */
  generateRecommendations(report) {
    const recommendations = [];

    if (report.security.expiredKeysCount > 0) {
      recommendations.push('Remove expired API keys using --cleanup');
    }

    if (report.security.securityLevel === 'LOW') {
      recommendations.push('Review and fix security warnings');
    }

    if (report.network.pinnedCertificates.length === 0) {
      recommendations.push('Consider implementing certificate pinning');
    }

    if (report.network.timeout > 60000) {
      recommendations.push('Consider reducing request timeout');
    }

    return recommendations;
  }
}

module.exports = SecurityCommand;
