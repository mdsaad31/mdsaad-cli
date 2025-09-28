/**
 * Cross-Platform Testing Automation
 */

const os = require('os');
const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs-extra');

// Platform detection utilities
const PlatformUtils = {
  isWindows: () => os.platform() === 'win32',
  isMacOS: () => os.platform() === 'darwin',
  isLinux: () => os.platform() === 'linux',
  
  getShell: () => {
    if (PlatformUtils.isWindows()) {
      return process.env.SHELL || 'cmd.exe';
    }
    return process.env.SHELL || '/bin/bash';
  },
  
  getPathSeparator: () => path.sep,
  
  getHomeDir: () => os.homedir(),
  
  getTempDir: () => os.tmpdir(),
  
  getNodeExecutable: () => {
    return PlatformUtils.isWindows() ? 'node.exe' : 'node';
  },
  
  getNpmExecutable: () => {
    return PlatformUtils.isWindows() ? 'npm.cmd' : 'npm';
  }
};

describe('Cross-Platform Compatibility Tests', () => {
  const CLI_PATH = path.join(__dirname, '../../src/cli.js');
  
  beforeEach(async () => {
    await global.testUtils.setupTestDirs();
  });

  afterEach(async () => {
    await global.testUtils.cleanupTestDirs();
  });

  describe('platform detection', () => {
    test('should correctly identify current platform', () => {
      const platformInfo = {
        platform: os.platform(),
        arch: os.arch(),
        release: os.release(),
        version: os.version ? os.version() : 'N/A',
        homedir: os.homedir(),
        tmpdir: os.tmpdir()
      };

      // Basic platform checks
      expect(['win32', 'darwin', 'linux', 'freebsd', 'openbsd', 'sunos', 'aix']).toContain(platformInfo.platform);
      expect(['arm', 'arm64', 'ia32', 'loong64', 'mips', 'mipsel', 'ppc', 'ppc64', 'riscv64', 's390', 's390x', 'x64']).toContain(platformInfo.arch);
      expect(platformInfo.homedir).toBeTruthy();
      expect(platformInfo.tmpdir).toBeTruthy();

      console.log('Platform Info:', platformInfo);
    });

    test('should handle platform-specific paths correctly', () => {
      const testPath = path.join('home', 'user', 'documents', 'file.txt');
      
      if (PlatformUtils.isWindows()) {
        expect(testPath).toContain('\\');
      } else {
        expect(testPath).toContain('/');
      }

      // Path operations should work consistently
      expect(path.dirname(testPath)).toBe(path.join('home', 'user', 'documents'));
      expect(path.basename(testPath)).toBe('file.txt');
      expect(path.extname(testPath)).toBe('.txt');
    });

    test('should resolve executable paths correctly', () => {
      const nodeExe = PlatformUtils.getNodeExecutable();
      const npmExe = PlatformUtils.getNpmExecutable();

      expect(nodeExe).toBeTruthy();
      expect(npmExe).toBeTruthy();

      if (PlatformUtils.isWindows()) {
        expect(nodeExe).toContain('.exe');
        expect(npmExe).toContain('.cmd');
      } else {
        expect(nodeExe).toBe('node');
        expect(npmExe).toBe('npm');
      }
    });
  });

  describe('file system operations', () => {
    test('should handle file operations across platforms', async () => {
      const testDir = path.join(global.testUtils.TEST_CONFIG_DIR, 'cross-platform-test');
      const testFile = path.join(testDir, 'test-file.json');
      
      // Create directory
      await fs.ensureDir(testDir);
      expect(await fs.pathExists(testDir)).toBe(true);

      // Write file with platform-specific content
      const testData = {
        platform: os.platform(),
        separator: path.sep,
        timestamp: new Date().toISOString(),
        path: testFile
      };

      await fs.writeJSON(testFile, testData);
      expect(await fs.pathExists(testFile)).toBe(true);

      // Read and verify
      const readData = await fs.readJSON(testFile);
      expect(readData.platform).toBe(os.platform());
      expect(readData.separator).toBe(path.sep);

      // Cleanup
      await fs.remove(testDir);
      expect(await fs.pathExists(testDir)).toBe(false);
    });

    test('should handle path normalization', () => {
      const testPaths = [
        'home/user/documents',
        'home\\user\\documents',
        './relative/path',
        '../parent/path',
        '/absolute/path'
      ];

      testPaths.forEach(testPath => {
        const normalized = path.normalize(testPath);
        expect(normalized).toBeTruthy();
        
        // Should use platform-appropriate separators
        if (PlatformUtils.isWindows()) {
          expect(normalized.includes('/') && normalized.includes('\\')).toBeFalsy();
        }
      });
    });

    test('should handle permissions appropriately', async () => {
      const testFile = path.join(global.testUtils.TEST_CONFIG_DIR, 'permission-test.txt');
      
      await fs.writeFile(testFile, 'test content');
      
      // Get file stats
      const stats = await fs.stat(testFile);
      expect(stats.isFile()).toBe(true);

      // On Unix-like systems, check basic permissions
      if (!PlatformUtils.isWindows()) {
        const mode = stats.mode;
        expect(mode).toBeTruthy();
        
        // File should be readable by owner
        expect((mode & parseInt('400', 8)) !== 0).toBe(true);
      }

      await fs.remove(testFile);
    });
  });

  describe('command execution', () => {
    const executeCommand = (command, args = [], options = {}) => {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'test',
            MDSAAD_CONFIG_DIR: global.testUtils.TEST_CONFIG_DIR
          },
          shell: PlatformUtils.isWindows(),
          ...options
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        });

        child.on('error', (error) => {
          reject(error);
        });

        // Timeout protection
        setTimeout(() => {
          child.kill();
          reject(new Error('Command timeout'));
        }, 10000);
      });
    };

    test('should execute node commands correctly', async () => {
      const result = await executeCommand(PlatformUtils.getNodeExecutable(), ['--version']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/^v\d+\.\d+\.\d+/);
    });

    test('should handle CLI execution across platforms', async () => {
      const result = await executeCommand(PlatformUtils.getNodeExecutable(), [CLI_PATH, '--version']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    test('should handle different shells appropriately', async () => {
      const shell = PlatformUtils.getShell();
      expect(shell).toBeTruthy();

      // Test shell-specific command
      let command, args;
      
      if (PlatformUtils.isWindows()) {
        command = 'cmd';
        args = ['/c', 'echo', 'test'];
      } else {
        command = 'sh';
        args = ['-c', 'echo test'];
      }

      const result = await executeCommand(command, args);
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('test');
    });
  });

  describe('environment variables', () => {
    test('should handle platform-specific environment variables', () => {
      // Common environment variables that should exist
      if (PlatformUtils.isWindows()) {
        expect(process.env.USERPROFILE || process.env.HOME).toBeTruthy();
        expect(process.env.TEMP || process.env.TMP).toBeTruthy();
      } else {
        expect(process.env.HOME).toBeTruthy();
        expect(process.env.PATH).toBeTruthy();
      }

      // Our custom environment variables
      expect(process.env.MDSAAD_CONFIG_DIR).toBeTruthy();
    });

    test('should handle path environment variable correctly', () => {
      const pathVar = process.env.PATH;
      expect(pathVar).toBeTruthy();

      const pathSeparator = PlatformUtils.isWindows() ? ';' : ':';
      const paths = pathVar.split(pathSeparator);
      
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach(p => expect(p).toBeTruthy());
    });
  });

  describe('Unicode and encoding', () => {
    test('should handle Unicode characters correctly', async () => {
      const unicodeContent = {
        english: 'Hello World',
        spanish: '¡Hola Mundo!',
        chinese: '你好世界',
        japanese: 'こんにちは世界',
        arabic: 'مرحبا بالعالم',
        emoji: '🌍🚀✨',
        special: '©®™€£¥'
      };

      const testFile = path.join(global.testUtils.TEST_CONFIG_DIR, 'unicode-test.json');
      
      await fs.writeJSON(testFile, unicodeContent, { encoding: 'utf8' });
      const readContent = await fs.readJSON(testFile);

      Object.keys(unicodeContent).forEach(key => {
        expect(readContent[key]).toBe(unicodeContent[key]);
      });

      await fs.remove(testFile);
    });

    test('should handle different line endings', async () => {
      const testContent = 'Line 1\nLine 2\nLine 3';
      const testFile = path.join(global.testUtils.TEST_CONFIG_DIR, 'line-endings.txt');

      await fs.writeFile(testFile, testContent);
      const readContent = await fs.readFile(testFile, 'utf8');

      // Content should be preserved correctly
      const lines = readContent.split(/\r?\n/);
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Line 1');
      expect(lines[1]).toBe('Line 2');
      expect(lines[2]).toBe('Line 3');

      await fs.remove(testFile);
    });
  });

  describe('performance characteristics', () => {
    test('should maintain performance across platforms', async () => {
      const iterations = 100;
      const startTime = Date.now();

      // Perform platform-agnostic operations
      for (let i = 0; i < iterations; i++) {
        const tempFile = path.join(global.testUtils.TEST_CONFIG_DIR, `perf-test-${i}.json`);
        
        await fs.writeJSON(tempFile, { 
          iteration: i, 
          platform: os.platform(),
          timestamp: Date.now() 
        });
        
        const data = await fs.readJSON(tempFile);
        expect(data.iteration).toBe(i);
        
        await fs.remove(tempFile);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / iterations;

      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds
      expect(avgTime).toBeLessThan(50); // Average under 50ms per operation

      console.log(`Platform performance: ${iterations} file ops in ${totalTime}ms (avg: ${avgTime.toFixed(2)}ms) on ${os.platform()}`);
    });
  });

  describe('CLI integration', () => {
    const executeCLI = (args) => {
      return new Promise((resolve, reject) => {
        const child = spawn(PlatformUtils.getNodeExecutable(), [CLI_PATH, ...args], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_ENV: 'test',
            MDSAAD_CONFIG_DIR: global.testUtils.TEST_CONFIG_DIR,
            MDSAAD_CACHE_DIR: global.testUtils.TEST_CACHE_DIR
          },
          shell: PlatformUtils.isWindows()
        });

        let stdout = '';
        let stderr = '';

        child.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        child.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        child.on('close', (code) => {
          resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        });

        child.on('error', reject);

        setTimeout(() => {
          child.kill();
          reject(new Error('CLI command timeout'));
        }, 8000);
      });
    };

    test('should work consistently across platforms', async () => {
      const testCases = [
        ['--version'],
        ['calculate', '2+2'],
        ['platform', '--info']
      ];

      for (const args of testCases) {
        const result = await executeCLI(args);
        expect(result.code).toBe(0);
        expect(result.stdout).toBeTruthy();
      }
    });

    test('should handle platform-specific features', async () => {
      const result = await executeCLI(['platform', '--info']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toContain('Platform');
      
      if (PlatformUtils.isWindows()) {
        expect(result.stdout.toLowerCase()).toContain('windows');
      } else if (PlatformUtils.isMacOS()) {
        expect(result.stdout.toLowerCase()).toContain('darwin');
      } else if (PlatformUtils.isLinux()) {
        expect(result.stdout.toLowerCase()).toContain('linux');
      }
    });

    test('should handle installation checks', async () => {
      const result = await executeCLI(['platform', '--install']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/node|npm|installation/i);
    });

    test('should run troubleshooting correctly', async () => {
      const result = await executeCLI(['platform', '--troubleshoot']);
      
      expect(result.code).toBe(0);
      expect(result.stdout).toMatch(/diagnostic|check|troubleshoot/i);
    });
  });

  describe('internationalization support', () => {
    test('should handle different locale settings', async () => {
      const originalLocale = process.env.LANG;
      
      // Test different locales if available
      const locales = ['en_US.UTF-8', 'es_ES.UTF-8', 'C'];
      
      for (const locale of locales) {
        process.env.LANG = locale;
        
        // Test date formatting
        const date = new Date('2024-01-01T12:00:00Z');
        const dateString = date.toISOString();
        expect(dateString).toContain('2024-01-01');
        
        // Test number formatting
        const number = 1234.56;
        const numberString = number.toString();
        expect(numberString).toBe('1234.56');
      }
      
      // Restore original locale
      if (originalLocale) {
        process.env.LANG = originalLocale;
      } else {
        delete process.env.LANG;
      }
    });

    test('should handle different character encodings', () => {
      const testStrings = [
        'ASCII text',
        'UTF-8: café résumé',
        'Symbols: ©®™',
        'Emoji: 🚀🌟',
        'Math: ∑∆√π'
      ];

      testStrings.forEach(str => {
        const buffer = Buffer.from(str, 'utf8');
        const decoded = buffer.toString('utf8');
        expect(decoded).toBe(str);
      });
    });
  });

  describe('resource limits', () => {
    test('should respect system resource limits', async () => {
      // Test memory usage
      const initialMemory = process.memoryUsage();
      
      // Perform operations that use memory
      const largeArray = new Array(10000).fill(0).map((_, i) => ({ id: i, data: 'test'.repeat(100) }));
      
      const currentMemory = process.memoryUsage();
      const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
      
      expect(memoryIncrease).toBeGreaterThan(0); // Should use some memory
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Should not use excessive memory (100MB limit)
      
      // Cleanup
      largeArray.length = 0;
    });

    test('should handle file descriptor limits gracefully', async () => {
      const files = [];
      const maxFiles = 50; // Conservative limit for testing
      
      try {
        // Create multiple file handles
        for (let i = 0; i < maxFiles; i++) {
          const testFile = path.join(global.testUtils.TEST_CONFIG_DIR, `fd-test-${i}.txt`);
          await fs.writeFile(testFile, `File ${i}`);
          files.push(testFile);
        }

        // Verify all files exist
        for (const file of files) {
          expect(await fs.pathExists(file)).toBe(true);
        }
        
      } finally {
        // Cleanup all files
        for (const file of files) {
          try {
            await fs.remove(file);
          } catch (error) {
            // Ignore cleanup errors
          }
        }
      }
    });
  });

  describe('signal handling', () => {
    test('should handle process signals appropriately', (done) => {
      if (PlatformUtils.isWindows()) {
        // Windows has limited signal support
        done();
        return;
      }

      let signalReceived = false;
      
      const handler = () => {
        signalReceived = true;
      };

      process.once('SIGUSR1', handler);
      
      // Send signal to self
      process.kill(process.pid, 'SIGUSR1');
      
      setTimeout(() => {
        expect(signalReceived).toBe(true);
        done();
      }, 100);
    });
  });
});

// Platform-specific test utilities
const PlatformTestUtils = {
  // Get platform-specific temp directory
  getTempDir: () => {
    if (PlatformUtils.isWindows()) {
      return process.env.TEMP || process.env.TMP || path.join(os.homedir(), 'AppData', 'Local', 'Temp');
    }
    return process.env.TMPDIR || '/tmp';
  },

  // Get platform-specific config directory
  getConfigDir: () => {
    if (PlatformUtils.isWindows()) {
      return path.join(os.homedir(), 'AppData', 'Roaming');
    } else if (PlatformUtils.isMacOS()) {
      return path.join(os.homedir(), 'Library', 'Application Support');
    } else {
      return path.join(os.homedir(), '.config');
    }
  },

  // Execute platform-specific commands
  getSystemInfo: async () => {
    let command, args;
    
    if (PlatformUtils.isWindows()) {
      command = 'wmic';
      args = ['os', 'get', 'Caption,Version', '/format:csv'];
    } else if (PlatformUtils.isMacOS()) {
      command = 'sw_vers';
      args = [];
    } else {
      command = 'uname';
      args = ['-a'];
    }

    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      child.on('error', reject);
    });
  }
};

// Export platform utilities for use in other tests
module.exports = { PlatformUtils, PlatformTestUtils };