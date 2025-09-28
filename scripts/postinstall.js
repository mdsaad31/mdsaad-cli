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

    // Check for common PATH issues
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      
      if (process.env.npm_config_global === 'true') {
        console.log(chalk.blue.bold('🔍 Checking installation...'));
        
        // Get npm prefix
        const npmPrefix = execSync('npm config get prefix', { encoding: 'utf8' }).trim();
        console.log(chalk.gray(`NPM Global Directory: ${npmPrefix}`));
        
        // Check PATH on different platforms
        const platform = os.platform();
        const pathSeparator = platform === 'win32' ? ';' : ':';
        const currentPath = process.env.PATH || '';
        
        if (!currentPath.includes(npmPrefix)) {
          console.log(chalk.yellow.bold('\n⚠️  IMPORTANT: PATH Setup Required'));
          console.log(chalk.white('The global npm directory is not in your PATH.'));
          
          if (platform === 'win32') {
            console.log(chalk.white('\n🔧 Windows Fix Options:'));
            console.log(chalk.white('1. Restart your terminal (may fix automatically)'));
            console.log(chalk.white('2. Run: npm install -g mdsaad-cli (if still not working)'));
            console.log(chalk.white('3. Use: npx mdsaad-cli instead of mdsaad'));
          } else {
            console.log(chalk.white('\n🔧 macOS/Linux Fix:'));
            console.log(chalk.white(`Add this to your ~/.bashrc or ~/.zshrc:`));
            console.log(chalk.cyan(`export PATH="${npmPrefix}/bin:$PATH"`));
            console.log(chalk.white('Then run: source ~/.bashrc'));
          }
          
          console.log(chalk.cyan.bold('\n💡 Quick Test:'));
          console.log(chalk.white('Try: npx mdsaad-cli --version'));
        }
      }
    } catch (error) {
      // Silently continue if PATH check fails
    }
    
  } catch (error) {
    // Fallback if chalk fails
    console.log('\n🎉 MDSAAD CLI installed successfully!');
    console.log('Run "mdsaad help" to get started.\n');
    console.log('If "mdsaad" command is not found, try: npx mdsaad-cli help');
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