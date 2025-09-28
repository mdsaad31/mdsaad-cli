/**
 * Help System Service
 * Provides comprehensive help with examples and interactive guidance
 */

const outputFormatter = require('./output-formatter');
const chalk = require('chalk');
const i18nService = require('./i18n');

class HelpSystem {
  constructor() {
    this.commands = new Map();
    this.globalOptions = new Map();
    this.examples = new Map();
    this.tutorials = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize the help system
   */
  initialize() {
    try {
      this.loadDefaultTutorials();
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('HelpSystem initialization warning:', error.message);
      this.isInitialized = true;
      return false;
    }
  }

  /**
   * Load default tutorials
   */
  loadDefaultTutorials() {
    this.addTutorial('getting-started', {
      title: '🚀 Getting Started with MDSAAD CLI',
      description: 'Learn the basics of using the MDSAAD command-line tool',
      steps: [
        'Run `mdsaad --help` to see all available commands',
        'Try `mdsaad weather` to get current weather information',
        'Use `mdsaad calculate "2+2"` for mathematical calculations',
        'Explore `mdsaad ai "Hello"` for AI interactions',
      ],
    });
  }

  /**
   * Register a command with help information
   */
  registerCommand(name, config) {
    this.commands.set(name, {
      name,
      description: config.description || '',
      usage: config.usage || '',
      options: config.options || [],
      examples: config.examples || [],
      aliases: config.aliases || [],
      category: config.category || 'General',
      ...config,
    });
  }

  /**
   * Register global options that apply to all commands
   */
  registerGlobalOption(name, config) {
    this.globalOptions.set(name, config);
  }

  /**
   * Add examples for a command
   */
  addExamples(commandName, examples) {
    if (this.examples.has(commandName)) {
      this.examples.get(commandName).push(...examples);
    } else {
      this.examples.set(commandName, examples);
    }
  }

  /**
   * Show general help
   */
  showGeneralHelp() {
    outputFormatter.clear();

    // Main header
    outputFormatter.header(
      'MDSAAD CLI Tool',
      'Your comprehensive command-line companion v1.0.0'
    );

    // Quick start
    outputFormatter.helpSection('Quick Start', [
      'mdsaad calculate "2 + 3 * 4"       # Mathematical calculations',
      'mdsaad ai "What is quantum physics?" # AI-powered assistance',
      'mdsaad weather "New York"           # Weather information',
      'mdsaad convert 100 USD EUR          # Currency conversion',
      'mdsaad show "Hello World"           # ASCII art display',
    ]);

    // Commands by category
    this.showCommandsByCategory();

    // Global options
    outputFormatter.helpSection(
      'Global Options',
      Array.from(this.globalOptions.entries()).map(
        ([name, config]) => `${name.padEnd(20)} ${config.description}`
      )
    );

    // Getting more help
    outputFormatter.helpSection('Getting More Help', [
      'mdsaad <command> --help     # Help for specific command',
      'mdsaad help <command>       # Detailed command help',
      'mdsaad help examples        # Show all examples',
      'mdsaad help tutorials       # Interactive tutorials',
    ]);

    console.log(
      chalk.gray(
        '💡 Pro tip: Use --verbose with any command for detailed output'
      )
    );
    console.log();
  }

  /**
   * Show commands organized by category
   */
  showCommandsByCategory() {
    const categories = new Map();

    // Group commands by category
    for (const [name, command] of this.commands) {
      const category = command.category;
      if (!categories.has(category)) {
        categories.set(category, []);
      }
      categories.get(category).push(command);
    }

    // Display each category
    for (const [category, commands] of categories) {
      const commandList = commands.map(
        cmd => `${cmd.name.padEnd(12)} ${cmd.description}`
      );
      outputFormatter.helpSection(category, commandList);
    }
  }

  /**
   * Show detailed help for a specific command
   */
  showCommandHelp(commandName) {
    const command = this.commands.get(commandName);
    if (!command) {
      outputFormatter.error(`Unknown command: ${commandName}`, null, [
        'Use "mdsaad help" to see all available commands',
        'Check spelling and try again',
      ]);
      return;
    }

    outputFormatter.header(`${command.name} Command`, command.description);

    // Usage
    if (command.usage) {
      outputFormatter.helpSection('Usage', command.usage);
    }

    // Options
    if (command.options && command.options.length > 0) {
      const optionsList = command.options.map(
        opt => `${opt.flags.padEnd(25)} ${opt.description}`
      );
      outputFormatter.helpSection('Options', optionsList);
    }

    // Examples
    const examples = this.examples.get(commandName) || command.examples || [];
    if (examples.length > 0) {
      outputFormatter.examples(examples);
    }

    // Aliases
    if (command.aliases && command.aliases.length > 0) {
      outputFormatter.helpSection('Aliases', command.aliases.join(', '));
    }

    // Related commands
    this.showRelatedCommands(command.category, commandName);
  }

  /**
   * Show related commands in the same category
   */
  showRelatedCommands(category, excludeCommand) {
    const related = [];
    for (const [name, command] of this.commands) {
      if (command.category === category && name !== excludeCommand) {
        related.push(`${name} - ${command.description}`);
      }
    }

    if (related.length > 0) {
      outputFormatter.helpSection('Related Commands', related.slice(0, 3));
    }
  }

  /**
   * Show all examples
   */
  showAllExamples() {
    outputFormatter.header(
      'Command Examples',
      'Real-world usage examples for all commands'
    );

    for (const [commandName, examples] of this.examples) {
      if (examples.length > 0) {
        console.log(chalk.cyan(`\n${commandName.toUpperCase()} Examples:`));
        outputFormatter.examples(examples);
      }
    }
  }

  /**
   * Interactive tutorial system
   */
  showTutorials() {
    outputFormatter.header(
      'Interactive Tutorials',
      'Step-by-step guides to get you started'
    );

    const tutorials = [
      {
        name: 'Getting Started',
        description: 'Basic CLI usage and navigation',
        steps: 5,
        duration: '5 min',
      },
      {
        name: 'Mathematical Calculations',
        description: 'Using the calculate command effectively',
        steps: 8,
        duration: '10 min',
      },
      {
        name: 'AI Interactions',
        description: 'Getting the most out of AI features',
        steps: 6,
        duration: '8 min',
      },
      {
        name: 'Weather & Conversions',
        description: 'Weather info and unit conversions',
        steps: 7,
        duration: '10 min',
      },
    ];

    outputFormatter.table(
      tutorials.map(t => [
        t.name,
        t.description,
        `${t.steps} steps`,
        t.duration,
      ]),
      {
        head: ['Tutorial', 'Description', 'Steps', 'Duration'],
        colWidths: [20, 35, 12, 12],
      }
    );

    console.log(
      chalk.gray('\n💡 Run "mdsaad tutorial <name>" to start a tutorial')
    );
  }

  /**
   * Smart help suggestions based on user input
   */
  suggestHelp(input) {
    const suggestions = [];

    // Find similar command names
    for (const [name, command] of this.commands) {
      if (
        name.includes(input.toLowerCase()) ||
        input.toLowerCase().includes(name)
      ) {
        suggestions.push({
          type: 'command',
          name: name,
          description: command.description,
          similarity: this.calculateSimilarity(input, name),
        });
      }
    }

    // Find similar aliases
    for (const [name, command] of this.commands) {
      for (const alias of command.aliases || []) {
        if (
          alias.includes(input.toLowerCase()) ||
          input.toLowerCase().includes(alias)
        ) {
          suggestions.push({
            type: 'alias',
            name: `${alias} (${name})`,
            description: command.description,
            similarity: this.calculateSimilarity(input, alias),
          });
        }
      }
    }

    // Sort by similarity
    suggestions.sort((a, b) => b.similarity - a.similarity);

    if (suggestions.length > 0) {
      outputFormatter.completions(suggestions.slice(0, 5), input);
    } else {
      outputFormatter.info(
        'No similar commands found',
        'Use "mdsaad help" to see all available commands'
      );
    }
  }

  /**
   * Calculate string similarity (simple Levenshtein-like)
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    if (len1 === 0) return len2;
    if (len2 === 0) return len1;

    const matrix = Array(len2 + 1)
      .fill(null)
      .map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; ++i) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= len2; ++j) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= len2; ++j) {
      for (let i = 1; i <= len1; ++i) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return 1 - matrix[len2][len1] / Math.max(len1, len2);
  }

  /**
   * Context-aware help for specific scenarios
   */
  showContextualHelp(context) {
    switch (context) {
      case 'first-time':
        this.showFirstTimeUserHelp();
        break;
      case 'error-recovery':
        this.showErrorRecoveryHelp();
        break;
      case 'advanced':
        this.showAdvancedFeatures();
        break;
      default:
        this.showGeneralHelp();
    }
  }

  /**
   * Help for first-time users
   */
  showFirstTimeUserHelp() {
    outputFormatter.header('Welcome to MDSAAD!', "Let's get you started");

    outputFormatter.box(
      '🎯 Start with these essential commands:\n\n' +
        '1. mdsaad calculate "2 + 3"     - Try basic math\n' +
        '2. mdsaad weather               - Get local weather\n' +
        '3. mdsaad ai "Hello"            - Chat with AI\n' +
        '4. mdsaad convert 10 USD EUR    - Convert currency\n' +
        '5. mdsaad show "Welcome"        - Display ASCII art',
      { borderColor: 'green', padding: 1 }
    );

    outputFormatter.info(
      'Configuration',
      'Run "mdsaad config" to set up API keys for enhanced features'
    );
  }

  /**
   * Help for error recovery
   */
  showErrorRecoveryHelp() {
    outputFormatter.header('Troubleshooting', 'Common issues and solutions');

    const troubleshooting = [
      {
        problem: 'Command not found',
        solution: 'Check spelling with "mdsaad help" or use tab completion',
      },
      {
        problem: 'API errors',
        solution:
          'Verify API keys with "mdsaad config" or check network connection',
      },
      {
        problem: 'Calculation errors',
        solution: 'Check syntax with "mdsaad calculate help" for examples',
      },
      {
        problem: 'Permission errors',
        solution:
          'Ensure proper file permissions or run with appropriate privileges',
      },
    ];

    outputFormatter.table(
      troubleshooting.map(t => [t.problem, t.solution]),
      {
        head: ['Problem', 'Solution'],
        colWidths: [25, 50],
      }
    );
  }

  /**
   * Advanced features help
   */
  showAdvancedFeatures() {
    outputFormatter.header('Advanced Features', 'Power user capabilities');

    outputFormatter.helpSection('Debugging & Verbose Output', [
      '--verbose flag for detailed information',
      '--debug flag for troubleshooting',
      'Environment variables for configuration',
    ]);

    outputFormatter.helpSection('Automation & Scripting', [
      'Batch file processing with --batch',
      'JSON output formats for scripting',
      'Exit codes for script integration',
    ]);

    outputFormatter.helpSection('Customization', [
      'Language settings with --lang',
      'Custom themes and colors',
      'Keyboard shortcuts and aliases',
    ]);
  }

  /**
   * Initialize help system with default commands
   */
  initialize() {
    // Register global options
    this.registerGlobalOption('--verbose, -v', {
      description: 'Show detailed output and debug information',
    });

    this.registerGlobalOption('--lang <code>', {
      description: 'Set interface language (en, es, fr, de, etc.)',
    });

    this.registerGlobalOption('--debug', {
      description: 'Enable debug mode for troubleshooting',
    });

    // Register commands will be done by individual command modules
    console.log('Help system initialized');
  }
}

module.exports = new HelpSystem();
