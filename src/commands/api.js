/**
 * API Command - Manage API providers and view statistics
 */

const chalk = require('chalk');
const apiManager = require('../services/api-manager');
const configService = require('../services/config');

class APICommand {
  constructor() {
    this.initialized = false;
  }

  /**
   * Execute API management command
   */
  async execute(action, options = {}) {
    try {
      // Initialize API manager if not already done
      if (!apiManager.initialized) {
        await apiManager.initialize();
      }

      switch (action?.toLowerCase()) {
        case 'status':
          await this.showStatus();
          break;

        case 'providers':
          await this.listProviders();
          break;

        case 'stats':
        case 'statistics':
          await this.showStatistics();
          break;

        case 'enable':
          await this.enableProvider(options.provider);
          break;

        case 'disable':
          await this.disableProvider(options.provider);
          break;

        case 'reset':
          await this.resetProvider(options.provider);
          break;

        case 'test':
          await this.testProvider(options.provider);
          break;

        case 'config':
          await this.showConfiguration();
          break;

        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.log(chalk.red('❌ API management failed:'), error.message);
    }
  }

  /**
   * Show overall API status
   */
  async showStatus() {
    console.log(chalk.yellow('📡 API Manager Status'));
    console.log();

    const stats = apiManager.getStatistics();
    const providers = apiManager.listProviders();

    // Overall statistics
    console.log(chalk.cyan('Overall Statistics:'));
    console.log(
      `  Total Requests: ${chalk.white(stats.overall.totalRequests)}`
    );
    console.log(
      `  Successful: ${chalk.green(stats.overall.successfulRequests)}`
    );
    console.log(`  Failed: ${chalk.red(stats.overall.failedRequests)}`);
    console.log(
      `  Success Rate: ${chalk.white(this.calculateSuccessRate(stats.overall))}%`
    );
    console.log(
      `  Uptime: ${chalk.white(this.formatUptime(stats.overall.uptime))}`
    );
    console.log();

    // Provider health overview
    console.log(chalk.cyan('Provider Health:'));
    if (providers.length === 0) {
      console.log(chalk.yellow('  No providers configured'));
    } else {
      providers.forEach(name => {
        const providerStats = stats.providers[name];
        const status = this.getProviderStatus(providerStats);
        console.log(`  ${name}: ${status}`);
      });
    }
    console.log();
  }

  /**
   * List all providers with details
   */
  async listProviders() {
    console.log(chalk.yellow('📋 API Providers'));
    console.log();

    const providers = apiManager.listProviders();
    const stats = apiManager.getStatistics();

    if (providers.length === 0) {
      console.log(chalk.yellow('No providers configured.'));
      console.log(chalk.gray('Use configuration to add API providers.'));
      return;
    }

    providers.forEach(name => {
      const provider = apiManager.getProvider(name);
      const providerStats = stats.providers[name];

      console.log(chalk.white(`${name}:`));
      console.log(`  URL: ${chalk.cyan(provider.baseURL)}`);
      console.log(`  Status: ${this.getProviderStatus(providerStats)}`);
      console.log(`  Priority: ${chalk.white(provider.priority)}`);
      console.log(
        `  Rate Limit: ${chalk.white(provider.rateLimit.requests)} req/${this.formatWindow(provider.rateLimit.window)}`
      );
      console.log(
        `  Requests: ${chalk.white(providerStats.requests.total)} (${chalk.green(providerStats.requests.successful)} success, ${chalk.red(providerStats.requests.failed)} failed)`
      );
      console.log(
        `  Circuit Breaker: ${this.formatCircuitBreakerState(providerStats.circuitBreaker)}`
      );
      console.log();
    });
  }

  /**
   * Show detailed statistics
   */
  async showStatistics() {
    console.log(chalk.yellow('📊 Detailed API Statistics'));
    console.log();

    const stats = apiManager.getStatistics();
    const providers = apiManager.listProviders();

    if (providers.length === 0) {
      console.log(chalk.yellow('No providers configured for statistics.'));
      return;
    }

    providers.forEach(name => {
      const providerStats = stats.providers[name];
      const requests = providerStats.requests;
      const failures = providerStats.failures;

      console.log(chalk.white(`${name} Statistics:`));
      console.log(`  ${chalk.cyan('Requests:')} ${requests.total} total`);
      console.log(`    ✅ Successful: ${chalk.green(requests.successful)}`);
      console.log(`    ❌ Failed: ${chalk.red(requests.failed)}`);
      console.log(
        `    📈 Success Rate: ${chalk.white(this.calculateSuccessRate(requests))}%`
      );
      console.log(
        `  ${chalk.cyan('Failures:')} ${failures.totalFailures} total`
      );
      console.log(
        `    🔄 Consecutive: ${chalk.yellow(failures.consecutiveFailures)}`
      );
      console.log(
        `  ${chalk.cyan('Health:')} ${this.getProviderStatus(providerStats)}`
      );
      console.log(
        `  ${chalk.cyan('Circuit Breaker:')} ${this.formatCircuitBreakerState(providerStats.circuitBreaker)}`
      );
      console.log(
        `  ${chalk.cyan('Rate Limited:')} ${providerStats.rateLimited ? chalk.red('Yes') : chalk.green('No')}`
      );
      console.log();
    });
  }

  /**
   * Enable a provider
   */
  async enableProvider(providerName) {
    if (!providerName) {
      console.log(chalk.red('❌ Provider name is required'));
      console.log(chalk.gray('Usage: mdsaad api enable --provider <name>'));
      return;
    }

    const provider = apiManager.getProvider(providerName);
    if (!provider) {
      console.log(chalk.red(`❌ Provider '${providerName}' not found`));
      return;
    }

    apiManager.setProviderEnabled(providerName, true);
    console.log(chalk.green(`✅ Provider '${providerName}' enabled`));
  }

  /**
   * Disable a provider
   */
  async disableProvider(providerName) {
    if (!providerName) {
      console.log(chalk.red('❌ Provider name is required'));
      console.log(chalk.gray('Usage: mdsaad api disable --provider <name>'));
      return;
    }

    const provider = apiManager.getProvider(providerName);
    if (!provider) {
      console.log(chalk.red(`❌ Provider '${providerName}' not found`));
      return;
    }

    apiManager.setProviderEnabled(providerName, false);
    console.log(chalk.yellow(`⏸️  Provider '${providerName}' disabled`));
  }

  /**
   * Reset provider circuit breaker and counters
   */
  async resetProvider(providerName) {
    if (!providerName) {
      console.log(chalk.red('❌ Provider name is required'));
      console.log(chalk.gray('Usage: mdsaad api reset --provider <name>'));
      return;
    }

    const provider = apiManager.getProvider(providerName);
    if (!provider) {
      console.log(chalk.red(`❌ Provider '${providerName}' not found`));
      return;
    }

    apiManager.resetCircuitBreaker(providerName);
    console.log(
      chalk.green(`🔄 Provider '${providerName}' circuit breaker reset`)
    );
  }

  /**
   * Test a provider connection
   */
  async testProvider(providerName) {
    if (!providerName) {
      console.log(chalk.red('❌ Provider name is required'));
      console.log(chalk.gray('Usage: mdsaad api test --provider <name>'));
      return;
    }

    const provider = apiManager.getProvider(providerName);
    if (!provider) {
      console.log(chalk.red(`❌ Provider '${providerName}' not found`));
      return;
    }

    console.log(chalk.cyan(`🔍 Testing provider: ${providerName}`));
    console.log();

    try {
      const startTime = Date.now();

      // Try a simple health check or test endpoint
      const result = await apiManager.executeRequest(providerName, '/health', {
        method: 'GET',
      });

      const duration = Date.now() - startTime;

      console.log(chalk.green(`✅ Test successful`));
      console.log(`   Response Status: ${chalk.white(result.status)}`);
      console.log(`   Response Time: ${chalk.white(duration)}ms`);
      console.log(`   Request ID: ${chalk.gray(result.requestId)}`);
    } catch (error) {
      console.log(chalk.red(`❌ Test failed: ${error.message}`));

      // Show additional debugging info
      if (error.response) {
        console.log(`   Status: ${chalk.red(error.response.status)}`);
        console.log(
          `   Message: ${chalk.red(error.response.data?.message || 'Unknown error')}`
        );
      }
    }

    console.log();
  }

  /**
   * Show API configuration
   */
  async showConfiguration() {
    console.log(chalk.yellow('⚙️  API Configuration'));
    console.log();

    const apiConfig = configService.get('apiProviders', {});

    if (Object.keys(apiConfig).length === 0) {
      console.log(chalk.yellow('No API providers configured.'));
      console.log();
      console.log(chalk.cyan('To configure providers, add to your config:'));
      console.log(
        chalk.gray(
          '  mdsaad config set apiProviders.gemini.baseURL "https://api.gemini.com"'
        )
      );
      console.log(
        chalk.gray(
          '  mdsaad config set apiProviders.gemini.apiKey "your-api-key"'
        )
      );
      return;
    }

    Object.entries(apiConfig).forEach(([name, config]) => {
      console.log(chalk.white(`${name}:`));
      console.log(`  Base URL: ${chalk.cyan(config.baseURL || 'Not set')}`);
      console.log(
        `  API Key: ${config.apiKey ? chalk.green('✓ Set') : chalk.red('✗ Not set')}`
      );
      console.log(
        `  Enabled: ${config.enabled !== false ? chalk.green('Yes') : chalk.red('No')}`
      );
      console.log(`  Priority: ${chalk.white(config.priority || 1)}`);
      console.log(
        `  Rate Limit: ${chalk.white(config.rateLimit?.requests || 100)} req/${this.formatWindow(config.rateLimit?.window || 3600000)}`
      );
      console.log();
    });
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.yellow('📡 API Management Help'));
    console.log();

    console.log(chalk.cyan('Available Commands:'));
    console.log('  mdsaad api status           →  Show overall API status');
    console.log('  mdsaad api providers        →  List all API providers');
    console.log('  mdsaad api stats            →  Show detailed statistics');
    console.log('  mdsaad api config           →  Show API configuration');
    console.log();

    console.log(chalk.cyan('Provider Management:'));
    console.log(
      '  mdsaad api enable --provider <name>    →  Enable a provider'
    );
    console.log(
      '  mdsaad api disable --provider <name>   →  Disable a provider'
    );
    console.log(
      '  mdsaad api reset --provider <name>     →  Reset provider circuit breaker'
    );
    console.log(
      '  mdsaad api test --provider <name>      →  Test provider connection'
    );
    console.log();

    console.log(chalk.cyan('Configuration Examples:'));
    console.log(
      '  mdsaad config set apiProviders.gemini.baseURL "https://api.gemini.com"'
    );
    console.log(
      '  mdsaad config set apiProviders.gemini.apiKey "your-api-key"'
    );
    console.log('  mdsaad config set apiProviders.gemini.enabled true');
    console.log('  mdsaad config set apiProviders.gemini.priority 5');
  }

  /**
   * Helper methods for formatting
   */
  getProviderStatus(providerStats) {
    if (!providerStats.enabled) {
      return chalk.gray('⏸️  Disabled');
    }

    if (!providerStats.healthy) {
      return chalk.red('❌ Unhealthy');
    }

    if (providerStats.rateLimited) {
      return chalk.yellow('⏳ Rate Limited');
    }

    if (providerStats.circuitBreaker === 'OPEN') {
      return chalk.red('⚡ Circuit Open');
    }

    if (providerStats.circuitBreaker === 'HALF_OPEN') {
      return chalk.yellow('🔄 Circuit Half-Open');
    }

    return chalk.green('✅ Healthy');
  }

  formatCircuitBreakerState(state) {
    switch (state) {
      case 'CLOSED':
        return chalk.green('CLOSED');
      case 'OPEN':
        return chalk.red('OPEN');
      case 'HALF_OPEN':
        return chalk.yellow('HALF_OPEN');
      default:
        return chalk.gray(state);
    }
  }

  calculateSuccessRate(requests) {
    if (!requests || requests.total === 0) return 0;
    return Math.round((requests.successful / requests.total) * 100);
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  formatWindow(ms) {
    if (ms >= 3600000) return `${ms / 3600000}h`;
    if (ms >= 60000) return `${ms / 60000}m`;
    return `${ms / 1000}s`;
  }
}

module.exports = new APICommand();
