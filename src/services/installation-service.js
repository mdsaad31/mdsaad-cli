/**
 * Installation Service
 * Handles package manager operations and installation verification
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync, spawn } = require('child_process');
const platformService = require('./platform-service');
const outputFormatter = require('./output-formatter');
const debugService = require('./debug-service');

class InstallationService {
  constructor() {
    this.isInitialized = false;
    this.packageManagers = {};
    this.installationMethods = [];
  }

  /**
   * Initialize installation service
   */
  async initialize() {
    try {
      await platformService.initialize();
      this.packageManagers = platformService.availablePackageManagers;
      this.detectInstallationMethods();

      this.isInitialized = true;
      debugService.debug('Installation service initialized', {
        packageManagers: Object.keys(this.packageManagers).filter(
          pm => this.packageManagers[pm].available
        ),
        methods: this.installationMethods.length,
      });

      return true;
    } catch (error) {
      debugService.debug('Installation service initialization failed', {
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Detect available installation methods
   */
  detectInstallationMethods() {
    this.installationMethods = [];

    // Package manager installations
    for (const [manager, info] of Object.entries(this.packageManagers)) {
      if (info.available) {
        this.installationMethods.push({
          type: 'package-manager',
          manager,
          version: info.version,
          global: info.global,
          recommended: manager === 'npm', // npm is most common
        });
      }
    }

    // Source installation (always available)
    this.installationMethods.push({
      type: 'source',
      manager: 'git',
      description: 'Install from source code',
      recommended: false,
    });

    // Binary installation (future enhancement)
    this.installationMethods.push({
      type: 'binary',
      manager: 'manual',
      description: 'Download pre-built binary',
      recommended: false,
      available: false, // Not implemented yet
    });
  }

  /**
   * Verify current installation
   */
  async verifyInstallation() {
    const verification = {
      installed: false,
      method: 'unknown',
      version: null,
      location: null,
      global: false,
      packageManager: null,
      issues: [],
      recommendations: [],
    };

    try {
      // Check if mdsaad command is available
      const output = execSync('mdsaad --version', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe',
      });

      verification.installed = true;
      verification.version = output.trim();

      // Determine installation method and location
      await this.detectInstallationDetails(verification);
    } catch (error) {
      verification.installed = false;
      verification.issues.push('mdsaad command not found in PATH');
    }

    // Check for common issues
    await this.checkInstallationIssues(verification);

    return verification;
  }

  /**
   * Detect installation details
   */
  async detectInstallationDetails(verification) {
    // Check each package manager for global installation
    for (const [manager, info] of Object.entries(this.packageManagers)) {
      if (!info.available) continue;

      try {
        let command, checkPattern;

        switch (manager) {
          case 'npm':
            command = 'npm list -g mdsaad --depth=0';
            checkPattern = /mdsaad@([\d.]+)/;
            break;
          case 'yarn':
            command = 'yarn global list --pattern mdsaad';
            checkPattern = /mdsaad@([\d.]+)/;
            break;
          case 'pnpm':
            command = 'pnpm list -g mdsaad --depth=0';
            checkPattern = /mdsaad@([\d.]+)/;
            break;
          default:
            continue;
        }

        const output = execSync(command, {
          encoding: 'utf8',
          timeout: 10000,
          stdio: 'pipe',
        });

        const match = output.match(checkPattern);
        if (match) {
          verification.method = 'package-manager';
          verification.packageManager = manager;
          verification.global = true;
          verification.location = await this.getGlobalPackageLocation(manager);
          break;
        }
      } catch (error) {
        // Continue checking other managers
      }
    }

    // If not found in package managers, check for local/source installation
    if (verification.method === 'unknown') {
      try {
        const whichCommand = platformService.isWindows
          ? 'where mdsaad'
          : 'which mdsaad';
        const location = execSync(whichCommand, {
          encoding: 'utf8',
          timeout: 5000,
          stdio: 'pipe',
        }).trim();

        verification.location = location;

        // Determine if it's a source installation
        if (location.includes('node_modules') && !location.includes('global')) {
          verification.method = 'local-package';
          verification.global = false;
        } else if (location.includes('src') || location.includes('dist')) {
          verification.method = 'source';
          verification.global = false;
        } else {
          verification.method = 'binary';
          verification.global = true;
        }
      } catch (error) {
        verification.location = 'unknown';
      }
    }
  }

  /**
   * Get global package installation location
   */
  async getGlobalPackageLocation(manager) {
    try {
      let command;

      switch (manager) {
        case 'npm':
          command = 'npm root -g';
          break;
        case 'yarn':
          command = 'yarn global dir';
          break;
        case 'pnpm':
          command = 'pnpm root -g';
          break;
        default:
          return 'unknown';
      }

      const globalRoot = execSync(command, {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe',
      }).trim();

      return path.join(globalRoot, 'mdsaad');
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Check for common installation issues
   */
  async checkInstallationIssues(verification) {
    // Check Node.js version compatibility
    const compatibility = platformService.validateCompatibility();
    if (!compatibility.compatible) {
      verification.issues.push(...compatibility.issues);
    }
    if (compatibility.warnings.length > 0) {
      verification.recommendations.push(...compatibility.warnings);
    }

    // Check PATH configuration
    if (verification.installed && verification.global) {
      const pathDirs = (process.env.PATH || '').split(path.delimiter);
      const installDir = path.dirname(verification.location || '');

      if (
        !pathDirs.some(dir => path.resolve(dir) === path.resolve(installDir))
      ) {
        verification.issues.push(
          `Installation directory not in PATH: ${installDir}`
        );
        verification.recommendations.push(
          'Add the installation directory to your PATH environment variable'
        );
      }
    }

    // Check for multiple installations
    await this.checkMultipleInstallations(verification);

    // Check permissions
    if (verification.location && verification.location !== 'unknown') {
      try {
        await fs.access(
          verification.location,
          fs.constants.R_OK | fs.constants.X_OK
        );
      } catch (error) {
        verification.issues.push(
          'Insufficient permissions to access installation'
        );
        verification.recommendations.push(
          'Check file permissions or reinstall with appropriate privileges'
        );
      }
    }
  }

  /**
   * Check for multiple installations that might conflict
   */
  async checkMultipleInstallations(verification) {
    const installations = [];

    // Check all package managers
    for (const [manager, info] of Object.entries(this.packageManagers)) {
      if (info.available && info.global) {
        installations.push({ manager, type: 'global-package' });
      }
    }

    // Check for local installations
    try {
      const localPackageJson = path.join(
        process.cwd(),
        'node_modules',
        'mdsaad',
        'package.json'
      );
      if (await fs.pathExists(localPackageJson)) {
        installations.push({ manager: 'local', type: 'local-package' });
      }
    } catch (error) {
      // Ignore
    }

    if (installations.length > 1) {
      verification.issues.push('Multiple installations detected');
      verification.recommendations.push(
        'Uninstall conflicting versions to avoid confusion'
      );
      verification.multipleInstallations = installations;
    }
  }

  /**
   * Generate installation instructions
   */
  generateInstallationInstructions() {
    const instructions = platformService.getInstallationInstructions();
    const availableManagers = Object.keys(this.packageManagers).filter(
      manager => this.packageManagers[manager].available
    );

    return {
      ...instructions,
      availableManagers,
      recommended: this.getRecommendedInstallationMethod(),
      platformNotes: instructions.notes,
      troubleshooting: this.getTroubleshootingTips(),
    };
  }

  /**
   * Get recommended installation method
   */
  getRecommendedInstallationMethod() {
    // Prefer npm if available, then yarn, then pnpm
    const preference = ['npm', 'yarn', 'pnpm'];

    for (const manager of preference) {
      if (this.packageManagers[manager]?.available) {
        return {
          manager,
          command: `${manager} install -g mdsaad`,
          reason:
            manager === 'npm'
              ? 'Most widely supported'
              : 'Available on your system',
        };
      }
    }

    return {
      manager: 'source',
      command:
        'git clone https://github.com/mdsaad/mdsaad-cli.git && cd mdsaad-cli && npm install',
      reason: 'Package managers not available',
    };
  }

  /**
   * Get troubleshooting tips
   */
  getTroubleshootingTips() {
    const tips = [];

    // Platform-specific tips
    if (platformService.isWindows) {
      tips.push({
        issue: 'Permission denied during installation',
        solution: 'Run PowerShell as Administrator or use --force flag',
      });
      tips.push({
        issue: 'Command not found after installation',
        solution:
          'Restart your terminal or check if npm global path is in your PATH',
      });
      tips.push({
        issue: 'Antivirus blocking installation',
        solution:
          'Temporarily disable antivirus or add Node.js/npm to exceptions',
      });
    } else if (platformService.isMacOS) {
      tips.push({
        issue: 'Permission denied during global installation',
        solution: 'Use sudo npm install -g mdsaad or configure npm prefix',
      });
      tips.push({
        issue: 'Command not found after installation',
        solution:
          'Add npm global bin directory to your PATH in ~/.bash_profile or ~/.zshrc',
      });
      tips.push({
        issue: 'Node.js not found',
        solution: 'Install Node.js via Homebrew: brew install node',
      });
    } else {
      tips.push({
        issue: 'Permission denied during global installation',
        solution: 'Use sudo npm install -g mdsaad or configure npm prefix',
      });
      tips.push({
        issue: 'Node.js not available',
        solution:
          'Install via package manager: apt install nodejs npm or yum install nodejs npm',
      });
      tips.push({
        issue: 'Command not found after installation',
        solution: 'Add ~/.npm-global/bin to your PATH or use npx mdsaad',
      });
    }

    // General tips
    tips.push({
      issue: 'Outdated npm version',
      solution: 'Update npm: npm install -g npm@latest',
    });
    tips.push({
      issue: 'Network connectivity issues',
      solution:
        'Use npm config set registry https://registry.npmjs.org/ and check proxy settings',
    });
    tips.push({
      issue: 'Installation hangs or fails',
      solution: 'Clear npm cache: npm cache clean --force and try again',
    });

    return tips;
  }

  /**
   * Test installation from different package managers
   */
  async testInstallation(manager = 'npm', options = {}) {
    const { dryRun = true, global = true, verbose = false } = options;

    const test = {
      manager,
      success: false,
      duration: 0,
      output: [],
      errors: [],
      warnings: [],
    };

    const startTime = Date.now();

    try {
      // Validate manager availability
      if (!this.packageManagers[manager]?.available) {
        throw new Error(`Package manager ${manager} is not available`);
      }

      // Build installation command
      let command;
      switch (manager) {
        case 'npm':
          command = `npm install ${global ? '-g' : ''} mdsaad${dryRun ? ' --dry-run' : ''}`;
          break;
        case 'yarn':
          command = `yarn ${global ? 'global ' : ''}add mdsaad${dryRun ? ' --dry-run' : ''}`;
          break;
        case 'pnpm':
          command = `pnpm ${global ? '-g ' : ''}add mdsaad${dryRun ? ' --dry-run' : ''}`;
          break;
        default:
          throw new Error(`Unsupported package manager: ${manager}`);
      }

      if (verbose) {
        test.output.push(`Executing: ${command}`);
      }

      // Execute installation command
      if (dryRun) {
        // Dry run - just check if command would work
        const output = execSync(command, {
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe',
        });
        test.output.push(output);
        test.success = true;
      } else {
        // Actual installation (not recommended for testing)
        test.warnings.push('Actual installation not recommended in test mode');
        test.success = false;
      }
    } catch (error) {
      test.errors.push(error.message);
      test.success = false;
    }

    test.duration = Date.now() - startTime;
    return test;
  }

  /**
   * Generate uninstallation instructions
   */
  generateUninstallationInstructions() {
    const instructions = {
      packageManager: {},
      manual: [],
      cleanup: [],
    };

    // Package manager uninstallation
    for (const [manager, info] of Object.entries(this.packageManagers)) {
      if (info.available) {
        switch (manager) {
          case 'npm':
            instructions.packageManager[manager] = 'npm uninstall -g mdsaad';
            break;
          case 'yarn':
            instructions.packageManager[manager] = 'yarn global remove mdsaad';
            break;
          case 'pnpm':
            instructions.packageManager[manager] = 'pnpm remove -g mdsaad';
            break;
        }
      }
    }

    // Manual cleanup
    const configDir = platformService.getConfigDirectory();
    const cacheDir = platformService.getCacheDirectory();

    instructions.manual.push(`Remove configuration directory: ${configDir}`);
    instructions.manual.push(`Remove cache directory: ${cacheDir}`);

    if (platformService.isWindows) {
      instructions.manual.push('Remove from Windows PATH if manually added');
    } else {
      instructions.manual.push(
        'Remove from shell profile (.bashrc, .zshrc) if manually added'
      );
    }

    // Cleanup commands
    instructions.cleanup.push(`rm -rf "${configDir}"`);
    instructions.cleanup.push(`rm -rf "${cacheDir}"`);

    return instructions;
  }

  /**
   * Validate package manager setup
   */
  async validatePackageManagerSetup() {
    const validation = {
      overall: true,
      managers: {},
      issues: [],
      recommendations: [],
    };

    for (const [manager, info] of Object.entries(this.packageManagers)) {
      const managerValidation = {
        available: info.available,
        version: info.version,
        globalPath: null,
        issues: [],
        working: false,
      };

      if (info.available) {
        try {
          // Test basic functionality
          const testOutput = execSync(`${manager} --version`, {
            encoding: 'utf8',
            timeout: 5000,
            stdio: 'pipe',
          });

          managerValidation.working = true;

          // Get global installation path
          try {
            let pathCommand;
            switch (manager) {
              case 'npm':
                pathCommand = 'npm config get prefix';
                break;
              case 'yarn':
                pathCommand = 'yarn global bin';
                break;
              case 'pnpm':
                pathCommand = 'pnpm config get global-bin-dir';
                break;
            }

            if (pathCommand) {
              const globalPath = execSync(pathCommand, {
                encoding: 'utf8',
                timeout: 5000,
                stdio: 'pipe',
              }).trim();

              managerValidation.globalPath = globalPath;

              // Check if global path is in PATH
              const pathDirs = (process.env.PATH || '').split(path.delimiter);
              const inPath = pathDirs.some(dir => {
                try {
                  return path.resolve(dir) === path.resolve(globalPath);
                } catch (error) {
                  return false;
                }
              });

              if (!inPath) {
                managerValidation.issues.push(
                  'Global bin directory not in PATH'
                );
                validation.recommendations.push(
                  `Add ${globalPath} to your PATH environment variable`
                );
              }
            }
          } catch (error) {
            managerValidation.issues.push(
              'Unable to determine global installation path'
            );
          }
        } catch (error) {
          managerValidation.working = false;
          managerValidation.issues.push(
            `Package manager test failed: ${error.message}`
          );
          validation.overall = false;
        }
      }

      validation.managers[manager] = managerValidation;
    }

    // Check if at least one package manager is working
    const workingManagers = Object.values(validation.managers).filter(
      m => m.working
    );
    if (workingManagers.length === 0) {
      validation.overall = false;
      validation.issues.push('No working package managers found');
      validation.recommendations.push(
        'Install Node.js and npm from https://nodejs.org/'
      );
    }

    return validation;
  }

  /**
   * Get available installation methods
   */
  getInstallationMethods(preferredManager = null) {
    const methods = [];

    for (const [manager, info] of Object.entries(this.packageManagers)) {
      if (preferredManager && manager !== preferredManager) continue;

      const method = {
        name: `${manager.toUpperCase()} Package Manager`,
        command: `${manager} install -g mdsaad`,
        available: info.available,
        notes: null,
      };

      switch (manager) {
        case 'npm':
          method.notes = 'Recommended - comes with Node.js';
          break;
        case 'yarn':
          method.notes = 'Fast and reliable';
          method.command = 'yarn global add mdsaad';
          break;
        case 'pnpm':
          method.notes = 'Fast and disk space efficient';
          method.command = 'pnpm add -g mdsaad';
          break;
      }

      if (!info.available) {
        switch (manager) {
          case 'npm':
            method.notes = 'Install Node.js from https://nodejs.org/';
            break;
          case 'yarn':
            method.notes = 'Install with: npm install -g yarn';
            break;
          case 'pnpm':
            method.notes = 'Install with: npm install -g pnpm';
            break;
        }
      }

      methods.push(method);
    }

    // Add manual installation method
    methods.push({
      name: 'Manual Installation',
      command:
        'git clone https://github.com/yourusername/mdsaad.git && cd mdsaad && npm install && npm link',
      available: true,
      notes: 'For development or if package managers are not available',
    });

    return methods;
  }

  /**
   * Get available package managers
   */
  getAvailablePackageManagers() {
    const managers = [];

    for (const [name, info] of Object.entries(this.packageManagers)) {
      managers.push({
        name,
        version: info.version,
        available: info.available,
        global: info.global,
      });
    }

    return managers;
  }

  /**
   * Verify installation status
   */
  async verifyInstallation() {
    const verification = {
      installed: false,
      version: null,
      path: null,
      global: false,
      method: 'unknown',
      issues: [],
      conflicts: [],
    };

    try {
      // Try to run mdsaad version command
      const { execSync } = require('child_process');
      const output = execSync('mdsaad --version', {
        encoding: 'utf8',
        timeout: 5000,
        stdio: 'pipe',
      });

      verification.installed = true;
      verification.version = output.trim().replace(/^.*v?/, ''); // Extract version number

      // Try to find installation path
      try {
        const whichOutput = execSync(
          platformService.isWindows ? 'where mdsaad' : 'which mdsaad',
          {
            encoding: 'utf8',
            timeout: 3000,
            stdio: 'pipe',
          }
        );
        verification.path = whichOutput.trim().split('\n')[0];

        // Determine if it's global installation
        verification.global =
          verification.path.includes('global') ||
          !verification.path.includes('node_modules') ||
          verification.path.includes('bin');
      } catch (error) {
        verification.issues.push('Could not determine installation path');
      }

      // Detect installation method
      if (verification.path) {
        if (verification.path.includes('yarn')) {
          verification.method = 'yarn';
        } else if (verification.path.includes('pnpm')) {
          verification.method = 'pnpm';
        } else if (verification.path.includes('npm')) {
          verification.method = 'npm';
        }
      }

      // Check for conflicts (multiple installations)
      const conflicts = await this.detectMultipleInstallations();
      if (conflicts.length > 1) {
        verification.conflicts = conflicts.map(
          c => `Multiple installations found: ${c.manager} at ${c.path}`
        );
      }
    } catch (error) {
      verification.installed = false;
      verification.issues.push(
        `Installation verification failed: ${error.message}`
      );
    }

    return verification;
  }

  /**
   * Get troubleshooting tips as array of strings
   */
  getTroubleshootingTips() {
    const tips = [];

    if (platformService.isWindows) {
      tips.push('If installation fails: Run PowerShell as Administrator');
      tips.push(
        'If command not found: Restart terminal or check PATH variable'
      );
      tips.push('If antivirus blocks: Add npm/node to antivirus exceptions');
    } else if (platformService.isMacOS) {
      tips.push('If permission denied: Use sudo or configure npm prefix');
      tips.push(
        'If command not found: Add npm global bin to PATH in shell profile'
      );
      tips.push(
        'If Node.js missing: Install with Homebrew - brew install node'
      );
    } else {
      tips.push('If permission denied: Use sudo or configure npm prefix');
      tips.push('If command not found: Add ~/.npm-global/bin to PATH');
      tips.push(
        'If Node.js missing: Install from package manager or nodejs.org'
      );
    }

    // General tips
    tips.push('Update npm to latest version: npm install -g npm@latest');
    tips.push('Clear npm cache: npm cache clean --force');
    tips.push('Check Node.js version compatibility (requires Node.js 14+)');

    return tips;
  }
}

module.exports = new InstallationService();
