/**
 * Update Manager Service
 * Handles version checking, update notifications, and maintenance tasks
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const https = require('https');
const { execSync } = require('child_process');
const outputFormatter = require('./output-formatter');
const debugService = require('./debug-service');
const configService = require('./config');

class UpdateManager {
  constructor() {
    this.packageJson = require('../../package.json');
    this.currentVersion = this.packageJson.version;
    this.updateCheckUrl = 'https://registry.npmjs.org/mdsaad/latest';
    this.changelogUrl = 'https://raw.githubusercontent.com/mdsaad/mdsaad-cli/main/CHANGELOG.md';
    this.isInitialized = false;
    this.lastCheckTime = null;
    this.checkInterval = 24 * 60 * 60 * 1000; // 24 hours
    this.updateInfoFile = path.join(os.homedir(), '.mdsaad', 'update-info.json');
  }

  /**
   * Initialize the update manager
   */
  async initialize() {
    try {
      await fs.ensureDir(path.dirname(this.updateInfoFile));
      this.loadUpdateInfo();
      this.isInitialized = true;
      debugService.debug('Update manager initialized', { currentVersion: this.currentVersion });
      return true;
    } catch (error) {
      debugService.debug('Update manager initialization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Load update information from file
   */
  async loadUpdateInfo() {
    try {
      if (await fs.pathExists(this.updateInfoFile)) {
        const updateInfo = await fs.readJson(this.updateInfoFile);
        this.lastCheckTime = updateInfo.lastCheck ? new Date(updateInfo.lastCheck) : null;
        return updateInfo;
      }
    } catch (error) {
      debugService.debug('Failed to load update info', { error: error.message });
    }
    return null;
  }

  /**
   * Save update information to file
   */
  async saveUpdateInfo(info) {
    try {
      const updateInfo = {
        lastCheck: new Date().toISOString(),
        currentVersion: this.currentVersion,
        ...info
      };
      await fs.writeJson(this.updateInfoFile, updateInfo, { spaces: 2 });
      this.lastCheckTime = new Date();
    } catch (error) {
      debugService.debug('Failed to save update info', { error: error.message });
    }
  }

  /**
   * Check if it's time to check for updates
   */
  shouldCheckForUpdates() {
    if (!this.lastCheckTime) {
      return true;
    }
    
    const timeSinceLastCheck = Date.now() - this.lastCheckTime.getTime();
    return timeSinceLastCheck > this.checkInterval;
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(force = false) {
    try {
      if (!force && !this.shouldCheckForUpdates()) {
        const cachedInfo = await this.loadUpdateInfo();
        if (cachedInfo && cachedInfo.latestVersion) {
          return {
            hasUpdate: this.compareVersions(cachedInfo.latestVersion, this.currentVersion) > 0,
            currentVersion: this.currentVersion,
            latestVersion: cachedInfo.latestVersion,
            cached: true
          };
        }
      }

      debugService.debug('Checking for updates', { currentVersion: this.currentVersion });
      
      const updateInfo = await this.fetchLatestVersion();
      
      if (updateInfo) {
        await this.saveUpdateInfo(updateInfo);
        
        const hasUpdate = this.compareVersions(updateInfo.latestVersion, this.currentVersion) > 0;
        
        return {
          hasUpdate,
          currentVersion: this.currentVersion,
          latestVersion: updateInfo.latestVersion,
          releaseNotes: updateInfo.releaseNotes,
          publishedAt: updateInfo.publishedAt,
          cached: false
        };
      }
      
      return null;
    } catch (error) {
      debugService.debug('Update check failed', { error: error.message });
      return null;
    }
  }

  /**
   * Fetch latest version information from npm registry
   */
  async fetchLatestVersion() {
    return new Promise((resolve, reject) => {
      const request = https.get(this.updateCheckUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          try {
            const packageInfo = JSON.parse(data);
            resolve({
              latestVersion: packageInfo.version,
              publishedAt: packageInfo.time ? packageInfo.time[packageInfo.version] : new Date().toISOString(),
              releaseNotes: packageInfo.description || 'No release notes available'
            });
          } catch (error) {
            reject(error);
          }
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(5000, () => {
        request.abort();
        reject(new Error('Update check timeout'));
      });
    });
  }

  /**
   * Compare two semantic versions
   */
  compareVersions(version1, version2) {
    const v1parts = version1.replace(/[^\d.]/g, '').split('.').map(Number);
    const v2parts = version2.replace(/[^\d.]/g, '').split('.').map(Number);
    
    const maxLength = Math.max(v1parts.length, v2parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1part = v1parts[i] || 0;
      const v2part = v2parts[i] || 0;
      
      if (v1part > v2part) return 1;
      if (v1part < v2part) return -1;
    }
    
    return 0;
  }

  /**
   * Show update notification
   */
  async showUpdateNotification(updateInfo) {
    if (!updateInfo || !updateInfo.hasUpdate) {
      return;
    }

    console.log(outputFormatter.header('🔄 Update Available!'));
    console.log(outputFormatter.info(`📦 Current version: ${updateInfo.currentVersion}`));
    console.log(outputFormatter.success(`🆕 Latest version: ${updateInfo.latestVersion}`));
    
    if (updateInfo.publishedAt) {
      const publishDate = new Date(updateInfo.publishedAt).toLocaleDateString();
      console.log(outputFormatter.info(`📅 Published: ${publishDate}`));
    }
    
    console.log('\n' + outputFormatter.subheader('💡 How to Update'));
    console.log(outputFormatter.info('   npm update -g mdsaad'));
    console.log(outputFormatter.info('   # or'));
    console.log(outputFormatter.info('   yarn global upgrade mdsaad'));
    console.log('');
  }

  /**
   * Get version information
   */
  getVersionInfo() {
    return {
      current: this.currentVersion,
      node: process.version,
      platform: os.platform(),
      arch: os.arch(),
      packageManager: this.detectPackageManager()
    };
  }

  /**
   * Detect the package manager used to install the CLI
   */
  detectPackageManager() {
    try {
      // Check if installed via npm
      const npmPath = execSync('npm list -g mdsaad --depth=0', { encoding: 'utf8', stdio: 'pipe' });
      if (npmPath.includes('mdsaad@')) {
        return 'npm';
      }
    } catch (error) {
      // Not installed via npm
    }

    try {
      // Check if installed via yarn
      const yarnPath = execSync('yarn global list', { encoding: 'utf8', stdio: 'pipe' });
      if (yarnPath.includes('mdsaad@')) {
        return 'yarn';
      }
    } catch (error) {
      // Not installed via yarn
    }

    try {
      // Check if installed via pnpm
      const pnpmPath = execSync('pnpm list -g mdsaad', { encoding: 'utf8', stdio: 'pipe' });
      if (pnpmPath.includes('mdsaad@')) {
        return 'pnpm';
      }
    } catch (error) {
      // Not installed via pnpm
    }

    return 'unknown';
  }

  /**
   * Check for deprecated features
   */
  checkDeprecations() {
    const deprecations = [];
    
    // Check for deprecated configuration options
    const config = configService.getAll();
    
    // Example deprecation checks
    if (config.oldApiFormat) {
      deprecations.push({
        type: 'configuration',
        message: 'Old API format configuration is deprecated',
        action: 'Use the new API key format in config',
        severity: 'warning'
      });
    }

    // Check for deprecated command usage patterns
    if (config.legacyCommandFormat) {
      deprecations.push({
        type: 'command',
        message: 'Legacy command format will be removed in v2.0',
        action: 'Update your scripts to use the new command syntax',
        severity: 'warning'
      });
    }

    return deprecations;
  }

  /**
   * Perform backward compatibility check
   */
  performCompatibilityCheck() {
    const compatibility = {
      configFormat: true,
      cacheFormat: true,
      pluginAPI: true,
      issues: []
    };

    try {
      // Check configuration file format
      const config = configService.getAll();
      if (config.version && this.compareVersions(config.version, '1.0.0') < 0) {
        compatibility.configFormat = false;
        compatibility.issues.push({
          type: 'config',
          message: 'Configuration format needs migration',
          action: 'Run: mdsaad maintenance --migrate-config'
        });
      }

      // Check cache format compatibility
      const cacheService = require('./cache');
      if (!cacheService.isCompatible()) {
        compatibility.cacheFormat = false;
        compatibility.issues.push({
          type: 'cache',
          message: 'Cache format is outdated',
          action: 'Cache will be automatically regenerated'
        });
      }

    } catch (error) {
      compatibility.issues.push({
        type: 'error',
        message: 'Compatibility check failed',
        action: 'Manual inspection required'
      });
    }

    return compatibility;
  }

  /**
   * Get changelog for a version range
   */
  async fetchChangelog(fromVersion = null, toVersion = null) {
    try {
      const changelog = await this.fetchChangelogContent();
      
      if (!fromVersion && !toVersion) {
        return changelog;
      }

      // Parse changelog and extract relevant sections
      return this.parseChangelogForVersions(changelog, fromVersion, toVersion);
    } catch (error) {
      debugService.debug('Failed to fetch changelog', { error: error.message });
      return null;
    }
  }

  /**
   * Fetch changelog content
   */
  async fetchChangelogContent() {
    return new Promise((resolve, reject) => {
      const request = https.get(this.changelogUrl, (response) => {
        let data = '';
        
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve(data);
        });
      });
      
      request.on('error', (error) => {
        reject(error);
      });
      
      request.setTimeout(10000, () => {
        request.abort();
        reject(new Error('Changelog fetch timeout'));
      });
    });
  }

  /**
   * Parse changelog for specific version range
   */
  parseChangelogForVersions(changelog, fromVersion, toVersion) {
    const lines = changelog.split('\n');
    const sections = [];
    let currentSection = null;
    let capturing = false;

    for (const line of lines) {
      // Check if line is a version header (e.g., ## [1.2.0] - 2024-01-15)
      const versionMatch = line.match(/^##\s*\[?(\d+\.\d+\.\d+)\]?/);
      
      if (versionMatch) {
        const version = versionMatch[1];
        
        // Save previous section
        if (currentSection) {
          sections.push(currentSection);
        }
        
        // Check if we should capture this version
        const shouldCapture = (!fromVersion || this.compareVersions(version, fromVersion) >= 0) &&
                             (!toVersion || this.compareVersions(version, toVersion) <= 0);
        
        if (shouldCapture) {
          currentSection = {
            version,
            content: [line]
          };
          capturing = true;
        } else {
          capturing = false;
          currentSection = null;
        }
      } else if (capturing && currentSection) {
        currentSection.content.push(line);
      }
    }

    // Add final section
    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Enable or disable automatic update checks
   */
  async setAutoUpdateCheck(enabled) {
    try {
      await configService.set('autoUpdateCheck', enabled);
      debugService.debug(`Auto update check ${enabled ? 'enabled' : 'disabled'}`);
      return true;
    } catch (error) {
      debugService.debug('Failed to set auto update check', { error: error.message });
      return false;
    }
  }

  /**
   * Get update check settings
   */
  getUpdateSettings() {
    return {
      autoCheck: configService.get('autoUpdateCheck', true),
      lastCheck: this.lastCheckTime,
      checkInterval: this.checkInterval,
      currentVersion: this.currentVersion
    };
  }

  /**
   * Perform silent update check (for background notifications)
   */
  async performSilentUpdateCheck() {
    try {
      if (!configService.get('autoUpdateCheck', true)) {
        return null;
      }

      if (!this.shouldCheckForUpdates()) {
        return null;
      }

      const updateInfo = await this.checkForUpdates();
      
      if (updateInfo && updateInfo.hasUpdate) {
        // Show subtle notification
        console.log(outputFormatter.info(`💡 Update available: v${updateInfo.latestVersion} (run 'mdsaad update --check' for details)`));
      }

      return updateInfo;
    } catch (error) {
      // Silent check should not throw errors
      debugService.debug('Silent update check failed', { error: error.message });
      return null;
    }
  }
}

module.exports = new UpdateManager();