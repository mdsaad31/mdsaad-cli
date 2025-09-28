/**
 * Update Command
 * Handles version checking, update notifications, and changelog display
 */

const updateManager = require('../services/update-manager');
const outputFormatter = require('../services/output-formatter');
const debugService = require('../services/debug-service');

class UpdateCommand {
  constructor() {
    this.name = 'update';
    this.description = 'Check for updates and manage version information';
  }

  /**
   * Configure the command
   */
  configure(commander) {
    const cmd = commander
      .command('update')
      .description('Check for updates and manage version information')
      .option('-c, --check', 'Check for available updates')
      .option('-f, --force', 'Force update check (bypass cache)')
      .option('--info', 'Show current version information')
      .option('-l, --changelog [version]', 'Show changelog for current or specific version')
      .option('-r, --range <from>..<to>', 'Show changelog for version range')
      .option('-s, --settings', 'Show update settings and configuration')
      .option('--enable-auto-check', 'Enable automatic update checks')
      .option('--disable-auto-check', 'Disable automatic update checks')
      .option('--compatibility', 'Check backward compatibility')
      .option('--deprecations', 'Check for deprecated features')
      .action(async (options) => {
        try {
          await this.execute(options);
        } catch (error) {
          console.error(outputFormatter.error(`Update command failed: ${error.message}`));
          debugService.debug('Update command error', { error: error.message, stack: error.stack });
          process.exit(1);
        }
      });

    return cmd;
  }

  /**
   * Execute the update command
   */
  async execute(options) {
    // Initialize update manager
    await updateManager.initialize();

    if (options.enableAutoCheck) {
      await this.enableAutoCheck();
      return;
    }

    if (options.disableAutoCheck) {
      await this.disableAutoCheck();
      return;
    }

    if (options.settings) {
      await this.showSettings();
      return;
    }

    if (options.info) {
      await this.showVersion();
      return;
    }

    if (options.changelog !== undefined) {
      await this.showChangelog(options.changelog, options.range);
      return;
    }

    if (options.compatibility) {
      await this.checkCompatibility();
      return;
    }

    if (options.deprecations) {
      await this.checkDeprecations();
      return;
    }

    if (options.check || options.force) {
      await this.checkForUpdates(options.force);
      return;
    }

    // Default: show brief version and check info
    await this.showBriefInfo();
  }

  /**
   * Check for available updates
   */
  async checkForUpdates(force = false) {
    console.log(outputFormatter.header('🔄 Checking for Updates'));

    const spinner = outputFormatter.spinner('Checking for updates...');
    spinner.start();

    try {
      const updateInfo = await updateManager.checkForUpdates(force);
      spinner.stop();

      if (!updateInfo) {
        console.log(outputFormatter.warning('⚠️  Unable to check for updates'));
        console.log(outputFormatter.info('Please check your internet connection and try again.'));
        return;
      }

      if (updateInfo.hasUpdate) {
        await updateManager.showUpdateNotification(updateInfo);
        
        if (updateInfo.releaseNotes && updateInfo.releaseNotes !== 'No release notes available') {
          console.log(outputFormatter.subheader('📝 Release Notes'));
          console.log(outputFormatter.info(updateInfo.releaseNotes));
          console.log('');
        }
      } else {
        console.log(outputFormatter.success('✅ You have the latest version installed'));
        console.log(outputFormatter.info(`📦 Current version: ${updateInfo.currentVersion}`));
      }

      if (updateInfo.cached) {
        const lastCheck = updateManager.lastCheckTime;
        const timeAgo = this.getTimeAgo(lastCheck);
        console.log(outputFormatter.info(`🕒 Last checked: ${timeAgo}`));
      }
    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Update check failed: ${error.message}`));
      debugService.debug('Update check failed', { error: error.message });
    }
  }

  /**
   * Show current version information
   */
  async showVersion() {
    const versionInfo = updateManager.getVersionInfo();

    console.log(outputFormatter.header('📋 Version Information'));
    
    console.log(outputFormatter.createTable([
      ['Package', 'mdsaad'],
      ['Version', versionInfo.current],
      ['Node.js', versionInfo.node],
      ['Platform', `${versionInfo.platform} (${versionInfo.arch})`],
      ['Package Manager', versionInfo.packageManager]
    ]));

    // Show update status
    const updateInfo = await updateManager.checkForUpdates();
    if (updateInfo) {
      console.log('\n' + outputFormatter.subheader('🔄 Update Status'));
      if (updateInfo.hasUpdate) {
        console.log(outputFormatter.warning(`📦 Update available: v${updateInfo.latestVersion}`));
      } else {
        console.log(outputFormatter.success('✅ Up to date'));
      }
    }
  }

  /**
   * Show changelog
   */
  async showChangelog(version, range) {
    console.log(outputFormatter.header('📝 Changelog'));

    const spinner = outputFormatter.spinner('Fetching changelog...');
    spinner.start();

    try {
      let fromVersion = null;
      let toVersion = null;

      if (range) {
        const [from, to] = range.split('..');
        fromVersion = from;
        toVersion = to;
      } else if (version && version !== true) {
        toVersion = version;
      }

      const changelog = await updateManager.fetchChangelog(fromVersion, toVersion);
      spinner.stop();

      if (!changelog) {
        console.log(outputFormatter.warning('⚠️  Unable to fetch changelog'));
        console.log(outputFormatter.info('Please check your internet connection and try again.'));
        return;
      }

      if (Array.isArray(changelog)) {
        // Parsed sections
        for (const section of changelog) {
          console.log(outputFormatter.subheader(`🏷️  Version ${section.version}`));
          console.log(section.content.slice(1).join('\n')); // Skip version header
          console.log('');
        }
      } else {
        // Full changelog
        console.log(changelog);
      }
    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Failed to fetch changelog: ${error.message}`));
      debugService.debug('Changelog fetch failed', { error: error.message });
    }
  }

  /**
   * Show update settings
   */
  async showSettings() {
    const settings = updateManager.getUpdateSettings();

    console.log(outputFormatter.header('⚙️  Update Settings'));

    console.log(outputFormatter.createTable([
      ['Auto Check', settings.autoCheck ? '✅ Enabled' : '❌ Disabled'],
      ['Check Interval', '24 hours'],
      ['Last Check', settings.lastCheck ? this.getTimeAgo(settings.lastCheck) : 'Never'],
      ['Current Version', settings.currentVersion]
    ]));

    console.log('\n' + outputFormatter.info('💡 Use --enable-auto-check or --disable-auto-check to modify settings'));
  }

  /**
   * Enable automatic update checks
   */
  async enableAutoCheck() {
    const success = await updateManager.setAutoUpdateCheck(true);
    
    if (success) {
      console.log(outputFormatter.success('✅ Automatic update checks enabled'));
      console.log(outputFormatter.info('🔄 Updates will be checked daily'));
    } else {
      console.log(outputFormatter.error('❌ Failed to enable automatic update checks'));
    }
  }

  /**
   * Disable automatic update checks
   */
  async disableAutoCheck() {
    const success = await updateManager.setAutoUpdateCheck(false);
    
    if (success) {
      console.log(outputFormatter.success('✅ Automatic update checks disabled'));
      console.log(outputFormatter.info('🔄 Use "mdsaad update --check" to check manually'));
    } else {
      console.log(outputFormatter.error('❌ Failed to disable automatic update checks'));
    }
  }

  /**
   * Check backward compatibility
   */
  async checkCompatibility() {
    console.log(outputFormatter.header('🔄 Compatibility Check'));

    const compatibility = updateManager.performCompatibilityCheck();

    console.log(outputFormatter.createTable([
      ['Configuration Format', compatibility.configFormat ? '✅ Compatible' : '❌ Needs Migration'],
      ['Cache Format', compatibility.cacheFormat ? '✅ Compatible' : '❌ Outdated'],
      ['Plugin API', compatibility.pluginAPI ? '✅ Compatible' : '❌ Deprecated']
    ]));

    if (compatibility.issues.length > 0) {
      console.log('\n' + outputFormatter.subheader('⚠️  Issues Found'));
      for (const issue of compatibility.issues) {
        console.log(outputFormatter.warning(`🔸 ${issue.type}: ${issue.message}`));
        console.log(outputFormatter.info(`   💡 ${issue.action}`));
      }
    } else {
      console.log('\n' + outputFormatter.success('✅ No compatibility issues found'));
    }
  }

  /**
   * Check for deprecated features
   */
  async checkDeprecations() {
    console.log(outputFormatter.header('⚠️  Deprecation Check'));

    const deprecations = updateManager.checkDeprecations();

    if (deprecations.length === 0) {
      console.log(outputFormatter.success('✅ No deprecated features found'));
      return;
    }

    console.log(outputFormatter.warning(`Found ${deprecations.length} deprecated feature(s):`));
    console.log('');

    for (const deprecation of deprecations) {
      const severityIcon = deprecation.severity === 'error' ? '🚨' : '⚠️';
      console.log(outputFormatter.warning(`${severityIcon} ${deprecation.type}: ${deprecation.message}`));
      console.log(outputFormatter.info(`   💡 Action: ${deprecation.action}`));
      console.log('');
    }

    console.log(outputFormatter.info('💡 Update your configuration to avoid future issues'));
  }

  /**
   * Show brief update information
   */
  async showBriefInfo() {
    const versionInfo = updateManager.getVersionInfo();
    
    console.log(outputFormatter.header('📋 MDSAAD CLI'));
    console.log(outputFormatter.info(`📦 Version: ${versionInfo.current}`));

    // Quick update check
    const updateInfo = await updateManager.checkForUpdates();
    if (updateInfo) {
      if (updateInfo.hasUpdate) {
        console.log(outputFormatter.warning(`🔄 Update available: v${updateInfo.latestVersion}`));
        console.log(outputFormatter.info('   Run "mdsaad update --check" for details'));
      } else {
        console.log(outputFormatter.success('✅ Up to date'));
      }
    }

    console.log('\n' + outputFormatter.info('💡 Commands:'));
    console.log(outputFormatter.info('   mdsaad update --check      Check for updates'));
    console.log(outputFormatter.info('   mdsaad update --version    Show version details'));
    console.log(outputFormatter.info('   mdsaad update --changelog  Show changelog'));
    console.log(outputFormatter.info('   mdsaad update --settings   Show update settings'));
  }

  /**
   * Get human-readable time difference
   */
  getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }
}

module.exports = UpdateCommand;