/**
 * Plugin Manager Service
 * Manages plugin discovery, loading, registration, and lifecycle
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const outputFormatter = require('./output-formatter');
const debugService = require('./debug-service');

class PluginManager extends EventEmitter {
  constructor() {
    super();
    this.plugins = new Map();
    this.pluginDirectory = path.join(os.homedir(), '.mdsaad', 'plugins');
    this.systemPluginDirectory = path.join(__dirname, '..', 'plugins');
    this.isInitialized = false;
    this.pluginApi = null;
    this.hooks = new Map();
    this.loadedCommands = new Map();
  }

  /**
   * Initialize the plugin manager
   */
  async initialize() {
    try {
      debugService.debug('Initializing plugin manager', null, 'plugin');

      // Ensure plugin directories exist
      await fs.ensureDir(this.pluginDirectory);
      await fs.ensureDir(this.systemPluginDirectory);

      // Initialize plugin API
      this.initializePluginAPI();

      // Load system plugins first
      await this.loadSystemPlugins();

      // Load user plugins
      await this.loadUserPlugins();

      this.isInitialized = true;
      debugService.debug(
        `Plugin manager initialized with ${this.plugins.size} plugins`
      );
      this.emit('initialized', { pluginCount: this.plugins.size });

      return true;
    } catch (error) {
      debugService.debug(
        'Plugin manager initialization failed',
        { error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Initialize the Plugin API that will be provided to plugins
   */
  initializePluginAPI() {
    this.pluginApi = {
      // Core services
      outputFormatter: require('./output-formatter'),
      debugService: require('./debug-service'),
      configService: require('./config'),
      cacheService: require('./cache'),

      // Utility functions
      registerCommand: this.registerCommand.bind(this),
      registerHook: this.registerHook.bind(this),
      executeHook: this.executeHook.bind(this),
      getConfig: this.getConfig.bind(this),
      setConfig: this.setConfig.bind(this),

      // Plugin utilities
      createLogger: this.createPluginLogger.bind(this),
      createCache: this.createPluginCache.bind(this),

      // Version info
      version: require('../../package.json').version,
      apiVersion: '1.0.0',
    };
  }

  /**
   * Load system plugins (built-in plugins)
   */
  async loadSystemPlugins() {
    try {
      const systemPluginFiles = await this.discoverPlugins(
        this.systemPluginDirectory
      );

      for (const pluginFile of systemPluginFiles) {
        await this.loadPlugin(pluginFile, 'system');
      }

      debugService.debug(`Loaded ${systemPluginFiles.length} system plugins`);
    } catch (error) {
      debugService.debug(
        'Error loading system plugins',
        { error: error.message },
        'plugin'
      );
    }
  }

  /**
   * Load user plugins (installed by user)
   */
  async loadUserPlugins() {
    try {
      const userPluginFiles = await this.discoverPlugins(this.pluginDirectory);

      for (const pluginFile of userPluginFiles) {
        await this.loadPlugin(pluginFile, 'user');
      }

      debugService.debug(`Loaded ${userPluginFiles.length} user plugins`);
    } catch (error) {
      debugService.debug(
        'Error loading user plugins',
        { error: error.message },
        'plugin'
      );
    }
  }

  /**
   * Discover plugin files in a directory
   */
  async discoverPlugins(directory) {
    try {
      const files = await fs.readdir(directory);
      const pluginFiles = [];

      for (const file of files) {
        const filePath = path.join(directory, file);
        const stat = await fs.stat(filePath);

        if (stat.isDirectory()) {
          // Check for package.json with mdsaad-plugin keyword
          const packagePath = path.join(filePath, 'package.json');
          if (await fs.pathExists(packagePath)) {
            const packageJson = await fs.readJson(packagePath);
            if (
              packageJson.keywords &&
              packageJson.keywords.includes('mdsaad-plugin')
            ) {
              const entryPoint = path.join(
                filePath,
                packageJson.main || 'index.js'
              );
              if (await fs.pathExists(entryPoint)) {
                pluginFiles.push({
                  path: entryPoint,
                  name: packageJson.name,
                  version: packageJson.version,
                  description: packageJson.description,
                  packageJson,
                });
              }
            }
          }
        } else if (file.endsWith('.js') && file.startsWith('plugin-')) {
          // Simple JavaScript plugin file
          pluginFiles.push({
            path: filePath,
            name: path.basename(file, '.js'),
            version: '1.0.0',
            description: 'Simple plugin',
          });
        }
      }

      return pluginFiles;
    } catch (error) {
      debugService.debug(
        'Error discovering plugins',
        { directory, error: error.message },
        'plugin'
      );
      return [];
    }
  }

  /**
   * Load a single plugin
   */
  async loadPlugin(pluginInfo, type = 'user') {
    try {
      debugService.debug(
        `Loading plugin: ${pluginInfo.name}`,
        pluginInfo,
        'plugin'
      );

      // Validate plugin before loading
      if (!(await this.validatePlugin(pluginInfo))) {
        throw new Error(`Plugin validation failed: ${pluginInfo.name}`);
      }

      // Load the plugin module
      let pluginModule;
      try {
        delete require.cache[require.resolve(pluginInfo.path)]; // Clear cache
        pluginModule = require(pluginInfo.path);
      } catch (error) {
        throw new Error(`Failed to load plugin module: ${error.message}`);
      }

      // Initialize plugin
      const plugin = {
        ...pluginInfo,
        type,
        module: pluginModule,
        active: false,
        loadTime: Date.now(),
        commands: [],
        hooks: [],
      };

      // Call plugin initialization if available
      if (typeof pluginModule.initialize === 'function') {
        await pluginModule.initialize(this.pluginApi);
      }

      // Register the plugin
      this.plugins.set(pluginInfo.name, plugin);
      plugin.active = true;

      debugService.debug(`Plugin loaded successfully: ${pluginInfo.name}`);
      this.emit('pluginLoaded', plugin);

      return plugin;
    } catch (error) {
      debugService.debug(
        `Failed to load plugin: ${pluginInfo.name}`,
        { error: error.message },
        'plugin'
      );
      this.emit('pluginError', {
        plugin: pluginInfo.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Validate plugin before loading
   */
  async validatePlugin(pluginInfo) {
    try {
      // Check if file exists
      if (!(await fs.pathExists(pluginInfo.path))) {
        debugService.debug(
          `Plugin file not found: ${pluginInfo.path}`,
          null,
          'plugin'
        );
        return false;
      }

      // Basic security check - no relative paths outside plugin directory
      const resolvedPath = path.resolve(pluginInfo.path);
      const pluginDirResolved = path.resolve(this.pluginDirectory);
      const systemPluginDirResolved = path.resolve(this.systemPluginDirectory);

      const isInUserDir = resolvedPath.startsWith(pluginDirResolved);
      const isInSystemDir = resolvedPath.startsWith(systemPluginDirResolved);

      if (!isInUserDir && !isInSystemDir) {
        debugService.debug(
          `Plugin outside allowed directories: ${resolvedPath}`,
          null,
          'plugin'
        );
        return false;
      }

      // Check if plugin is already loaded
      if (this.plugins.has(pluginInfo.name)) {
        debugService.debug(
          `Plugin already loaded: ${pluginInfo.name}`,
          null,
          'plugin'
        );
        return false;
      }

      return true;
    } catch (error) {
      debugService.debug(
        'Plugin validation error',
        { plugin: pluginInfo.name, error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Register a command from a plugin
   */
  registerCommand(commandName, commandHandler, pluginName) {
    try {
      if (this.loadedCommands.has(commandName)) {
        throw new Error(`Command '${commandName}' already registered`);
      }

      const command = {
        name: commandName,
        handler: commandHandler,
        plugin: pluginName,
        registeredAt: Date.now(),
      };

      this.loadedCommands.set(commandName, command);

      // Add to plugin's command list
      const plugin = this.plugins.get(pluginName);
      if (plugin) {
        plugin.commands.push(commandName);
      }

      debugService.debug(
        `Command registered: ${commandName} by ${pluginName}`,
        null,
        'plugin'
      );
      this.emit('commandRegistered', command);

      return true;
    } catch (error) {
      debugService.debug(
        'Command registration failed',
        { command: commandName, plugin: pluginName, error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Register a hook from a plugin
   */
  registerHook(hookName, hookHandler, pluginName) {
    try {
      if (!this.hooks.has(hookName)) {
        this.hooks.set(hookName, []);
      }

      const hook = {
        handler: hookHandler,
        plugin: pluginName,
        registeredAt: Date.now(),
      };

      this.hooks.get(hookName).push(hook);

      // Add to plugin's hook list
      const plugin = this.plugins.get(pluginName);
      if (plugin) {
        plugin.hooks.push(hookName);
      }

      debugService.debug(
        `Hook registered: ${hookName} by ${pluginName}`,
        null,
        'plugin'
      );
      return true;
    } catch (error) {
      debugService.debug(
        'Hook registration failed',
        { hook: hookName, plugin: pluginName, error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Execute all handlers for a hook
   */
  async executeHook(hookName, data = {}) {
    try {
      const hookHandlers = this.hooks.get(hookName);
      if (!hookHandlers || hookHandlers.length === 0) {
        return data; // No handlers, return original data
      }

      let result = data;

      for (const hook of hookHandlers) {
        try {
          if (typeof hook.handler === 'function') {
            result = await hook.handler(result);
          }
        } catch (error) {
          debugService.debug(
            `Hook handler error: ${hookName}`,
            { plugin: hook.plugin, error: error.message },
            'plugin'
          );
        }
      }

      return result;
    } catch (error) {
      debugService.debug(
        'Hook execution error',
        { hook: hookName, error: error.message },
        'plugin'
      );
      return data;
    }
  }

  /**
   * Get configuration value for a plugin
   */
  getConfig(pluginName, key, defaultValue = null) {
    try {
      const configService = require('./config');
      return configService.get(`plugins.${pluginName}.${key}`, defaultValue);
    } catch (error) {
      debugService.debug(
        'Plugin config get error',
        { plugin: pluginName, key, error: error.message },
        'plugin'
      );
      return defaultValue;
    }
  }

  /**
   * Set configuration value for a plugin
   */
  setConfig(pluginName, key, value) {
    try {
      const configService = require('./config');
      configService.set(`plugins.${pluginName}.${key}`, value);
      return true;
    } catch (error) {
      debugService.debug(
        'Plugin config set error',
        { plugin: pluginName, key, error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Create a logger instance for a plugin
   */
  createPluginLogger(pluginName) {
    return {
      debug: (message, data) =>
        debugService.debug(message, data, `plugin:${pluginName}`),
      info: message =>
        console.log(outputFormatter.info(`[${pluginName}] ${message}`)),
      warning: message =>
        console.log(outputFormatter.warning(`[${pluginName}] ${message}`)),
      error: message =>
        console.log(outputFormatter.error(`[${pluginName}] ${message}`)),
      success: message =>
        console.log(outputFormatter.success(`[${pluginName}] ${message}`)),
    };
  }

  /**
   * Create a cache instance for a plugin
   */
  createPluginCache(pluginName) {
    const cacheService = require('./cache');
    return {
      get: key => cacheService.get(`plugin:${pluginName}:${key}`),
      set: (key, value, ttl) =>
        cacheService.set(`plugin:${pluginName}:${key}`, value, ttl),
      delete: key => cacheService.delete(`plugin:${pluginName}:${key}`),
      clear: () => cacheService.clear(`plugin:${pluginName}`),
    };
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginName) {
    try {
      const plugin = this.plugins.get(pluginName);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      // Call plugin cleanup if available
      if (typeof plugin.module.cleanup === 'function') {
        await plugin.module.cleanup();
      }

      // Remove registered commands
      for (const commandName of plugin.commands) {
        this.loadedCommands.delete(commandName);
      }

      // Remove registered hooks
      for (const hookName of plugin.hooks) {
        const hooks = this.hooks.get(hookName);
        if (hooks) {
          this.hooks.set(
            hookName,
            hooks.filter(h => h.plugin !== pluginName)
          );
        }
      }

      // Remove plugin
      this.plugins.delete(pluginName);

      debugService.debug(`Plugin unloaded: ${pluginName}`);
      this.emit('pluginUnloaded', { name: pluginName });

      return true;
    } catch (error) {
      debugService.debug(
        'Plugin unload error',
        { plugin: pluginName, error: error.message },
        'plugin'
      );
      return false;
    }
  }

  /**
   * Get plugin information
   */
  getPlugin(pluginName) {
    return this.plugins.get(pluginName);
  }

  /**
   * List all loaded plugins
   */
  listPlugins() {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugin statistics
   */
  getStatistics() {
    const plugins = this.listPlugins();

    return {
      totalPlugins: plugins.length,
      activePlugins: plugins.filter(p => p.active).length,
      systemPlugins: plugins.filter(p => p.type === 'system').length,
      userPlugins: plugins.filter(p => p.type === 'user').length,
      totalCommands: this.loadedCommands.size,
      totalHooks: Array.from(this.hooks.values()).reduce(
        (sum, hooks) => sum + hooks.length,
        0
      ),
    };
  }

  /**
   * Install a plugin from a file or URL
   */
  async installPlugin(source) {
    try {
      debugService.debug(`Installing plugin from: ${source}`, null, 'plugin');

      // Implementation would depend on source type (file, npm package, git repo)
      // For now, we'll implement basic file copying

      if (await fs.pathExists(source)) {
        const pluginName = path.basename(source, path.extname(source));
        const targetPath = path.join(this.pluginDirectory, pluginName + '.js');

        await fs.copy(source, targetPath);
        debugService.debug(`Plugin file copied to: ${targetPath}`);

        // Load the plugin
        const pluginInfo = {
          path: targetPath,
          name: pluginName,
          version: '1.0.0',
          description: 'Installed plugin',
        };

        return await this.loadPlugin(pluginInfo, 'user');
      } else {
        throw new Error('Plugin source not found or not supported');
      }
    } catch (error) {
      debugService.debug(
        'Plugin installation failed',
        { source, error: error.message },
        'plugin'
      );
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginName) {
    try {
      const plugin = this.getPlugin(pluginName);
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginName}`);
      }

      if (plugin.type === 'system') {
        throw new Error('Cannot uninstall system plugins');
      }

      // Unload the plugin first
      await this.unloadPlugin(pluginName);

      // Remove plugin file
      await fs.remove(plugin.path);

      debugService.debug(`Plugin uninstalled: ${pluginName}`);
      return true;
    } catch (error) {
      debugService.debug(
        'Plugin uninstall failed',
        { plugin: pluginName, error: error.message },
        'plugin'
      );
      throw error;
    }
  }
}

module.exports = new PluginManager();
