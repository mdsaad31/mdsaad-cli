#!/usr/bin/env node

/**
 * Post-install script for MDSAAD CLI
 * Displays welcome message and setup instructions
 */

const chalk = require('chalk');

function showWelcomeMessage() {
  try {
    console.log(chalk.cyan.bold('\n🎉 MDSAAD CLI Installed Successfully!\n'));
    console.log(chalk.white('Your powerful CLI toolkit is ready to use!'));
    
    console.log(chalk.yellow.bold('\n🚀 Quick Start:'));
    console.log(chalk.white('  mdsaad help              ') + chalk.gray('# View all commands'));
    console.log(chalk.white('  mdsaad ai "Hello!"        ') + chalk.gray('# Chat with AI'));
    console.log(chalk.white('  mdsaad weather London     ') + chalk.gray('# Get weather info'));
    console.log(chalk.white('  mdsaad calc "2+2"         ') + chalk.gray('# Math calculator'));
    console.log(chalk.white('  mdsaad ascii "Hello"      ') + chalk.gray('# ASCII art'));

    console.log(chalk.yellow.bold('\n✨ Features:'));
    console.log(chalk.white('• 20+ Commands available'));
    console.log(chalk.white('• No API keys required'));
    console.log(chalk.white('• Works through secure proxy'));
    console.log(chalk.white('• Cross-platform support'));

    console.log(chalk.yellow.bold('\n📚 Resources:'));
    console.log(chalk.white('• GitHub: ') + chalk.cyan('https://github.com/mdsaad31/mdsaad-cli'));
    console.log(chalk.white('• Issues: ') + chalk.cyan('https://github.com/mdsaad31/mdsaad-cli/issues'));
    console.log(chalk.white('• NPM:    ') + chalk.cyan('https://npmjs.com/package/mdsaad-cli'));

    console.log(chalk.green('\nHappy coding! 🎯\n'));
    
  } catch (error) {
    // Fallback if chalk fails
    console.log('\n🎉 MDSAAD CLI installed successfully!');
    console.log('Run "mdsaad help" to get started.\n');
  }
}

// Only show message if installed globally or as dependency
if (process.env.npm_config_global === 'true' || 
    process.argv.includes('--global') || 
    process.argv.includes('-g') ||
    require.main === module) {
  showWelcomeMessage();
} else {
  // Silent install for local dependencies
  try {
    console.log(require('chalk').green('✅ MDSAAD CLI ready! Run: npx mdsaad help'));
  } catch {
    console.log('✅ MDSAAD CLI ready! Run: npx mdsaad help');
  }
}

module.exports = showWelcomeMessage;