/**
 * Output Formatter Service
 * Provides consistent output formatting with emojis, colors, and progressive disclosure
 */

const chalk = require('chalk');
const Table = require('cli-table3');

// Handle ES modules gracefully
let boxen, gradient;
try {
  boxen = require('boxen');
} catch (error) {
  // Fallback for boxen if import fails
  boxen = (text, options = {}) => {
    const border = options.borderStyle === 'double' ? '═' : '─';
    const corner = options.borderStyle === 'double' ? '╔╗╚╝' : '┌┐└┘';
    const width = Math.max(text.length + 4, options.width || text.length + 4);
    const top = corner[0] + border.repeat(width - 2) + corner[1];
    const bottom = corner[2] + border.repeat(width - 2) + corner[3];
    const middle = `│ ${text.padEnd(width - 4)} │`;
    return top + '\n' + middle + '\n' + bottom;
  };
}

try {
  gradient = require('gradient-string');
} catch (error) {
  // Fallback for gradient if import fails
  gradient = {
    rainbow: text => (chalk.rainbow ? chalk.rainbow(text) : chalk.cyan(text)),
    pastel: text => chalk.blue(text),
    cristal: text => chalk.cyan(text),
    teen: text => chalk.magenta(text),
    mind: text => chalk.yellow(text),
    morning: text => chalk.yellow(text),
    vice: text => chalk.magenta(text),
    passion: text => chalk.red(text),
    fruit: text => chalk.green(text),
    instagram: text => chalk.magenta(text),
    atlas: text => chalk.blue(text),
    retro: text => chalk.yellow(text),
    summer: text => chalk.green(text),
    rainbow: {
      multiline: text =>
        text
          .split('\n')
          .map(line => (chalk.rainbow ? chalk.rainbow(line) : chalk.cyan(line)))
          .join('\n'),
    },
  };
}

class OutputFormatter {
  constructor() {
    this.theme = {
      primary: '#007ACC',
      secondary: '#61DAFB',
      success: '#28a745',
      warning: '#ffc107',
      error: '#dc3545',
      info: '#17a2b8',
      muted: '#6c757d',
    };

    this.emojis = {
      success: '✅',
      error: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      loading: '⏳',
      sparkles: '✨',
      rocket: '🚀',
      gear: '⚙️',
      lightbulb: '💡',
      fire: '🔥',
      star: '⭐',
      checkmark: '☑️',
      crossmark: '❎',
      arrow: '➤',
      bullet: '•',
      diamond: '◆',
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the output formatter
   */
  initialize() {
    try {
      // Test color support
      this.supportsColor = chalk.supportsColor !== false;

      // Test emoji support (basic check)
      this.supportsEmoji = true;

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.warn('OutputFormatter initialization warning:', error.message);
      this.isInitialized = true; // Continue with fallback
      return false;
    }
  }

  /**
   * Format success messages with consistent styling
   */
  success(message, details = null) {
    console.log(
      chalk.hex(this.theme.success)(`${this.emojis.success} ${message}`)
    );
    if (details && Array.isArray(details)) {
      details.forEach(detail => {
        console.log(chalk.gray(`  ${this.emojis.bullet} ${detail}`));
      });
    } else if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Format error messages with consistent styling
   */
  error(message, details = null, suggestions = null) {
    console.log(chalk.hex(this.theme.error)(`${this.emojis.error} ${message}`));
    if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
    if (suggestions && Array.isArray(suggestions)) {
      console.log();
      console.log(
        chalk.hex(this.theme.info)(`${this.emojis.lightbulb} Suggestions:`)
      );
      suggestions.forEach(suggestion => {
        console.log(chalk.gray(`  ${this.emojis.arrow} ${suggestion}`));
      });
    }
  }

  /**
   * Format warning messages with consistent styling
   */
  warning(message, details = null) {
    console.log(
      chalk.hex(this.theme.warning)(`${this.emojis.warning} ${message}`)
    );
    if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Format info messages with consistent styling
   */
  info(message, details = null) {
    console.log(chalk.hex(this.theme.info)(`${this.emojis.info} ${message}`));
    if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Create beautiful headers with gradient and styling
   */
  header(title, subtitle = null) {
    let titleText;
    try {
      if (typeof gradient === 'function') {
        const titleGradient = gradient(['#007ACC', '#61DAFB']);
        titleText = titleGradient(
          `${this.emojis.sparkles} ${title} ${this.emojis.sparkles}`
        );
      } else {
        titleText = chalk.cyan(
          `${this.emojis.sparkles} ${title} ${this.emojis.sparkles}`
        );
      }
    } catch (error) {
      titleText = chalk.cyan(
        `${this.emojis.sparkles} ${title} ${this.emojis.sparkles}`
      );
    }

    console.log();
    console.log(titleText);
    if (subtitle) {
      console.log(chalk.gray(`   ${subtitle}`));
    }
    console.log();
  }

  /**
   * Create boxed output for important information
   */
  box(content, options = {}) {
    const defaultOptions = {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: this.theme.primary,
      backgroundColor: null,
      align: 'left',
    };

    const boxOptions = { ...defaultOptions, ...options };
    console.log(boxen(content, boxOptions));
  }

  /**
   * Create loading spinners and progress indicators
   */
  loading(message) {
    console.log(
      chalk.hex(this.theme.info)(`${this.emojis.loading} ${message}`)
    );
  }

  /**
   * Create a simple spinner (returns an object with start/stop methods)
   */
  spinner(message) {
    return {
      start: () => {
        console.log(
          chalk.hex(this.theme.info)(`${this.emojis.loading} ${message}`)
        );
      },
      stop: () => {
        // Simple implementation - just clears the line in real scenarios
        // For now, we'll just not print anything on stop
      },
    };
  }

  /**
   * Format key-value pairs in a consistent way
   */
  keyValue(pairs, options = {}) {
    const { indent = 2, separator = ':', color = this.theme.muted } = options;
    const prefix = ' '.repeat(indent);

    pairs.forEach(([key, value]) => {
      console.log(`${prefix}${chalk.hex(color)(key)}${separator} ${value}`);
    });
  }

  /**
   * Create beautiful tables with consistent styling
   */
  table(data, options = {}) {
    const defaultOptions = {
      head: [],
      colWidths: [],
      style: {
        head: [this.theme.primary],
        border: [this.theme.muted],
        compact: false,
      },
    };

    const tableOptions = { ...defaultOptions, ...options };
    const table = new Table(tableOptions);

    if (Array.isArray(data[0])) {
      // Array of arrays
      data.forEach(row => table.push(row));
    } else {
      // Array of objects
      data.forEach(item => {
        const row = tableOptions.head.map(header => item[header] || '');
        table.push(row);
      });
    }

    console.log(table.toString());
  }

  /**
   * Create table and return as string (doesn't print to console)
   */
  createTable(data, options = {}) {
    const defaultOptions = {
      head: [],
      colWidths: [],
      style: {
        head: [this.theme.primary],
        border: [this.theme.muted],
        compact: false,
      },
    };

    const tableOptions = { ...defaultOptions, ...options };
    const table = new Table(tableOptions);

    if (Array.isArray(data[0])) {
      // Array of arrays
      data.forEach(row => table.push(row));
    } else {
      // Array of objects
      data.forEach(item => {
        const row = tableOptions.head.map(header => item[header] || '');
        table.push(row);
      });
    }

    return table.toString();
  }

  /**
   * Progressive disclosure - show basic info first, more details on demand
   */
  progressive(basicInfo, detailedInfo, options = {}) {
    const { showDetails = false, prompt = 'Show more details' } = options;

    // Always show basic info
    console.log(basicInfo);

    if (showDetails) {
      console.log();
      console.log(chalk.hex(this.theme.muted)('--- Details ---'));
      console.log(detailedInfo);
    } else if (detailedInfo) {
      console.log(
        chalk.hex(this.theme.muted)(
          `\n💡 Use --verbose to see ${prompt.toLowerCase()}`
        )
      );
    }
  }

  /**
   * Format command examples with syntax highlighting
   */
  examples(examples) {
    console.log(
      chalk.hex(this.theme.info)(`${this.emojis.lightbulb} Examples:`)
    );
    console.log();

    examples.forEach(example => {
      if (typeof example === 'string') {
        console.log(chalk.gray(`  ${this.emojis.arrow} ${example}`));
      } else {
        console.log(chalk.cyan(`  ${example.description}:`));
        console.log(
          chalk.gray(`    ${this.emojis.diamond} ${example.command}`)
        );
        if (example.output) {
          console.log(chalk.dim(`    → ${example.output}`));
        }
      }
      console.log();
    });
  }

  /**
   * Format help sections with consistent styling
   */
  helpSection(title, content, options = {}) {
    const { collapsible = false, expanded = true } = options;

    if (collapsible && !expanded) {
      console.log(
        chalk.hex(this.theme.primary)(
          `${this.emojis.arrow} ${title} (use --help-${title.toLowerCase()} for details)`
        )
      );
      return;
    }

    console.log(
      chalk.hex(this.theme.primary)(`${this.emojis.diamond} ${title}`)
    );
    console.log();

    if (Array.isArray(content)) {
      content.forEach(item => {
        console.log(chalk.gray(`  ${this.emojis.bullet} ${item}`));
      });
    } else {
      console.log(chalk.gray(`  ${content}`));
    }

    console.log();
  }

  /**
   * Format status indicators
   */
  status(label, status, details = null) {
    let emoji, color;

    switch (status.toLowerCase()) {
      case 'success':
      case 'ok':
      case 'active':
      case 'online':
        emoji = this.emojis.success;
        color = this.theme.success;
        break;
      case 'error':
      case 'failed':
      case 'offline':
        emoji = this.emojis.error;
        color = this.theme.error;
        break;
      case 'warning':
      case 'pending':
        emoji = this.emojis.warning;
        color = this.theme.warning;
        break;
      default:
        emoji = this.emojis.info;
        color = this.theme.info;
    }

    console.log(
      `${chalk.hex(color)(emoji)} ${label}: ${chalk.hex(color)(status)}`
    );
    if (details) {
      console.log(chalk.gray(`  ${details}`));
    }
  }

  /**
   * Format lists with consistent bullet points and indentation
   */
  list(items, options = {}) {
    const {
      bullet = this.emojis.bullet,
      indent = 2,
      numbered = false,
    } = options;
    const prefix = ' '.repeat(indent);

    items.forEach((item, index) => {
      const marker = numbered ? `${index + 1}.` : bullet;
      console.log(`${prefix}${chalk.hex(this.theme.muted)(marker)} ${item}`);
    });
  }

  /**
   * Format code blocks with syntax highlighting
   */
  code(code, language = null) {
    const border = '─'.repeat(Math.min(code.length + 4, 80));

    console.log(chalk.hex(this.theme.muted)(`┌${border}┐`));
    code.split('\n').forEach(line => {
      console.log(
        chalk.hex(this.theme.muted)(
          `│ ${chalk.cyan(line.padEnd(Math.min(code.length + 2, 78)))} │`
        )
      );
    });
    console.log(chalk.hex(this.theme.muted)(`└${border}┘`));
  }

  /**
   * Format metrics and statistics
   */
  metrics(data, options = {}) {
    const { title = 'Metrics', format = 'table' } = options;

    console.log(chalk.hex(this.theme.primary)(`${this.emojis.gear} ${title}`));
    console.log();

    if (format === 'table') {
      const tableData = Object.entries(data).map(([key, value]) => [
        chalk.cyan(key),
        typeof value === 'number' ? value.toLocaleString() : value,
      ]);

      this.table(tableData, {
        head: ['Metric', 'Value'],
        colWidths: [25, 20],
      });
    } else {
      // Key-value format
      this.keyValue(
        Object.entries(data).map(([key, value]) => [
          key,
          typeof value === 'number' ? value.toLocaleString() : value,
        ])
      );
    }
  }

  /**
   * Clear screen and show branded header
   */
  clear() {
    console.clear();
    this.header('MDSAAD CLI Tool', 'Your comprehensive command-line companion');
  }

  /**
   * Format completion suggestions for tab completion
   */
  completions(suggestions, query = '') {
    if (suggestions.length === 0) {
      console.log(chalk.gray('No suggestions available'));
      return;
    }

    console.log(
      chalk.hex(this.theme.info)(
        `${this.emojis.lightbulb} Suggestions for "${query}":`
      )
    );
    console.log();

    suggestions.forEach(suggestion => {
      if (typeof suggestion === 'string') {
        console.log(chalk.gray(`  ${this.emojis.arrow} ${suggestion}`));
      } else {
        console.log(
          `  ${chalk.cyan(suggestion.name)} ${chalk.gray(suggestion.description || '')}`
        );
      }
    });
  }

  /**
   * Format debug information with detailed output
   */
  debug(message, data = null) {
    console.log(chalk.magenta(`🐛 DEBUG: ${message}`));
    if (data) {
      if (typeof data === 'object') {
        console.log(chalk.gray(JSON.stringify(data, null, 2)));
      } else {
        console.log(chalk.gray(`  ${data}`));
      }
    }
  }

  /**
   * Format progress bars for long operations
   */
  progress(current, total, label = '') {
    const percentage = Math.round((current / total) * 100);
    const filledBlocks = Math.round((percentage / 100) * 20);
    const emptyBlocks = 20 - filledBlocks;

    const progressBar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);

    process.stdout.write(
      `\r${label} [${chalk.green(progressBar)}] ${percentage}% (${current}/${total})`
    );

    if (current === total) {
      console.log(); // New line when complete
    }
  }

  /**
   * Create rainbow colored text
   */
  rainbow(text) {
    try {
      if (gradient && gradient.rainbow) {
        return gradient.rainbow(text);
      } else {
        // Fallback: cycle through colors for rainbow effect
        const colors = ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'];
        return text
          .split('')
          .map((char, i) => chalk[colors[i % colors.length]](char))
          .join('');
      }
    } catch (error) {
      // Final fallback
      return chalk.cyan(text);
    }
  }

  /**
   * Create a progress bar display
   */
  progressBar(percentage, label = '') {
    const width = 20;
    const filledWidth = Math.round(width * percentage);
    const emptyWidth = width - filledWidth;

    const filled = '█'.repeat(filledWidth);
    const empty = '░'.repeat(emptyWidth);
    const percent = Math.round(percentage * 100);

    return `${label} [${chalk.green(filled)}${chalk.gray(empty)}] ${percent}%`;
  }

  /**
   * Create styled subheader
   */
  subheader(title) {
    console.log();
    console.log(
      chalk.hex(this.theme.secondary)(`${this.emojis.diamond} ${title}`)
    );
    console.log();
  }

  /**
   * Format data as a table
   */
  formatTable(title, data, options = {}) {
    try {
      const table = new Table({
        head: options.headers || [],
        style: {
          head: [options.colors?.header || 'cyan'],
          border: [options.colors?.border || 'gray'],
        },
        colWidths: options.colWidths,
      });

      // Add data rows
      if (Array.isArray(data) && data.length > 0) {
        if (Array.isArray(data[0])) {
          // 2D array format
          data.forEach(row => {
            if (Array.isArray(row)) {
              table.push(row);
            }
          });
        } else {
          // Object format
          data.forEach(item => {
            if (typeof item === 'object' && item !== null) {
              table.push(Object.values(item));
            }
          });
        }
      }

      let output = '';
      if (title) {
        output += chalk.hex(this.theme.primary)(
          `${this.emojis.gear} ${title}\n\n`
        );
      }
      output += table.toString();
      return output;
    } catch (error) {
      // Fallback to simple format
      let output = '';
      if (title) {
        output += chalk.hex(this.theme.primary)(
          `${this.emojis.gear} ${title}\n\n`
        );
      }

      if (options.headers) {
        output += options.headers.map(h => chalk.cyan(h)).join(' | ') + '\n';
        output += options.headers.map(() => '---').join(' | ') + '\n';
      }

      if (Array.isArray(data)) {
        data.forEach(row => {
          if (Array.isArray(row)) {
            output += row.join(' | ') + '\n';
          }
        });
      }

      return output;
    }
  }

  /**
   * Format object as key-value pairs
   */
  formatObject(title, obj, options = {}) {
    let output = '';
    if (title) {
      output += chalk.hex(this.theme.primary)(
        `${this.emojis.gear} ${title}\n\n`
      );
    }

    Object.entries(obj).forEach(([key, value]) => {
      const formattedKey = chalk.cyan(key.padEnd(options.keyWidth || 20));
      const formattedValue =
        typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value);
      output += `  ${formattedKey}: ${formattedValue}\n`;
    });

    return output;
  }

  /**
   * Highlight text with specific styling
   */
  highlight(text, type = 'default') {
    switch (type) {
      case 'important':
        return chalk.bgYellow.black(` ${text} `);
      case 'temperature':
        return chalk.red.bold(text);
      case 'success':
        return chalk.green.bold(text);
      case 'error':
        return chalk.red.bold(text);
      case 'warning':
        return chalk.yellow.bold(text);
      default:
        return chalk.cyan.bold(text);
    }
  }
}

module.exports = new OutputFormatter();
