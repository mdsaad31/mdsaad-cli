/**
 * Currency Conversion Integration Tests
 */

const axios = require('axios');
const convertCommand = require('../../src/commands/convert');
const cacheService = require('../../src/services/cache');

// Mock axios for integration testing
jest.mock('axios');
const mockedAxios = axios;

describe('Currency Conversion Integration', () => {
  let consoleMock;

  beforeEach(async () => {
    consoleMock = global.testUtils.mockConsole();
    await cacheService.initialize();
    await cacheService.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  describe('currency exchange API calls', () => {
    test('should fetch current exchange rates', async () => {
      const mockExchangeData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          EUR: 0.85,
          GBP: 0.73,
          JPY: 110.0,
          CAD: 1.25,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockExchangeData)
      );

      await convertCommand.execute('100', 'USD', 'EUR', {});

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('exchangerate-api.com'),
        expect.any(Object)
      );

      expect(consoleMock.logs.some(log => log.includes('85'))).toBe(true); // 100 * 0.85 = 85
      expect(consoleMock.logs.some(log => log.includes('EUR'))).toBe(true);
    });

    test('should handle pair conversion rates', async () => {
      const mockPairData = {
        result: 'success',
        base_code: 'GBP',
        target_code: 'USD',
        conversion_rate: 1.37,
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockPairData)
      );

      await convertCommand.execute('50', 'GBP', 'USD', {});

      expect(consoleMock.logs.some(log => log.includes('68.5'))).toBe(true); // 50 * 1.37 = 68.5
    });

    test('should cache exchange rates', async () => {
      const mockData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      // First conversion should hit API
      await convertCommand.execute('100', 'USD', 'EUR', {});
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second conversion should use cache
      await convertCommand.execute('200', 'USD', 'EUR', {});
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Still 1
    });

    test('should show current exchange rates table', async () => {
      const mockRatesData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          EUR: 0.85,
          GBP: 0.73,
          JPY: 110.0,
          CAD: 1.25,
          AUD: 1.35,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockRatesData)
      );

      await convertCommand.execute(undefined, undefined, undefined, {
        rates: true,
      });

      expect(consoleMock.logs.some(log => log.includes('Exchange Rates'))).toBe(
        true
      );
      expect(consoleMock.logs.some(log => log.includes('EUR'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('0.85'))).toBe(true);
    });
  });

  describe('historical exchange rates', () => {
    test('should fetch historical rates', async () => {
      const mockHistoricalData = {
        result: 'success',
        base_code: 'USD',
        target_code: 'EUR',
        conversion_rate: 0.82,
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockHistoricalData)
      );

      await convertCommand.execute('100', 'USD', 'EUR', {
        historical: '2023-01-01',
      });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('2023/01/01'),
        expect.any(Object)
      );

      expect(consoleMock.logs.some(log => log.includes('82'))).toBe(true); // Historical rate
    });

    test('should validate historical date format', async () => {
      await convertCommand.execute('100', 'USD', 'EUR', {
        historical: 'invalid-date',
      });

      expect(
        consoleMock.errors.some(
          error => error.includes('Invalid date') || error.includes('format')
        )
      ).toBe(true);
    });
  });

  describe('unit conversions (local calculations)', () => {
    test('should convert length units without API calls', async () => {
      await convertCommand.execute('10', 'meters', 'feet', {});

      expect(mockedAxios.get).not.toHaveBeenCalled(); // No API call for unit conversion
      expect(consoleMock.logs.some(log => log.includes('32.808'))).toBe(true); // 10m = ~32.808ft
    });

    test('should convert weight units', async () => {
      await convertCommand.execute('5', 'kg', 'pounds', {});

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(consoleMock.logs.some(log => log.includes('11.023'))).toBe(true); // 5kg = ~11.023lbs
    });

    test('should convert temperature units', async () => {
      await convertCommand.execute('0', 'celsius', 'fahrenheit', {});

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(consoleMock.logs.some(log => log.includes('32'))).toBe(true); // 0°C = 32°F
    });

    test('should convert volume units', async () => {
      await convertCommand.execute('1', 'liter', 'gallons', {});

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(consoleMock.logs.some(log => log.includes('0.264'))).toBe(true); // 1L ≈ 0.264 gal
    });
  });

  describe('batch conversions', () => {
    test('should process batch file conversions', async () => {
      const fs = require('fs-extra');
      const batchFilePath = `${global.testUtils.TEST_DIR}/batch_conversions.txt`;

      const batchContent = `100 USD EUR
50 meters feet
20 celsius fahrenheit`;

      await fs.writeFile(batchFilePath, batchContent);

      const mockCurrencyData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockCurrencyData)
      );

      await convertCommand.execute(undefined, undefined, undefined, {
        batch: batchFilePath,
      });

      expect(consoleMock.logs.some(log => log.includes('85'))).toBe(true); // USD to EUR
      expect(consoleMock.logs.some(log => log.includes('164.04'))).toBe(true); // meters to feet
      expect(consoleMock.logs.some(log => log.includes('68'))).toBe(true); // celsius to fahrenheit
    });

    test('should handle batch file errors', async () => {
      await convertCommand.execute(undefined, undefined, undefined, {
        batch: 'nonexistent_file.txt',
      });

      expect(
        consoleMock.errors.some(
          error => error.includes('not found') || error.includes('Error')
        )
      ).toBe(true);
    });
  });

  describe('favorites management', () => {
    test('should add conversion to favorites', async () => {
      const mockData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await convertCommand.execute('100', 'USD', 'EUR', { addFavorite: true });

      expect(
        consoleMock.logs.some(
          log => log.includes('favorite') || log.includes('saved')
        )
      ).toBe(true);
    });

    test('should show favorites list', async () => {
      await convertCommand.execute(undefined, undefined, undefined, {
        favorites: true,
      });

      expect(
        consoleMock.logs.some(
          log => log.includes('Favorite') || log.includes('No favorites')
        )
      ).toBe(true);
    });
  });

  describe('API error handling', () => {
    test('should handle network errors', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      await convertCommand.execute('100', 'USD', 'EUR', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('Error') || error.includes('failed')
        )
      ).toBe(true);
    });

    test('should handle invalid currency codes', async () => {
      const invalidCurrencyData = {
        result: 'error',
        'error-type': 'unsupported-code',
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(invalidCurrencyData)
      );

      await convertCommand.execute('100', 'INVALID', 'USD', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('Invalid') || error.includes('currency')
        )
      ).toBe(true);
    });

    test('should handle API quota exceeded', async () => {
      const quotaError = {
        result: 'error',
        'error-type': 'quota-reached',
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(quotaError)
      );

      await convertCommand.execute('100', 'USD', 'EUR', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('quota') || error.includes('limit')
        )
      ).toBe(true);
    });

    test('should handle malformed API responses', async () => {
      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse('invalid response format')
      );

      await convertCommand.execute('100', 'USD', 'EUR', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('Error') || error.includes('failed')
        )
      ).toBe(true);
    });
  });

  describe('verbose mode', () => {
    test('should show detailed conversion information in verbose mode', async () => {
      const mockData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await convertCommand.execute('100', 'USD', 'EUR', { verbose: true });

      expect(consoleMock.logs.some(log => log.includes('Exchange Rate'))).toBe(
        true
      );
      expect(consoleMock.logs.some(log => log.includes('Formula'))).toBe(true);
    });

    test('should show unit conversion formulas in verbose mode', async () => {
      await convertCommand.execute('10', 'meters', 'feet', { verbose: true });

      expect(consoleMock.logs.some(log => log.includes('Formula'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('3.28084'))).toBe(true); // meters to feet multiplier
    });
  });

  describe('input validation', () => {
    test('should validate numeric amounts', async () => {
      await convertCommand.execute('invalid', 'USD', 'EUR', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('Invalid') || error.includes('number')
        )
      ).toBe(true);
    });

    test('should handle negative amounts', async () => {
      await convertCommand.execute('-100', 'USD', 'EUR', {});

      expect(
        consoleMock.errors.some(
          error => error.includes('negative') || error.includes('positive')
        )
      ).toBe(true);
    });

    test('should handle zero amounts', async () => {
      await convertCommand.execute('0', 'USD', 'EUR', {});

      expect(consoleMock.logs.some(log => log.includes('0'))).toBe(true);
    });

    test('should handle very large amounts', async () => {
      const mockData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: { EUR: 0.85 },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await convertCommand.execute('1000000000', 'USD', 'EUR', {});

      expect(consoleMock.logs.some(log => log.includes('850000000'))).toBe(
        true
      );
    });
  });

  describe('caching optimization', () => {
    test('should optimize API calls with smart caching', async () => {
      const mockData = {
        result: 'success',
        base_code: 'USD',
        conversion_rates: {
          EUR: 0.85,
          GBP: 0.73,
          JPY: 110.0,
        },
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      // Multiple conversions from same base should use single API call
      await convertCommand.execute('100', 'USD', 'EUR', {});
      await convertCommand.execute('200', 'USD', 'GBP', {});
      await convertCommand.execute('300', 'USD', 'JPY', {});

      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Only one API call needed
    });
  });
});
