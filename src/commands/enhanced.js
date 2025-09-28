/**
 * Enhanced Command
 * Manages enhanced UX features like formatting, themes, and configuration
 */

const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const outputFormatter = require('../services/output-formatter');
const configManager = require('../services/config-manager');
const helpSystem = require('../services/help-system');
const tabCompletion = require('../services/tab-completion');

class EnhancedCommand {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Execute the enhanced command
   */
  async execute(action, options = {}) {
    try {
      // Initialize services if needed
      if (!this.isInitialized) {
        await this.initialize();
      }

      switch (action?.toLowerCase()) {
        case 'setup':
          await this.setupEnhancements();
          break;

        case 'theme':
          await this.manageTheme(options);
          break;

        case 'completion':
          await this.manageCompletion(options);
          break;

        case 'config':
          await this.manageConfig(options);
          break;

        case 'demo':
          await this.showDemo(options);
          break;

        case 'status':
          await this.showStatus();
          break;

        case 'help':
        default:
          this.showHelp();
          break;
      }

    } catch (error) {
      console.error(outputFormatter.error('Enhanced command failed:', error.message));
      if (options.debug) {
        console.error(chalk.gray(error.stack));
      }
    }
  }

  /**
   * Initialize enhanced services
   */
  async initialize() {
    try {
      await configManager.initialize();
      outputFormatter.initialize();
      helpSystem.initialize();
      tabCompletion.initialize();
      
      this.isInitialized = true;
      console.log(outputFormatter.success('Enhanced services initialized'));
    } catch (error) {
      console.warn(outputFormatter.warning('Some enhanced services failed to initialize:', error.message));
    }
  }

  /**
   * Setup all enhancements
   */
  async setupEnhancements() {
    console.log(outputFormatter.header('🚀 Setting up Enhanced Features'));
    
    const steps = [
      { name: 'Configuration System', action: () => configManager.initialize() },
      { name: 'Output Formatter', action: () => outputFormatter.initialize() },
      { name: 'Help System', action: () => helpSystem.initialize() },
      { name: 'Tab Completion', action: () => tabCompletion.initialize() },
      { name: 'Shell Completions', action: () => tabCompletion.installCompletions() }
    ];

    console.log(outputFormatter.info('Setting up enhanced features...'));
    console.log();

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      try {
        console.log(outputFormatter.progressBar(i / steps.length, `Setting up ${step.name}...`));
        await step.action();
        console.log(outputFormatter.success(`✅ ${step.name} - Complete`));
      } catch (error) {
        console.log(outputFormatter.error(`❌ ${step.name} - Failed: ${error.message}`));
      }
    }

    console.log();
    console.log(outputFormatter.progressBar(1, 'Setup Complete!'));
    console.log();
    console.log(outputFormatter.success('🎉 Enhanced features are now ready!'));
    
    // Show next steps
    console.log();
    console.log(outputFormatter.info('Next steps:'));
    console.log('  • Restart your shell to activate tab completion');
    console.log('  • Run `mdsaad enhanced demo` to see the new features');
    console.log('  • Use `mdsaad enhanced config` to customize settings');
  }

  /**
   * Manage themes
   */
  async manageTheme(options) {
    if (options.list) {
      await this.listThemes();
    } else if (options.set) {
      await this.setTheme(options.set);
    } else if (options.create) {
      await this.createTheme(options.create, options);
    } else {
      await this.showCurrentTheme();
    }
  }

  /**
   * List available themes
   */
  async listThemes() {
    console.log(outputFormatter.header('🎨 Available Themes'));
    
    const themes = [
      { name: 'default', description: 'Clean and minimal design' },
      { name: 'dark', description: 'Dark mode with blue accents' },
      { name: 'light', description: 'Light mode with warm colors' },
      { name: 'rainbow', description: 'Colorful gradient themes' },
      { name: 'matrix', description: 'Green on black terminal style' },
      { name: 'ocean', description: 'Blue and cyan ocean theme' },
      { name: 'sunset', description: 'Orange and red sunset theme' }
    ];

    const currentTheme = configManager.get('display.theme', 'default');
    
    const themeData = themes.map(theme => [
      theme.name === currentTheme ? `${theme.name} ⭐` : theme.name,
      theme.description
    ]);

    console.log(outputFormatter.formatTable('Themes', themeData, {
      headers: ['Theme', 'Description'],
      colors: { header: 'cyan', border: 'gray' }
    }));

    console.log();
    console.log(outputFormatter.info('Use `mdsaad enhanced theme --set <name>` to change themes'));
  }

  /**
   * Set theme
   */
  async setTheme(themeName) {
    const validThemes = ['default', 'dark', 'light', 'rainbow', 'matrix', 'ocean', 'sunset'];
    
    if (!validThemes.includes(themeName)) {
      console.log(outputFormatter.error(`Invalid theme: ${themeName}`));
      console.log(outputFormatter.info('Valid themes: ' + validThemes.join(', ')));
      return;
    }

    await configManager.set('display.theme', themeName);
    console.log(outputFormatter.success(`Theme changed to: ${themeName}`));
    
    // Show theme preview
    console.log();
    console.log(outputFormatter.info('Theme preview:'));
    this.showThemePreview(themeName);
  }

  /**
   * Show theme preview
   */
  showThemePreview(themeName) {
    switch (themeName) {
      case 'dark':
        console.log(chalk.bgBlack.white(' Dark Theme ') + chalk.blue(' with blue accents'));
        break;
      case 'light':
        console.log(chalk.bgWhite.black(' Light Theme ') + chalk.yellow(' with warm colors'));
        break;
      case 'rainbow':
        console.log(outputFormatter.rainbow(' Rainbow Theme with gradients '));
        break;
      case 'matrix':
        console.log(chalk.bgBlack.green(' Matrix Theme ') + chalk.green(' green terminal style'));
        break;
      case 'ocean':
        console.log(chalk.bgBlue.white(' Ocean Theme ') + chalk.cyan(' blue and cyan colors'));
        break;
      case 'sunset':
        console.log(chalk.bgRed.white(' Sunset Theme ') + chalk.yellow(' orange and red colors'));
        break;
      default:
        console.log(chalk.gray(' Default Theme ') + ' clean and minimal');
    }
  }

  /**
   * Manage tab completion
   */
  async manageCompletion(options) {
    if (options.install) {
      await tabCompletion.installCompletions();
    } else if (options.generate) {
      const script = tabCompletion.generateBashCompletion();
      console.log(script);
    } else if (options.test) {
      await this.testCompletion(options.test);
    } else {
      console.log(outputFormatter.info('Tab completion management'));
      console.log('  --install     Install completions for current shell');
      console.log('  --generate    Generate completion script');
      console.log('  --test <cmd>  Test completions for command');
    }
  }

  /**
   * Test tab completion
   */
  async testCompletion(input) {
    const completions = tabCompletion.getCompletions(input);
    
    console.log(outputFormatter.header(`Testing completions for: "${input}"`));
    console.log();
    
    if (completions.suggestions.length === 0) {
      console.log(outputFormatter.warning('No completions found'));
      return;
    }

    console.log(outputFormatter.info(`Found ${completions.suggestions.length} ${completions.type} completions:`));
    console.log();
    
    completions.suggestions.forEach(suggestion => {
      console.log(`  ${chalk.green('•')} ${suggestion}`);
    });
  }

  /**
   * Manage configuration
   */
  async manageConfig(options) {
    if (options.export) {
      const data = await configManager.exportConfig(options.export, options.includeKeys);
      console.log(outputFormatter.success(`Configuration exported to: ${options.export}`));
    } else if (options.import) {
      await configManager.importConfig(options.import, options.overwrite);
      console.log(outputFormatter.success(`Configuration imported from: ${options.import}`));
    } else if (options.reset) {
      await configManager.reset(options.reset);
      console.log(outputFormatter.success('Configuration reset complete'));
    } else {
      const summary = configManager.getSummary();
      console.log(outputFormatter.formatObject('Configuration Summary', summary));
    }
  }

  /**
   * Show feature demonstrations
   */
  async showDemo(options) {
    console.log(outputFormatter.header('🎭 Enhanced Features Demo'));
    
    if (options.all || options.formatting) {
      await this.demoFormatting();
    }

    if (options.all || options.tables) {
      await this.demoTables();
    }

    if (options.all || options.progress) {
      await this.demoProgress();
    }

    if (options.all || options.colors) {
      await this.demoColors();
    }

    if (options.all || !options.formatting && !options.tables && !options.progress && !options.colors) {
      await this.demoAll();
    }
  }

  /**
   * Demo formatting features
   */
  async demoFormatting() {
    outputFormatter.subheader('📝 Text Formatting');
    
    console.log(outputFormatter.success('Success messages look like this'));
    console.log(outputFormatter.error('Error messages look like this'));
    console.log(outputFormatter.warning('Warning messages look like this'));
    console.log(outputFormatter.info('Info messages look like this'));
    console.log(outputFormatter.highlight('Highlighted text', 'important'));
    console.log();
  }

  /**
   * Demo table features
   */
  async demoTables() {
    outputFormatter.subheader('📊 Table Formatting');
    
    const sampleData = [
      ['USD', '1.0000', '+0.00%'],
      ['EUR', '0.8501', '+0.15%'],
      ['GBP', '0.7633', '-0.08%'],
      ['JPY', '149.80', '+0.25%']
    ];

    console.log(outputFormatter.formatTable('Exchange Rates', sampleData, {
      headers: ['Currency', 'Rate', 'Change']
    }));
    console.log();
  }

  /**
   * Demo progress features
   */
  async demoProgress() {
    console.log(outputFormatter.subheader('⏳ Progress Indicators'));
    console.log();
    
    for (let i = 0; i <= 10; i++) {
      const progress = i / 10;
      console.log(outputFormatter.progressBar(progress, `Step ${i + 1}/11`));
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    console.log();
  }

  /**
   * Demo color features
   */
  async demoColors() {
    console.log(outputFormatter.subheader('🌈 Color Themes'));
    console.log();
    
    console.log(outputFormatter.rainbow('Rainbow gradient text'));
    console.log(outputFormatter.code('const example = "syntax highlighted code";', 'javascript'));
    console.log();
  }

  /**
   * Demo all features
   */
  async demoAll() {
    await this.demoFormatting();
    await this.demoTables();
    await this.demoColors();
    console.log(outputFormatter.success('🎉 Demo complete! Enhanced features are ready to use.'));
  }

  /**
   * Show service status
   */
  async showStatus() {
    console.log(outputFormatter.header('🔍 Enhanced Services Status'));
    
    const services = [
      { name: 'Configuration Manager', status: this.isInitialized ? 'Active' : 'Inactive' },
      { name: 'Output Formatter', status: 'Active' },
      { name: 'Help System', status: 'Active' },
      { name: 'Tab Completion', status: 'Active' }
    ];

    const statusData = services.map(service => [
      service.name,
      service.status === 'Active' ? 
        outputFormatter.success('✅ ' + service.status) : 
        outputFormatter.error('❌ ' + service.status)
    ]);

    console.log(outputFormatter.formatTable('Service Status', statusData));
    console.log();

    // Show configuration summary
    const summary = configManager.getSummary();
    console.log(outputFormatter.formatObject('Configuration', summary));
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(outputFormatter.header('🔧 Enhanced Features Help'));
    console.log();
    
    console.log(outputFormatter.info('Available actions:'));
    console.log('  setup         Set up all enhanced features');
    console.log('  theme         Manage visual themes');
    console.log('  completion    Manage tab completion');
    console.log('  config        Manage configuration');
    console.log('  demo          Show feature demonstrations');
    console.log('  status        Show service status');
    console.log();
    
    console.log(outputFormatter.info('Theme options:'));
    console.log('  --list        List available themes');
    console.log('  --set <name>  Set active theme');
    console.log();
    
    console.log(outputFormatter.info('Demo options:'));
    console.log('  --all         Show all demos');
    console.log('  --formatting  Show text formatting demo');
    console.log('  --tables      Show table formatting demo');
    console.log('  --colors      Show color theme demo');
    console.log();
    
    console.log(outputFormatter.info('Examples:'));
    console.log('  mdsaad enhanced setup');
    console.log('  mdsaad enhanced theme --list');
    console.log('  mdsaad enhanced demo --all');
    console.log('  mdsaad enhanced config --export backup.json');
  }
}

module.exports = new EnhancedCommand();