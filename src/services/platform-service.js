/**
 * Platform Service
 * Handles cross-platform compatibility and platform-specific features
 */

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { execSync, spawn } = require('child_process');
const debugService = require('./debug-service');

class PlatformService {
  constructor() {
    this.platform = os.platform();
    this.arch = os.arch();
    this.isWindows = this.platform === 'win32';
    this.isMacOS = this.platform === 'darwin';
    this.isLinux = this.platform === 'linux';
    this.homeDir = os.homedir();
    this.isInitialized = false;
  }

  /**
   * Initialize platform service
   */
  async initialize() {
    try {
      await this.detectTerminalFeatures();
      await this.detectPackageManagers();
      await this.setupPlatformPaths();

      this.isInitialized = true;
      debugService.debug('Platform service initialized', {
        platform: this.platform,
        arch: this.arch,
        terminalFeatures: this.terminalFeatures,
      });

      return true;
    } catch (error) {
      debugService.debug('Platform service initialization failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Detect terminal capabilities and features
   */
  async detectTerminalFeatures() {
    this.terminalFeatures = {
      colors: this.supportsColors(),
      unicode: this.supportsUnicode(),
      interactivity: this.supportsInteractivity(),
      tabCompletion: await this.detectTabCompletionSupport(),
      shell: this.detectShell(),
      terminalType: this.detectTerminalType(),
    };
  }

  /**
   * Check if terminal supports colors
   */
  supportsColors() {
    // Check environment variables
    if (process.env.FORCE_COLOR || process.env.npm_config_color === 'always') {
      return true;
    }

    if (process.env.NO_COLOR || process.env.npm_config_color === 'never') {
      return false;
    }

    // Check if we're in a TTY
    if (!process.stdout.isTTY) {
      return false;
    }

    // Windows-specific checks
    if (this.isWindows) {
      // Windows 10 version 1511+ supports ANSI colors
      const release = os.release();
      const version = release.split('.').map(Number);
      if (
        version[0] > 10 ||
        (version[0] === 10 && version[1] >= 0 && version[2] >= 10586)
      ) {
        return true;
      }

      // Check for Windows Terminal, ConEmu, etc.
      const terminal =
        process.env.TERM_PROGRAM ||
        process.env.WT_SESSION ||
        process.env.ConEmuPID;
      return Boolean(terminal);
    }

    // Unix-like systems
    const term = (process.env.TERM || '').toLowerCase();
    if (term === 'dumb') {
      return false;
    }

    return true;
  }

  /**
   * Check if terminal supports Unicode
   */
  supportsUnicode() {
    // Check environment locale
    const locale =
      process.env.LC_ALL || process.env.LC_CTYPE || process.env.LANG || '';

    if (
      locale.toLowerCase().includes('utf-8') ||
      locale.toLowerCase().includes('utf8')
    ) {
      return true;
    }

    // Windows-specific Unicode support
    if (this.isWindows) {
      // Modern Windows terminals support Unicode
      return Boolean(process.env.WT_SESSION || process.env.ConEmuPID);
    }

    // macOS and modern Linux distributions generally support Unicode
    return this.isMacOS || this.isLinux;
  }

  /**
   * Check if terminal supports interactivity
   */
  supportsInteractivity() {
    return Boolean(process.stdin.isTTY && process.stdout.isTTY);
  }

  /**
   * Detect shell type
   */
  detectShell() {
    if (this.isWindows) {
      // Windows shell detection
      const shell = process.env.SHELL || process.env.COMSPEC || '';
      if (shell.includes('powershell') || shell.includes('pwsh')) {
        return 'powershell';
      }
      if (shell.includes('cmd')) {
        return 'cmd';
      }
      if (shell.includes('bash')) {
        return 'bash';
      }
      return 'unknown';
    } else {
      // Unix-like shell detection
      const shell = process.env.SHELL || '';
      const shellName = path.basename(shell);
      return shellName || 'unknown';
    }
  }

  /**
   * Detect terminal type
   */
  detectTerminalType() {
    // Check various terminal environment variables
    const terminals = [
      { env: 'WT_SESSION', name: 'Windows Terminal' },
      { env: 'ConEmuPID', name: 'ConEmu' },
      { env: 'TERM_PROGRAM', name: process.env.TERM_PROGRAM },
      { env: 'ITERM_SESSION_ID', name: 'iTerm2' },
      { env: 'GNOME_TERMINAL_SCREEN', name: 'GNOME Terminal' },
      { env: 'KONSOLE_VERSION', name: 'Konsole' },
    ];

    for (const terminal of terminals) {
      if (process.env[terminal.env]) {
        return terminal.name;
      }
    }

    return process.env.TERM || 'unknown';
  }

  /**
   * Detect tab completion support
   */
  async detectTabCompletionSupport() {
    const shell = this.detectShell();

    const supportMap = {
      bash: { supported: true, configFile: '.bashrc' },
      zsh: { supported: true, configFile: '.zshrc' },
      fish: { supported: true, configFile: 'config.fish' },
      powershell: {
        supported: true,
        configFile: 'Microsoft.PowerShell_profile.ps1',
      },
      pwsh: { supported: true, configFile: 'Microsoft.PowerShell_profile.ps1' },
      cmd: { supported: false, configFile: null },
    };

    return supportMap[shell] || { supported: false, configFile: null };
  }

  /**
   * Detect available package managers
   */
  async detectPackageManagers() {
    const managers = ['npm', 'yarn', 'pnpm'];
    this.availablePackageManagers = {};

    for (const manager of managers) {
      try {
        const version = execSync(`${manager} --version`, {
          encoding: 'utf8',
          timeout: 5000,
          stdio: 'pipe',
        }).trim();

        this.availablePackageManagers[manager] = {
          available: true,
          version,
          global: await this.checkGlobalInstallation(manager),
        };
      } catch (error) {
        this.availablePackageManagers[manager] = {
          available: false,
          version: null,
          global: false,
        };
      }
    }
  }

  /**
   * Check if CLI is installed globally via package manager
   */
  async checkGlobalInstallation(manager) {
    try {
      let command;
      switch (manager) {
        case 'npm':
          command = 'npm list -g mdsaad --depth=0';
          break;
        case 'yarn':
          command = 'yarn global list';
          break;
        case 'pnpm':
          command = 'pnpm list -g mdsaad';
          break;
        default:
          return false;
      }

      const output = execSync(command, {
        encoding: 'utf8',
        timeout: 10000,
        stdio: 'pipe',
      });

      return output.includes('mdsaad@');
    } catch (error) {
      return false;
    }
  }

  /**
   * Setup platform-specific paths and directories
   */
  async setupPlatformPaths() {
    this.paths = {
      home: this.homeDir,
      config: this.getConfigDirectory(),
      cache: this.getCacheDirectory(),
      temp: this.getTempDirectory(),
      logs: this.getLogsDirectory(),
      completion: this.getCompletionDirectory(),
    };

    // Ensure all directories exist
    for (const [name, dirPath] of Object.entries(this.paths)) {
      if (dirPath && name !== 'home') {
        try {
          await fs.ensureDir(dirPath);
        } catch (error) {
          debugService.debug(`Failed to create ${name} directory`, {
            path: dirPath,
            error: error.message,
          });
        }
      }
    }
  }

  /**
   * Get platform-appropriate configuration directory
   */
  getConfigDirectory() {
    if (this.isWindows) {
      return path.join(process.env.APPDATA || this.homeDir, 'mdsaad');
    } else if (this.isMacOS) {
      return path.join(
        this.homeDir,
        'Library',
        'Application Support',
        'mdsaad'
      );
    } else {
      // Linux and other Unix-like systems
      return path.join(
        process.env.XDG_CONFIG_HOME || path.join(this.homeDir, '.config'),
        'mdsaad'
      );
    }
  }

  /**
   * Get platform-appropriate cache directory
   */
  getCacheDirectory() {
    if (this.isWindows) {
      return path.join(
        process.env.LOCALAPPDATA || this.homeDir,
        'mdsaad',
        'cache'
      );
    } else if (this.isMacOS) {
      return path.join(this.homeDir, 'Library', 'Caches', 'mdsaad');
    } else {
      // Linux and other Unix-like systems
      return path.join(
        process.env.XDG_CACHE_HOME || path.join(this.homeDir, '.cache'),
        'mdsaad'
      );
    }
  }

  /**
   * Get platform-appropriate temporary directory
   */
  getTempDirectory() {
    const systemTemp = os.tmpdir();
    return path.join(systemTemp, 'mdsaad');
  }

  /**
   * Get platform-appropriate logs directory
   */
  getLogsDirectory() {
    if (this.isWindows) {
      return path.join(
        process.env.LOCALAPPDATA || this.homeDir,
        'mdsaad',
        'logs'
      );
    } else if (this.isMacOS) {
      return path.join(this.homeDir, 'Library', 'Logs', 'mdsaad');
    } else {
      // Linux and other Unix-like systems
      return path.join(
        process.env.XDG_STATE_HOME ||
          path.join(this.homeDir, '.local', 'state'),
        'mdsaad'
      );
    }
  }

  /**
   * Get platform-appropriate completion scripts directory
   */
  getCompletionDirectory() {
    if (this.isWindows) {
      return path.join(this.getConfigDirectory(), 'completion');
    } else if (this.isMacOS) {
      return path.join(this.homeDir, '.local', 'share', 'mdsaad', 'completion');
    } else {
      // Linux and other Unix-like systems
      return path.join(
        process.env.XDG_DATA_HOME || path.join(this.homeDir, '.local', 'share'),
        'mdsaad',
        'completion'
      );
    }
  }

  /**
   * Handle file permissions cross-platform
   */
  async setFilePermissions(filePath, permissions = '755') {
    try {
      if (!this.isWindows) {
        // Unix-like systems support chmod
        await fs.chmod(filePath, permissions);
        return true;
      } else {
        // Windows doesn't use Unix permissions
        // We can use attrib command or just ensure file exists and is readable
        const stats = await fs.stat(filePath);
        return stats.isFile();
      }
    } catch (error) {
      debugService.debug('Failed to set file permissions', {
        filePath,
        permissions,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Create executable script with proper permissions
   */
  async createExecutableScript(scriptPath, content) {
    try {
      await fs.writeFile(scriptPath, content, { encoding: 'utf8' });
      await this.setFilePermissions(scriptPath, '755');
      return true;
    } catch (error) {
      debugService.debug('Failed to create executable script', {
        scriptPath,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Open file or URL with system default application
   */
  async openWithDefault(target) {
    try {
      let command;

      if (this.isWindows) {
        command = `start "" "${target}"`;
      } else if (this.isMacOS) {
        command = `open "${target}"`;
      } else {
        command = `xdg-open "${target}"`;
      }

      execSync(command, { stdio: 'ignore' });
      return true;
    } catch (error) {
      debugService.debug('Failed to open with default application', {
        target,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Get system information for diagnostics
   */
  getSystemInfo() {
    return {
      platform: this.platform,
      arch: this.arch,
      release: os.release(),
      version: os.version?.() || 'unknown',
      hostname: os.hostname(),
      uptime: os.uptime(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      networkInterfaces: this.getNetworkInterfaceSummary(),
      environment: this.getEnvironmentSummary(),
      paths: this.paths,
      terminalFeatures: this.terminalFeatures,
      packageManagers: this.availablePackageManagers,
    };
  }

  /**
   * Get network interface summary
   */
  getNetworkInterfaceSummary() {
    try {
      const interfaces = os.networkInterfaces();
      const summary = {};

      for (const [name, addresses] of Object.entries(interfaces)) {
        summary[name] = addresses
          .filter(addr => !addr.internal)
          .map(addr => ({
            family: addr.family,
            address: addr.address,
            netmask: addr.netmask,
          }));
      }

      return summary;
    } catch (error) {
      return {};
    }
  }

  /**
   * Get relevant environment variables summary
   */
  getEnvironmentSummary() {
    const relevantVars = [
      'NODE_ENV',
      'PATH',
      'HOME',
      'USER',
      'USERNAME',
      'SHELL',
      'TERM',
      'LANG',
      'LC_ALL',
      'APPDATA',
      'LOCALAPPDATA',
      'XDG_CONFIG_HOME',
      'XDG_CACHE_HOME',
      'XDG_DATA_HOME',
      'WT_SESSION',
      'TERM_PROGRAM',
    ];

    const summary = {};
    for (const varName of relevantVars) {
      if (process.env[varName]) {
        summary[varName] = process.env[varName];
      }
    }

    return summary;
  }

  /**
   * Check file system access and permissions
   */
  async checkFileSystemAccess() {
    const results = {
      config: { readable: false, writable: false, executable: false },
      cache: { readable: false, writable: false, executable: false },
      temp: { readable: false, writable: false, executable: false },
      logs: { readable: false, writable: false, executable: false },
    };

    for (const [name, dirPath] of Object.entries(this.paths)) {
      if (name === 'home') continue;

      try {
        // Test read access
        await fs.access(dirPath, fs.constants.R_OK);
        results[name].readable = true;

        // Test write access
        await fs.access(dirPath, fs.constants.W_OK);
        results[name].writable = true;

        // Test execute access (directory traversal)
        await fs.access(dirPath, fs.constants.X_OK);
        results[name].executable = true;
      } catch (error) {
        debugService.debug(`File system access check failed for ${name}`, {
          path: dirPath,
          error: error.message,
        });
      }
    }

    return results;
  }

  /**
   * Get platform-specific installation instructions
   */
  getInstallationInstructions() {
    const instructions = {
      npm: {
        global: 'npm install -g mdsaad',
        local: 'npm install mdsaad',
        update: 'npm update -g mdsaad',
        uninstall: 'npm uninstall -g mdsaad',
      },
      yarn: {
        global: 'yarn global add mdsaad',
        local: 'yarn add mdsaad',
        update: 'yarn global upgrade mdsaad',
        uninstall: 'yarn global remove mdsaad',
      },
      pnpm: {
        global: 'pnpm add -g mdsaad',
        local: 'pnpm add mdsaad',
        update: 'pnpm update -g mdsaad',
        uninstall: 'pnpm remove -g mdsaad',
      },
    };

    // Add platform-specific notes
    if (this.isWindows) {
      instructions.notes = [
        'Run PowerShell or Command Prompt as Administrator for global installation',
        'Windows Defender might scan the package during installation',
        'Make sure Node.js is in your PATH environment variable',
      ];
    } else if (this.isMacOS) {
      instructions.notes = [
        'You might need to use sudo for global installation: sudo npm install -g mdsaad',
        'Consider using a Node version manager like nvm or n',
        'Homebrew users can install Node.js via: brew install node',
      ];
    } else {
      instructions.notes = [
        'You might need to use sudo for global installation: sudo npm install -g mdsaad',
        "Consider using your distribution's package manager to install Node.js",
        'Some distributions require nodejs-npm package separately',
      ];
    }

    return instructions;
  }

  /**
   * Validate platform compatibility
   */
  validateCompatibility() {
    const issues = [];
    const warnings = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

    if (majorVersion < 16) {
      issues.push(
        `Node.js ${nodeVersion} is not supported. Please upgrade to Node.js 16 or later.`
      );
    } else if (majorVersion < 18) {
      warnings.push(
        `Node.js ${nodeVersion} is supported but Node.js 18+ is recommended.`
      );
    }

    // Check platform support
    if (!['win32', 'darwin', 'linux'].includes(this.platform)) {
      warnings.push(
        `Platform ${this.platform} is not officially tested but may work.`
      );
    }

    // Check architecture support
    if (!['x64', 'arm64'].includes(this.arch)) {
      warnings.push(
        `Architecture ${this.arch} is not officially tested but may work.`
      );
    }

    // Check terminal features
    if (!this.terminalFeatures.colors) {
      warnings.push(
        'Terminal does not support colors. Output may be less readable.'
      );
    }

    if (!this.terminalFeatures.unicode) {
      warnings.push(
        'Terminal does not support Unicode. Some symbols may not display correctly.'
      );
    }

    return {
      compatible: issues.length === 0,
      issues,
      warnings,
    };
  }

  /**
   * Get completion directory for shell completions
   */
  getCompletionDirectory() {
    return path.join(this.paths.config, 'completions');
  }

  /**
   * Detect current shell
   */
  detectShell() {
    // Check SHELL environment variable first
    if (process.env.SHELL) {
      const shellPath = process.env.SHELL;
      const shellName = path.basename(shellPath);

      // Map common shell names
      const shellMap = {
        bash: 'bash',
        zsh: 'zsh',
        fish: 'fish',
        pwsh: 'powershell',
        powershell: 'powershell',
        cmd: 'cmd',
        'cmd.exe': 'cmd',
      };

      if (shellMap[shellName]) {
        return shellMap[shellName];
      }
    }

    // Check parent process on Windows
    if (this.platform === 'win32') {
      if (process.env.PSModulePath) {
        return 'powershell';
      }
      if (process.env.COMSPEC && process.env.COMSPEC.includes('cmd')) {
        return 'cmd';
      }
      // Default to powershell on Windows
      return 'powershell';
    }

    // Default to bash on Unix-like systems
    return 'bash';
  }

  /**
   * Check file permissions for a directory
   */
  async checkFilePermissions(dirPath) {
    const permissions = {
      readable: false,
      writable: false,
      executable: false,
    };

    try {
      // Check if directory exists and is accessible
      await fs.access(dirPath, fs.constants.F_OK);
      permissions.readable = true;

      // Check write permission
      await fs.access(dirPath, fs.constants.W_OK);
      permissions.writable = true;

      // Check execute permission (for directories, this means ability to list contents)
      await fs.access(dirPath, fs.constants.X_OK);
      permissions.executable = true;
    } catch (error) {
      // Some permissions failed, but readable might still be true
      try {
        await fs.access(dirPath, fs.constants.R_OK);
        permissions.readable = true;
      } catch (readError) {
        permissions.readable = false;
      }
    }

    return permissions;
  }
}

module.exports = new PlatformService();
