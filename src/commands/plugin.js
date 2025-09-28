/**
 * Plugin Command
 * Interface for managing plugins (install, uninstall, list, etc.)
 */

const { Command } = require('commander');
const pluginManager = require('../services/plugin-manager');
const errorHandler = require('../services/error-handler');
const debugService = require('../services/debug-service');
const outputFormatter = require('../services/output-formatter');
const fs = require('fs-extra');
const path = require('path');

const pluginCommand = new Command('plugin');

pluginCommand
  .description('🔌 Plugin management system')
  .option('-l, --list', 'List all installed plugins')
  .option('-i, --install <source>', 'Install plugin from file or URL')
  .option('-u, --uninstall <name>', 'Uninstall a plugin')
  .option('-e, --enable <name>', 'Enable a plugin')
  .option('-d, --disable <name>', 'Disable a plugin')
  .option('--info <name>', 'Show detailed plugin information')
  .option('--stats', 'Show plugin system statistics')
  .option('--reload <name>', 'Reload a specific plugin')
  .option('--create <name>', 'Create a new plugin template')
  .option('--validate <path>', 'Validate a plugin file')
  .action(async options => {
    try {
      debugService.markPerformance('plugin_command', 'start');
      debugService.debug('Executing plugin command', { options }, 'plugin');

      // Initialize plugin manager if needed
      if (!pluginManager.isInitialized) {
        console.log(
          outputFormatter.loading('🔌 Initializing plugin system...')
        );
        await pluginManager.initialize();
      }

      // Handle different plugin operations
      if (options.list) {
        await listPlugins();
        return;
      }

      if (options.install) {
        await installPlugin(options.install);
        return;
      }

      if (options.uninstall) {
        await uninstallPlugin(options.uninstall);
        return;
      }

      if (options.enable) {
        await enablePlugin(options.enable);
        return;
      }

      if (options.disable) {
        await disablePlugin(options.disable);
        return;
      }

      if (options.info) {
        await showPluginInfo(options.info);
        return;
      }

      if (options.stats) {
        await showPluginStats();
        return;
      }

      if (options.reload) {
        await reloadPlugin(options.reload);
        return;
      }

      if (options.create) {
        await createPluginTemplate(options.create);
        return;
      }

      if (options.validate) {
        await validatePlugin(options.validate);
        return;
      }

      // Default: show plugin overview
      await showPluginOverview();

      debugService.markPerformance('plugin_command', 'end');
      debugService.debug('Plugin command completed successfully');
    } catch (error) {
      debugService.markPerformance('plugin_command', 'end');

      await errorHandler.handleError(error, {
        command: 'plugin',
        context: { options },
        userFriendly: true,
      });
    }
  });

/**
 * List all installed plugins
 */
async function listPlugins() {
  const plugins = pluginManager.listPlugins();

  if (plugins.length === 0) {
    console.log(outputFormatter.info('📭 No plugins installed'));
    console.log(
      outputFormatter.info(
        'Use "mdsaad plugin --create <name>" to create your first plugin'
      )
    );
    return;
  }

  console.log(outputFormatter.header('🔌 Installed Plugins'));

  const pluginData = plugins.map(plugin => [
    plugin.name,
    plugin.version || '1.0.0',
    plugin.type,
    plugin.active ? '✅ Active' : '❌ Inactive',
    plugin.commands.length.toString(),
    plugin.description || 'No description',
  ]);

  console.log(
    outputFormatter.formatTable('Plugins', pluginData, {
      headers: ['Name', 'Version', 'Type', 'Status', 'Commands', 'Description'],
      maxWidth: 120,
    })
  );

  console.log(outputFormatter.muted(`\nTotal: ${plugins.length} plugins`));
}

/**
 * Install a plugin
 */
async function installPlugin(source) {
  try {
    console.log(
      outputFormatter.loading(`🔄 Installing plugin from: ${source}`)
    );

    const plugin = await pluginManager.installPlugin(source);

    console.log(
      outputFormatter.success(
        `✅ Plugin installed successfully: ${plugin.name}`
      )
    );
    console.log(outputFormatter.info(`   Version: ${plugin.version}`));
    console.log(outputFormatter.info(`   Commands: ${plugin.commands.length}`));

    if (plugin.description) {
      console.log(
        outputFormatter.info(`   Description: ${plugin.description}`)
      );
    }
  } catch (error) {
    console.log(
      outputFormatter.error(`❌ Installation failed: ${error.message}`)
    );
    console.log(
      outputFormatter.info(
        'Use "mdsaad plugin --validate <path>" to check plugin format'
      )
    );
  }
}

/**
 * Uninstall a plugin
 */
async function uninstallPlugin(pluginName) {
  try {
    const plugin = pluginManager.getPlugin(pluginName);
    if (!plugin) {
      console.log(
        outputFormatter.warning(`⚠️ Plugin not found: ${pluginName}`)
      );
      return;
    }

    console.log(
      outputFormatter.loading(`🔄 Uninstalling plugin: ${pluginName}`)
    );

    await pluginManager.uninstallPlugin(pluginName);

    console.log(
      outputFormatter.success(`✅ Plugin uninstalled: ${pluginName}`)
    );
  } catch (error) {
    console.log(
      outputFormatter.error(`❌ Uninstallation failed: ${error.message}`)
    );
  }
}

/**
 * Enable a plugin (placeholder - plugins are auto-enabled when loaded)
 */
async function enablePlugin(pluginName) {
  const plugin = pluginManager.getPlugin(pluginName);
  if (!plugin) {
    console.log(outputFormatter.warning(`⚠️ Plugin not found: ${pluginName}`));
    return;
  }

  if (plugin.active) {
    console.log(
      outputFormatter.info(`ℹ️ Plugin already active: ${pluginName}`)
    );
    return;
  }

  // For now, plugins are automatically enabled when loaded
  console.log(
    outputFormatter.info(`ℹ️ Plugin enable/disable functionality coming soon`)
  );
  console.log(
    outputFormatter.muted('Plugins are currently auto-enabled when installed')
  );
}

/**
 * Disable a plugin (placeholder)
 */
async function disablePlugin(pluginName) {
  const plugin = pluginManager.getPlugin(pluginName);
  if (!plugin) {
    console.log(outputFormatter.warning(`⚠️ Plugin not found: ${pluginName}`));
    return;
  }

  console.log(
    outputFormatter.info(`ℹ️ Plugin enable/disable functionality coming soon`)
  );
  console.log(
    outputFormatter.info(
      'Use "mdsaad plugin --uninstall" to remove plugins for now'
    )
  );
}

/**
 * Show detailed plugin information
 */
async function showPluginInfo(pluginName) {
  const plugin = pluginManager.getPlugin(pluginName);
  if (!plugin) {
    console.log(outputFormatter.warning(`⚠️ Plugin not found: ${pluginName}`));
    return;
  }

  console.log(outputFormatter.header(`🔌 Plugin: ${plugin.name}`));

  const info = {
    Name: plugin.name,
    Version: plugin.version || '1.0.0',
    Type: plugin.type,
    Status: plugin.active ? '✅ Active' : '❌ Inactive',
    Description: plugin.description || 'No description',
    Path: plugin.path,
    Commands: plugin.commands.length > 0 ? plugin.commands.join(', ') : 'None',
    Hooks: plugin.hooks.length > 0 ? plugin.hooks.join(', ') : 'None',
    'Loaded At': new Date(plugin.loadTime).toLocaleString(),
  };

  console.log(outputFormatter.formatObject('Plugin Information', info));

  if (plugin.packageJson) {
    console.log(outputFormatter.subheader('Package Information'));
    const packageInfo = {
      Author: plugin.packageJson.author || 'Unknown',
      License: plugin.packageJson.license || 'Unknown',
      Keywords: plugin.packageJson.keywords
        ? plugin.packageJson.keywords.join(', ')
        : 'None',
    };
    console.log(outputFormatter.formatObject('Package', packageInfo));
  }
}

/**
 * Show plugin system statistics
 */
async function showPluginStats() {
  const stats = pluginManager.getStatistics();

  console.log(outputFormatter.header('📊 Plugin System Statistics'));

  const statsData = {
    'Total Plugins': stats.totalPlugins,
    'Active Plugins': stats.activePlugins,
    'System Plugins': stats.systemPlugins,
    'User Plugins': stats.userPlugins,
    'Registered Commands': stats.totalCommands,
    'Registered Hooks': stats.totalHooks,
  };

  console.log(outputFormatter.formatObject('Statistics', statsData));

  if (stats.totalPlugins > 0) {
    console.log(outputFormatter.subheader('Plugin Breakdown'));
    const plugins = pluginManager.listPlugins();

    plugins.forEach(plugin => {
      const status = plugin.active ? '🟢' : '🔴';
      console.log(
        `   ${status} ${plugin.name} (${plugin.type}) - ${plugin.commands.length} commands`
      );
    });
  }
}

/**
 * Reload a plugin
 */
async function reloadPlugin(pluginName) {
  try {
    const plugin = pluginManager.getPlugin(pluginName);
    if (!plugin) {
      console.log(
        outputFormatter.warning(`⚠️ Plugin not found: ${pluginName}`)
      );
      return;
    }

    console.log(outputFormatter.loading(`🔄 Reloading plugin: ${pluginName}`));

    // Store plugin info before unloading
    const pluginPath = plugin.path;
    const pluginType = plugin.type;

    // Unload and reload
    await pluginManager.unloadPlugin(pluginName);

    const pluginInfo = {
      path: pluginPath,
      name: pluginName,
      version: plugin.version || '1.0.0',
      description: plugin.description,
    };

    await pluginManager.loadPlugin(pluginInfo, pluginType);

    console.log(outputFormatter.success(`✅ Plugin reloaded: ${pluginName}`));
  } catch (error) {
    console.log(outputFormatter.error(`❌ Reload failed: ${error.message}`));
  }
}

/**
 * Create a new plugin template
 */
async function createPluginTemplate(pluginName) {
  try {
    const pluginDir = path.join(pluginManager.pluginDirectory, pluginName);

    if (await fs.pathExists(pluginDir)) {
      console.log(
        outputFormatter.warning(
          `⚠️ Plugin directory already exists: ${pluginName}`
        )
      );
      return;
    }

    console.log(
      outputFormatter.loading(`🔄 Creating plugin template: ${pluginName}`)
    );

    // Create plugin directory
    await fs.ensureDir(pluginDir);

    // Create package.json
    const packageJson = {
      name: pluginName,
      version: '1.0.0',
      description: `A plugin for MDSAAD CLI`,
      main: 'index.js',
      keywords: ['mdsaad-plugin'],
      author: 'Your Name',
      license: 'MIT',
    };

    await fs.writeJson(path.join(pluginDir, 'package.json'), packageJson, {
      spaces: 2,
    });

    // Create main plugin file
    const className = pluginName
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('');

    const pluginTemplate = `/**
 * ${pluginName} Plugin for MDSAAD CLI
 * 
 * This is a sample plugin that demonstrates the MDSAAD plugin API
 */

class ${className}Plugin {
  constructor() {
    this.name = '${pluginName}';
    this.version = '1.0.0';
  }

  /**
   * Initialize the plugin
   * @param {object} api - The MDSAAD plugin API
   */
  async initialize(api) {
    this.api = api;
    this.logger = api.createLogger(this.name);
    this.cache = api.createCache(this.name);

    // Register a sample command
    api.registerCommand('${pluginName}-hello', this.helloCommand.bind(this), this.name);

    // Register a hook example
    api.registerHook('before-command', this.beforeCommand.bind(this), this.name);

    this.logger.info('Plugin initialized successfully');
  }

  /**
   * Sample command handler
   */
  async helloCommand(args, options) {
    const name = args[0] || 'World';
    const message = \`Hello, \${name}! This is the \${this.name} plugin.\`;
    
    console.log(this.api.outputFormatter.success(message));
    
    // Example of using plugin configuration
    const greeting = this.api.getConfig(this.name, 'greeting', 'Hello');
    console.log(this.api.outputFormatter.info(\`Custom greeting: \${greeting}\`));

    return { success: true, message };
  }

  /**
   * Hook handler example
   */
  async beforeCommand(data) {
    this.logger.debug('Before command hook triggered', data);
    return data;
  }

  /**
   * Cleanup function (optional)
   */
  async cleanup() {
    this.logger.info('Plugin cleanup completed');
  }
}

// Export the plugin
module.exports = new ${className}Plugin();
`;

    await fs.writeFile(path.join(pluginDir, 'index.js'), pluginTemplate);

    // Create README
    const readmeContent = `# ${pluginName} Plugin

A plugin for the MDSAAD CLI tool.

## Installation

Copy this directory to your MDSAAD plugins directory or use:
\`\`\`bash
mdsaad plugin --install ${pluginDir}
\`\`\`

## Usage

After installation, you can use the following command:
\`\`\`bash
mdsaad ${pluginName}-hello [name]
\`\`\`

## Configuration

You can configure the plugin using:
\`\`\`bash
mdsaad config --set plugins.${pluginName}.greeting "Custom Greeting"
\`\`\`

## Development

Edit \`index.js\` to customize the plugin functionality.

See the MDSAAD plugin API documentation for more details.
`;

    await fs.writeFile(path.join(pluginDir, 'README.md'), readmeContent);

    console.log(
      outputFormatter.success(`✅ Plugin template created: ${pluginName}`)
    );
    console.log(outputFormatter.info(`📁 Location: ${pluginDir}`));
    console.log(
      outputFormatter.info(
        'Edit the files and install with: mdsaad plugin --install ' + pluginDir
      )
    );
  } catch (error) {
    console.log(
      outputFormatter.error(`❌ Template creation failed: ${error.message}`)
    );
  }
}

/**
 * Validate a plugin file
 */
async function validatePlugin(pluginPath) {
  try {
    console.log(outputFormatter.loading(`🔍 Validating plugin: ${pluginPath}`));

    // Check if file exists
    if (!(await fs.pathExists(pluginPath))) {
      console.log(outputFormatter.error('❌ Plugin file not found'));
      return;
    }

    // Try to load the plugin
    let pluginModule;
    try {
      pluginModule = require(path.resolve(pluginPath));
    } catch (error) {
      console.log(
        outputFormatter.error(`❌ Failed to load plugin: ${error.message}`)
      );
      return;
    }

    // Basic validation
    const validations = [
      {
        test: typeof pluginModule === 'object',
        message: 'Plugin should export an object',
      },
      {
        test: typeof pluginModule.initialize === 'function',
        message: 'Plugin should have an initialize method',
      },
    ];

    let isValid = true;
    for (const validation of validations) {
      if (validation.test) {
        console.log(outputFormatter.success(`✅ ${validation.message}`));
      } else {
        console.log(outputFormatter.error(`❌ ${validation.message}`));
        isValid = false;
      }
    }

    if (isValid) {
      console.log(outputFormatter.success('🎉 Plugin validation passed!'));
    } else {
      console.log(outputFormatter.warning('⚠️ Plugin validation failed'));
      console.log(
        outputFormatter.muted(
          'See plugin template: mdsaad plugin --create example'
        )
      );
    }
  } catch (error) {
    console.log(outputFormatter.error(`❌ Validation error: ${error.message}`));
  }
}

/**
 * Show plugin overview
 */
async function showPluginOverview() {
  console.log(outputFormatter.header('🔌 MDSAAD Plugin System'));

  const stats = pluginManager.getStatistics();
  console.log(
    outputFormatter.info(
      `📊 ${stats.totalPlugins} plugins installed (${stats.activePlugins} active)`
    )
  );

  if (stats.totalPlugins > 0) {
    console.log('\n' + outputFormatter.subheader('Quick Actions'));
    console.log(
      outputFormatter.muted(
        '   mdsaad plugin --list              List all plugins'
      )
    );
    console.log(
      outputFormatter.muted(
        '   mdsaad plugin --info <name>       Show plugin details'
      )
    );
    console.log(
      outputFormatter.muted(
        '   mdsaad plugin --stats             Show detailed statistics'
      )
    );
  }

  console.log('\n' + outputFormatter.subheader('Plugin Development'));
  console.log(
    outputFormatter.muted(
      '   mdsaad plugin --create <name>     Create plugin template'
    )
  );
  console.log(
    outputFormatter.muted(
      '   mdsaad plugin --validate <path>   Validate plugin format'
    )
  );
  console.log(
    outputFormatter.muted(
      '   mdsaad plugin --install <path>    Install plugin from file'
    )
  );

  console.log(
    '\n' +
      outputFormatter.rainbow('🔌 Extend MDSAAD with custom functionality!')
  );
}

module.exports = pluginCommand;
