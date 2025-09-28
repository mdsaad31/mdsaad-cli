/**
 * Show Command
 * Comprehensive ASCII art display system with animations, colors, and search functionality
 */

const chalk = require('chalk');
const readline = require('readline');
const asciiArtDb = require('../services/ascii-art-db');
const animationService = require('../services/ascii-animation');
const i18n = require('../services/i18n');
const loggerService = require('../services/logger');

class ShowCommand {
  constructor() {
    this.colorSchemes = {
      default: 'white',
      rainbow: ['red', 'yellow', 'green', 'cyan', 'blue', 'magenta'],
      fire: ['red', 'brightRed', 'yellow', 'brightYellow'],
      ocean: ['blue', 'brightBlue', 'cyan', 'brightCyan'],
      forest: ['green', 'brightGreen', 'yellow', 'brightYellow'],
      sunset: ['red', 'yellow', 'magenta', 'brightYellow'],
      monochrome: ['white', 'gray', 'brightWhite', 'dim'],
    };

    this.animations = {
      typewriter: 'Typewriter effect (character by character)',
      fadein: 'Fade in effect (gradual appearance)',
      slidein: 'Slide in from specified direction',
      matrix: 'Matrix digital rain effect',
      pulse: 'Pulsing color effect',
      wave: 'Wavy movement effect',
    };
  }

  /**
   * Execute show command with comprehensive art display system
   */
  async execute(artName, options = {}) {
    try {
      // Initialize ASCII art database
      if (!asciiArtDb.isInitialized()) {
        console.log(chalk.yellow('🎨 Initializing ASCII art database...'));
        await asciiArtDb.initialize();
      }

      // Handle special commands
      if (await this.handleSpecialCommands(artName, options)) {
        return;
      }

      // Search and display art
      await this.displayArt(artName, options);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle special commands (list, search, random, etc.)
   */
  async handleSpecialCommands(artName, options) {
    const command = artName?.toLowerCase();

    switch (command) {
      case 'help':
      case '?':
        this.showHelp();
        return true;

      case 'list':
        await this.listArt(options.category);
        return true;

      case 'categories':
      case 'cats':
        this.showCategories();
        return true;

      case 'search':
        if (options.query) {
          await this.searchArt(options.query, options);
        } else {
          console.log(
            chalk.red('❌ Please specify search query: --query "search term"')
          );
        }
        return true;

      case 'random':
        await this.showRandomArt(options);
        return true;

      case 'popular':
        await this.showPopularArt(options);
        return true;

      case 'stats':
      case 'statistics':
        this.showStatistics();
        return true;

      case 'colors':
        this.showColorSchemes();
        return true;

      case 'animations':
        this.showAnimations();
        return true;

      default:
        return false;
    }
  }

  /**
   * Display ASCII art with specified options
   */
  async displayArt(artName, options) {
    // Search for the art
    const searchResults = asciiArtDb.searchArt(artName, {
      category: options.category,
      limit: 1,
      fuzzy: true,
    });

    if (searchResults.length === 0) {
      console.log(chalk.red(`❌ ASCII art "${artName}" not found`));
      console.log(chalk.gray('Use "mdsaad show list" to see available art'));
      console.log(
        chalk.gray('Use "mdsaad show search --query <term>" to search')
      );
      return;
    }

    const result = searchResults[0];
    const art = result.artData;

    console.log(
      chalk.cyan(`🎨 Displaying: ${chalk.white(art.name)} (${art.category})`)
    );
    if (result.description) {
      console.log(chalk.gray(`📝 ${result.description}`));
    }
    console.log();

    // Adjust art for terminal width if needed
    let content = art.content;
    if (options.width) {
      content = this.adjustWidth(content, parseInt(options.width));
    }

    // Apply display options
    const displayOptions = {
      color: options.color || this.colorSchemes.default,
      animated: options.animated,
      animation: options.animation || 'typewriter',
      speed: parseInt(options.speed) || 100,
      colorScheme: options.colorScheme || 'default',
    };

    // Display art
    await this.renderArt(content, displayOptions);

    // Show art metadata
    console.log();
    this.showArtMetadata(art, result);
  }

  /**
   * Render ASCII art with animations and colors
   */
  async renderArt(content, options) {
    const { animated, animation, color, colorScheme, speed } = options;

    // Prepare color scheme
    let colors;
    if (colorScheme && this.colorSchemes[colorScheme]) {
      colors = Array.isArray(this.colorSchemes[colorScheme])
        ? this.colorSchemes[colorScheme]
        : [this.colorSchemes[colorScheme]];
    } else {
      colors = [color];
    }

    if (animated && animation) {
      // Handle animations
      switch (animation.toLowerCase()) {
        case 'typewriter':
          await animationService.animateTypewriter(content, {
            speed: speed,
            color: colors[0],
          });
          break;

        case 'fadein':
          await animationService.animateFadeIn(content, {
            speed: speed * 2,
            color: colors[0],
          });
          break;

        case 'slidein':
          await animationService.animateSlideIn(content, {
            direction: options.direction || 'right',
            speed: speed,
            color: colors[0],
          });
          break;

        case 'matrix':
          await animationService.animateMatrixRain(content, {
            duration: 3000,
            speed: speed,
            color: 'green',
          });
          break;

        case 'pulse':
          await animationService.animatePulse(content, {
            cycles: 3,
            speed: speed * 3,
            colors: colors,
          });
          break;

        case 'wave':
          await animationService.animateWave(content, {
            cycles: 2,
            speed: speed,
            color: colors[0],
          });
          break;

        default:
          animationService.displayStatic(content, { color: colors[0] });
      }
    } else {
      // Static display with color scheme
      if (colors.length > 1) {
        await this.displayWithColorScheme(content, colors);
      } else {
        animationService.displayStatic(content, { color: colors[0] });
      }
    }
  }

  /**
   * Display art with multi-color scheme
   */
  async displayWithColorScheme(content, colors) {
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      const colorIndex = index % colors.length;
      const color = colors[colorIndex];
      process.stdout.write(chalk[color](line) + '\n');
    });
  }

  /**
   * List available ASCII art
   */
  async listArt(category = null) {
    console.log(chalk.yellow('🎨 Available ASCII Art'));
    console.log();

    if (category) {
      const art = asciiArtDb.getCategory(category);
      if (art.length === 0) {
        console.log(chalk.red(`❌ Category "${category}" not found or empty`));
        return;
      }

      console.log(
        chalk.cyan(`📂 ${category.toUpperCase()}: (${art.length} items)`)
      );
      art.forEach(item => {
        console.log(
          `  ${chalk.white(item.name)} - ${chalk.gray(item.lines)} lines, ${chalk.gray(item.width)} chars wide`
        );
      });
    } else {
      const categories = asciiArtDb.getCategories();

      for (const cat of categories) {
        const art = asciiArtDb.getCategory(cat);
        console.log(
          chalk.cyan(`📂 ${cat.toUpperCase()}: (${art.length} items)`)
        );

        art.forEach(item => {
          console.log(
            `  ${chalk.white(item.name)} - ${chalk.gray(item.lines)} lines, ${chalk.gray(item.width)} chars wide`
          );
        });
        console.log();
      }
    }
  }

  /**
   * Show available categories
   */
  showCategories() {
    console.log(chalk.yellow('📂 Available Categories'));
    console.log();

    const categories = asciiArtDb.getCategories();
    categories.forEach(category => {
      const art = asciiArtDb.getCategory(category);
      console.log(
        `${chalk.cyan(category)} - ${chalk.white(art.length)} artworks`
      );
    });
    console.log();
    console.log(
      chalk.gray(
        'Use "mdsaad show list --category <name>" to list art in a category'
      )
    );
  }

  /**
   * Search for ASCII art
   */
  async searchArt(query, options = {}) {
    console.log(chalk.yellow(`🔍 Searching for: "${query}"`));
    console.log();

    const results = asciiArtDb.searchArt(query, {
      category: options.category,
      limit: options.limit || 10,
      fuzzy: true,
    });

    if (results.length === 0) {
      console.log(chalk.red('❌ No matching ASCII art found'));
      console.log(
        chalk.gray(
          'Try different search terms or browse categories with "mdsaad show categories"'
        )
      );
      return;
    }

    console.log(chalk.green(`✅ Found ${results.length} result(s):`));
    console.log();

    results.forEach((result, index) => {
      const { name, category, description, score } = result;
      console.log(
        `${chalk.white(`${index + 1}.`)} ${chalk.cyan(name)} (${chalk.gray(category)})`
      );
      console.log(`   ${chalk.gray(description)}`);
      console.log(`   ${chalk.gray('Match score:')} ${chalk.white(score)}`);
      console.log();
    });

    console.log(
      chalk.gray('Use "mdsaad show <name>" to display any of these artworks')
    );
  }

  /**
   * Show random ASCII art
   */
  async showRandomArt(options) {
    console.log(chalk.yellow('🎲 Random ASCII Art'));
    console.log();

    const art = asciiArtDb.getRandomArt(options.category);
    if (!art) {
      console.log(chalk.red('❌ No art available'));
      return;
    }

    // Display the random art
    await this.displayArt(art.name, options);
  }

  /**
   * Show popular ASCII art
   */
  async showPopularArt(options) {
    console.log(chalk.yellow('⭐ Popular ASCII Art'));
    console.log();

    const popularArt = asciiArtDb.getPopularArt(
      options.limit || 5,
      options.category
    );

    if (popularArt.length === 0) {
      console.log(chalk.red('❌ No popular art available'));
      return;
    }

    popularArt.forEach((item, index) => {
      console.log(
        `${chalk.white(`${index + 1}.`)} ${chalk.cyan(item.name)} (${chalk.gray(item.category)})`
      );
      console.log(`   ${chalk.gray(item.description)}`);
      console.log(
        `   ${chalk.gray('Popularity:')} ${chalk.white(item.popularity)}/100`
      );
      console.log();
    });

    console.log(
      chalk.gray('Use "mdsaad show <name>" to display any of these artworks')
    );
  }

  /**
   * Show ASCII art database statistics
   */
  showStatistics() {
    console.log(chalk.yellow('📊 ASCII Art Database Statistics'));
    console.log();

    const stats = asciiArtDb.getStatistics();

    console.log(
      `${chalk.cyan('Total Artworks:')} ${chalk.white(stats.totalArt)}`
    );
    console.log(
      `${chalk.cyan('Categories:')} ${chalk.white(stats.categories)}`
    );
    console.log(
      `${chalk.cyan('Average Size:')} ${chalk.white(stats.averageSize)} characters`
    );
    console.log();

    console.log(chalk.cyan('Category Breakdown:'));
    Object.entries(stats.categoryBreakdown).forEach(([category, count]) => {
      console.log(`  ${chalk.white(category)}: ${chalk.gray(count)} artworks`);
    });
    console.log();

    if (stats.largestArt) {
      console.log(
        `${chalk.cyan('Largest Artwork:')} ${chalk.white(stats.largestArt.name)} (${stats.largestArt.size} chars)`
      );
    }

    if (stats.smallestArt) {
      console.log(
        `${chalk.cyan('Smallest Artwork:')} ${chalk.white(stats.smallestArt.name)} (${stats.smallestArt.size} chars)`
      );
    }
  }

  /**
   * Show available color schemes
   */
  showColorSchemes() {
    console.log(chalk.yellow('🎨 Available Color Schemes'));
    console.log();

    Object.entries(this.colorSchemes).forEach(([name, colors]) => {
      const colorList = Array.isArray(colors) ? colors.join(', ') : colors;
      console.log(`${chalk.cyan(name)}: ${chalk.gray(colorList)}`);
    });
    console.log();
    console.log(
      chalk.gray('Use --color-scheme <name> to apply a color scheme')
    );
  }

  /**
   * Show available animations
   */
  showAnimations() {
    console.log(chalk.yellow('🎬 Available Animations'));
    console.log();

    Object.entries(this.animations).forEach(([name, description]) => {
      console.log(`${chalk.cyan(name)}: ${chalk.gray(description)}`);
    });
    console.log();
    console.log(
      chalk.gray('Use --animated --animation <name> to apply an animation')
    );
  }

  /**
   * Show art metadata
   */
  showArtMetadata(art, metadata) {
    console.log(chalk.gray('─'.repeat(60)));
    console.log(
      chalk.gray(
        `📏 Size: ${art.lines} lines × ${art.width} chars (${art.size} total)`
      )
    );

    if (metadata.tags && metadata.tags.length > 0) {
      console.log(chalk.gray(`🏷️  Tags: ${metadata.tags.join(', ')}`));
    }

    if (metadata.difficulty) {
      console.log(chalk.gray(`⭐ Complexity: ${metadata.difficulty}/10`));
    }

    console.log(chalk.gray(`📁 Category: ${art.category}`));
  }

  /**
   * Adjust ASCII art width to fit terminal
   */
  adjustWidth(content, maxWidth) {
    const lines = content.split('\n');

    return lines
      .map(line => {
        if (line.length <= maxWidth) {
          return line;
        }
        return line.substring(0, maxWidth - 3) + '...';
      })
      .join('\n');
  }

  /**
   * Show comprehensive help
   */
  showHelp() {
    console.log(chalk.yellow('🎨 ASCII Art Display System Help'));
    console.log();

    console.log(chalk.cyan('Basic Usage:'));
    console.log('  mdsaad show <artname>              →  Display ASCII art');
    console.log(
      '  mdsaad show batman                 →  Show Batman ASCII art'
    );
    console.log(
      '  mdsaad show superman --animated    →  Animated Superman art'
    );
    console.log();

    console.log(chalk.cyan('Art Management:'));
    console.log(
      '  mdsaad show list                   →  List all available art'
    );
    console.log('  mdsaad show list --category logos  →  List art in category');
    console.log('  mdsaad show categories             →  Show all categories');
    console.log('  mdsaad show search --query hero    →  Search for art');
    console.log('  mdsaad show random                 →  Display random art');
    console.log('  mdsaad show popular                →  Show popular art');
    console.log();

    console.log(chalk.cyan('Display Options:'));
    console.log('  -a, --animated                     →  Enable animations');
    console.log(
      '  --animation <type>                 →  Animation type (typewriter, fadein, etc.)'
    );
    console.log('  -c, --color <color>                →  Set text color');
    console.log('  --color-scheme <scheme>            →  Apply color scheme');
    console.log(
      '  -w, --width <number>               →  Maximum display width'
    );
    console.log(
      '  --speed <ms>                       →  Animation speed (milliseconds)'
    );
    console.log();

    console.log(chalk.cyan('Information:'));
    console.log(
      '  mdsaad show stats                  →  Show database statistics'
    );
    console.log('  mdsaad show colors                 →  List color schemes');
    console.log('  mdsaad show animations             →  List animation types');
    console.log();

    console.log(chalk.cyan('Examples:'));
    console.log('  mdsaad show batman --animated --animation typewriter');
    console.log('  mdsaad show mdsaad --color-scheme rainbow');
    console.log('  mdsaad show cat --animated --animation wave --speed 50');
    console.log('  mdsaad show search --query "super" --category superheroes');
  }

  /**
   * Handle errors with user-friendly messages
   */
  handleError(error) {
    console.log(chalk.red('❌ ASCII art display failed:'), error.message);

    if (error.message.includes('not initialized')) {
      console.log(
        chalk.yellow('💡 Try restarting the command or check file permissions')
      );
    } else if (error.message.includes('not found')) {
      console.log(
        chalk.yellow('💡 Use "mdsaad show list" to see available art')
      );
    }

    console.log(chalk.gray('Use "mdsaad show help" for usage information'));
  }
}

module.exports = new ShowCommand();
