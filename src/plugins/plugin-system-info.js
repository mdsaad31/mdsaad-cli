/**
 * System Info Plugin for MDSAAD CLI
 *
 * A built-in plugin that provides system information commands
 */

class SystemInfoPlugin {
  constructor() {
    this.name = 'system-info';
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

    // Register system info commands
    api.registerCommand(
      'sysinfo',
      this.systemInfoCommand.bind(this),
      this.name
    );
    api.registerCommand('uptime', this.uptimeCommand.bind(this), this.name);
    api.registerCommand('memory', this.memoryCommand.bind(this), this.name);

    // Register hooks
    api.registerHook('before-command', this.logCommand.bind(this), this.name);

    this.logger.info('System Info plugin initialized');
  }

  /**
   * System information command
   */
  async systemInfoCommand(args, options) {
    const os = require('os');

    console.log(this.api.outputFormatter.header('💻 System Information'));

    const systemInfo = {
      Platform: os.platform(),
      Architecture: os.arch(),
      'OS Release': os.release(),
      Hostname: os.hostname(),
      'CPU Cores': os.cpus().length,
      'Total Memory': `${Math.round((os.totalmem() / 1024 / 1024 / 1024) * 100) / 100} GB`,
      'Free Memory': `${Math.round((os.freemem() / 1024 / 1024 / 1024) * 100) / 100} GB`,
      Uptime: `${Math.round((os.uptime() / 3600) * 100) / 100} hours`,
      'Node.js Version': process.version,
      'Load Average': os
        .loadavg()
        .map(load => load.toFixed(2))
        .join(', '),
    };

    console.log(this.api.outputFormatter.formatObject('System', systemInfo));

    return { success: true, systemInfo };
  }

  /**
   * System uptime command
   */
  async uptimeCommand(args, options) {
    const os = require('os');
    const uptime = os.uptime();

    const days = Math.floor(uptime / 86400);
    const hours = Math.floor((uptime % 86400) / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);

    let uptimeString = '';
    if (days > 0) uptimeString += `${days}d `;
    if (hours > 0) uptimeString += `${hours}h `;
    if (minutes > 0) uptimeString += `${minutes}m `;
    uptimeString += `${seconds}s`;

    console.log(
      this.api.outputFormatter.success(`⏰ System Uptime: ${uptimeString}`)
    );
    console.log(
      this.api.outputFormatter.info(`   Total seconds: ${uptime.toFixed(0)}`)
    );

    return { success: true, uptime: uptimeString, seconds: uptime };
  }

  /**
   * Memory usage command
   */
  async memoryCommand(args, options) {
    const os = require('os');
    const process = require('process');

    console.log(this.api.outputFormatter.header('🧠 Memory Usage'));

    // System memory
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercentage = ((usedMem / totalMem) * 100).toFixed(1);

    const systemMemory = {
      'Total Memory': `${Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100} GB`,
      'Used Memory': `${Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100} GB`,
      'Free Memory': `${Math.round((freeMem / 1024 / 1024 / 1024) * 100) / 100} GB`,
      'Usage Percentage': `${usedPercentage}%`,
    };

    console.log(
      this.api.outputFormatter.formatObject('System Memory', systemMemory)
    );

    // Process memory
    const procMem = process.memoryUsage();
    const processMemory = {
      'RSS (Resident Set Size)': `${Math.round((procMem.rss / 1024 / 1024) * 100) / 100} MB`,
      'Heap Total': `${Math.round((procMem.heapTotal / 1024 / 1024) * 100) / 100} MB`,
      'Heap Used': `${Math.round((procMem.heapUsed / 1024 / 1024) * 100) / 100} MB`,
      External: `${Math.round((procMem.external / 1024 / 1024) * 100) / 100} MB`,
    };

    console.log(
      this.api.outputFormatter.formatObject('Process Memory', processMemory)
    );

    // Memory status indicator
    if (usedPercentage > 90) {
      console.log(
        this.api.outputFormatter.error('⚠️ High memory usage detected')
      );
    } else if (usedPercentage > 75) {
      console.log(this.api.outputFormatter.warning('⚠️ Moderate memory usage'));
    } else {
      console.log(
        this.api.outputFormatter.success('✅ Memory usage is normal')
      );
    }

    return { success: true, system: systemMemory, process: processMemory };
  }

  /**
   * Hook to log command execution
   */
  async logCommand(data) {
    if (data.command) {
      this.logger.debug(`Command executed: ${data.command}`);
    }
    return data;
  }

  /**
   * Cleanup function
   */
  async cleanup() {
    this.logger.info('System Info plugin cleanup completed');
  }
}

// Export the plugin
module.exports = new SystemInfoPlugin();
