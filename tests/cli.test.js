/**
 * CLI Application Tests
 * Tests for the main CLI framework
 */

const CLIApplication = require('../src/cli');

describe('CLI Application', () => {
  let app;

  beforeEach(() => {
    app = new CLIApplication();
  });

  afterEach(() => {
    // Clean up any side effects
  });

  test('should create CLI application instance', () => {
    expect(app).toBeInstanceOf(CLIApplication);
    expect(app.isInitialized).toBe(false);
  });

  test('should initialize successfully', async () => {
    await app.initialize();
    expect(app.isInitialized).toBe(true);
  });

  test('should have program configured', async () => {
    await app.initialize();
    expect(app.program).toBeDefined();
    expect(app.program.name()).toBe('mdsaad');
  });
});