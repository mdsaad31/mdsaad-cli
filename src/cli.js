#!/usr/bin/env node

/**
 * mdsaad CLI Tool
 * A comprehensive command-line utility for mathematical calculations,
 * AI interactions, ASCII art, weather information, and currency conversions.
 */

const { Command } = require('commander');
const chalk = require('chalk');
// const updateNotifier = require('update-notifier'); // Temporarily disabled due to ES module issues
const path = require('path');
const fs = require('fs-extra');

// Import services
const logger = require('./services/logger');
const config = require('./services/config');
const i18n = require('./services/i18n');
const pluginManager = require('./services/plugin-manager');
const updateManager = require('./services/update-manager');

// Import performance services
const performanceService = require('./services/performance-service');
const resourceManager = require('./services/resource-manager');
const offlineManager = require('./services/offline-manager');
const startupOptimizer = require('./services/startup-optimizer');

// Import security services
const InputValidator = require('./services/input-validator');
const SecurityManager = require('./services/security-manager');
const NetworkSecurity = require('./services/network-security');

// Import command modules
const calculateCommand = require('./commands/calculate');
const aiCommand = require('./commands/ai');
const apiCommand = require('./commands/api');
const showCommand = require('./commands/show');
const weatherCommand = require('./commands/weather');
const convertCommand = require('./commands/convert');
const debugCommand = require('./commands/debug');
const diagnoseCommand = require('./commands/diagnose');
const pluginCommand = require('./commands/plugin');
const UpdateCommand = require('./commands/update');
const MaintenanceCommand = require('./commands/maintenance');
const CrossPlatformCommand = require('./commands/platform');
const PerformanceCommand = require('./commands/performance');
const SecurityCommand = require('./commands/security');
const ConfigCommand = require('./commands/config');

// Package information
const packageJson = require('../package.json');

class CLIApplication {
  constructor() {
    this.program = new Command();
    this.isInitialized = false;
    this.inputValidator = new InputValidator();
    this.securityManager = new SecurityManager();
    this.networkSecurity = new NetworkSecurity();
  }

  async initialize() {
    try {
      // Start startup optimization tracking
      await startupOptimizer.initialize();
      startupOptimizer.recordPhase('cli-initialization', 'start');

      // Apply startup optimizations
      startupOptimizer.applyOptimizations();

      // Initialize performance services first (they're critical)
      await performanceService.initialize();
      await resourceManager.initialize();

      // Initialize core services
      await config.initialize();
      await i18n.initialize();

      // Initialize security services early for protection
      startupOptimizer.recordPhase('security-init', 'start');
      await this.securityManager.initialize();
      logger.info('Security services initialized');
      startupOptimizer.recordPhase('security-init', 'end');

      // Initialize offline manager for network-independent features
      await offlineManager.initialize();

      // Initialize plugin manager (deferred to improve startup time)
      try {
        startupOptimizer.recordPhase('plugin-manager-init', 'start');

        // Use lazy loading for plugins if startup optimizer is available
        const pluginLoader = startupOptimizer.getLazyLoader('plugin-manager');
        if (pluginLoader) {
          // Defer plugin loading unless explicitly needed
          this.deferredPluginLoader = pluginLoader;
        } else {
          // Fallback to immediate loading
          await pluginManager.initialize();
          logger.info(
            `Plugin manager initialized with ${pluginManager.getStatistics().totalPlugins} plugins`
          );

          // Register plugin commands with Commander
          this.registerPluginCommands();
        }

        startupOptimizer.recordPhase('plugin-manager-init', 'end');
      } catch (error) {
        logger.warn(`Plugin manager initialization failed: ${error.message}`);
      }

      // Initialize update manager (deferred to improve startup time)
      try {
        startupOptimizer.recordPhase('update-manager-init', 'start');

        // Use offline-aware update checking
        await offlineManager.executeWithOfflineFallback(
          'update-check',
          async () => {
            await updateManager.initialize();

            // Perform silent update check if enabled and online
            if (!process.env.SKIP_NETWORK_CHECK) {
              await updateManager.performSilentUpdateCheck();
            }
          },
          { timeout: 2000 }
        );

        startupOptimizer.recordPhase('update-manager-init', 'end');
      } catch (error) {
        logger.warn(`Update manager initialization failed: ${error.message}`);
      }

      // Load language preference from config
      const preferredLanguage = config.get('language', 'en');
      if (
        preferredLanguage !== 'en' &&
        i18n.isLanguageSupported(preferredLanguage)
      ) {
        try {
          await i18n.setLanguage(preferredLanguage);
        } catch (error) {
          logger.warn(
            `Failed to set preferred language ${preferredLanguage}: ${error.message}`
          );
        }
      }

      // Set up update notifier
      this.setupUpdateNotifier();

      // Configure CLI program
      this.setupProgram();

      // Register commands
      this.registerCommands();

      // Set up global middleware
      this.setupGlobalMiddleware();

      // Complete startup optimization tracking
      startupOptimizer.recordPhase('cli-initialization', 'end');

      this.isInitialized = true;

      // Log startup performance if in debug mode
      if (process.env.DEBUG || logger.getLevel() === 'debug') {
        const startupReport = startupOptimizer.getStartupReport();
        logger.info(
          `CLI application initialized successfully in ${startupReport.totalTime}ms`
        );

        // Show performance summary
        performanceService.logPerformanceEvent(
          'startup',
          'CLI application startup completed',
          {
            totalTime: startupReport.totalTime,
            phases: Object.keys(startupReport.phases).length,
            optimizations: startupReport.optimizations.length,
          }
        );
      } else {
        logger.info('CLI application initialized successfully');
      }
    } catch (error) {
      logger.error('Failed to initialize CLI application:', error);
      process.exit(1);
    }
  }

  setupUpdateNotifier() {
    // TODO: Implement update notifier with proper ES module support
    // For now, we'll skip the update check to get the CLI working
    logger.info('Update notifier temporarily disabled');
  }

  setupProgram() {
    this.program
      .name('mdsaad')
      .description(packageJson.description)
      .version(
        packageJson.version,
        '-v, --version',
        i18n.translate('global.version')
      )
      .option(
        '-l, --lang <language>',
        i18n.translate('global.language'),
        config.get('language', 'en')
      )
      .option('--verbose', i18n.translate('global.verbose'), false)
      .option('--debug', i18n.translate('global.debug'), false)
      .helpOption('-h, --help', i18n.translate('global.help'));
  }

  registerCommands() {
    // Calculate command
    this.program
      .command('calculate <expression>')
      .alias('calc')
      .description(i18n.translate('commands.calculate.description'))
      .option(
        '-p, --precision <number>',
        i18n.translate('commands.calculate.precision'),
        '4'
      )
      .option(
        '-v, --verbose',
        i18n.translate('commands.calculate.verbose'),
        false
      )
      .action(async (expression, options) => {
        await this.executeCommand(calculateCommand, expression, options);
      });

    // AI command
    this.program
      .command('ai <prompt>')
      .description(i18n.translate('commands.ai.description'))
      .option('-m, --model <model>', i18n.translate('commands.ai.model'))
      .option('-s, --stream', i18n.translate('commands.ai.stream'), false)
      .option(
        '-t, --temperature <number>',
        i18n.translate('commands.ai.temperature'),
        '0.7'
      )
      .option(
        '--max-tokens <number>',
        i18n.translate('commands.ai.maxTokens'),
        '1000'
      )
      .option('-c, --context <context>', i18n.translate('commands.ai.context'))
      .action(async (prompt, options) => {
        await this.executeCommand(aiCommand, prompt, options);
      });

    // API command
    this.program
      .command('api <action>')
      .description('Manage API providers and view statistics')
      .option('-p, --provider <name>', 'Provider name for operations')
      .action(async (action, options) => {
        await this.executeCommand(apiCommand, action, options);
      });

    // Show command
    this.program
      .command('show <artName>')
      .description(i18n.translate('commands.show.description'))
      .option('-a, --animated', i18n.translate('commands.show.animated'), false)
      .option(
        '--animation <type>',
        'Animation type (typewriter, fadein, slidein, matrix, pulse, wave)',
        'typewriter'
      )
      .option(
        '-c, --color <color>',
        i18n.translate('commands.show.color'),
        'default'
      )
      .option(
        '--color-scheme <scheme>',
        'Color scheme (default, rainbow, fire, ocean, forest, sunset, monochrome)',
        'default'
      )
      .option('-w, --width <number>', i18n.translate('commands.show.width'))
      .option(
        '--speed <milliseconds>',
        'Animation speed in milliseconds',
        '100'
      )
      .option(
        '--direction <dir>',
        'Slide direction (left, right, up, down)',
        'right'
      )
      .option(
        '--category <name>',
        'Filter by category (superheroes, logos, animals)'
      )
      .option('--query <text>', 'Search query for finding art')
      .option('--limit <number>', 'Limit search results', '10')
      .action(async (artName, options) => {
        await this.executeCommand(showCommand, artName, options);
      });

    // Weather command
    this.program
      .command('weather [location]')
      .description(i18n.translate('commands.weather.description'))
      .option(
        '-d, --detailed',
        i18n.translate('commands.weather.detailed'),
        false
      )
      .option(
        '-f, --forecast',
        'Show weather forecast instead of current conditions',
        false
      )
      .option('--days <number>', 'Number of forecast days (1-10)', '5')
      .option(
        '-u, --units <units>',
        i18n.translate('commands.weather.units'),
        'metric'
      )
      .option('--alerts', i18n.translate('commands.weather.alerts'), false)
      .option('--lang <language>', 'Language for weather descriptions', 'en')
      .action(async (location, options) => {
        await this.executeCommand(weatherCommand, location, options);
      });

    // Convert command
    this.program
      .command('convert [amount] [from] [to]')
      .alias('conv')
      .description(
        'Convert between currencies and units (length, weight, temperature)'
      )
      .option('-v, --verbose', 'Show detailed conversion information')
      .option(
        '-h, --historical [date]',
        'Use historical exchange rates (YYYY-MM-DD)'
      )
      .option('-r, --rates', 'Show current exchange rates')
      .option('-f, --favorites', 'Show favorite conversion pairs')
      .option('-a, --add-favorite', 'Add this conversion to favorites')
      .option('-b, --batch <file>', 'Process batch conversions from file')
      .action(async (amount, from, to, options) => {
        await this.executeCommand(convertCommand, amount, from, to, options);
      });

    // Language command
    this.program
      .command('language')
      .alias('lang')
      .description('Manage interface language')
      .option('-l, --list', 'List available languages')
      .option('-c, --current', 'Show current language')
      .option('-s, --set <code>', 'Set language by code')
      .action(async options => {
        const LanguageCommand = require('./commands/language');
        const cmd = new LanguageCommand();
        await cmd.execute(options);
      });

    // Enhanced command for UX features
    this.program
      .command('enhanced <action>')
      .description('Enhanced UX features and configuration')
      .option('--list', 'List available options')
      .option('--set <value>', 'Set a value')
      .option('--create <name>', 'Create new item')
      .option('--install', 'Install feature')
      .option('--generate', 'Generate scripts')
      .option('--test <input>', 'Test functionality')
      .option('--export <file>', 'Export to file')
      .option('--import <file>', 'Import from file')
      .option('--reset [component]', 'Reset to defaults')
      .option('--all', 'Apply to all items')
      .option('--formatting', 'Text formatting demo')
      .option('--tables', 'Table formatting demo')
      .option('--colors', 'Color theme demo')
      .option('--progress', 'Progress indicator demo')
      .option('--include-keys', 'Include API keys in export')
      .option('--overwrite', 'Overwrite existing configuration')
      .action(async (action, options) => {
        const enhancedCommand = require('./commands/enhanced');
        await this.executeCommand(enhancedCommand, action, options);
      });

    // Debug command
    this.program.addCommand(debugCommand);

    // Diagnose command
    this.program
      .command('diagnose')
      .description('Run installation diagnostics and troubleshooting for PATH issues')
      .option('--verbose', 'Show detailed diagnostic information')
      .action(async (options) => {
        await this.executeCommand(diagnoseCommand, options);
      });

    // Plugin command
    this.program.addCommand(pluginCommand);

    // Update command
    const updateCommand = new UpdateCommand();
    updateCommand.configure(this.program);

    // Maintenance command
    const maintenanceCommand = new MaintenanceCommand();
    maintenanceCommand.configure(this.program);

    // Platform command
    this.program
      .command('platform')
      .description('Cross-platform compatibility and installation tools')
      .option('--info', 'Show detailed platform and system information')
      .option('--install [manager]', 'Show installation methods and status')
      .option(
        '--setup-completion [shell]',
        'Set up tab completion for specified shell'
      )
      .option(
        '--uninstall-completion [shell]',
        'Remove tab completion for specified shell'
      )
      .option(
        '--check-completion [shell]',
        'Check tab completion installation status'
      )
      .option(
        '--troubleshoot',
        'Run installation diagnostics and troubleshooting'
      )
      .option(
        '--shell <shell>',
        'Specify shell for completion (bash, zsh, fish, powershell)'
      )
      .option('--force', 'Force reinstallation of tab completion')
      .action(async options => {
        const platformCommand = new CrossPlatformCommand();
        await this.executeCommand(platformCommand, [], options);
      });

    // Performance command
    this.program
      .command('performance')
      .alias('perf')
      .description('Performance monitoring, optimization, and diagnostics')
      .argument(
        '<action>',
        'Action to perform (monitor, report, optimize, startup, memory, cache, gc, benchmark, status)'
      )
      .option('-v, --verbose', 'Show detailed information')
      .option('-f, --format <format>', 'Output format (table, json)', 'table')
      .option('-o, --output <file>', 'Save output to file')
      .option('-w, --watch', 'Enable watch mode for monitoring')
      .option(
        '-d, --duration <seconds>',
        'Monitoring duration in seconds',
        '10'
      )
      .option('-t, --threshold <number>', 'Performance threshold')
      .action(async (action, options) => {
        const performanceCommand = new PerformanceCommand();
        await this.executeCommand(performanceCommand, [action], options);
      });

    // Security command
    this.program
      .command('security')
      .alias('sec')
      .description('Security management, validation, and monitoring')
      .argument(
        '<action>',
        'Action to perform (status, audit, report, keys, validate, cleanup)'
      )
      .option('-v, --verbose', 'Show detailed information')
      .option('-f, --format <format>', 'Output format (table, json)', 'table')
      .option(
        '-t, --type <type>',
        'Validation type (email, url, apiKey, expression, cityName, currencyCode)'
      )
      .option('-k, --key <key>', 'API key for management operations')
      .option('-s, --service <service>', 'Service name for key operations')
      .option('--validate <input>', 'Input to validate')
      .option('--detailed', 'Show detailed audit information')
      .option('--force', 'Force operation without confirmation')
      .action(async (action, options) => {
        const securityCommand = new SecurityCommand();
        await this.executeCommand(securityCommand, [action], options);
      });

    // Config command
    this.program
      .command('config')
      .alias('cfg')
      .description('Configure API keys and settings securely')
      .argument(
        '<action>',
        'Action to perform (setup, show, set, remove, help)'
      )
      .option('-s, --service <service>', 'Service name for set operation')
      .option('-k, --key <key>', 'API key for set operation')
      .action(async (action, options) => {
        const configCommand = new ConfigCommand();
        const args = [action];
        if (options.service) args.push(options.service);
        if (options.key) args.push(options.key);
        await this.executeCommand(configCommand, args);
      });

    // Version command
    this.program
      .command('version')
      .description(i18n.translate('commands.version.description'))
      .action(() => {
        console.log(chalk.cyan(`${packageJson.name} v${packageJson.version}`));
      });
  }

  /**
   * Register plugin commands with Commander.js
   */
  registerPluginCommands() {
    const pluginCommands = pluginManager.loadedCommands;

    for (const [commandName, commandInfo] of pluginCommands) {
      this.program
        .command(commandName)
        .description(`Plugin command from ${commandInfo.plugin}`)
        .allowUnknownOption() // Allow plugins to handle their own options
        .action(async (...args) => {
          try {
            // Extract options and command arguments
            const options = args[args.length - 1]; // Commander passes options as last argument
            const commandArgs = args.slice(0, -1);

            // Execute the plugin command
            await commandInfo.handler(
              commandArgs,
              options.opts ? options.opts() : {}
            );
          } catch (error) {
            console.error(
              chalk.red('❌ Plugin command failed:'),
              error.message
            );
          }
        });
    }

    logger.info(`Registered ${pluginCommands.size} plugin commands`);
  }

  setupGlobalMiddleware() {
    // Handle global options before command execution
    this.program.hook('preAction', async thisCommand => {
      const options = thisCommand.opts();

      // Security validation for command-line arguments
      try {
        // Rate limiting check for user commands
        const userId = process.env.USER || process.env.USERNAME || 'anonymous';
        this.inputValidator.checkRateLimit(userId, 100, 60000); // 100 requests per minute

        // Validate command name
        const commandName = thisCommand.name();
        if (commandName && commandName !== 'help') {
          this.inputValidator.validate(commandName, 'command');
        }
      } catch (error) {
        if (error.message.includes('Rate limit exceeded')) {
          console.error(
            chalk.red(
              '❌ Rate limit exceeded. Please wait before making more requests.'
            )
          );
          process.exit(1);
        }
        // Log but don't block for other security validation errors
        logger.warn('Security validation warning:', error.message);
      }

      // Set language
      if (options.lang && options.lang !== config.get('language')) {
        i18n.setLanguage(options.lang);
        config.set('language', options.lang);
      }

      // Set logging levels
      if (options.verbose) {
        logger.setLevel('verbose');
      }

      if (options.debug) {
        logger.setLevel('debug');
      }
    });

    // Handle errors globally
    this.program.configureOutput({
      outputError: (str, write) => {
        write(chalk.red('❌ ' + str));
      },
    });
  }

  async executeCommand(commandModule, ...args) {
    try {
      if (!this.isInitialized) {
        throw new Error('CLI application not initialized');
      }

      // Start performance measurement for command execution
      const commandName = commandModule.name || 'unknown';
      performanceService.markStart(`command-${commandName}`);

      // Security validation for command arguments
      try {
        // Validate and sanitize command arguments
        const validatedArgs = args.map((arg, index) => {
          if (typeof arg === 'string') {
            // Basic input validation for string arguments
            if (arg.length > 10000) {
              throw new Error(
                `Argument ${index + 1} is too long (max 10,000 characters)`
              );
            }

            // Sanitize potentially dangerous content
            return this.inputValidator.sanitize(arg, 'text');
          }
          return arg;
        });

        // Replace original args with validated ones
        args = validatedArgs;
      } catch (securityError) {
        logger.warn(
          'Security validation failed for command arguments:',
          securityError.message
        );
        throw new Error(`Security validation failed: ${securityError.message}`);
      }

      // Load deferred plugins if this command might need them
      if (this.deferredPluginLoader && !this.deferredPluginLoader.isLoaded()) {
        try {
          await this.deferredPluginLoader.load();
          this.registerPluginCommands();
        } catch (error) {
          logger.warn('Failed to load deferred plugins:', error.message);
        }
      }

      // Execute the command with resource management and security context
      const result = await resourceManager.manageOperation(async () => {
        // Add security context to command execution
        const securityContext = {
          validator: this.inputValidator,
          securityManager: this.securityManager,
          networkSecurity: this.networkSecurity,
        };

        // If the command module has a setSecurity method, provide security services
        if (typeof commandModule.setSecurity === 'function') {
          commandModule.setSecurity(securityContext);
        }

        return await commandModule.execute(...args);
      });

      // End performance measurement
      performanceService.markEnd(`command-${commandName}`);

      // Log performance metrics in debug mode
      if (logger.getLevel() === 'debug') {
        const measurement = performanceService.getMeasurement(
          `command-${commandName}`
        );
        if (measurement) {
          logger.debug(
            `Command '${commandName}' executed in ${measurement.duration.toFixed(2)}ms`
          );
        }
      }

      return result;
    } catch (error) {
      logger.error('Command execution failed:', error);

      const errorMessage = i18n.translate('errors.command_failed', {
        error: error.message,
      });

      console.error(chalk.red('❌ ' + errorMessage));

      if (logger.getLevel() === 'debug') {
        console.error(chalk.gray(error.stack));
      }

      process.exit(1);
    }
  }

  async run() {
    try {
      await this.initialize();
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('❌ Fatal error:'), error.message);

      if (process.env.NODE_ENV === 'development') {
        console.error(error.stack);
      }

      process.exit(1);
    }
  }
}

// Export for testing
module.exports = CLIApplication;

// Run if called directly
if (require.main === module) {
  const app = new CLIApplication();
  app.run();
}
