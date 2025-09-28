/**
 * Cross-platform compatibility command
 * Handles platform detection, installation, and tab completion setup
 */

const platformService = require('../services/platform-service');
const installationService = require('../services/installation-service');
const tabCompletionService = require('../services/tab-completion-service');
const outputFormatter = require('../services/output-formatter');
const debugService = require('../services/debug-service');

class CrossPlatformCommand {
  constructor() {
    this.name = 'platform';
    this.description = 'Cross-platform compatibility and installation tools';
  }

  /**
   * Execute the cross-platform command
   */
  async execute(args, options) {
    const {
      info = false,
      install = false,
      setupCompletion = false,
      uninstallCompletion = false,
      checkCompletion = false,
      shell = null,
      force = false,
      troubleshoot = false,
      packageManager = null,
      verbose = false,
    } = options;

    try {
      // Initialize services
      await this.initializeServices();

      if (info) {
        return await this.showPlatformInfo(verbose);
      }

      if (install) {
        return await this.showInstallationInfo(packageManager);
      }

      if (setupCompletion) {
        return await this.setupTabCompletion(shell, { force });
      }

      if (uninstallCompletion) {
        return await this.uninstallTabCompletion(shell);
      }

      if (checkCompletion) {
        return await this.checkTabCompletion(shell);
      }

      if (troubleshoot) {
        return await this.troubleshootInstallation();
      }

      // Default action - show overview
      return await this.showOverview();
    } catch (error) {
      console.error(
        outputFormatter.error('Cross-platform command failed:', error.message)
      );

      if (verbose || debugService.debugMode) {
        console.error(error.stack);
      }

      process.exit(1);
    }
  }

  /**
   * Initialize required services
   */
  async initializeServices() {
    await platformService.initialize();
    await installationService.initialize();
    await tabCompletionService.initialize();
  }

  /**
   * Show comprehensive platform information
   */
  async showPlatformInfo(verbose = false) {
    console.log(outputFormatter.header('🔧 Platform Information'));

    const info = platformService.getSystemInfo();
    const terminalInfo = info.terminalFeatures;

    // Basic platform info
    console.log(outputFormatter.info('System Details'));
    const systemTable = outputFormatter.createTable([
      ['Platform', info.platform],
      ['Architecture', info.arch],
      ['OS Version', info.release],
      ['Node.js', process.version],
      ['Shell', platformService.detectShell()],
      ['Terminal', info.environment?.TERM || 'Unknown'],
    ]);
    console.log(systemTable);

    // Terminal capabilities
    console.log(outputFormatter.info('Terminal Features'));
    const terminalTable = outputFormatter.createTable([
      ['Colors', terminalInfo.colors ? '✓ Supported' : '✗ Not supported'],
      ['Unicode', terminalInfo.unicode ? '✓ Supported' : '✗ Not supported'],
      ['Interactive', terminalInfo.interactive ? '✓ Yes' : '✗ No'],
      ['Width', `${terminalInfo.width || 'Unknown'} columns`],
      ['Height', `${terminalInfo.height || 'Unknown'} rows`],
    ]);
    console.log(terminalTable);

    // Directories
    console.log(outputFormatter.info('Directory Paths'));
    const paths = info.paths;
    if (paths) {
      const pathTable = outputFormatter.createTable([
        ['Config', paths.config],
        ['Cache', paths.cache],
        ['Data', paths.data],
        ['Logs', paths.logs],
        ['Temp', paths.temp],
      ]);
      console.log(pathTable);
    } else {
      console.log(outputFormatter.warning('Path information not available'));
    }
    if (verbose) {
      // Package managers
      console.log(outputFormatter.info('Package Managers'));
      const packageManagers =
        await installationService.getAvailablePackageManagers();

      if (packageManagers.length > 0) {
        const pmTable = outputFormatter.createTable(
          packageManagers.map(pm => [
            pm.name,
            pm.version || 'Unknown',
            pm.available ? '✓ Available' : '✗ Not found',
          ])
        );
        console.log(pmTable);
      } else {
        console.log(outputFormatter.warning('No package managers detected'));
      }

      // Environment variables
      console.log(outputFormatter.info('Environment'));
      const envVars = ['PATH', 'HOME', 'SHELL', 'TERM', 'NODE_ENV'];
      const envTable = outputFormatter.createTable(
        envVars.map(key => [key, process.env[key] || 'Not set'])
      );
      console.log(envTable);
    }
  }

  /**
   * Show installation information and instructions
   */
  async showInstallationInfo(packageManager = null) {
    console.log(outputFormatter.header('📦 Installation Information'));

    const methods =
      await installationService.getInstallationMethods(packageManager);

    console.log(outputFormatter.info('Available Installation Methods'));

    methods.forEach((method, index) => {
      console.log(
        outputFormatter.highlight(`${index + 1}. ${method.name}`, 'important')
      );
      console.log(
        `   Command: ${outputFormatter.highlight(method.command, 'default')}`
      );
      console.log(
        `   Status: ${
          method.available
            ? outputFormatter.success('✓ Available')
            : outputFormatter.warning('⚠ Requires installation')
        }`
      );

      if (method.notes) {
        console.log(`   ${method.notes}`);
      }
      console.log();
    });

    // Installation verification
    const verification = await installationService.verifyInstallation();

    console.log(outputFormatter.info('Current Installation Status'));

    if (verification.installed) {
      console.log(
        outputFormatter.success('✓ mdsaad is installed and accessible')
      );
      console.log(
        `Version: ${outputFormatter.highlight(verification.version, 'success')}`
      );
      console.log(`Location: ${verification.path}`);

      if (verification.conflicts && verification.conflicts.length > 0) {
        console.log(
          outputFormatter.warning('\n⚠ Installation Conflicts Detected:')
        );
        verification.conflicts.forEach(conflict => {
          console.log(`   • ${conflict}`);
        });
      }
    } else {
      console.log(outputFormatter.error('✗ mdsaad is not properly installed'));

      if (verification.issues && verification.issues.length > 0) {
        console.log('\nIssues found:');
        verification.issues.forEach(issue => {
          console.log(`   • ${outputFormatter.warning(issue)}`);
        });
      }
    }

    // Troubleshooting tips
    const troubleshooting = await installationService.getTroubleshootingTips();

    if (troubleshooting.length > 0) {
      console.log(outputFormatter.info('Troubleshooting Tips'));
      troubleshooting.forEach((tip, index) => {
        console.log(`${index + 1}. ${tip}`);
      });
    }
  }

  /**
   * Setup tab completion
   */
  async setupTabCompletion(shell = null, options = {}) {
    console.log(outputFormatter.header('⚡ Setting up Tab Completion'));

    const detectedShell = shell || platformService.detectShell();
    console.log(
      `Detected shell: ${outputFormatter.highlight(detectedShell, 'important')}`
    );

    try {
      const result = await tabCompletionService.installTabCompletion(
        detectedShell,
        options
      );

      if (result.success) {
        console.log(
          outputFormatter.success('✓ Tab completion installed successfully!')
        );

        if (result.configFile) {
          console.log(`Modified: ${result.configFile}`);
        }

        if (result.scriptPath) {
          console.log(`Script: ${result.scriptPath}`);
        }

        if (result.instructions && result.instructions.length > 0) {
          console.log(outputFormatter.info('Next Steps'));
          result.instructions.forEach((instruction, index) => {
            console.log(`${index + 1}. ${instruction}`);
          });
        }
      } else {
        console.log(
          outputFormatter.error('✗ Tab completion installation failed')
        );
        if (result.error) {
          console.log(result.error);
        }
      }
    } catch (error) {
      console.log(
        outputFormatter.error('✗ Tab completion setup failed:', error.message)
      );
    }
  }

  /**
   * Uninstall tab completion
   */
  async uninstallTabCompletion(shell = null) {
    console.log(outputFormatter.header('🗑️ Removing Tab Completion'));

    const detectedShell = shell || platformService.detectShell();
    console.log(
      `Detected shell: ${outputFormatter.highlight(detectedShell, 'important')}`
    );

    try {
      const result =
        await tabCompletionService.uninstallTabCompletion(detectedShell);

      if (result.success) {
        console.log(
          outputFormatter.success('✓ Tab completion removed successfully!')
        );

        if (result.configFile) {
          console.log(`Modified: ${result.configFile}`);
        }

        console.log('Restart your terminal for changes to take effect.');
      } else {
        console.log(outputFormatter.error('✗ Tab completion removal failed'));
        if (result.error) {
          console.log(result.error);
        }
      }
    } catch (error) {
      console.log(
        outputFormatter.error('✗ Tab completion removal failed:', error.message)
      );
    }
  }

  /**
   * Check tab completion status
   */
  async checkTabCompletion(shell = null) {
    console.log(outputFormatter.header('🔍 Tab Completion Status'));

    const shells = shell ? [shell] : tabCompletionService.supportedShells;

    for (const shellName of shells) {
      const status = await tabCompletionService.checkInstallation(shellName);

      console.log(outputFormatter.info(`${shellName.toUpperCase()} Shell`));

      const statusTable = outputFormatter.createTable([
        ['Installed', status.installed ? '✓ Yes' : '✗ No'],
        ['Working', status.working ? '✓ Yes' : '✗ No'],
        ['Script Path', status.scriptPath || 'Not found'],
        ['Config File', status.configFile || 'Not configured'],
      ]);

      console.log(statusTable);

      if (!status.installed && shellName === platformService.detectShell()) {
        console.log(
          outputFormatter.info(`Run: mdsaad platform --setup-completion`)
        );
      }

      console.log();
    }
  }

  /**
   * Troubleshoot installation issues
   */
  async troubleshootInstallation() {
    console.log(outputFormatter.header('🔧 Installation Troubleshooting'));

    const spinner = outputFormatter.spinner('Running diagnostics...');
    spinner.start();

    try {
      // Check installation
      const verification = await installationService.verifyInstallation();

      // Check permissions
      const permissions = await platformService.checkFilePermissions(
        process.cwd()
      );

      // Check package managers
      const packageManagers =
        await installationService.getAvailablePackageManagers();

      // Check tab completion
      const completionStatus = await tabCompletionService.checkInstallation();

      spinner.stop();

      console.log(outputFormatter.info('Diagnostic Results'));

      // Installation status
      console.log(
        `Installation: ${
          verification.installed
            ? outputFormatter.success('✓ Working')
            : outputFormatter.error('✗ Issues found')
        }`
      );

      if (!verification.installed && verification.issues) {
        verification.issues.forEach(issue => {
          console.log(`   • ${outputFormatter.warning(issue)}`);
        });
      }

      // Permissions
      console.log(
        `Permissions: ${
          permissions.readable && permissions.writable
            ? outputFormatter.success('✓ OK')
            : outputFormatter.warning('⚠ Limited')
        }`
      );

      if (!permissions.writable) {
        console.log(
          `   • ${outputFormatter.warning('No write access to current directory')}`
        );
      }

      // Package managers
      const availablePMs = packageManagers.filter(pm => pm.available);
      console.log(
        `Package Managers: ${
          availablePMs.length > 0
            ? outputFormatter.success(`✓ ${availablePMs.length} available`)
            : outputFormatter.error('✗ None found')
        }`
      );

      // Tab completion
      console.log(
        `Tab Completion: ${
          completionStatus.installed
            ? outputFormatter.success('✓ Installed')
            : outputFormatter.info('⚡ Available for setup')
        }`
      );

      // Recommendations
      console.log(outputFormatter.info('Recommendations'));

      const recommendations = [];

      if (!verification.installed) {
        recommendations.push(
          'Reinstall mdsaad using a supported package manager'
        );
      }

      if (availablePMs.length === 0) {
        recommendations.push(
          'Install Node.js and npm from https://nodejs.org/'
        );
      }

      if (!permissions.writable) {
        recommendations.push(
          'Ensure you have write permissions in the current directory'
        );
      }

      if (!completionStatus.installed) {
        recommendations.push(
          'Set up tab completion with: mdsaad platform --setup-completion'
        );
      }

      if (verification.conflicts && verification.conflicts.length > 0) {
        recommendations.push(
          'Resolve installation conflicts by removing duplicate installations'
        );
      }

      if (recommendations.length === 0) {
        console.log(
          outputFormatter.success(
            '✓ No issues detected - installation looks good!'
          )
        );
      } else {
        recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }
    } catch (error) {
      spinner.stop();
      console.log(
        outputFormatter.error('Troubleshooting failed:', error.message)
      );
    }
  }

  /**
   * Show platform overview
   */
  async showOverview() {
    console.log(outputFormatter.header('🌍 Cross-Platform Compatibility'));
    console.log(
      'mdsaad provides comprehensive cross-platform support for Windows, macOS, and Linux.'
    );
    console.log();

    console.log(outputFormatter.info('Available Commands'));
    const commands = [
      ['--info', 'Show detailed platform information'],
      ['--install', 'Show installation methods and status'],
      ['--setup-completion', 'Set up tab completion for your shell'],
      ['--uninstall-completion', 'Remove tab completion'],
      ['--check-completion', 'Check tab completion status'],
      ['--troubleshoot', 'Run installation diagnostics'],
    ];

    const commandTable = outputFormatter.createTable(commands);
    console.log(commandTable);

    console.log(outputFormatter.info('Supported Features'));
    console.log('• Automatic platform detection and adaptation');
    console.log('• Terminal capability detection (colors, Unicode, etc.)');
    console.log('• Cross-platform file paths and permissions');
    console.log('• Tab completion for Bash, Zsh, Fish, and PowerShell');
    console.log('• Multiple package manager support (npm, yarn, pnpm)');
    console.log('• Installation verification and troubleshooting');

    console.log();
    console.log(
      outputFormatter.info('Use --help with any option for more details')
    );
  }

  /**
   * Get command help
   */
  getHelp() {
    return {
      usage: 'mdsaad platform [options]',
      description: 'Cross-platform compatibility and installation tools',
      options: [
        {
          flags: '--info',
          description: 'Show detailed platform and system information',
        },
        {
          flags: '--install [manager]',
          description: 'Show installation methods and status',
        },
        {
          flags: '--setup-completion [shell]',
          description: 'Set up tab completion for specified shell',
        },
        {
          flags: '--uninstall-completion [shell]',
          description: 'Remove tab completion for specified shell',
        },
        {
          flags: '--check-completion [shell]',
          description: 'Check tab completion installation status',
        },
        {
          flags: '--troubleshoot',
          description: 'Run installation diagnostics and troubleshooting',
        },
        {
          flags: '--shell <shell>',
          description:
            'Specify shell for completion (bash, zsh, fish, powershell)',
        },
        {
          flags: '--force',
          description: 'Force reinstallation of tab completion',
        },
        {
          flags: '--verbose',
          description: 'Show detailed information and debug output',
        },
      ],
      examples: [
        'mdsaad platform --info                    # Show platform information',
        'mdsaad platform --install                 # Show installation status',
        'mdsaad platform --setup-completion        # Set up tab completion',
        'mdsaad platform --setup-completion zsh    # Set up for specific shell',
        'mdsaad platform --troubleshoot            # Diagnose installation issues',
      ],
    };
  }
}

module.exports = CrossPlatformCommand;
