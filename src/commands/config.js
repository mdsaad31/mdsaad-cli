/**
 * Configuration Command - Set up API keys securely
 *
 * This command helps users configure their API keys for MDSAAD services.
 * Keys are stored in user's home directory (~/.mdsaad/config.json)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const {
  loadUserConfig,
  saveUserConfig,
  checkApiKeysConfigured,
  getSetupInstructions,
  CONFIG_DIR,
  CONFIG_FILE,
} = require('../config/mdsaad-keys');

class ConfigCommand {
  constructor() {
    this.name = 'config';
    this.description = 'Configure API keys and settings for MDSAAD';
    this.usage = 'mdsaad config <subcommand>';
    this.subcommands = {
      setup: 'Interactive setup of API keys',
      show: 'Show current configuration status',
      set: 'Set a specific API key',
      remove: 'Remove configuration',
      help: 'Show configuration help',
    };
  }

  async execute(args) {
    const subcommand = args[0] || 'help';

    switch (subcommand.toLowerCase()) {
      case 'setup':
        return await this.setupInteractive();
      case 'show':
      case 'status':
        return this.showStatus();
      case 'set':
        return await this.setApiKey(args[1], args[2]);
      case 'remove':
      case 'delete':
      case 'clear':
        return this.removeConfig();
      case 'help':
      default:
        return this.showHelp();
    }
  }

  /**
   * Interactive setup of API keys
   */
  async setupInteractive() {
    console.log('\n🔧 MDSAAD Configuration Setup');
    console.log('=====================================\n');

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const question = prompt => {
      return new Promise(resolve => {
        rl.question(prompt, resolve);
      });
    };

    try {
      const config = loadUserConfig() || {};
      if (!config.apiKeys) config.apiKeys = {};

      console.log('📝 Please provide your API keys (press Enter to skip):\n');

      // OpenRouter API Key
      console.log('🔹 OpenRouter (Recommended - Multiple AI models)');
      console.log('   Get free key at: https://openrouter.ai/');
      const openrouterKey = await question('   API Key: ');
      if (openrouterKey.trim()) {
        config.apiKeys.openrouter = openrouterKey.trim();
      }

      // Groq API Key
      console.log('\n🔹 Groq (Fast inference)');
      console.log('   Get free key at: https://groq.com/');
      const groqKey = await question('   API Key: ');
      if (groqKey.trim()) {
        config.apiKeys.groq = groqKey.trim();
      }

      // DeepSeek API Key
      console.log('\n🔹 DeepSeek (Coding models)');
      console.log('   Get key at: https://platform.deepseek.com/');
      const deepseekKey = await question('   API Key: ');
      if (deepseekKey.trim()) {
        config.apiKeys.deepseek = deepseekKey.trim();
      }

      // Gemini API Key
      console.log('\n🔹 Gemini (Google AI)');
      console.log('   Get key at: https://ai.google.dev/');
      const geminiKey = await question('   API Key: ');
      if (geminiKey.trim()) {
        config.apiKeys.gemini = geminiKey.trim();
      }

      // WeatherAPI Key
      console.log('\n🔹 WeatherAPI (Weather services)');
      console.log('   Get free key at: https://weatherapi.com/');
      const weatherKey = await question('   API Key: ');
      if (weatherKey.trim()) {
        config.apiKeys.weatherapi = weatherKey.trim();
      }

      // Save configuration
      const saved = saveUserConfig(config);

      if (saved) {
        console.log('\n✅ Configuration saved successfully!');
        console.log(`📁 Config file: ${CONFIG_FILE}`);
        this.showStatus();
      } else {
        console.log('\n❌ Failed to save configuration');
      }
    } catch (error) {
      console.error('Error during setup:', error.message);
    } finally {
      rl.close();
    }
  }

  /**
   * Show current configuration status
   */
  showStatus() {
    console.log('\n📊 MDSAAD Configuration Status');
    console.log('=================================\n');

    const status = checkApiKeysConfigured();

    console.log(`📁 Config file: ${CONFIG_FILE}`);
    console.log(
      `📁 Config exists: ${fs.existsSync(CONFIG_FILE) ? '✅ Yes' : '❌ No'}\n`
    );

    console.log('🔑 API Keys Status:');
    console.log(
      `   AI Services: ${status.ai ? '✅ Configured' : '❌ Not configured'}`
    );
    console.log(
      `   Weather Services: ${status.weather ? '✅ Configured' : '❌ Not configured'}\n`
    );

    if (!status.hasAnyKeys) {
      console.log('⚠️  No API keys configured!');
      console.log('   Run: mdsaad config setup\n');
    }

    // Show which specific keys are configured
    const config = loadUserConfig();
    if (config.apiKeys) {
      console.log('🔍 Configured Services:');
      const services = [
        'openrouter',
        'groq',
        'deepseek',
        'gemini',
        'weatherapi',
      ];
      services.forEach(service => {
        const hasKey = config.apiKeys[service];
        console.log(`   ${service}: ${hasKey ? '✅' : '❌'}`);
      });
    }
  }

  /**
   * Set a specific API key
   */
  async setApiKey(service, key) {
    if (!service || !key) {
      console.log('❌ Usage: mdsaad config set <service> <api_key>');
      console.log(
        '   Services: openrouter, groq, deepseek, gemini, weatherapi'
      );
      return;
    }

    const validServices = [
      'openrouter',
      'groq',
      'deepseek',
      'gemini',
      'weatherapi',
    ];
    if (!validServices.includes(service.toLowerCase())) {
      console.log(
        `❌ Invalid service. Valid options: ${validServices.join(', ')}`
      );
      return;
    }

    const config = loadUserConfig() || {};
    if (!config.apiKeys) config.apiKeys = {};

    config.apiKeys[service.toLowerCase()] = key;

    const saved = saveUserConfig(config);
    if (saved) {
      console.log(`✅ ${service} API key saved successfully!`);
    } else {
      console.log(`❌ Failed to save ${service} API key`);
    }
  }

  /**
   * Remove configuration
   */
  removeConfig() {
    if (fs.existsSync(CONFIG_FILE)) {
      try {
        fs.unlinkSync(CONFIG_FILE);
        console.log('✅ Configuration removed successfully!');
      } catch (error) {
        console.log('❌ Failed to remove configuration:', error.message);
      }
    } else {
      console.log('ℹ️  No configuration file to remove');
    }
  }

  /**
   * Show help for configuration
   */
  showHelp() {
    console.log('\n🔧 MDSAAD Configuration Help');
    console.log('===============================\n');

    console.log('Usage: mdsaad config <subcommand>\n');

    console.log('Subcommands:');
    Object.entries(this.subcommands).forEach(([cmd, desc]) => {
      console.log(`   ${cmd.padEnd(8)} - ${desc}`);
    });

    console.log('\nExamples:');
    console.log(
      '   mdsaad config setup                    # Interactive setup'
    );
    console.log(
      '   mdsaad config show                     # Show current status'
    );
    console.log('   mdsaad config set openrouter sk-123... # Set specific key');
    console.log(
      '   mdsaad config remove                   # Remove all config'
    );

    const instructions = getSetupInstructions();
    console.log('\n' + instructions.message);

    instructions.methods.forEach(method => {
      console.log(`\n${method.title}:`);
      method.instructions.forEach(inst => {
        console.log(`   ${inst}`);
      });
    });
  }
}

module.exports = ConfigCommand;
