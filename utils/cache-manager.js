#!/usr/bin/env node

/**
 * Cache Management Utility
 * CLI tool for managing mdsaad cache
 */

const { Command } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const cache = require('../src/services/cache');

class CacheManager {
  constructor() {
    this.program = new Command();
  }

  async initialize() {
    await cache.initialize();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('mdsaad-cache')
      .description('Cache management utility for mdsaad CLI tool')
      .version('1.0.0');

    // Show cache statistics
    this.program
      .command('stats')
      .description('Display cache statistics')
      .option('-j, --json', 'Output as JSON')
      .action(async (options) => {
        await this.showStats(options);
      });

    // List cache entries
    this.program
      .command('list [namespace]')
      .description('List cache entries by namespace')
      .option('-e, --expired', 'Show only expired entries')
      .action(async (namespace, options) => {
        await this.listEntries(namespace, options);
      });

    // Clear cache
    this.program
      .command('clear [namespace]')
      .description('Clear cache entries (all or by namespace)')
      .option('-y, --yes', 'Skip confirmation')
      .action(async (namespace, options) => {
        await this.clearCache(namespace, options);
      });

    // Cleanup expired entries
    this.program
      .command('cleanup')
      .description('Remove expired cache entries')
      .action(async () => {
        await this.cleanup();
      });

    // Test cache operations
    this.program
      .command('test')
      .description('Test cache functionality')
      .action(async () => {
        await this.testCache();
      });

    // Set cache size limit
    this.program
      .command('size <limit>')
      .description('Set maximum cache size (in MB)')
      .action(async (limit) => {
        await this.setSize(limit);
      });
  }

  async showStats(options) {
    try {
      const stats = await cache.getStats();
      
      if (options.json) {
        console.log(JSON.stringify(stats, null, 2));
        return;
      }

      console.log(chalk.cyan('📊 Cache Statistics:'));
      console.log();
      
      // General stats
      console.log(chalk.yellow('General:'));
      console.log(`  Total Entries: ${stats.totalEntries}`);
      console.log(`  Total Size: ${this.formatBytes(stats.totalSize)}`);
      console.log(`  Expired Entries: ${stats.expiredEntries}`);
      
      if (stats.oldestEntry) {
        console.log(`  Oldest Entry: ${new Date(stats.oldestEntry).toLocaleString()}`);
      }
      if (stats.newestEntry) {
        console.log(`  Newest Entry: ${new Date(stats.newestEntry).toLocaleString()}`);
      }
      
      console.log();
      
      // Namespace breakdown
      console.log(chalk.yellow('By Namespace:'));
      Object.entries(stats.namespaces).forEach(([namespace, nsStats]) => {
        const expiredInfo = nsStats.expired > 0 ? chalk.red(` (${nsStats.expired} expired)`) : '';
        console.log(`  ${namespace}: ${nsStats.entries} entries, ${this.formatBytes(nsStats.size)}${expiredInfo}`);
      });
      
      if (stats.error) {
        console.log();
        console.log(chalk.red('⚠️  Error:'), stats.error);
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to get cache statistics:'), error.message);
    }
  }

  async listEntries(namespace, options) {
    try {
      console.log(chalk.cyan(`📁 Cache Entries${namespace ? ` (${namespace})` : ''}`));
      console.log();

      const stats = await cache.getStats();
      const namespacesToShow = namespace ? [namespace] : Object.keys(stats.namespaces);

      for (const ns of namespacesToShow) {
        if (!stats.namespaces[ns]) {
          console.log(chalk.yellow(`No entries found in namespace: ${ns}`));
          continue;
        }

        const nsStats = stats.namespaces[ns];
        console.log(chalk.yellow(`${ns} (${nsStats.entries} entries):`));

        // This is a simplified listing - in a real implementation, 
        // you'd scan the directory and show individual entries
        if (options.expired && nsStats.expired > 0) {
          console.log(`  ${nsStats.expired} expired entries`);
        } else if (!options.expired) {
          console.log(`  ${nsStats.entries} total entries`);
        }
        console.log();
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to list cache entries:'), error.message);
    }
  }

  async clearCache(namespace, options) {
    try {
      const stats = await cache.getStats();
      
      if (namespace) {
        if (!stats.namespaces[namespace]) {
          console.log(chalk.yellow(`No entries found in namespace: ${namespace}`));
          return;
        }

        if (!options.yes) {
          const { confirmed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `Clear all entries in namespace "${namespace}" (${stats.namespaces[namespace].entries} entries)?`,
              default: false
            }
          ]);

          if (!confirmed) {
            console.log(chalk.yellow('Clear cancelled'));
            return;
          }
        }

        const cleared = await cache.clearNamespace(namespace);
        if (cleared) {
          console.log(chalk.green(`✅ Cleared namespace: ${namespace}`));
        } else {
          console.log(chalk.red(`❌ Failed to clear namespace: ${namespace}`));
        }
      } else {
        if (!options.yes) {
          const { confirmed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirmed',
              message: `Clear ALL cache entries (${stats.totalEntries} entries, ${this.formatBytes(stats.totalSize)})?`,
              default: false
            }
          ]);

          if (!confirmed) {
            console.log(chalk.yellow('Clear cancelled'));
            return;
          }
        }

        const cleared = await cache.clearAll();
        if (cleared) {
          console.log(chalk.green('✅ All cache entries cleared'));
        } else {
          console.log(chalk.red('❌ Failed to clear cache'));
        }
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to clear cache:'), error.message);
    }
  }

  async cleanup() {
    try {
      console.log(chalk.cyan('🧹 Cleaning up expired cache entries...'));
      
      const cleanedCount = await cache.cleanup();
      
      if (cleanedCount > 0) {
        console.log(chalk.green(`✅ Cleanup completed: ${cleanedCount} expired entries removed`));
      } else {
        console.log(chalk.blue('ℹ️  No expired entries found'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Cache cleanup failed:'), error.message);
    }
  }

  async testCache() {
    try {
      console.log(chalk.cyan('🧪 Testing Cache Functionality'));
      console.log();

      // Test basic operations
      console.log('Testing basic set/get operations...');
      
      const testData = {
        message: 'Hello, Cache!',
        timestamp: Date.now(),
        number: 42
      };

      // Store test data
      await cache.set('test', 'cache-test', testData, 5000); // 5 second TTL
      console.log(chalk.green('✅ Store operation: OK'));

      // Retrieve test data
      const retrieved = await cache.get('test', 'cache-test');
      if (retrieved && JSON.stringify(retrieved.data) === JSON.stringify(testData)) {
        console.log(chalk.green('✅ Retrieve operation: OK'));
      } else {
        console.log(chalk.red('❌ Retrieve operation: FAILED'));
      }

      // Test expiration
      console.log('Testing cache expiration...');
      await cache.set('test', 'expire-test', { temp: 'data' }, 100); // 100ms TTL
      
      await new Promise(resolve => setTimeout(resolve, 150)); // Wait for expiration
      
      const expired = await cache.get('test', 'expire-test');
      if (expired === null) {
        console.log(chalk.green('✅ Expiration test: OK'));
      } else {
        console.log(chalk.red('❌ Expiration test: FAILED'));
      }

      // Test middleware
      console.log('Testing cache middleware...');
      const middleware = cache.middleware('test', 1000);
      
      let fetchCount = 0;
      const mockFetch = async () => {
        fetchCount++;
        return { result: `fetch-${fetchCount}` };
      };

      const result1 = await middleware('middleware-test', mockFetch);
      const result2 = await middleware('middleware-test', mockFetch);

      if (fetchCount === 1 && result1.result === result2.result && result2._cached) {
        console.log(chalk.green('✅ Middleware test: OK'));
      } else {
        console.log(chalk.red('❌ Middleware test: FAILED'));
      }

      // Clean up test data
      await cache.clearNamespace('test');
      
      console.log();
      console.log(chalk.green('🎉 Cache functionality test completed!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Cache test failed:'), error.message);
    }
  }

  async setSize(limitMB) {
    try {
      const limitBytes = parseInt(limitMB) * 1024 * 1024;
      
      if (isNaN(limitBytes) || limitBytes <= 0) {
        console.error(chalk.red('❌ Invalid size limit. Please provide a positive number in MB.'));
        return;
      }

      cache.setMaxSize(limitBytes);
      console.log(chalk.green(`✅ Cache size limit set to ${limitMB} MB (${this.formatBytes(limitBytes)})`));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to set cache size:'), error.message);
    }
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async run() {
    try {
      await this.initialize();
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('❌ Cache manager error:'), error.message);
      process.exit(1);
    }
  }
}

// Run if called directly
if (require.main === module) {
  const manager = new CacheManager();
  manager.run();
}

module.exports = CacheManager;