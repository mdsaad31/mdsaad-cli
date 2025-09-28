#!/usr/bin/env node

/**
 * Configuration Management Utility
 * CLI tool for managing mdsaad configuration
 */

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const config = require('../src/services/config');

class ConfigManager {
  constructor() {
    this.program = new Command();
  }

  async initialize() {
    await config.initialize();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('mdsaad-config')
      .description('Configuration management utility for mdsaad CLI tool')
      .version('1.0.0');

    // Show configuration
    this.program
      .command('show')
      .description('Display current configuration')
      .option('-j, --json', 'Output as JSON')
      .action(async (options) => {
        await this.showConfig(options);
      });

    // Set configuration value
    this.program
      .command('set <key> <value>')
      .description('Set configuration value')
      .action(async (key, value) => {
        await this.setConfig(key, value);
      });

    // Get configuration value
    this.program
      .command('get <key>')
      .description('Get configuration value')
      .action(async (key) => {
        await this.getConfig(key);
      });

    // Setup API keys
    this.program
      .command('setup-api')
      .description('Interactive setup for API keys')
      .action(async () => {
        await this.setupApiKeys();
      });

    // Reset configuration
    this.program
      .command('reset')
      .description('Reset configuration to defaults')
      .option('-y, --yes', 'Skip confirmation')
      .action(async (options) => {
        await this.resetConfig(options);
      });

    // Export configuration
    this.program
      .command('export <file>')
      .description('Export configuration to file')
      .action(async (file) => {
        await this.exportConfig(file);
      });

    // Import configuration
    this.program
      .command('import <file>')
      .description('Import configuration from file')
      .action(async (file) => {
        await this.importConfig(file);
      });

    // Show statistics
    this.program
      .command('stats')
      .description('Show configuration statistics')
      .action(async () => {
        await this.showStats();
      });
  }

  async showConfig(options) {
    try {
      const configData = config.exportConfig();
      
      if (options.json) {
        console.log(JSON.stringify(configData, null, 2));
      } else {
        console.log(chalk.cyan('🔧 Current Configuration:'));
        console.log();
        
        console.log(chalk.yellow('General Settings:'));
        console.log(`  Language: ${configData.language}`);
        console.log(`  Precision: ${configData.defaultPrecision}`);
        console.log(`  Cache Directory: ${configData.cacheDirectory}`);
        console.log();
        
        console.log(chalk.yellow('API Keys:'));
        Object.entries(configData.apiKeys).forEach(([service, key]) => {
          const status = key ? chalk.green('✓ Configured') : chalk.red('✗ Not set');
          console.log(`  ${service}: ${status}`);
        });
        console.log();
        
        console.log(chalk.yellow('Preferences:'));
        console.log(`  Weather Units: ${configData.preferences.weatherUnits}`);
        console.log(`  Currency Favorites: ${configData.preferences.currencyFavorites.join(', ')}`);
        console.log(`  Color Scheme: ${configData.preferences.colorScheme}`);
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to show configuration:'), error.message);
    }
  }

  async setConfig(key, value) {
    try {
      // Parse value if it looks like JSON
      let parsedValue = value;
      if (value.startsWith('[') || value.startsWith('{') || value === 'true' || value === 'false' || !isNaN(value)) {
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // Keep as string if JSON parsing fails
        }
      }
      
      config.set(key, parsedValue);
      console.log(chalk.green('✅ Configuration updated:'));
      console.log(`  ${key} = ${JSON.stringify(parsedValue)}`);
    } catch (error) {
      console.error(chalk.red('❌ Failed to set configuration:'), error.message);
    }
  }

  async getConfig(key) {
    try {
      const value = config.get(key);
      if (value !== null) {
        console.log(chalk.cyan(`${key}:`), JSON.stringify(value, null, 2));
      } else {
        console.log(chalk.yellow(`Configuration key '${key}' not found`));
      }
    } catch (error) {
      console.error(chalk.red('❌ Failed to get configuration:'), error.message);
    }
  }

  async setupApiKeys() {
    try {
      console.log(chalk.cyan('🔑 API Key Setup'));
      console.log('Configure API keys for external services:');
      console.log();

      const services = [
        { name: 'openweather', description: 'OpenWeatherMap (for weather data)' },
        { name: 'exchangerate', description: 'ExchangeRate-API (for currency conversion)' },
        { name: 'gemini', description: 'Google Gemini (for AI assistance)' },
        { name: 'deepseek', description: 'Deepseek AI (for AI assistance)' },
        { name: 'openrouter', description: 'OpenRouter (for AI assistance)' },
        { name: 'nvidia', description: 'NVIDIA AI (for AI assistance)' },
        { name: 'groq', description: 'Groq AI (for AI assistance)' }
      ];

      for (const service of services) {
        const currentKey = config.getApiKey(service.name);
        const hasKey = currentKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set');
        
        console.log(`\n${chalk.yellow(service.description)}`);
        console.log(`Current status: ${hasKey}`);
        
        const { shouldUpdate } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'shouldUpdate',
            message: `Update ${service.name} API key?`,
            default: !currentKey
          }
        ]);

        if (shouldUpdate) {
          const { apiKey } = await inquirer.prompt([
            {
              type: 'password',
              name: 'apiKey',
              message: `Enter ${service.name} API key:`,
              mask: '*'
            }
          ]);

          if (apiKey.trim()) {
            config.setApiKey(service.name, apiKey.trim());
            console.log(chalk.green(`✅ ${service.name} API key updated`));
          } else {
            console.log(chalk.yellow(`⚠️  ${service.name} API key unchanged`));
          }
        }
      }

      console.log();
      console.log(chalk.green('🎉 API key setup completed!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to setup API keys:'), error.message);
    }
  }

  async resetConfig(options) {
    try {
      if (!options.yes) {
        const { confirmed } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirmed',
            message: 'Are you sure you want to reset all configuration to defaults?',
            default: false
          }
        ]);

        if (!confirmed) {
          console.log(chalk.yellow('Reset cancelled'));
          return;
        }
      }

      await config.reset();
      console.log(chalk.green('✅ Configuration reset to defaults'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to reset configuration:'), error.message);
    }
  }

  async exportConfig(file) {
    try {
      const fs = require('fs-extra');
      const configData = config.exportConfig();
      
      await fs.writeJson(file, configData, { spaces: 2 });
      console.log(chalk.green('✅ Configuration exported to:'), file);
    } catch (error) {
      console.error(chalk.red('❌ Failed to export configuration:'), error.message);
    }
  }

  async importConfig(file) {
    try {
      const fs = require('fs-extra');
      
      if (!await fs.pathExists(file)) {
        throw new Error(`File not found: ${file}`);
      }
      
      const configData = await fs.readJson(file);
      await config.importConfig(configData);
      console.log(chalk.green('✅ Configuration imported from:'), file);
    } catch (error) {
      console.error(chalk.red('❌ Failed to import configuration:'), error.message);
    }
  }

  async showStats() {
    try {
      const stats = config.getStats();
      
      console.log(chalk.cyan('📊 Configuration Statistics:'));
      console.log();
      console.log(`Config File: ${stats.configFile}`);
      console.log(`Config Size: ${stats.configSize} bytes`);
      console.log(`API Keys Configured: ${stats.apiKeysConfigured}/${stats.totalApiKeys}`);
      console.log(`Language: ${stats.language}`);
      console.log(`Cache Directory: ${stats.cacheDirectory}`);
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to show statistics:'), error.message);
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('❌ Configuration manager error:'), error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const manager = new ConfigManager();
  manager.run();
}

module.exports = ConfigManager;