/**
 * Weather API Integration Tests
 */

const axios = require('axios');
const weatherCommand = require('../../src/commands/weather');
const cacheService = require('../../src/services/cache');

// Mock axios for integration testing
jest.mock('axios');
const mockedAxios = axios;

describe('Weather API Integration', () => {
  let consoleMock;

  beforeEach(async () => {
    consoleMock = global.testUtils.mockConsole();
    await cacheService.initialize();
    
    // Clear any cached data
    await cacheService.clear();
    
    // Reset axios mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleMock.restore();
  });

  describe('successful API calls', () => {
    test('should fetch current weather data', async () => {
      const mockWeatherData = {
        location: {
          name: 'London',
          country: 'United Kingdom'
        },
        current: {
          temp_c: 20,
          condition: {
            text: 'Sunny',
            icon: '//cdn.weatherapi.com/weather/64x64/day/113.png'
          },
          humidity: 65,
          wind_kph: 10,
          wind_dir: 'SW'
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockWeatherData)
      );

      await weatherCommand.execute('London', {});

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('current.json'),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'London'
          })
        })
      );

      expect(consoleMock.logs.some(log => log.includes('London'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('20°C'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('Sunny'))).toBe(true);
    });

    test('should fetch weather forecast', async () => {
      const mockForecastData = {
        location: {
          name: 'New York',
          country: 'USA'
        },
        current: {
          temp_c: 25,
          condition: { text: 'Cloudy' }
        },
        forecast: {
          forecastday: [
            {
              date: '2024-01-01',
              day: {
                maxtemp_c: 28,
                mintemp_c: 20,
                condition: { text: 'Partly cloudy' }
              }
            },
            {
              date: '2024-01-02',
              day: {
                maxtemp_c: 30,
                mintemp_c: 22,
                condition: { text: 'Sunny' }
              }
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockForecastData)
      );

      await weatherCommand.execute('New York', { forecast: true, days: '2' });

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('forecast.json'),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'New York',
            days: '2'
          })
        })
      );

      expect(consoleMock.logs.some(log => log.includes('New York'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('2024-01-01'))).toBe(true);
    });

    test('should cache weather data', async () => {
      const mockWeatherData = {
        location: { name: 'Paris' },
        current: { temp_c: 18, condition: { text: 'Rainy' } }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockWeatherData)
      );

      // First call should hit API
      await weatherCommand.execute('Paris', {});
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await weatherCommand.execute('Paris', {});
      expect(mockedAxios.get).toHaveBeenCalledTimes(1); // Still 1, not called again

      expect(consoleMock.logs.some(log => log.includes('Paris'))).toBe(true);
    });
  });

  describe('API error handling', () => {
    test('should handle network errors gracefully', async () => {
      mockedAxios.get.mockRejectedValueOnce(new Error('Network Error'));

      await weatherCommand.execute('InvalidLocation', {});

      expect(consoleMock.errors.some(error => 
        error.includes('Error') || error.includes('failed')
      )).toBe(true);
    });

    test('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      rateLimitError.response = { status: 429 };
      
      mockedAxios.get.mockRejectedValueOnce(rateLimitError);

      await weatherCommand.execute('London', {});

      expect(consoleMock.errors.some(error => 
        error.includes('rate limit') || error.includes('Error')
      )).toBe(true);
    });

    test('should handle invalid location', async () => {
      const invalidLocationError = new Error('Location not found');
      invalidLocationError.response = { status: 400 };
      
      mockedAxios.get.mockRejectedValueOnce(invalidLocationError);

      await weatherCommand.execute('InvalidCity123', {});

      expect(consoleMock.errors.some(error => 
        error.includes('not found') || error.includes('Error')
      )).toBe(true);
    });

    test('should handle API key errors', async () => {
      const apiKeyError = new Error('Invalid API key');
      apiKeyError.response = { status: 401 };
      
      mockedAxios.get.mockRejectedValueOnce(apiKeyError);

      await weatherCommand.execute('London', {});

      expect(consoleMock.errors.some(error => 
        error.includes('API key') || error.includes('Error')
      )).toBe(true);
    });
  });

  describe('caching behavior', () => {
    test('should respect cache TTL', async () => {
      const mockData = {
        location: { name: 'Berlin' },
        current: { temp_c: 15 }
      };

      mockedAxios.get.mockResolvedValue(
        global.testUtils.mockApiResponse(mockData)
      );

      // Mock cache to be expired
      await global.testUtils.createMockCache('weather_Berlin', mockData, 1); // 1ms TTL
      await global.testUtils.wait(10); // Wait for expiration

      await weatherCommand.execute('Berlin', {});

      // Should make new API call since cache expired
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    test('should use valid cached data', async () => {
      const cachedData = {
        location: { name: 'Tokyo' },
        current: { temp_c: 22, condition: { text: 'Clear' } }
      };

      // Create valid cache entry
      await global.testUtils.createMockCache('weather_Tokyo', cachedData, 3600000); // 1 hour TTL

      await weatherCommand.execute('Tokyo', {});

      // Should not make API call
      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(consoleMock.logs.some(log => log.includes('Tokyo'))).toBe(true);
    });

    test('should handle cache corruption', async () => {
      const mockData = {
        location: { name: 'Sydney' },
        current: { temp_c: 25 }
      };

      // Create corrupted cache file
      const cachePath = global.testUtils.TEST_CACHE_DIR;
      const fs = require('fs-extra');
      await fs.writeFile(`${cachePath}/weather_Sydney.json`, 'invalid json');

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await weatherCommand.execute('Sydney', {});

      // Should make API call since cache is corrupted
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });

  describe('different weather units', () => {
    test('should handle metric units', async () => {
      const mockData = {
        location: { name: 'Madrid' },
        current: { 
          temp_c: 30,
          wind_kph: 15,
          condition: { text: 'Hot' }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await weatherCommand.execute('Madrid', { units: 'metric' });

      expect(consoleMock.logs.some(log => log.includes('30°C'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('15 km/h'))).toBe(true);
    });

    test('should handle imperial units', async () => {
      const mockData = {
        location: { name: 'Chicago' },
        current: { 
          temp_f: 86,
          wind_mph: 10,
          condition: { text: 'Warm' }
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(mockData)
      );

      await weatherCommand.execute('Chicago', { units: 'imperial' });

      expect(consoleMock.logs.some(log => log.includes('86°F'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('10 mph'))).toBe(true);
    });
  });

  describe('detailed weather information', () => {
    test('should show detailed weather when requested', async () => {
      const detailedMockData = {
        location: {
          name: 'Mumbai',
          country: 'India',
          lat: 19.07,
          lon: 72.88
        },
        current: {
          temp_c: 32,
          condition: { text: 'Humid' },
          humidity: 85,
          wind_kph: 12,
          wind_dir: 'SW',
          pressure_mb: 1013,
          uv: 8,
          vis_km: 10
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(detailedMockData)
      );

      await weatherCommand.execute('Mumbai', { detailed: true });

      expect(consoleMock.logs.some(log => log.includes('Mumbai'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('Humidity'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('Pressure'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('UV Index'))).toBe(true);
    });

    test('should show weather alerts when available', async () => {
      const alertMockData = {
        location: { name: 'Miami' },
        current: { temp_c: 28 },
        alerts: {
          alert: [
            {
              headline: 'Hurricane Warning',
              desc: 'Hurricane conditions expected',
              severity: 'Severe'
            }
          ]
        }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(alertMockData)
      );

      await weatherCommand.execute('Miami', { alerts: true });

      expect(consoleMock.logs.some(log => log.includes('Hurricane Warning'))).toBe(true);
    });
  });

  describe('auto-location detection', () => {
    test('should handle auto-location', async () => {
      const autoLocationData = {
        location: { name: 'Current Location' },
        current: { temp_c: 20 }
      };

      mockedAxios.get.mockResolvedValueOnce(
        global.testUtils.mockApiResponse(autoLocationData)
      );

      await weatherCommand.execute('auto', {});

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('current.json'),
        expect.objectContaining({
          params: expect.objectContaining({
            q: 'auto:ip'
          })
        })
      );
    });
  });

  describe('concurrent requests', () => {
    test('should handle multiple simultaneous requests', async () => {
      const mockData1 = { location: { name: 'City1' }, current: { temp_c: 20 } };
      const mockData2 = { location: { name: 'City2' }, current: { temp_c: 25 } };

      mockedAxios.get
        .mockResolvedValueOnce(global.testUtils.mockApiResponse(mockData1))
        .mockResolvedValueOnce(global.testUtils.mockApiResponse(mockData2));

      const promise1 = weatherCommand.execute('City1', {});
      const promise2 = weatherCommand.execute('City2', {});

      await Promise.all([promise1, promise2]);

      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(consoleMock.logs.some(log => log.includes('City1'))).toBe(true);
      expect(consoleMock.logs.some(log => log.includes('City2'))).toBe(true);
    });
  });
});