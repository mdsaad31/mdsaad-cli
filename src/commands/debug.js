/**
 * Debug Command
 * CLI debugging and diagnostics interface
 */

const { Command } = require('commander');
const debugService = require('../services/debug-service');
const errorHandler = require('../services/error-handler');
const outputFormatter = require('../services/output-formatter');
const path = require('path');
const os = require('os');

const debugCommand = new Command('debug');

debugCommand
  .description('🔧 Debugging and diagnostic tools')
  .option('-e, --enable', 'Enable debug mode')
  .option('-d, --disable', 'Disable debug mode')
  .option('-v, --verbose', 'Enable verbose mode')
  .option('-r, --report', 'Generate diagnostic report')
  .option('-c, --clear', 'Clear debug log')
  .option('-s, --status', 'Show debug status')
  .option('--export <file>', 'Export diagnostics to file')
  .option('--validate', 'Validate system requirements')
  .option('--test-errors', 'Test error handling scenarios')
  .action(async options => {
    try {
      await debugService.initialize();

      // Handle different debug options
      if (options.enable) {
        debugService.enableDebug();
        return;
      }

      if (options.disable) {
        debugService.disableDebug();
        return;
      }

      if (options.verbose) {
        debugService.enableVerbose();
        return;
      }

      if (options.clear) {
        debugService.clearDebugLog();
        return;
      }

      if (options.report) {
        await generateFullReport();
        return;
      }

      if (options.status) {
        showDebugStatus();
        return;
      }

      if (options.export) {
        await exportDiagnostics(options.export);
        return;
      }

      if (options.validate) {
        await validateSystem();
        return;
      }

      if (options.testErrors) {
        await testErrorHandling();
        return;
      }

      // Default: show debug menu
      await showDebugMenu();
    } catch (error) {
      await errorHandler.handle(error, {
        command: 'debug',
        context: { options },
        userFriendly: true,
      });
    }
  });

/**
 * Show debug status
 */
function showDebugStatus() {
  console.log(outputFormatter.header('🔍 Debug Status'));

  const status = {
    'Debug Mode': debugService.debugMode ? '✅ Enabled' : '❌ Disabled',
    'Verbose Mode': debugService.verboseMode ? '✅ Enabled' : '❌ Disabled',
    'Debug Log Entries': debugService.debugLog.length,
    'Performance Markers': debugService.performanceMarkers.size,
    'Debug Log File': debugService.debugFile,
  };

  console.log(outputFormatter.formatObject('Status', status));
}

/**
 * Generate full diagnostic report
 */
async function generateFullReport() {
  console.log(
    outputFormatter.info('🔄 Generating comprehensive diagnostic report...')
  );

  await debugService.generateDiagnosticReport();

  // Add error statistics
  console.log(outputFormatter.subheader('Error Statistics'));
  try {
    const errorStats = errorHandler.getErrorStatistics(7);
    if (errorStats.totalErrors > 0) {
      console.log(outputFormatter.formatObject('Last 7 Days', errorStats));
    } else {
      console.log(outputFormatter.success('✅ No errors in the last 7 days'));
    }
  } catch (error) {
    console.log(outputFormatter.warning('Could not load error statistics'));
  }
}

/**
 * Export diagnostics to file
 */
async function exportDiagnostics(filePath) {
  try {
    // Resolve file path
    const resolvedPath = path.isAbsolute(filePath)
      ? filePath
      : path.join(process.cwd(), filePath);

    await debugService.exportDiagnostics(resolvedPath);
    console.log(
      outputFormatter.success(`📁 Diagnostics exported to: ${resolvedPath}`)
    );
  } catch (error) {
    console.log(outputFormatter.error('Export failed:', error.message));
  }
}

/**
 * Validate system requirements
 */
async function validateSystem() {
  console.log(outputFormatter.header('🔧 System Validation'));

  const validation = debugService.validateSystemRequirements();

  if (validation.issues.length > 0) {
    console.log(outputFormatter.subheader('❌ Critical Issues'));
    validation.issues.forEach(issue => {
      console.log(outputFormatter.error(issue));
    });
  }

  if (validation.warnings.length > 0) {
    console.log(outputFormatter.subheader('⚠️ Warnings'));
    validation.warnings.forEach(warning => {
      console.log(outputFormatter.warning(warning));
    });
  }

  if (validation.issues.length === 0 && validation.warnings.length === 0) {
    console.log(outputFormatter.success('✅ All system requirements met!'));
  }

  // Network connectivity check
  console.log(outputFormatter.subheader('🌐 Network Connectivity'));
  console.log(outputFormatter.info('Testing network connectivity...'));

  try {
    const networkInfo = await debugService.checkNetworkConnectivity();
    Object.entries(networkInfo).forEach(([host, info]) => {
      if (info.reachable) {
        console.log(outputFormatter.success(`✅ ${host}: ${info.latency}ms`));
      } else {
        console.log(
          outputFormatter.error(`❌ ${host}: ${info.error || 'Unreachable'}`)
        );
      }
    });
  } catch (error) {
    console.log(outputFormatter.warning('Could not test network connectivity'));
  }
}

/**
 * Test error handling scenarios
 */
async function testErrorHandling() {
  console.log(outputFormatter.header('🧪 Error Handling Test Suite'));

  const tests = [
    {
      name: 'Network Error',
      test: () => {
        const error = new Error('ENOTFOUND api.example.com');
        error.code = 'ENOTFOUND';
        throw error;
      },
    },
    {
      name: 'API Rate Limit',
      test: () => {
        const error = new Error('Too Many Requests');
        error.code = 'RATE_LIMIT';
        error.status = 429;
        throw error;
      },
    },
    {
      name: 'File Not Found',
      test: () => {
        const error = new Error('ENOENT: no such file or directory');
        error.code = 'ENOENT';
        throw error;
      },
    },
    {
      name: 'Invalid Configuration',
      test: () => {
        const error = new Error('Invalid API key format');
        error.type = 'ConfigurationError';
        throw error;
      },
    },
    {
      name: 'Validation Error',
      test: () => {
        const error = new Error('City name must be provided');
        error.type = 'ValidationError';
        throw error;
      },
    },
  ];

  for (const testCase of tests) {
    console.log(outputFormatter.subheader(`Testing: ${testCase.name}`));

    try {
      testCase.test();
    } catch (error) {
      // Test error handling
      const result = await errorHandler.handleError(error, {
        command: 'debug-test',
        context: { test: testCase.name },
        userFriendly: false,
      });

      console.log(
        outputFormatter.success(
          `✅ Error handled: ${result.action || 'default'}`
        )
      );
    }
  }

  console.log(outputFormatter.success('🧪 Error handling tests complete'));
}

/**
 * Interactive debug menu
 */
async function showDebugMenu() {
  console.log(outputFormatter.header('🔧 Debug & Diagnostics Menu'));

  const options = [
    '1. Enable/Disable Debug Mode',
    '2. Generate Diagnostic Report',
    '3. Validate System Requirements',
    '4. Test Error Handling',
    '5. Clear Debug Log',
    '6. Export Diagnostics',
    '7. Show Debug Status',
  ];

  options.forEach(option => {
    console.log(outputFormatter.info(`   ${option}`));
  });

  console.log(
    '\n' + outputFormatter.info('Use individual flags for direct access:')
  );
  console.log(
    outputFormatter.code(
      `
Examples:
  mdsaad debug --enable        # Enable debug mode
  mdsaad debug --report        # Generate full report
  mdsaad debug --validate      # Check system requirements
  mdsaad debug --test-errors   # Test error handling
  mdsaad debug --export ./diagnostics.json
  `,
      'bash'
    )
  );

  console.log(
    outputFormatter.rainbow(
      '🔧 Use the options above or run with specific flags!'
    )
  );
}

module.exports = debugCommand;
