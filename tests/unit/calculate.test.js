/**
 * Calculate Command Unit Tests
 */

const calculateCommand = require('../../src/commands/calculate');

describe('Calculate Command', () => {
  let consoleMock;

  beforeEach(() => {
    consoleMock = global.testUtils.mockConsole();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  describe('basic arithmetic operations', () => {
    test('should perform addition', async () => {
      await calculateCommand.execute('2 + 3', {});
      
      expect(consoleMock.logs.some(log => log.includes('5'))).toBe(true);
    });

    test('should perform subtraction', async () => {
      await calculateCommand.execute('10 - 4', {});
      
      expect(consoleMock.logs.some(log => log.includes('6'))).toBe(true);
    });

    test('should perform multiplication', async () => {
      await calculateCommand.execute('6 * 7', {});
      
      expect(consoleMock.logs.some(log => log.includes('42'))).toBe(true);
    });

    test('should perform division', async () => {
      await calculateCommand.execute('15 / 3', {});
      
      expect(consoleMock.logs.some(log => log.includes('5'))).toBe(true);
    });

    test('should handle division by zero', async () => {
      await calculateCommand.execute('5 / 0', {});
      
      expect(consoleMock.logs.some(log => log.includes('Infinity'))).toBe(true);
    });
  });

  describe('complex expressions', () => {
    test('should handle parentheses', async () => {
      await calculateCommand.execute('(2 + 3) * 4', {});
      
      expect(consoleMock.logs.some(log => log.includes('20'))).toBe(true);
    });

    test('should follow order of operations', async () => {
      await calculateCommand.execute('2 + 3 * 4', {});
      
      expect(consoleMock.logs.some(log => log.includes('14'))).toBe(true);
    });

    test('should handle nested parentheses', async () => {
      await calculateCommand.execute('((2 + 3) * 4) / 2', {});
      
      expect(consoleMock.logs.some(log => log.includes('10'))).toBe(true);
    });

    test('should handle decimal numbers', async () => {
      await calculateCommand.execute('3.14 * 2', {});
      
      expect(consoleMock.logs.some(log => log.includes('6.28'))).toBe(true);
    });
  });

  describe('scientific functions', () => {
    test('should calculate square root', async () => {
      await calculateCommand.execute('sqrt(16)', {});
      
      expect(consoleMock.logs.some(log => log.includes('4'))).toBe(true);
    });

    test('should calculate power', async () => {
      await calculateCommand.execute('2^3', {});
      
      expect(consoleMock.logs.some(log => log.includes('8'))).toBe(true);
    });

    test('should calculate trigonometric functions', async () => {
      await calculateCommand.execute('sin(0)', {});
      
      expect(consoleMock.logs.some(log => log.includes('0'))).toBe(true);
    });

    test('should calculate logarithms', async () => {
      await calculateCommand.execute('log(10)', {});
      
      expect(consoleMock.logs.some(log => log.includes('1'))).toBe(true);
    });

    test('should use mathematical constants', async () => {
      await calculateCommand.execute('pi', {});
      
      expect(consoleMock.logs.some(log => log.includes('3.14159'))).toBe(true);
    });
  });

  describe('precision handling', () => {
    test('should respect precision option', async () => {
      await calculateCommand.execute('1 / 3', { precision: '2' });
      
      expect(consoleMock.logs.some(log => log.includes('0.33'))).toBe(true);
    });

    test('should handle high precision', async () => {
      await calculateCommand.execute('1 / 3', { precision: '6' });
      
      expect(consoleMock.logs.some(log => log.includes('0.333333'))).toBe(true);
    });

    test('should default to 4 decimal places', async () => {
      await calculateCommand.execute('1 / 3', {});
      
      expect(consoleMock.logs.some(log => log.includes('0.3333'))).toBe(true);
    });
  });

  describe('verbose mode', () => {
    test('should show step-by-step calculation in verbose mode', async () => {
      await calculateCommand.execute('(2 + 3) * 4', { verbose: true });
      
      expect(consoleMock.logs.length).toBeGreaterThan(1);
      expect(consoleMock.logs.some(log => log.includes('Expression'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('Result'))).toBe(true);
    });

    test('should show function information in verbose mode', async () => {
      await calculateCommand.execute('sqrt(16)', { verbose: true });
      
      expect(consoleMock.logs.some(log => log.includes('Function'))).toBe(true);
    });
  });

  describe('error handling', () => {
    test('should handle invalid expressions', async () => {
      await calculateCommand.execute('2 +', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
      expect(consoleMock.errors.some(error => error.includes('Error'))).toBe(true);
    });

    test('should handle unknown functions', async () => {
      await calculateCommand.execute('unknown(5)', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });

    test('should handle malformed parentheses', async () => {
      await calculateCommand.execute('(2 + 3', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });

    test('should handle empty expressions', async () => {
      await calculateCommand.execute('', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });

    test('should handle null/undefined input', async () => {
      await calculateCommand.execute(null, {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });
  });

  describe('unit conversions', () => {
    test('should handle basic unit conversion', async () => {
      await calculateCommand.execute('5 meter to feet', {});
      
      expect(consoleMock.logs.some(log => log.includes('16.404'))).toBe(true);
    });

    test('should handle temperature conversion', async () => {
      await calculateCommand.execute('0 celsius to fahrenheit', {});
      
      expect(consoleMock.logs.some(log => log.includes('32'))).toBe(true);
    });

    test('should handle weight conversion', async () => {
      await calculateCommand.execute('1 kg to pounds', {});
      
      expect(consoleMock.logs.some(log => log.includes('2.2046'))).toBe(true);
    });

    test('should handle invalid unit conversion', async () => {
      await calculateCommand.execute('5 invalid to meters', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });
  });

  describe('mathematical constants', () => {
    test('should recognize pi constant', async () => {
      await calculateCommand.execute('pi * 2', {});
      
      expect(consoleMock.logs.some(log => log.includes('6.2831'))).toBe(true);
    });

    test('should recognize e constant', async () => {
      await calculateCommand.execute('e', {});
      
      expect(consoleMock.logs.some(log => log.includes('2.7182'))).toBe(true);
    });

    test('should handle custom constants', async () => {
      await calculateCommand.execute('c', {}); // Speed of light
      
      expect(consoleMock.logs.some(log => log.includes('299792458'))).toBe(true);
    });
  });

  describe('complex numbers', () => {
    test('should handle imaginary numbers', async () => {
      await calculateCommand.execute('2 + 3i', {});
      
      expect(consoleMock.logs.some(log => log.includes('2 + 3i'))).toBe(true);
    });

    test('should perform complex arithmetic', async () => {
      await calculateCommand.execute('(1 + 2i) + (3 + 4i)', {});
      
      expect(consoleMock.logs.some(log => log.includes('4 + 6i'))).toBe(true);
    });

    test('should calculate complex magnitude', async () => {
      await calculateCommand.execute('abs(3 + 4i)', {});
      
      expect(consoleMock.logs.some(log => log.includes('5'))).toBe(true);
    });
  });

  describe('matrices and vectors', () => {
    test('should handle matrix operations', async () => {
      await calculateCommand.execute('[[1, 2], [3, 4]] + [[5, 6], [7, 8]]', {});
      
      expect(consoleMock.logs.some(log => log.includes('[[6, 8], [10, 12]]'))).toBe(true);
    });

    test('should calculate matrix determinant', async () => {
      await calculateCommand.execute('det([[1, 2], [3, 4]])', {});
      
      expect(consoleMock.logs.some(log => log.includes('-2'))).toBe(true);
    });
  });

  describe('statistical functions', () => {
    test('should calculate mean', async () => {
      await calculateCommand.execute('mean([1, 2, 3, 4, 5])', {});
      
      expect(consoleMock.logs.some(log => log.includes('3'))).toBe(true);
    });

    test('should calculate standard deviation', async () => {
      await calculateCommand.execute('std([1, 2, 3, 4, 5])', {});
      
      expect(consoleMock.logs.some(log => log.includes('1.5811'))).toBe(true);
    });

    test('should calculate median', async () => {
      await calculateCommand.execute('median([1, 2, 3, 4, 5])', {});
      
      expect(consoleMock.logs.some(log => log.includes('3'))).toBe(true);
    });
  });

  describe('input validation', () => {
    test('should validate expression length', async () => {
      const longExpression = '1 + 2 + 3 + 4 + 5'.repeat(100);
      await calculateCommand.execute(longExpression, {});
      
      // Should either process or show appropriate error
      expect(consoleMock.logs.length + consoleMock.errors.length).toBeGreaterThan(0);
    });

    test('should handle special characters', async () => {
      await calculateCommand.execute('2 + 3 € invalid', {});
      
      expect(consoleMock.errors.length).toBeGreaterThan(0);
    });

    test('should handle very large numbers', async () => {
      await calculateCommand.execute('1e100 + 1e100', {});
      
      expect(consoleMock.logs.some(log => log.includes('2e+100'))).toBe(true);
    });

    test('should handle very small numbers', async () => {
      await calculateCommand.execute('1e-100 + 1e-100', {});
      
      expect(consoleMock.logs.some(log => log.includes('2e-100'))).toBe(true);
    });
  });
});