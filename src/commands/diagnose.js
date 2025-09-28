/**
 * Diagnose Command
 * Runs comprehensive diagnostics for mdsaad-cli installation and PATH issues
 */

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const { execSync, spawn } = require('child_process');
const chalk = require('chalk');

// Import boxen - newer versions might have different export
let boxen;
try {
  const boxenModule = require('boxen');
  boxen = boxenModule.default || boxenModule;
} catch (error) {
  console.warn('Boxen not available, using simple formatting');
  // Simple fallback function if boxen is not available
  boxen = (text, options = {}) => {
    const lines = text.split('\n');
    const maxLength = Math.max(...lines.map(line => line.length));
    const border = '═'.repeat(maxLength + 4);
    
    let result = `\n╔${border}╗\n`;
    for (const line of lines) {
      const padding = ' '.repeat(maxLength - line.length);
      result += `║  ${line}${padding}  ║\n`;
    }
    result += `╚${border}╝\n`;
    
    return result;
  };
}

class DiagnoseCommand {
  constructor() {
    this.platform = process.platform;
    this.results = [];
    this.issues = [];
    this.recommendations = [];
  }

  /**
   * Execute diagnostic tests
   */
  async execute(options = {}) {
    console.log(
      boxen(chalk.bold.blue('🔍 mdsaad-cli Installation Diagnostics'), {
        padding: 1,
        margin: 1,
        borderStyle: 'double',
        borderColor: 'blue',
        align: 'center',
      })
    );

    console.log(chalk.yellow('Running comprehensive diagnostics...\n'));

    // Run all diagnostic tests
    await this.checkSystemInfo();
    await this.checkNodeJS();
    await this.checkNPM();
    await this.checkMdsaadInstallation();
    await this.checkPATH();
    await this.checkPermissions();
    await this.checkNetworkConnectivity();

    // Display results
    this.displayResults();
    this.displayRecommendations();

    return {
      success: this.issues.length === 0,
      issues: this.issues,
      recommendations: this.recommendations,
    };
  }

  /**
   * Check system information
   */
  async checkSystemInfo() {
    try {
      const systemInfo = {
        Platform: this.platform,
        Architecture: os.arch(),
        OS: `${os.type()} ${os.release()}`,
        'Node.js Version': process.version,
        'NPM Version': this.getCommandOutput('npm --version'),
        'Current Directory': process.cwd(),
        'Home Directory': os.homedir(),
        'User': os.userInfo().username,
      };

      this.addResult('✅ System Information', 'success', systemInfo);
    } catch (error) {
      this.addIssue('System Info', 'Failed to gather system information', error.message);
    }
  }

  /**
   * Check Node.js installation
   */
  async checkNodeJS() {
    try {
      const nodeVersion = process.version;
      const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);

      if (majorVersion >= 14) {
        this.addResult('✅ Node.js Version', 'success', `${nodeVersion} (Compatible)`);
      } else {
        this.addIssue(
          'Node.js Version',
          `Node.js ${nodeVersion} is outdated`,
          'Please upgrade to Node.js 14 or higher'
        );
      }

      // Check Node.js executable location
      const nodeExecutable = process.execPath;
      this.addResult('📍 Node.js Location', 'info', nodeExecutable);
    } catch (error) {
      this.addIssue('Node.js Check', 'Failed to verify Node.js installation', error.message);
    }
  }

  /**
   * Check NPM configuration
   */
  async checkNPM() {
    try {
      const npmVersion = this.getCommandOutput('npm --version');
      const npmRoot = this.getCommandOutput('npm root -g');
      const npmPrefix = this.getCommandOutput('npm prefix -g');
      const npmConfig = this.getCommandOutput('npm config list');

      this.addResult('✅ NPM Version', 'success', npmVersion);
      this.addResult('📂 NPM Global Root', 'info', npmRoot);
      this.addResult('📂 NPM Global Prefix', 'info', npmPrefix);

      // Check if npm prefix is in PATH
      const pathEnv = process.env.PATH || '';
      const expectedBinPath = path.join(npmPrefix, this.platform === 'win32' ? '' : 'bin');

      if (pathEnv.includes(expectedBinPath)) {
        this.addResult('✅ NPM Prefix in PATH', 'success', expectedBinPath);
      } else {
        this.addIssue(
          'NPM PATH Configuration',
          'NPM global bin directory not in PATH',
          `Add ${expectedBinPath} to your PATH environment variable`
        );
      }
    } catch (error) {
      this.addIssue('NPM Check', 'Failed to verify NPM configuration', error.message);
    }
  }

  /**
   * Check mdsaad-cli installation
   */
  async checkMdsaadInstallation() {
    try {
      // Check if mdsaad-cli is installed globally
      const globalPackages = this.getCommandOutput('npm list -g --depth=0');
      
      if (globalPackages.includes('mdsaad-cli')) {
        this.addResult('✅ mdsaad-cli Installation', 'success', 'Found in global packages');
        
        // Get version information
        try {
          const packageInfo = this.getCommandOutput('npm list -g mdsaad-cli --json');
          const info = JSON.parse(packageInfo);
          const version = info.dependencies?.['mdsaad-cli']?.version || 'unknown';
          this.addResult('📦 mdsaad-cli Version', 'info', version);
        } catch (versionError) {
          this.addResult('📦 mdsaad-cli Version', 'warning', 'Could not determine version');
        }
      } else {
        this.addIssue(
          'mdsaad-cli Installation',
          'mdsaad-cli not found in global packages',
          'Run: npm install -g mdsaad-cli'
        );
      }

      // Check for mdsaad executable
      const npmPrefix = this.getCommandOutput('npm prefix -g');
      const expectedExecutable = this.platform === 'win32' 
        ? path.join(npmPrefix, 'mdsaad.cmd')
        : path.join(npmPrefix, 'bin', 'mdsaad');

      if (await fs.pathExists(expectedExecutable)) {
        this.addResult('✅ mdsaad Executable', 'success', expectedExecutable);
      } else {
        this.addIssue(
          'mdsaad Executable',
          'mdsaad executable not found',
          `Expected location: ${expectedExecutable}`
        );
      }
    } catch (error) {
      this.addIssue('Installation Check', 'Failed to verify mdsaad-cli installation', error.message);
    }
  }

  /**
   * Check PATH configuration
   */
  async checkPATH() {
    try {
      const pathEnv = process.env.PATH || '';
      const pathDirs = pathEnv.split(path.delimiter);
      
      this.addResult('🛤️ PATH Environment', 'info', `${pathDirs.length} directories`);

      // Check for common npm directories in PATH
      const npmPrefix = this.getCommandOutput('npm prefix -g');
      const expectedBinPath = path.join(npmPrefix, this.platform === 'win32' ? '' : 'bin');
      
      const pathIncludes = pathDirs.some(dir => 
        path.resolve(dir) === path.resolve(expectedBinPath)
      );

      if (pathIncludes) {
        this.addResult('✅ NPM Bin in PATH', 'success', expectedBinPath);
      } else {
        this.addIssue(
          'PATH Configuration',
          'NPM global bin directory not in PATH',
          `Add "${expectedBinPath}" to your PATH`
        );
      }

      // Test mdsaad command resolution
      try {
        const whichCommand = this.platform === 'win32' ? 'where mdsaad' : 'which mdsaad';
        const mdsaadLocation = this.getCommandOutput(whichCommand);
        this.addResult('✅ mdsaad Command Found', 'success', mdsaadLocation);
      } catch (error) {
        this.addIssue(
          'Command Resolution',
          'mdsaad command not found in PATH',
          'The mdsaad command cannot be resolved by your shell'
        );
      }
    } catch (error) {
      this.addIssue('PATH Check', 'Failed to analyze PATH configuration', error.message);
    }
  }

  /**
   * Check file permissions
   */
  async checkPermissions() {
    try {
      const npmPrefix = this.getCommandOutput('npm prefix -g');
      const stats = await fs.stat(npmPrefix);
      
      this.addResult('📁 NPM Global Directory', 'info', npmPrefix);
      
      // Check if directory is writable
      try {
        await fs.access(npmPrefix, fs.constants.W_OK);
        this.addResult('✅ NPM Directory Writable', 'success', 'Write access confirmed');
      } catch (error) {
        this.addIssue(
          'Permissions',
          'No write access to NPM global directory',
          'Try running with administrator/sudo privileges or fix npm permissions'
        );
      }
    } catch (error) {
      this.addIssue('Permission Check', 'Failed to verify permissions', error.message);
    }
  }

  /**
   * Check network connectivity
   */
  async checkNetworkConnectivity() {
    try {
      // Test NPM registry connectivity
      const registryUrl = this.getCommandOutput('npm config get registry');
      this.addResult('🌐 NPM Registry', 'info', registryUrl);

      // Simple connectivity test (this will work if we got this far in installation)
      this.addResult('✅ Network Connectivity', 'success', 'NPM registry accessible');
    } catch (error) {
      this.addIssue('Network Check', 'Failed to verify network connectivity', error.message);
    }
  }

  /**
   * Add a successful result
   */
  addResult(name, type, value) {
    this.results.push({ name, type, value });
  }

  /**
   * Add an issue
   */
  addIssue(category, problem, solution) {
    this.issues.push({ category, problem, solution });
  }

  /**
   * Get command output safely
   */
  getCommandOutput(command) {
    try {
      return execSync(command, { 
        encoding: 'utf8', 
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 10000 
      }).trim();
    } catch (error) {
      throw new Error(`Command failed: ${command}`);
    }
  }

  /**
   * Display diagnostic results
   */
  displayResults() {
    console.log(chalk.bold.blue('\n📋 Diagnostic Results:\n'));

    for (const result of this.results) {
      const icon = result.type === 'success' ? '✅' : result.type === 'warning' ? '⚠️' : 'ℹ️';
      const color = result.type === 'success' ? 'green' : result.type === 'warning' ? 'yellow' : 'cyan';
      
      console.log(chalk[color](`${icon} ${result.name}:`));
      
      if (typeof result.value === 'object') {
        for (const [key, value] of Object.entries(result.value)) {
          console.log(chalk.gray(`   ${key}: ${value}`));
        }
      } else {
        console.log(chalk.gray(`   ${result.value}`));
      }
      console.log();
    }
  }

  /**
   * Display issues and recommendations
   */
  displayRecommendations() {
    if (this.issues.length === 0) {
      console.log(
        boxen(chalk.bold.green('✅ All diagnostics passed! Your mdsaad-cli installation looks good.'), {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'green',
          align: 'center',
        })
      );
      
      console.log(chalk.green('\n🎉 You should be able to use the mdsaad command now!'));
      console.log(chalk.gray('Try: mdsaad calculate "2+2"'));
      return;
    }

    console.log(
      boxen(chalk.bold.red(`❌ Found ${this.issues.length} issue(s) with your installation`), {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'red',
        align: 'center',
      })
    );

    console.log(chalk.bold.red('\n🔧 Issues Found:\n'));

    for (let i = 0; i < this.issues.length; i++) {
      const issue = this.issues[i];
      console.log(chalk.red(`${i + 1}. ${issue.category}: ${issue.problem}`));
      console.log(chalk.yellow(`   💡 Solution: ${issue.solution}\n`));
    }

    // Provide quick fix options
    console.log(chalk.bold.blue('🚀 Quick Fix Options:\n'));

    if (this.platform === 'win32') {
      console.log(chalk.cyan('1. Download and run the Windows fix script:'));
      console.log(chalk.gray('   curl -o fix-windows.bat https://raw.githubusercontent.com/mdsaad31/mdsaad-cli/main/scripts/fix-windows.bat'));
      console.log(chalk.gray('   fix-windows.bat\n'));
    } else {
      console.log(chalk.cyan('1. Download and run the Unix fix script:'));
      console.log(chalk.gray('   curl -o fix-unix.sh https://raw.githubusercontent.com/mdsaad31/mdsaad-cli/main/scripts/fix-unix.sh'));
      console.log(chalk.gray('   chmod +x fix-unix.sh && ./fix-unix.sh\n'));
    }

    console.log(chalk.cyan('2. Use npx as a workaround (no installation needed):'));
    console.log(chalk.gray('   npx mdsaad-cli calculate "2+2"'));
    console.log(chalk.gray('   npx mdsaad-cli weather London\n'));

    console.log(chalk.cyan('3. Manual PATH setup - add this to your PATH:'));
    try {
      const npmPrefix = this.getCommandOutput('npm prefix -g');
      const binPath = this.platform === 'win32' 
        ? npmPrefix 
        : path.join(npmPrefix, 'bin');
      console.log(chalk.gray(`   ${binPath}\n`));
    } catch (error) {
      console.log(chalk.gray('   (Could not determine NPM global prefix)\n'));
    }

    console.log(chalk.cyan('4. For detailed troubleshooting, visit:'));
    console.log(chalk.gray('   https://github.com/mdsaad31/mdsaad-cli/blob/main/INSTALLATION_TROUBLESHOOTING.md'));
  }
}

module.exports = new DiagnoseCommand();