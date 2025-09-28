/**
 * Calculate Command
 * Handles mathematical calculations using math.js
 * Supports basic arithmetic, scientific functions, constants, and unit conversions
 */

const { create, all } = require('mathjs');
const chalk = require('chalk');
const i18nService = require('../services/i18n');
const configService = require('../services/config');

class CalculateCommand {
  constructor() {
    // Create math.js instance with full functionality
    this.math = create(all);
    
    // Configure math.js
    this.math.config({
      number: 'BigNumber',
      precision: 64
    });
    
    // Add custom functions
    this.addCustomFunctions();
    
    // History for calculations
    this.history = [];
    
    // Load calculation history from config
    this.loadCalculationHistory();
  }

  /**
   * Add custom mathematical functions
   */
  addCustomFunctions() {
    // Math.js already includes most mathematical constants and functions
    // We'll use the built-in ones to avoid conflicts
    try {
      // Only add constants that don't already exist
      if (!this.math.lightSpeed) {
        this.math.import({ lightSpeed: 299792458 });
      }
    } catch (error) {
      // Silently ignore import errors for existing constants
    }
  }

  /**
   * Execute mathematical calculation
   */
  async execute(expression, options = {}) {
    // Safely get translation function
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    try {
      // Handle special commands
      if (this.handleSpecialCommands(expression, options)) {
        return;
      }

      // Validate expression
      if (!expression || typeof expression !== 'string') {
        console.log(chalk.red(t('calculate.errors.invalidExpression')));
        return;
      }

      // Clean and prepare expression
      const cleanExpression = this.preprocessExpression(expression);
      
      // Evaluate expression
      const startTime = Date.now();
      const result = this.math.evaluate(cleanExpression);
      const executionTime = Date.now() - startTime;

      // Format and display result
      this.displayResult(expression, result, executionTime, options);
      
      // Add to history
      this.addToHistory(expression, result);
      
      // Save to config if enabled
      if (configService.get('calculate.saveHistory', true)) {
        this.saveCalculationHistory();
      }

    } catch (error) {
      this.handleCalculationError(error, expression);
    }
  }

  /**
   * Handle special commands (help, history, constants, etc.)
   */
  handleSpecialCommands(expression, options) {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    switch (expression?.toLowerCase()) {
      case 'help':
      case '?':
        this.showHelp();
        return true;
        
      case 'history':
        this.showHistory();
        return true;
        
      case 'constants':
        this.showConstants();
        return true;
        
      case 'functions':
        this.showFunctions();
        return true;
        
      case 'clear':
        this.clearHistory();
        console.log(chalk.green(t('calculate.history.cleared')));
        return true;
        
      default:
        return false;
    }
  }

  /**
   * Preprocess expression to handle common input formats
   */
  preprocessExpression(expression) {
    let processed = expression
      // Replace common symbols
      .replace(/×/g, '*')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/∞/g, 'Infinity')
      // Handle implicit multiplication
      .replace(/(\d+)\s*\(/g, '$1*(')
      .replace(/\)\s*(\d+)/g, ')*$1')
      .replace(/(\d+)\s*([a-zA-Z])/g, '$1*$2')
      // Handle percentage
      .replace(/(\d+(?:\.\d+)?)%/g, '($1/100)')
      // Handle factorial notation
      .replace(/(\d+)!/g, 'factorial($1)')
      // Remove extra spaces
      .replace(/\s+/g, ' ')
      .trim();
    
    return processed;
  }

  /**
   * Display calculation result with formatting
   */
  displayResult(expression, result, executionTime, options) {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    console.log();
    console.log(chalk.cyan('📝 ') + chalk.bold('Expression') + chalk.cyan(': ') + expression);
    
    // Format result based on type
    let formattedResult;
    if (typeof result === 'object' && result.type) {
      // Handle complex numbers, matrices, etc.
      formattedResult = this.math.format(result, { precision: 14 });
    } else if (typeof result === 'number') {
      formattedResult = this.formatNumber(result, options);
    } else {
      formattedResult = String(result);
    }
    
    console.log(chalk.green('🧮 ') + chalk.bold('Result') + chalk.green(': ') + chalk.yellow(formattedResult));
    
    // Show additional formats if requested
    if (options.format || options.all) {
      this.showAlternativeFormats(result);
    }
    
    // Show execution time for complex calculations
    if (executionTime > 10) {
      console.log(chalk.gray(`⏱️  Execution time: ${executionTime}ms`));
    }
    
    console.log();
  }

  /**
   * Format number with different representations
   */
  formatNumber(num, options = {}) {
    const results = [];
    
    // Decimal (default)
    results.push(`${num}`);
    
    // Scientific notation for very large/small numbers
    if (Math.abs(num) >= 1e6 || (Math.abs(num) < 1e-3 && num !== 0)) {
      results.push(`(${num.toExponential(6)})`);
    }
    
    // Show all formats if requested
    if (options.format === 'all' || options.all) {
      if (Number.isInteger(num) && num >= 0 && num <= Number.MAX_SAFE_INTEGER) {
        // Binary
        results.push(`Binary: ${num.toString(2)}`);
        // Hexadecimal
        results.push(`Hex: 0x${num.toString(16).toUpperCase()}`);
        // Octal
        results.push(`Octal: 0o${num.toString(8)}`);
      }
    }
    
    return results.join(' ');
  }

  /**
   * Show alternative result formats
   */
  showAlternativeFormats(result) {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    if (typeof result === 'number' && Number.isFinite(result)) {
      console.log(chalk.blue(t('calculate.alternativeFormats') + ':'));
      
      if (Number.isInteger(result) && result >= 0) {
        console.log(chalk.gray(`  Binary: ${result.toString(2)}`));
        console.log(chalk.gray(`  Hexadecimal: 0x${result.toString(16).toUpperCase()}`));
        console.log(chalk.gray(`  Octal: 0o${result.toString(8)}`));
      }
      
      console.log(chalk.gray(`  Scientific: ${result.toExponential(6)}`));
      
      if (Math.abs(result) < 1e6) {
        console.log(chalk.gray(`  Fraction: ${this.toFraction(result)}`));
      }
    }
  }

  /**
   * Convert decimal to fraction (simple approximation)
   */
  toFraction(decimal) {
    const tolerance = 1e-6;
    let numerator = 1;
    let denominator = 1;
    let x = decimal;
    
    while (Math.abs(numerator / denominator - decimal) > tolerance && denominator < 10000) {
      if (numerator / denominator < decimal) {
        numerator++;
      } else {
        denominator++;
        numerator = Math.round(decimal * denominator);
      }
    }
    
    return `${numerator}/${denominator}`;
  }

  /**
   * Show help information
   */
  showHelp() {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    console.log(chalk.yellow('🧮 Mathematical Calculator Help'));
    console.log();
    
    console.log(chalk.cyan('Basic Operations:'));
    console.log('  2 + 3 * 4        →  14');
    console.log('  sqrt(16)         →  4');
    console.log('  sin(pi/2)        →  1');
    console.log('  log(10)          →  2.302585093');
    console.log('  2^8              →  256');
    console.log('  5!               →  120');
    console.log();
    
    console.log(chalk.cyan('Available Constants:'));
    console.log('  pi, e, phi, tau');
    console.log('  lightSpeed, gravity, avogadro');
    console.log();
    
    console.log(chalk.cyan('Available Functions:'));
    console.log('  sin, cos, tan, asin, acos, atan');
    console.log('  sqrt, cbrt, pow, exp, log, ln');
    console.log('  abs, round, ceil, floor, factorial');
    console.log();
    
    console.log(chalk.cyan('Special Commands:'));
    console.log('  help             →  Show this help message');
    console.log('  history          →  Show calculation history');
    console.log('  constants        →  Show all constants');
    console.log('  functions        →  Show all functions');
    console.log('  clear            →  Clear calculation history');
  }

  /**
   * Show calculation history
   */
  showHistory() {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    if (this.history.length === 0) {
      console.log(chalk.yellow('No calculations in history yet'));
      return;
    }
    
    console.log(chalk.yellow('📊 Calculation History'));
    console.log();
    
    this.history.slice(-10).forEach((entry, index) => {
      const number = this.history.length - 9 + index;
      console.log(chalk.gray(`${number}. `) + chalk.cyan(entry.expression) + chalk.gray(' = ') + chalk.yellow(entry.result));
    });
    
    if (this.history.length > 10) {
      console.log(chalk.gray(`... and ${this.history.length - 10} more`));
    }
  }

  /**
   * Show available constants
   */
  showConstants() {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    console.log(chalk.yellow('🔢 Available Mathematical Constants'));
    console.log();
    
    const constants = [
      { name: 'pi', value: Math.PI, description: 'Pi (3.14159...)' },
      { name: 'e', value: Math.E, description: 'Euler\'s number (2.71828...)' },
      { name: 'phi', value: 1.618033988749895, description: 'Golden ratio' },
      { name: 'tau', value: 2 * Math.PI, description: '2π (6.28318...)' },
      { name: 'lightSpeed', value: 299792458, description: 'Speed of light (m/s)' },
      { name: 'gravity', value: 9.80665, description: 'Standard gravity (m/s²)' },
      { name: 'avogadro', value: 6.02214076e23, description: 'Avogadro\'s number' }
    ];
    
    constants.forEach(constant => {
      console.log(chalk.cyan(`${constant.name.padEnd(12)} → `) + chalk.yellow(constant.value.toString()) + chalk.gray(` (${constant.description})`));
    });
  }

  /**
   * Show available functions
   */
  showFunctions() {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    console.log(chalk.yellow('🔧 Available Mathematical Functions'));
    console.log();
    
    const functionCategories = {
      'Arithmetic': ['add', 'subtract', 'multiply', 'divide', 'mod', 'pow'],
      'Trigonometric': ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'sinh', 'cosh', 'tanh'],
      'Exponential': ['exp', 'log', 'log10', 'ln', 'sqrt', 'cbrt'],
      'Rounding': ['round', 'ceil', 'floor', 'abs', 'sign'],
      'Statistics': ['min', 'max', 'mean', 'median', 'mode', 'std'],
      'Special': ['factorial', 'gcd', 'lcm', 'random']
    };
    
    Object.entries(functionCategories).forEach(([category, functions]) => {
      console.log(chalk.cyan(category + ':'));
      console.log('  ' + functions.join(', '));
      console.log();
    });
  }

  /**
   * Add calculation to history
   */
  addToHistory(expression, result) {
    const entry = {
      expression,
      result: String(result),
      timestamp: new Date().toISOString()
    };
    
    this.history.push(entry);
    
    // Keep only last 100 calculations
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }
  }

  /**
   * Clear calculation history
   */
  clearHistory() {
    this.history = [];
    this.saveCalculationHistory();
  }

  /**
   * Save calculation history to config
   */
  saveCalculationHistory() {
    try {
      configService.set('calculate.history', this.history);
    } catch (error) {
      // Silently fail if config save fails
    }
  }

  /**
   * Load calculation history from config
   */
  loadCalculationHistory() {
    try {
      const saved = configService.get('calculate.history', []);
      if (Array.isArray(saved)) {
        this.history = saved;
      }
    } catch (error) {
      // Silently fail if config load fails
    }
  }

  /**
   * Handle calculation errors
   */
  handleCalculationError(error, expression) {
    const t = (key, defaultValue = key) => {
      try {
        return i18nService.getTranslation(key) || defaultValue;
      } catch (error) {
        return defaultValue;
      }
    };
    
    console.log();
    console.log(chalk.red('❌ ' + t('calculate.errors.calculationFailed')));
    
    // Provide specific error messages
    if (error.message.includes('Undefined symbol')) {
      console.log(chalk.yellow(t('calculate.errors.undefinedSymbol')));
      console.log(chalk.gray(t('calculate.errors.checkSpelling')));
    } else if (error.message.includes('Unexpected')) {
      console.log(chalk.yellow(t('calculate.errors.syntaxError')));
      console.log(chalk.gray(t('calculate.errors.checkSyntax')));
    } else if (error.message.includes('Division by zero')) {
      console.log(chalk.yellow(t('calculate.errors.divisionByZero')));
    } else {
      console.log(chalk.yellow(error.message));
    }
    
    console.log();
    console.log(chalk.gray(t('calculate.errors.helpHint')));
    console.log();
  }
}

module.exports = new CalculateCommand();

module.exports = new CalculateCommand();