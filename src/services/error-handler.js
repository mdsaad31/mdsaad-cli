/**
 * Error Handler Service
 * Comprehensive error classification, handling, and recovery system
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const outputFormatter = require('./output-formatter');

class ErrorHandler {
  constructor() {
    this.errorCategories = {
      NETWORK: 'network',
      API: 'api',
      CONFIGURATION: 'configuration',
      VALIDATION: 'validation',
      FILE_SYSTEM: 'filesystem',
      PERMISSION: 'permission',
      RATE_LIMIT: 'ratelimit',
      AUTHENTICATION: 'authentication',
      PARSING: 'parsing',
      DEPENDENCY: 'dependency',
      UNKNOWN: 'unknown',
    };

    this.severityLevels = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
      INFO: 0,
    };

    this.errorLog = [];
    this.maxLogSize = 1000;
    this.logFile = path.join(os.homedir(), '.mdsaad', 'error.log');
    this.recoveryStrategies = new Map();
    this.isInitialized = false;

    this.initializeRecoveryStrategies();
  }

  /**
   * Initialize the error handler
   */
  async initialize() {
    try {
      await fs.ensureDir(path.dirname(this.logFile));
      await this.loadErrorLog();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('ErrorHandler initialization warning:', error.message);
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Initialize recovery strategies for different error types
   */
  initializeRecoveryStrategies() {
    // Network errors
    this.recoveryStrategies.set('NETWORK_TIMEOUT', {
      message: 'Network request timed out',
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Use --timeout <seconds> to increase timeout',
        'Check if the service is temporarily down',
      ],
      autoRetry: true,
      maxRetries: 3,
      retryDelay: 2000,
    });

    this.recoveryStrategies.set('NETWORK_OFFLINE', {
      message: 'No internet connection detected',
      suggestions: [
        'Connect to the internet and try again',
        'Check your network settings',
        'Use cached data where available',
        'Enable offline mode with --offline',
      ],
      autoRetry: false,
      fallbackMode: 'offline',
    });

    // API errors
    this.recoveryStrategies.set('API_KEY_INVALID', {
      message: 'API key is invalid or expired',
      suggestions: [
        'Check your API key configuration with: mdsaad config --get apiKeys',
        'Update your API key with: mdsaad config --set apiKeys.<service>=<key>',
        'Visit the service provider to get a new API key',
        'Use alternative providers if available',
      ],
      severity: this.severityLevels.HIGH,
    });

    this.recoveryStrategies.set('API_RATE_LIMITED', {
      message: 'API rate limit exceeded',
      suggestions: [
        'Wait before making more requests',
        'Use --cache to reduce API calls',
        'Consider upgrading to a higher tier plan',
        'Use alternative providers',
      ],
      autoRetry: true,
      maxRetries: 1,
      retryDelay: 60000,
    });

    // Configuration errors
    this.recoveryStrategies.set('CONFIG_CORRUPTED', {
      message: 'Configuration file is corrupted',
      suggestions: [
        'Reset configuration: mdsaad enhanced config --reset',
        'Import from backup: mdsaad enhanced config --import backup.json',
        'Manually edit ~/.mdsaad/config.json',
        'Contact support if the issue persists',
      ],
      severity: this.severityLevels.MEDIUM,
      autoFix: true,
    });

    // File system errors
    this.recoveryStrategies.set('FILE_NOT_FOUND', {
      message: 'Required file not found',
      suggestions: [
        'Check if the file path is correct',
        'Ensure the file exists and is readable',
        'Check file permissions',
        "Run setup again if it's a system file",
      ],
      severity: this.severityLevels.MEDIUM,
    });

    this.recoveryStrategies.set('PERMISSION_DENIED', {
      message: 'Permission denied accessing file or directory',
      suggestions: [
        'Run with appropriate permissions',
        'Check file/directory ownership',
        'Use sudo if necessary (Linux/Mac)',
        'Run as Administrator (Windows)',
      ],
      severity: this.severityLevels.HIGH,
    });

    // Validation errors
    this.recoveryStrategies.set('INVALID_INPUT', {
      message: 'Invalid input provided',
      suggestions: [
        'Check the command syntax with --help',
        'Verify input format and requirements',
        'Use examples provided in help',
        'Check for typos in command arguments',
      ],
      severity: this.severityLevels.LOW,
    });
  }

  /**
   * Handle an error with classification and recovery suggestions
   */
  async handleError(error, context = {}) {
    try {
      // Classify the error
      const classification = this.classifyError(error, context);

      // Log the error
      await this.logError(error, classification, context);

      // Get recovery strategy
      const recovery = this.getRecoveryStrategy(classification);

      // Display user-friendly error
      this.displayError(error, classification, recovery, context);

      // Attempt automatic recovery if configured
      if (
        recovery.autoRetry &&
        context.retryCount < (recovery.maxRetries || 0)
      ) {
        return await this.attemptAutoRecovery(
          error,
          classification,
          recovery,
          context
        );
      }

      // Suggest manual recovery
      if (recovery.autoFix && !context.skipAutoFix) {
        return await this.attemptAutoFix(
          error,
          classification,
          recovery,
          context
        );
      }

      return {
        handled: true,
        recovered: false,
        classification,
        recovery,
      };
    } catch (handlerError) {
      // Fallback error handling
      console.error(
        chalk.red('❌ Error handler failed:'),
        handlerError.message
      );
      console.error(chalk.red('❌ Original error:'), error.message);
      return { handled: false, recovered: false };
    }
  }

  /**
   * Classify error based on type, message, and context
   */
  classifyError(error, context = {}) {
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;
    const errorName = error.name;

    // Network errors
    if (errorCode === 'ENOTFOUND' || errorCode === 'ECONNREFUSED') {
      return {
        category: 'NETWORK',
        type: 'NETWORK_OFFLINE',
        severity: this.severityLevels.HIGH,
      };
    }
    if (errorCode === 'ETIMEDOUT' || errorMessage.includes('timeout')) {
      return {
        category: 'NETWORK',
        type: 'NETWORK_TIMEOUT',
        severity: this.severityLevels.MEDIUM,
      };
    }

    // API errors
    if (
      error.status === 401 ||
      errorMessage.includes('unauthorized') ||
      errorMessage.includes('invalid api key')
    ) {
      return {
        category: 'API',
        type: 'API_KEY_INVALID',
        severity: this.severityLevels.HIGH,
      };
    }
    if (
      error.status === 429 ||
      errorMessage.includes('rate limit') ||
      errorMessage.includes('too many requests')
    ) {
      return {
        category: 'API',
        type: 'API_RATE_LIMITED',
        severity: this.severityLevels.MEDIUM,
      };
    }

    // File system errors
    if (errorCode === 'ENOENT' || errorMessage.includes('no such file')) {
      return {
        category: 'FILE_SYSTEM',
        type: 'FILE_NOT_FOUND',
        severity: this.severityLevels.MEDIUM,
      };
    }
    if (
      errorCode === 'EACCES' ||
      errorCode === 'EPERM' ||
      errorMessage.includes('permission denied')
    ) {
      return {
        category: 'FILE_SYSTEM',
        type: 'PERMISSION_DENIED',
        severity: this.severityLevels.HIGH,
      };
    }

    // Configuration errors
    if (
      errorMessage.includes('config') &&
      (errorMessage.includes('corrupt') ||
        errorMessage.includes('invalid json'))
    ) {
      return {
        category: 'CONFIGURATION',
        type: 'CONFIG_CORRUPTED',
        severity: this.severityLevels.MEDIUM,
      };
    }

    // Validation errors
    if (errorName === 'ValidationError' || context.isValidationError) {
      return {
        category: 'VALIDATION',
        type: 'INVALID_INPUT',
        severity: this.severityLevels.LOW,
      };
    }

    // Parsing errors
    if (
      errorName === 'SyntaxError' ||
      errorMessage.includes('unexpected token')
    ) {
      return {
        category: 'PARSING',
        type: 'PARSING_ERROR',
        severity: this.severityLevels.MEDIUM,
      };
    }

    // Default classification
    return {
      category: 'UNKNOWN',
      type: 'UNKNOWN_ERROR',
      severity: this.severityLevels.MEDIUM,
      originalError: errorName,
    };
  }

  /**
   * Get recovery strategy for error classification
   */
  getRecoveryStrategy(classification) {
    const strategy = this.recoveryStrategies.get(classification.type);
    if (strategy) {
      return { ...strategy, classification };
    }

    // Default strategy
    return {
      message: 'An unexpected error occurred',
      suggestions: [
        'Try the command again',
        'Check your input for any typos',
        'Use --debug for more detailed error information',
        'Report this issue if it persists',
      ],
      severity: classification.severity || this.severityLevels.MEDIUM,
    };
  }

  /**
   * Display user-friendly error message with recovery suggestions
   */
  displayError(error, classification, recovery, context = {}) {
    console.log(); // Add spacing

    // Error header with appropriate severity styling
    const severityIcon = this.getSeverityIcon(recovery.severity);
    const severityColor = this.getSeverityColor(recovery.severity);

    console.log(
      chalk[severityColor](
        `${severityIcon} ${recovery.message || 'Error occurred'}`
      )
    );

    // Show original error in debug mode
    if (context.debug || process.env.NODE_ENV === 'development') {
      console.log(chalk.gray(`   Technical details: ${error.message}`));
      if (error.stack) {
        console.log(
          chalk.gray(`   Stack trace: ${error.stack.split('\n')[1]}`)
        );
      }
    }

    console.log();

    // Recovery suggestions
    if (recovery.suggestions && recovery.suggestions.length > 0) {
      console.log(outputFormatter.info('💡 Suggested solutions:'));
      recovery.suggestions.forEach((suggestion, index) => {
        console.log(`   ${chalk.yellow(`${index + 1}.`)} ${suggestion}`);
      });
      console.log();
    }

    // Additional context-specific help
    if (context.command) {
      console.log(
        outputFormatter.info(
          `📖 For help with the '${context.command}' command:`
        )
      );
      console.log(`   Run: ${chalk.cyan(`mdsaad ${context.command} --help`)}`);
      console.log();
    }

    // Auto-retry information
    if (recovery.autoRetry && context.retryCount < (recovery.maxRetries || 0)) {
      console.log(
        chalk.yellow(
          `🔄 Auto-retry in ${(recovery.retryDelay || 1000) / 1000} seconds... (${context.retryCount + 1}/${recovery.maxRetries})`
        )
      );
    }
  }

  /**
   * Attempt automatic error recovery
   */
  async attemptAutoRecovery(error, classification, recovery, context) {
    context.retryCount = (context.retryCount || 0) + 1;

    console.log(
      chalk.yellow(
        `🔄 Attempting automatic recovery... (attempt ${context.retryCount}/${recovery.maxRetries})`
      )
    );

    // Wait for retry delay
    if (recovery.retryDelay) {
      await new Promise(resolve => setTimeout(resolve, recovery.retryDelay));
    }

    try {
      // If the context has a retry function, use it
      if (
        context.retryFunction &&
        typeof context.retryFunction === 'function'
      ) {
        await context.retryFunction();
        console.log(
          outputFormatter.success('✅ Automatic recovery successful')
        );
        return { handled: true, recovered: true };
      }

      return { handled: true, recovered: false, needsManualIntervention: true };
    } catch (retryError) {
      console.log(outputFormatter.warning('⚠️ Automatic recovery failed'));
      return await this.handleError(retryError, {
        ...context,
        skipAutoRetry: true,
      });
    }
  }

  /**
   * Attempt automatic fix for recoverable errors
   */
  async attemptAutoFix(error, classification, recovery, context) {
    console.log(chalk.yellow('🔧 Attempting automatic fix...'));

    try {
      switch (classification.type) {
        case 'CONFIG_CORRUPTED':
          return await this.fixCorruptedConfig();

        case 'FILE_NOT_FOUND':
          return await this.createMissingFile(context);

        default:
          return {
            handled: true,
            recovered: false,
            needsManualIntervention: true,
          };
      }
    } catch (fixError) {
      console.log(outputFormatter.warning('⚠️ Automatic fix failed'));
      return { handled: true, recovered: false, fixError };
    }
  }

  /**
   * Fix corrupted configuration
   */
  async fixCorruptedConfig() {
    try {
      const configManager = require('./config-manager');
      await configManager.reset('config');
      console.log(
        outputFormatter.success('✅ Configuration reset to defaults')
      );
      return { handled: true, recovered: true };
    } catch (error) {
      throw new Error(`Failed to reset configuration: ${error.message}`);
    }
  }

  /**
   * Create missing file if possible
   */
  async createMissingFile(context) {
    if (context.expectedFile && context.defaultContent) {
      try {
        await fs.ensureDir(path.dirname(context.expectedFile));
        await fs.writeFile(context.expectedFile, context.defaultContent);
        console.log(
          outputFormatter.success(
            `✅ Created missing file: ${context.expectedFile}`
          )
        );
        return { handled: true, recovered: true };
      } catch (error) {
        throw new Error(`Failed to create file: ${error.message}`);
      }
    }
    return { handled: true, recovered: false };
  }

  /**
   * Log error for debugging and analytics
   */
  async logError(error, classification, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
      },
      classification,
      context: {
        command: context.command,
        args: context.args,
        platform: os.platform(),
        nodeVersion: process.version,
        retryCount: context.retryCount || 0,
      },
      id: this.generateErrorId(),
    };

    this.errorLog.push(logEntry);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Write to file asynchronously
    try {
      await fs.writeFile(this.logFile, JSON.stringify(this.errorLog, null, 2));
    } catch (writeError) {
      // Don't let logging errors affect the main error handling
      console.debug('Failed to write error log:', writeError.message);
    }
  }

  /**
   * Load existing error log
   */
  async loadErrorLog() {
    try {
      if (await fs.pathExists(this.logFile)) {
        const logData = await fs.readFile(this.logFile, 'utf8');
        this.errorLog = JSON.parse(logData);
      }
    } catch (error) {
      // Start with empty log if loading fails
      this.errorLog = [];
    }
  }

  /**
   * Get error statistics
   */
  getErrorStatistics(days = 7) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentErrors = this.errorLog.filter(
      entry => new Date(entry.timestamp) > cutoffDate
    );

    const stats = {
      totalErrors: recentErrors.length,
      byCategory: {},
      byType: {},
      bySeverity: {},
      byDay: {},
    };

    recentErrors.forEach(entry => {
      const category = entry.classification.category;
      const type = entry.classification.type;
      const severity = entry.classification.severity;
      const day = entry.timestamp.split('T')[0];

      stats.byCategory[category] = (stats.byCategory[category] || 0) + 1;
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    });

    return stats;
  }

  /**
   * Generate unique error ID
   */
  generateErrorId() {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get severity icon
   */
  getSeverityIcon(severity) {
    switch (severity) {
      case this.severityLevels.CRITICAL:
        return '🚨';
      case this.severityLevels.HIGH:
        return '❌';
      case this.severityLevels.MEDIUM:
        return '⚠️';
      case this.severityLevels.LOW:
        return '💡';
      default:
        return 'ℹ️';
    }
  }

  /**
   * Get severity color
   */
  getSeverityColor(severity) {
    switch (severity) {
      case this.severityLevels.CRITICAL:
        return 'redBright';
      case this.severityLevels.HIGH:
        return 'red';
      case this.severityLevels.MEDIUM:
        return 'yellow';
      case this.severityLevels.LOW:
        return 'blue';
      default:
        return 'cyan';
    }
  }

  /**
   * Create error wrapper for consistent error handling
   */
  createError(message, type, context = {}) {
    const error = new Error(message);
    error.type = type;
    error.context = context;
    return error;
  }

  /**
   * Graceful degradation for offline scenarios
   */
  enableOfflineMode() {
    console.log(outputFormatter.info('🔌 Switching to offline mode'));
    console.log('   • Using cached data where available');
    console.log('   • Some features may be limited');
    console.log('   • Connect to internet to restore full functionality');
  }
}

module.exports = new ErrorHandler();

module.exports = new ErrorHandler();
