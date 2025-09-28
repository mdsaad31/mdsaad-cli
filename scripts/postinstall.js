#!/usr/bin/env node

/**
 * Post-installation script for mdsaad CLI
 * Sets up initial configuration and performs post-install tasks
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const chalk = require('chalk');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'mdsaad');
const CACHE_DIR = path.join(os.homedir(), '.cache', 'mdsaad');

async function postInstall() {
  try {
    console.log(chalk.blue('🚀 Setting up mdsaad CLI...'));
    
    // Create configuration directory
    await fs.ensureDir(CONFIG_DIR);
    console.log(chalk.green('✅ Created configuration directory'));
    
    // Create cache directory
    await fs.ensureDir(CACHE_DIR);
    console.log(chalk.green('✅ Created cache directory'));
    
    // Create default configuration if it doesn't exist
    const configFile = path.join(CONFIG_DIR, 'config.json');
    if (!(await fs.pathExists(configFile))) {
      const defaultConfig = {
        language: 'en',
        theme: 'default',
        security: {
          rateLimit: {
            enabled: true,
            requests: 100,
            window: 60000
          }
        },
        performance: {
          enableOptimizations: true,
          cacheSize: '50MB'
        }
      };
      
      await fs.writeJSON(configFile, defaultConfig, { spaces: 2 });
      console.log(chalk.green('✅ Created default configuration'));
    }
    
    // Set appropriate permissions (Unix systems)
    if (os.platform() !== 'win32') {
      try {
        await fs.chmod(CONFIG_DIR, 0o700); // rwx------
        console.log(chalk.green('✅ Set secure directory permissions'));
      } catch (error) {
        console.log(chalk.yellow('⚠️ Could not set directory permissions (non-critical)'));
      }
    }
    
    console.log(chalk.green('\n🎉 mdsaad CLI installation completed successfully!'));
    
    console.log(chalk.yellow('\n⚠️  IMPORTANT: API Keys Required'));
    console.log(chalk.white('   MDSAAD needs API keys for AI and weather features.'));
    console.log(chalk.white('   No keys are included for security reasons.\n'));

    console.log(chalk.cyan('� Quick Setup (Required):'));
    console.log(chalk.white('  mdsaad config setup           # Interactive API key configuration'));
    console.log(chalk.white('  mdsaad config show            # Check configuration status'));

    console.log(chalk.cyan('\n🆓 Get Free API Keys:'));
    console.log(chalk.white('  • OpenRouter (AI): https://openrouter.ai/'));
    console.log(chalk.white('  • Groq (Fast AI):  https://groq.com/'));  
    console.log(chalk.white('  • WeatherAPI:      https://weatherapi.com/'));

    console.log(chalk.cyan('\n🚀 Features (No API Key Required):'));
    console.log(chalk.white('  mdsaad calculate "2+2*3"      # Mathematical calculations'));
    console.log(chalk.white('  mdsaad convert 100 USD EUR    # Currency conversion'));
    console.log(chalk.white('  mdsaad show batman            # ASCII art'));
    console.log(chalk.white('  mdsaad --help                 # Show all commands'));

    console.log(chalk.cyan('\n🤖 AI & Weather (API Key Required):'));
    console.log(chalk.white('  mdsaad ai "Hello world"       # AI interactions'));
    console.log(chalk.white('  mdsaad weather London         # Weather information'));
    
    console.log(chalk.cyan('\n🔐 Security & Privacy:'));
    console.log(chalk.white('  • API keys stored locally and encrypted'));
    console.log(chalk.white('  • No telemetry or data collection'));
    console.log(chalk.white('  • Run "mdsaad security status" for audit'));
    
    console.log(chalk.cyan('\n📖 Documentation:'));
    console.log(chalk.white('  README.md          # Complete setup guide'));
    console.log(chalk.white('  docs/API.md        # API reference'));
    console.log(chalk.white('  CONTRIBUTING.md    # Contributing guidelines'));

    console.log(chalk.green('\n💡 Next Steps:'));
    console.log(chalk.white('  1. Run: mdsaad config setup'));
    console.log(chalk.white('  2. Get free API keys from above providers'));
    console.log(chalk.white('  3. Enjoy all features!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Post-installation setup failed:'), error.message);
    console.log(chalk.yellow('⚠️ The CLI should still work, but some features may be limited.'));
    console.log(chalk.white('💡 You can manually create the configuration directory at:'), CONFIG_DIR);
    process.exit(0); // Don't fail the installation
  }
}

// Only run if this script is executed directly
if (require.main === module) {
  postInstall();
}

module.exports = postInstall;