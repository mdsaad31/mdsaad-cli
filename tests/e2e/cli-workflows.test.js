/**
 * End-to-End CLI Workflow Tests
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs-extra');

describe('CLI End-to-End Workflows', () => {
  const CLI_PATH = path.join(__dirname, '../../src/cli.js');

  // Helper function to execute CLI commands
  const executeCLI = (args, options = {}) => {
    return new Promise((resolve, reject) => {
      const child = spawn('node', [CLI_PATH, ...args], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: 'test',
          CI: 'true',
          MDSAAD_CONFIG_DIR: global.testUtils.TEST_CONFIG_DIR,
          MDSAAD_CACHE_DIR: global.testUtils.TEST_CACHE_DIR,
        },
        timeout: options.timeout || 10000,
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', code => {
        resolve({
          code,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        });
      });

      child.on('error', error => {
        reject(error);
      });

      // Handle timeout
      if (options.timeout) {
        setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timed out after ${options.timeout}ms`));
        }, options.timeout);
      }
    });
  };

  beforeEach(async () => {
    await global.testUtils.setupTestDirs();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
  });

  describe('basic CLI functionality', () => {
    test('should show version information', async () => {
      const result = await executeCLI(['--version']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/); // Version number pattern
    });

    test('should show help information', async () => {
      const result = await executeCLI(['--help']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('Options:');
    });

    test('should handle unknown commands gracefully', async () => {
      const result = await executeCLI(['unknown-command']);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('unknown');
    });

    test('should handle global options', async () => {
      const result = await executeCLI(['calculate', '2+2', '--verbose']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('4');
    });
  });

  describe('mathematical calculations workflow', () => {
    test('should perform basic arithmetic', async () => {
      const result = await executeCLI(['calculate', '15 + 25']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('40');
    });

    test('should handle complex expressions', async () => {
      const result = await executeCLI(['calculate', '(2^3 + 4) * sqrt(16)']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('48'); // (8 + 4) * 4 = 48
    });

    test('should show verbose calculation steps', async () => {
      const result = await executeCLI(['calculate', '10 * 5', '--verbose']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Expression');
      expect(result.stdout).toContain('Result');
      expect(result.stdout).toContain('50');
    });

    test('should handle precision settings', async () => {
      const result = await executeCLI(['calculate', '1/3', '--precision', '6']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('0.333333');
    });

    test('should handle calculation errors gracefully', async () => {
      const result = await executeCLI(['calculate', '2 +']);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('Error');
    });
  });

  describe('ASCII art display workflow', () => {
    test('should display ASCII art', async () => {
      const result = await executeCLI(['show', 'batman']);

      expect(result.code).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(50); // ASCII art should be substantial
    });

    test('should handle animated ASCII art', async () => {
      const result = await executeCLI([
        'show',
        'batman',
        '--animated',
        '--animation',
        'typewriter',
        '--speed',
        '10',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(50);
    });

    test('should apply color schemes', async () => {
      const result = await executeCLI([
        'show',
        'batman',
        '--color-scheme',
        'rainbow',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(50);
    });

    test('should handle art search', async () => {
      const result = await executeCLI(['show', 'search', '--query', 'super']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Found'); // Should find superhero art
    });

    test('should handle non-existent art gracefully', async () => {
      const result = await executeCLI(['show', 'nonexistent-art']);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toContain('not found');
    });
  });

  describe('weather information workflow', () => {
    test('should handle weather command with mock data', async () => {
      // Create mock weather cache to avoid API calls
      await global.testUtils.createMockCache('weather_London', {
        location: { name: 'London', country: 'UK' },
        current: {
          temp_c: 20,
          condition: { text: 'Sunny', icon: 'sunny.png' },
          humidity: 65,
        },
      });

      const result = await executeCLI(['weather', 'London']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('London');
      expect(result.stdout).toContain('20°C');
    });

    test('should show detailed weather information', async () => {
      await global.testUtils.createMockCache('weather_Paris', {
        location: { name: 'Paris' },
        current: {
          temp_c: 22,
          condition: { text: 'Cloudy' },
          humidity: 70,
          wind_kph: 15,
          pressure_mb: 1013,
        },
      });

      const result = await executeCLI(['weather', 'Paris', '--detailed']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Humidity');
      expect(result.stdout).toContain('Pressure');
    });

    test('should handle weather forecast', async () => {
      await global.testUtils.createMockCache('forecast_Tokyo_5', {
        location: { name: 'Tokyo' },
        forecast: {
          forecastday: [
            {
              date: '2024-01-01',
              day: { maxtemp_c: 25, condition: { text: 'Clear' } },
            },
            {
              date: '2024-01-02',
              day: { maxtemp_c: 27, condition: { text: 'Sunny' } },
            },
          ],
        },
      });

      const result = await executeCLI([
        'weather',
        'Tokyo',
        '--forecast',
        '--days',
        '2',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Forecast');
    });
  });

  describe('conversion workflows', () => {
    test('should perform currency conversion with mock data', async () => {
      await global.testUtils.createMockCache('exchange_rates_USD', {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      });

      const result = await executeCLI(['convert', '100', 'USD', 'EUR']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('85');
      expect(result.stdout).toContain('EUR');
    });

    test('should perform unit conversions', async () => {
      const result = await executeCLI(['convert', '10', 'meters', 'feet']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('32.808'); // 10m = ~32.808ft
    });

    test('should show conversion rates table', async () => {
      await global.testUtils.createMockCache('exchange_rates_USD', {
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          EUR: 0.85,
          GBP: 0.73,
          JPY: 110.0,
        },
      });

      const result = await executeCLI(['convert', '--rates']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Exchange Rates');
      expect(result.stdout).toContain('EUR');
    });

    test('should handle verbose conversion mode', async () => {
      const result = await executeCLI([
        'convert',
        '5',
        'kg',
        'pounds',
        '--verbose',
      ]);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Formula');
      expect(result.stdout).toContain('11.023'); // 5kg = ~11.023lbs
    });
  });

  describe('configuration management workflow', () => {
    test('should handle language switching', async () => {
      const result = await executeCLI(['language', '--set', 'es']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/language|idioma|configurado/i);
    });

    test('should list available languages', async () => {
      const result = await executeCLI(['language', '--list']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('en');
      expect(result.stdout).toContain('es');
    });

    test('should show current language', async () => {
      const result = await executeCLI(['language', '--current']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('en'); // Default language
    });
  });

  describe('enhanced features workflow', () => {
    test('should show available themes', async () => {
      const result = await executeCLI(['enhanced', 'themes', '--list']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Available');
    });

    test('should demonstrate formatting features', async () => {
      const result = await executeCLI(['enhanced', 'demo', '--formatting']);

      expect(result.code).toBe(0);
      expect(result.stdout.length).toBeGreaterThan(50);
    });

    test('should show configuration management', async () => {
      const result = await executeCLI(['enhanced', 'config', '--list']);

      expect(result.code).toBe(0);
    });
  });

  describe('debug and maintenance workflow', () => {
    test('should show debug information', async () => {
      const result = await executeCLI(['debug', 'info']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('System Information');
    });

    test('should clear cache', async () => {
      // Create some cache first
      await global.testUtils.createMockCache('test_cache', { data: 'test' });

      const result = await executeCLI(['maintenance', 'cache', '--clear']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/cleared|clean/i);
    });

    test('should show system health', async () => {
      const result = await executeCLI(['maintenance', 'health']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Health');
    });
  });

  describe('performance monitoring workflow', () => {
    test('should show performance status', async () => {
      const result = await executeCLI(['performance', 'status']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/performance|status/i);
    });

    test('should show memory information', async () => {
      const result = await executeCLI(['performance', 'memory']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/memory|heap/i);
    });

    test('should apply optimizations', async () => {
      const result = await executeCLI(['performance', 'optimize']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/optimization|completed/i);
    });
  });

  describe('cross-platform compatibility workflow', () => {
    test('should show platform information', async () => {
      const result = await executeCLI(['platform', '--info']);

      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Platform');
      expect(result.stdout).toMatch(/Windows|Linux|macOS|Darwin/);
    });

    test('should check installation status', async () => {
      const result = await executeCLI(['platform', '--install']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/installation|npm|node/i);
    });

    test('should run troubleshooting', async () => {
      const result = await executeCLI(['platform', '--troubleshoot']);

      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/diagnostic|check/i);
    });
  });

  describe('error handling and recovery', () => {
    test('should handle invalid command gracefully', async () => {
      const result = await executeCLI(['invalid-command']);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toMatch(/unknown|not found/i);
    });

    test('should handle invalid options gracefully', async () => {
      const result = await executeCLI(['calculate', '2+2', '--invalid-option']);

      expect(result.code).not.toBe(0);
      expect(result.stderr).toMatch(/unknown|option/i);
    });

    test('should handle interrupted operations', async () => {
      const result = await executeCLI(['show', 'batman'], { timeout: 100 }); // Very short timeout

      // Should either complete quickly or be interrupted gracefully
      expect(typeof result.code).toBe('number');
    });
  });

  describe('complete user workflows', () => {
    test('should handle complete calculation workflow', async () => {
      // Perform multiple calculations
      const calc1 = await executeCLI(['calculate', '10 + 5']);
      const calc2 = await executeCLI(['calculate', 'sqrt(16)']);
      const calc3 = await executeCLI([
        'calculate',
        'pi * 2',
        '--precision',
        '4',
      ]);

      expect(calc1.code).toBe(0);
      expect(calc1.stdout).toContain('15');

      expect(calc2.code).toBe(0);
      expect(calc2.stdout).toContain('4');

      expect(calc3.code).toBe(0);
      expect(calc3.stdout).toContain('6.2832');
    });

    test('should handle complete conversion workflow', async () => {
      // Mock exchange rate data
      await global.testUtils.createMockCache('exchange_rates_USD', {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85, GBP: 0.73 },
      });

      // Perform multiple conversions
      const conv1 = await executeCLI(['convert', '100', 'USD', 'EUR']);
      const conv2 = await executeCLI(['convert', '10', 'meters', 'feet']);
      const conv3 = await executeCLI([
        'convert',
        '20',
        'celsius',
        'fahrenheit',
      ]);

      expect(conv1.code).toBe(0);
      expect(conv1.stdout).toContain('85');

      expect(conv2.code).toBe(0);
      expect(conv2.stdout).toContain('32.808');

      expect(conv3.code).toBe(0);
      expect(conv3.stdout).toContain('68');
    });

    test('should handle configuration and customization workflow', async () => {
      // Change language
      const langResult = await executeCLI(['language', '--set', 'es']);
      expect(langResult.code).toBe(0);

      // Check configuration
      const configResult = await executeCLI(['enhanced', 'config', '--list']);
      expect(configResult.code).toBe(0);

      // Reset to English
      const resetResult = await executeCLI(['language', '--set', 'en']);
      expect(resetResult.code).toBe(0);
    });
  });

  describe('concurrent operations', () => {
    test('should handle multiple simultaneous commands', async () => {
      const promises = [
        executeCLI(['calculate', '2+2']),
        executeCLI(['convert', '5', 'meters', 'feet']),
        executeCLI(['show', 'batman', '--color-scheme', 'monochrome']),
      ];

      const results = await Promise.all(promises);

      // All should complete successfully
      results.forEach(result => {
        expect(result.code).toBe(0);
      });
    });
  });
});
