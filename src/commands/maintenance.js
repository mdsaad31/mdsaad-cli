/**
 * Maintenance Command
 * Handles cache cleanup, diagnostics, and system maintenance tasks
 */

const maintenanceService = require('../services/maintenance-service');
const outputFormatter = require('../services/output-formatter');
const debugService = require('../services/debug-service');

class MaintenanceCommand {
  constructor() {
    this.name = 'maintenance';
    this.description = 'System maintenance and diagnostics';
  }

  /**
   * Configure the command
   */
  configure(commander) {
    const cmd = commander
      .command('maintenance')
      .alias('maint')
      .description('System maintenance and diagnostics')
      .option('-d, --diagnostics', 'Run comprehensive system diagnostics')
      .option('-c, --clean-cache [type]', 'Clean cache files (all, expired, or number of days)')
      .option('-t, --clean-temp', 'Clean temporary files')
      .option('-l, --clean-logs [days]', 'Clean log files older than specified days (default: 30)')
      .option('-s, --storage', 'Show storage usage statistics')
      .option('--migrate-config', 'Migrate configuration to newer format')
      .option('--reset [type]', 'Reset data (all, config, cache, temp, logs)')
      .option('--health', 'Quick health check')
      .option('--fix', 'Attempt to fix common issues automatically')
      .action(async (options) => {
        try {
          await this.execute(options);
        } catch (error) {
          console.error(outputFormatter.error(`Maintenance command failed: ${error.message}`));
          debugService.debug('Maintenance command error', { error: error.message, stack: error.stack });
          process.exit(1);
        }
      });

    return cmd;
  }

  /**
   * Execute the maintenance command
   */
  async execute(options) {
    // Initialize maintenance service
    await maintenanceService.initialize();

    if (options.diagnostics) {
      await this.runDiagnostics();
      return;
    }

    if (options.cleanCache !== undefined) {
      await this.cleanCache(options.cleanCache);
      return;
    }

    if (options.cleanTemp) {
      await this.cleanTemp();
      return;
    }

    if (options.cleanLogs !== undefined) {
      const days = parseInt(options.cleanLogs) || 30;
      await this.cleanLogs(days);
      return;
    }

    if (options.storage) {
      await this.showStorage();
      return;
    }

    if (options.migrateConfig) {
      await this.migrateConfig();
      return;
    }

    if (options.reset !== undefined) {
      await this.resetData(options.reset);
      return;
    }

    if (options.health) {
      await this.quickHealth();
      return;
    }

    if (options.fix) {
      await this.autoFix();
      return;
    }

    // Default: show maintenance menu
    await this.showMaintenanceMenu();
  }

  /**
   * Run comprehensive diagnostics
   */
  async runDiagnostics() {
    console.log(outputFormatter.header('🔍 System Diagnostics'));

    const spinner = outputFormatter.spinner('Running diagnostics...');
    spinner.start();

    try {
      const diagnostics = await maintenanceService.runDiagnostics();
      spinner.stop();

      // System Information
      console.log(outputFormatter.subheader('💻 System Information'));
      console.log(outputFormatter.createTable([
        ['Platform', `${diagnostics.system.platform} ${diagnostics.system.arch}`],
        ['OS Release', diagnostics.system.release],
        ['Node.js Version', diagnostics.system.nodeVersion],
        ['NPM Version', diagnostics.system.npmVersion],
        ['Total Memory', maintenanceService.formatBytes(diagnostics.system.totalMemory)],
        ['Free Memory', maintenanceService.formatBytes(diagnostics.system.freeMemory)],
        ['CPU Cores', diagnostics.system.cpus],
        ['Uptime', this.formatUptime(diagnostics.system.uptime)]
      ]));

      // MDSAAD Information
      console.log('\n' + outputFormatter.subheader('📦 MDSAAD Information'));
      console.log(outputFormatter.createTable([
        ['Version', diagnostics.mdsaad.version],
        ['Install Path', diagnostics.mdsaad.installPath],
        ['Config Directory', diagnostics.mdsaad.configDir],
        ['Config Exists', diagnostics.mdsaad.configExists ? '✅ Yes' : '❌ No'],
        ['Cache Exists', diagnostics.mdsaad.cacheExists ? '✅ Yes' : '❌ No'],
        ['Plugins Directory', diagnostics.mdsaad.pluginsExists ? '✅ Yes' : '❌ No']
      ]));

      // Configuration Status
      console.log('\n' + outputFormatter.subheader('⚙️  Configuration Status'));
      const configStatus = diagnostics.configuration.valid ? '✅ Valid' : '❌ Invalid';
      console.log(outputFormatter.createTable([
        ['Status', configStatus],
        ['Version', diagnostics.configuration.version || 'Unknown'],
        ['Keys Count', diagnostics.configuration.keys.length],
        ['Issues', diagnostics.configuration.issues.length]
      ]));

      if (diagnostics.configuration.issues.length > 0) {
        console.log('\n' + outputFormatter.warning('Configuration Issues:'));
        for (const issue of diagnostics.configuration.issues) {
          console.log(outputFormatter.warning(`  • ${issue}`));
        }
      }

      // Cache Status
      console.log('\n' + outputFormatter.subheader('💾 Cache Status'));
      console.log(outputFormatter.createTable([
        ['Files', diagnostics.cache.files],
        ['Total Size', maintenanceService.formatBytes(diagnostics.cache.size)],
        ['Status', diagnostics.cache.healthy ? '✅ Healthy' : '❌ Issues'],
        ['Oldest Entry', diagnostics.cache.oldestEntry || 'N/A'],
        ['Newest Entry', diagnostics.cache.newestEntry || 'N/A']
      ]));

      // Network Status
      console.log('\n' + outputFormatter.subheader('🌐 Network Status'));
      const networkStatus = diagnostics.network.connected ? '✅ Connected' : '❌ Offline';
      console.log(outputFormatter.createTable([
        ['Internet', networkStatus],
        ['WeatherAPI', diagnostics.network.apiReachable.WeatherAPI ? '✅ Reachable' : '❌ Unreachable'],
        ['ExchangeRate-API', diagnostics.network.apiReachable['ExchangeRate-API'] ? '✅ Reachable' : '❌ Unreachable'],
        ['npm Registry', diagnostics.network.apiReachable['npm Registry'] ? '✅ Reachable' : '❌ Unreachable']
      ]));

      // Permissions Status
      console.log('\n' + outputFormatter.subheader('🔒 Permissions Status'));
      console.log(outputFormatter.createTable([
        ['Config Readable', diagnostics.permissions.configDirReadable ? '✅ Yes' : '❌ No'],
        ['Config Writable', diagnostics.permissions.configDirWritable ? '✅ Yes' : '❌ No'],
        ['Temp Writable', diagnostics.permissions.tempDirWritable ? '✅ Yes' : '❌ No']
      ]));

      // Overall Health
      console.log('\n' + outputFormatter.subheader('🏥 Health Summary'));
      const healthIcon = this.getHealthIcon(diagnostics.health.overall);
      console.log(outputFormatter.info(`Overall Status: ${healthIcon} ${diagnostics.health.overall.toUpperCase()}`));

      if (diagnostics.health.issues.length > 0) {
        console.log('\n' + outputFormatter.error('🚨 Critical Issues:'));
        for (const issue of diagnostics.health.issues) {
          console.log(outputFormatter.error(`  • ${issue}`));
        }
      }

      if (diagnostics.health.warnings.length > 0) {
        console.log('\n' + outputFormatter.warning('⚠️  Warnings:'));
        for (const warning of diagnostics.health.warnings) {
          console.log(outputFormatter.warning(`  • ${warning}`));
        }
      }

      if (diagnostics.health.recommendations.length > 0) {
        console.log('\n' + outputFormatter.info('💡 Recommendations:'));
        for (const recommendation of diagnostics.health.recommendations) {
          console.log(outputFormatter.info(`  • ${recommendation}`));
        }
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Diagnostics failed: ${error.message}`));
      debugService.debug('Diagnostics failed', { error: error.message });
    }
  }

  /**
   * Clean cache files
   */
  async cleanCache(type) {
    console.log(outputFormatter.header('🧹 Cache Cleanup'));

    let options = {};
    
    if (type === 'all' || type === true) {
      options.all = true;
    } else if (type === 'expired') {
      options.expired = true;
    } else if (!isNaN(parseInt(type))) {
      options.olderThan = parseInt(type);
    } else {
      options.expired = true; // Default to expired
    }

    const spinner = outputFormatter.spinner('Cleaning cache...');
    spinner.start();

    try {
      const results = await maintenanceService.cleanupCache(options);
      spinner.stop();

      console.log(outputFormatter.createTable([
        ['Total Files', results.totalFiles],
        ['Deleted Files', results.deletedFiles],
        ['Freed Space', maintenanceService.formatBytes(results.freedSpace)],
        ['Errors', results.errors.length]
      ]));

      if (results.errors.length > 0) {
        console.log('\n' + outputFormatter.warning('Errors encountered:'));
        for (const error of results.errors) {
          console.log(outputFormatter.warning(`  • ${error}`));
        }
      }

      if (results.deletedFiles > 0) {
        console.log('\n' + outputFormatter.success(`✅ Cache cleanup completed`));
      } else {
        console.log('\n' + outputFormatter.info('ℹ️  No cache files to clean'));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Cache cleanup failed: ${error.message}`));
    }
  }

  /**
   * Clean temporary files
   */
  async cleanTemp() {
    console.log(outputFormatter.header('🗑️  Temporary File Cleanup'));

    const spinner = outputFormatter.spinner('Cleaning temporary files...');
    spinner.start();

    try {
      const results = await maintenanceService.cleanupTempFiles();
      spinner.stop();

      console.log(outputFormatter.createTable([
        ['Deleted Files', results.deletedFiles],
        ['Freed Space', maintenanceService.formatBytes(results.freedSpace)],
        ['Errors', results.errors.length]
      ]));

      if (results.errors.length > 0) {
        console.log('\n' + outputFormatter.warning('Errors encountered:'));
        for (const error of results.errors) {
          console.log(outputFormatter.warning(`  • ${error}`));
        }
      }

      if (results.deletedFiles > 0) {
        console.log('\n' + outputFormatter.success(`✅ Temporary files cleanup completed`));
      } else {
        console.log('\n' + outputFormatter.info('ℹ️  No temporary files to clean'));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Temporary files cleanup failed: ${error.message}`));
    }
  }

  /**
   * Clean log files
   */
  async cleanLogs(maxAgeDays) {
    console.log(outputFormatter.header('📋 Log File Cleanup'));

    const spinner = outputFormatter.spinner(`Cleaning logs older than ${maxAgeDays} days...`);
    spinner.start();

    try {
      const results = await maintenanceService.cleanupLogs(maxAgeDays);
      spinner.stop();

      console.log(outputFormatter.createTable([
        ['Deleted Files', results.deletedFiles],
        ['Freed Space', maintenanceService.formatBytes(results.freedSpace)],
        ['Errors', results.errors.length]
      ]));

      if (results.errors.length > 0) {
        console.log('\n' + outputFormatter.warning('Errors encountered:'));
        for (const error of results.errors) {
          console.log(outputFormatter.warning(`  • ${error}`));
        }
      }

      if (results.deletedFiles > 0) {
        console.log('\n' + outputFormatter.success(`✅ Log cleanup completed`));
      } else {
        console.log('\n' + outputFormatter.info('ℹ️  No log files to clean'));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Log cleanup failed: ${error.message}`));
    }
  }

  /**
   * Show storage usage statistics
   */
  async showStorage() {
    console.log(outputFormatter.header('💾 Storage Usage'));

    const spinner = outputFormatter.spinner('Calculating storage usage...');
    spinner.start();

    try {
      const stats = await maintenanceService.getStorageStats();
      spinner.stop();

      console.log(outputFormatter.createTable([
        ['Total Usage', maintenanceService.formatBytes(stats.total)],
        ['Configuration', maintenanceService.formatBytes(stats.config)],
        ['Cache', maintenanceService.formatBytes(stats.cache)],
        ['Temporary Files', maintenanceService.formatBytes(stats.temp)],
        ['Log Files', maintenanceService.formatBytes(stats.logs)],
        ['Plugins', maintenanceService.formatBytes(stats.plugins)],
        ['Other', maintenanceService.formatBytes(stats.other)]
      ]));

      // Show percentage breakdown
      if (stats.total > 0) {
        console.log('\n' + outputFormatter.subheader('📊 Breakdown'));
        const breakdown = [
          ['Cache', ((stats.cache / stats.total) * 100).toFixed(1) + '%'],
          ['Logs', ((stats.logs / stats.total) * 100).toFixed(1) + '%'],
          ['Temp', ((stats.temp / stats.total) * 100).toFixed(1) + '%'],
          ['Plugins', ((stats.plugins / stats.total) * 100).toFixed(1) + '%'],
          ['Config', ((stats.config / stats.total) * 100).toFixed(1) + '%'],
          ['Other', ((stats.other / stats.total) * 100).toFixed(1) + '%']
        ];
        console.log(outputFormatter.createTable(breakdown));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Failed to get storage stats: ${error.message}`));
    }
  }

  /**
   * Migrate configuration
   */
  async migrateConfig() {
    console.log(outputFormatter.header('🔄 Configuration Migration'));

    const spinner = outputFormatter.spinner('Migrating configuration...');
    spinner.start();

    try {
      const result = await maintenanceService.migrateConfiguration();
      spinner.stop();

      if (result.success) {
        if (result.migrated) {
          console.log(outputFormatter.success('✅ Configuration migrated successfully'));
        } else {
          console.log(outputFormatter.info('ℹ️  Configuration is already up to date'));
        }
      } else {
        console.log(outputFormatter.error(`❌ Configuration migration failed: ${result.error}`));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Configuration migration failed: ${error.message}`));
    }
  }

  /**
   * Reset data
   */
  async resetData(type) {
    const resetType = type === true ? 'all' : type;
    
    console.log(outputFormatter.header('🔄 Data Reset'));
    console.log(outputFormatter.warning(`⚠️  This will reset: ${resetType}`));
    
    // In a real CLI, you'd want to add confirmation prompt here
    console.log(outputFormatter.info('Proceeding with reset...'));

    const spinner = outputFormatter.spinner('Resetting data...');
    spinner.start();

    try {
      const options = {};
      
      if (resetType === 'config') {
        options.cache = false;
        options.temp = false;
        options.logs = false;
      } else if (resetType === 'cache') {
        options.config = false;
        options.temp = false;
        options.logs = false;
      } else if (resetType === 'temp') {
        options.config = false;
        options.cache = false;
        options.logs = false;
      } else if (resetType === 'logs') {
        options.config = false;
        options.cache = false;
        options.temp = false;
      }

      const results = await maintenanceService.resetAll(options);
      spinner.stop();

      console.log(outputFormatter.createTable([
        ['Configuration Reset', results.configReset ? '✅ Yes' : '❌ No'],
        ['Cache Cleared', results.cacheCleared ? '✅ Yes' : '❌ No'],
        ['Temp Cleared', results.tempCleared ? '✅ Yes' : '❌ No'],
        ['Logs Cleared', results.logsCleared ? '✅ Yes' : '❌ No'],
        ['Errors', results.errors.length]
      ]));

      if (results.errors.length > 0) {
        console.log('\n' + outputFormatter.warning('Errors encountered:'));
        for (const error of results.errors) {
          console.log(outputFormatter.warning(`  • ${error}`));
        }
      }

      console.log('\n' + outputFormatter.success('✅ Reset completed'));

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Reset failed: ${error.message}`));
    }
  }

  /**
   * Quick health check
   */
  async quickHealth() {
    console.log(outputFormatter.header('🏥 Quick Health Check'));

    const spinner = outputFormatter.spinner('Checking system health...');
    spinner.start();

    try {
      const diagnostics = await maintenanceService.runDiagnostics();
      spinner.stop();

      const health = diagnostics.health;
      const healthIcon = this.getHealthIcon(health.overall);

      console.log(outputFormatter.info(`Overall Status: ${healthIcon} ${health.overall.toUpperCase()}`));

      if (health.issues.length > 0) {
        console.log('\n' + outputFormatter.error('🚨 Critical Issues:'));
        for (const issue of health.issues) {
          console.log(outputFormatter.error(`  • ${issue}`));
        }
      }

      if (health.warnings.length > 0) {
        console.log('\n' + outputFormatter.warning('⚠️  Warnings:'));
        for (const warning of health.warnings) {
          console.log(outputFormatter.warning(`  • ${warning}`));
        }
      }

      if (health.recommendations.length > 0) {
        console.log('\n' + outputFormatter.info('💡 Recommendations:'));
        for (const recommendation of health.recommendations) {
          console.log(outputFormatter.info(`  • ${recommendation}`));
        }
      }

      if (health.issues.length === 0 && health.warnings.length === 0) {
        console.log('\n' + outputFormatter.success('✅ System is healthy'));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Health check failed: ${error.message}`));
    }
  }

  /**
   * Automatic fix for common issues
   */
  async autoFix() {
    console.log(outputFormatter.header('🔧 Auto Fix'));

    const spinner = outputFormatter.spinner('Analyzing and fixing issues...');
    spinner.start();

    try {
      const diagnostics = await maintenanceService.runDiagnostics();
      spinner.stop();

      let fixedIssues = 0;
      const fixResults = [];

      // Fix configuration issues
      if (!diagnostics.configuration.valid) {
        try {
          await maintenanceService.migrateConfiguration();
          fixResults.push('✅ Configuration migrated');
          fixedIssues++;
        } catch (error) {
          fixResults.push('❌ Failed to fix configuration');
        }
      }

      // Clean expired cache if there are cache issues
      if (!diagnostics.cache.healthy || diagnostics.cache.files > 100) {
        try {
          await maintenanceService.cleanupCache({ expired: true });
          fixResults.push('✅ Expired cache cleaned');
          fixedIssues++;
        } catch (error) {
          fixResults.push('❌ Failed to clean cache');
        }
      }

      // Clean old temp files
      try {
        const tempResults = await maintenanceService.cleanupTempFiles();
        if (tempResults.deletedFiles > 0) {
          fixResults.push('✅ Temporary files cleaned');
          fixedIssues++;
        }
      } catch (error) {
        fixResults.push('❌ Failed to clean temp files');
      }

      console.log(outputFormatter.info(`Fixed ${fixedIssues} issue(s):`));
      for (const result of fixResults) {
        console.log(outputFormatter.info(`  ${result}`));
      }

      if (fixedIssues > 0) {
        console.log('\n' + outputFormatter.success('✅ Auto fix completed'));
      } else {
        console.log('\n' + outputFormatter.info('ℹ️  No issues found to fix'));
      }

    } catch (error) {
      spinner.stop();
      console.log(outputFormatter.error(`❌ Auto fix failed: ${error.message}`));
    }
  }

  /**
   * Show maintenance menu
   */
  async showMaintenanceMenu() {
    console.log(outputFormatter.header('🔧 Maintenance & Diagnostics'));

    console.log(outputFormatter.subheader('🔍 Diagnostics'));
    console.log(outputFormatter.info('  mdsaad maintenance --diagnostics     Run full system diagnostics'));
    console.log(outputFormatter.info('  mdsaad maintenance --health          Quick health check'));

    console.log('\n' + outputFormatter.subheader('🧹 Cleanup'));
    console.log(outputFormatter.info('  mdsaad maintenance --clean-cache     Clean all cache files'));
    console.log(outputFormatter.info('  mdsaad maintenance --clean-cache expired  Clean expired cache only'));
    console.log(outputFormatter.info('  mdsaad maintenance --clean-temp      Clean temporary files'));
    console.log(outputFormatter.info('  mdsaad maintenance --clean-logs      Clean old log files'));

    console.log('\n' + outputFormatter.subheader('📊 Information'));
    console.log(outputFormatter.info('  mdsaad maintenance --storage         Show storage usage'));

    console.log('\n' + outputFormatter.subheader('🔄 Maintenance'));
    console.log(outputFormatter.info('  mdsaad maintenance --migrate-config  Migrate configuration'));
    console.log(outputFormatter.info('  mdsaad maintenance --fix             Auto-fix common issues'));
    console.log(outputFormatter.info('  mdsaad maintenance --reset [type]    Reset data'));
  }

  /**
   * Get health status icon
   */
  getHealthIcon(status) {
    switch (status) {
      case 'healthy': return '✅';
      case 'degraded': return '⚠️';
      case 'unhealthy': return '❌';
      default: return '❓';
    }
  }

  /**
   * Format uptime in human readable format
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);

    return parts.join(' ') || '< 1m';
  }
}

module.exports = MaintenanceCommand;