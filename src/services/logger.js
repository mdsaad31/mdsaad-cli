/**
 * Logging Service
 * Provides centralized logging functionality with different levels
 */

const chalk = require('chalk');

class Logger {
  constructor() {
    this.level = 'info';
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      verbose: 3,
      debug: 4,
    };
  }

  setLevel(level) {
    if (this.levels.hasOwnProperty(level)) {
      this.level = level;
    }
  }

  getLevel() {
    return this.level;
  }

  shouldLog(messageLevel) {
    return this.levels[messageLevel] <= this.levels[this.level];
  }

  error(...args) {
    if (this.shouldLog('error')) {
      console.error(chalk.red('ERROR:'), ...args);
    }
  }

  warn(...args) {
    if (this.shouldLog('warn')) {
      console.warn(chalk.yellow('WARN:'), ...args);
    }
  }

  info(...args) {
    if (this.shouldLog('info')) {
      console.log(chalk.blue('INFO:'), ...args);
    }
  }

  verbose(...args) {
    if (this.shouldLog('verbose')) {
      console.log(chalk.gray('VERBOSE:'), ...args);
    }
  }

  debug(...args) {
    if (this.shouldLog('debug')) {
      console.log(chalk.magenta('DEBUG:'), ...args);
    }
  }
}

module.exports = new Logger();
