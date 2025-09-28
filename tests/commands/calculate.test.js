/**
 * Tests for Calculate Command - Core Functionality
 */

// Mock console to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});

// Mock the services
jest.mock('../../src/services/i18n', () => ({
  getTranslation: jest.fn(key => key),
}));

jest.mock('../../src/services/config', () => ({
  get: jest.fn(() => true),
  set: jest.fn(),
}));

describe('Calculate Command - Core Functions', () => {
  // Import after mocks are set
  const CalculateCommandModule = require('../../src/commands/calculate');

  beforeEach(() => {
    mockConsoleLog.mockClear();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
  });

  describe('Expression Preprocessing', () => {
    test('should replace common symbols correctly', () => {
      expect(CalculateCommandModule.preprocessExpression('2 × 3 ÷ 2')).toBe(
        '2 * 3 / 2'
      );
      expect(CalculateCommandModule.preprocessExpression('2 * π')).toBe(
        '2 * pi'
      );
      expect(CalculateCommandModule.preprocessExpression('25%')).toBe(
        '(25/100)'
      );
      expect(CalculateCommandModule.preprocessExpression('5!')).toBe(
        'factorial(5)'
      );
      expect(CalculateCommandModule.preprocessExpression('2(3+4)')).toBe(
        '2*(3+4)'
      );
    });
  });

  describe('Number Formatting', () => {
    test('should format numbers correctly', () => {
      expect(CalculateCommandModule.formatNumber(3.14159)).toBe('3.14159');
      expect(CalculateCommandModule.formatNumber(42)).toBe('42');
      expect(CalculateCommandModule.formatNumber(1234567890)).toContain(
        '1.234568e+9'
      );
      expect(CalculateCommandModule.formatNumber(0.000001)).toContain(
        '1.000000e-6'
      );
    });
  });

  describe('Fraction Conversion', () => {
    test('should convert decimals to fractions', () => {
      expect(CalculateCommandModule.toFraction(0.5)).toBe('1/2');
      expect(CalculateCommandModule.toFraction(0.25)).toBe('1/4');
      expect(CalculateCommandModule.toFraction(0.333333)).toMatch(/\d+\/\d+/);
    });
  });

  describe('Integration Test', () => {
    test('should be available as a module', () => {
      expect(CalculateCommandModule).toBeDefined();
      expect(typeof CalculateCommandModule.execute).toBe('function');
    });
  });
});
