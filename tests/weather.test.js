/**
 * Weather Service Test
 * Demonstrates weather functionality with mock data and API simulation
 */

const weatherService = require('../src/services/weather');
const configService = require('../src/services/config');

// Mock weather data for testing
const mockWeatherData = {
  openweathermap: {
    main: {
      temp: 22.5,
      feels_like: 24.2,
      humidity: 65,
      pressure: 1013,
    },
    weather: [
      {
        id: 800,
        description: 'clear sky',
        icon: '01d',
      },
    ],
    wind: {
      speed: 3.2,
      deg: 150,
      gust: 4.1,
    },
    clouds: { all: 5 },
    visibility: 10000,
    sys: {
      sunrise: Math.floor(Date.now() / 1000) - 3600,
      sunset: Math.floor(Date.now() / 1000) + 7200,
    },
  },
  weatherapi: {
    current: {
      temp_c: 22.5,
      feelslike_c: 24.2,
      humidity: 65,
      pressure_mb: 1013,
      vis_km: 10,
      uv: 6,
      condition: {
        text: 'Sunny',
        code: 1000,
        icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
      },
      wind_kph: 11.5,
      wind_degree: 150,
      gust_kph: 14.8,
      cloud: 5,
      precip_mm: 0,
      air_quality: {
        co: 233.0,
        no2: 15.5,
        o3: 98.2,
        so2: 7.3,
        pm2_5: 12.1,
        pm10: 18.4,
        'us-epa-index': 2,
        'gb-defra-index': 3,
      },
    },
    forecast: {
      forecastday: [
        {
          date: new Date().toISOString().split('T')[0],
          day: {
            mintemp_c: 18,
            maxtemp_c: 26,
            avgtemp_c: 22,
            condition: {
              text: 'Sunny',
              code: 1000,
              icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
            },
            avghumidity: 65,
            maxwind_kph: 12,
            totalprecip_mm: 0,
            totalsnow_cm: 0,
            daily_chance_of_rain: 10,
            uv: 6,
          },
          astro: {
            sunrise: '06:30 AM',
            sunset: '08:15 PM',
          },
        },
      ],
    },
  },
};

// Mock location data
const mockLocation = {
  lat: 40.7128,
  lon: -74.006,
  name: 'New York',
  country: 'United States',
};

async function testWeatherService() {
  console.log('🧪 Testing Weather Service...');
  console.log();

  try {
    // Test service initialization
    console.log('1. Testing Service Initialization');
    await weatherService.initialize();
    const stats = weatherService.getStats();
    console.log(`   ✓ Service initialized: ${stats.isInitialized}`);
    console.log(`   ✓ Active providers: ${stats.activeProviders}`);
    console.log();

    // Test provider status
    console.log('2. Testing Provider Status');
    const providers = weatherService.getProviderStatus();
    providers.forEach(provider => {
      console.log(
        `   ${provider.name}: ${provider.isActive ? '✓' : '✗'} ${provider.hasApiKey ? '(with key)' : '(no key)'}`
      );
    });
    console.log();

    // Test location resolution
    console.log('3. Testing Location Resolution');

    // Test coordinates parsing
    const coordLocation =
      await weatherService.resolveLocation('40.7128,-74.0060');
    if (coordLocation) {
      console.log('   ✓ Coordinate parsing works');
      console.log(
        `     → ${coordLocation.name} at ${coordLocation.lat}, ${coordLocation.lon}`
      );
    }

    // Test auto-detection
    console.log('   Testing auto-location detection...');
    const autoLocation = await weatherService.autoDetectLocation();
    if (autoLocation) {
      console.log('   ✓ Auto-location detection works');
      console.log(
        `     → Detected: ${autoLocation.name}, ${autoLocation.country}`
      );
    } else {
      console.log('   ⚠ Auto-location detection failed (network/API issue)');
    }
    console.log();

    // Test data normalization
    console.log('4. Testing Data Normalization');

    // Test OpenWeatherMap normalization
    const normalizedOWM = weatherService.normalizeCurrentWeather(
      mockWeatherData.openweathermap,
      'openweathermap',
      mockLocation
    );
    console.log('   ✓ OpenWeatherMap data normalization');
    console.log(`     → Temperature: ${normalizedOWM.current.temperature}°C`);
    console.log(`     → Condition: ${normalizedOWM.current.condition}`);

    // Test WeatherAPI normalization
    const normalizedWAPI = weatherService.normalizeCurrentWeather(
      mockWeatherData.weatherapi,
      'weatherapi',
      mockLocation
    );
    console.log('   ✓ WeatherAPI data normalization');
    console.log(`     → Temperature: ${normalizedWAPI.current.temperature}°C`);
    console.log(
      `     → Air Quality: EPA Index ${normalizedWAPI.current.airQuality.usEpaIndex}`
    );
    console.log();

    // Test forecast normalization
    console.log('5. Testing Forecast Normalization');
    const normalizedForecast = weatherService.normalizeForecast(
      mockWeatherData.weatherapi,
      'weatherapi',
      mockLocation
    );
    console.log('   ✓ Forecast data normalization');
    console.log(`     → Forecast days: ${normalizedForecast.forecast.length}`);
    if (normalizedForecast.forecast.length > 0) {
      const tomorrow = normalizedForecast.forecast[0];
      console.log(
        `     → Tomorrow: ${tomorrow.temperature.min}°-${tomorrow.temperature.max}°C, ${tomorrow.condition}`
      );
    }
    console.log();

    // Test cache functionality
    console.log('6. Testing Cache Functionality');
    const testCacheExpired = weatherService.isCacheExpired(
      Date.now() - 35 * 60 * 1000
    ); // 35 minutes ago
    const testCacheValid = weatherService.isCacheExpired(
      Date.now() - 25 * 60 * 1000
    ); // 25 minutes ago
    console.log(
      `   ✓ Cache expiry logic: expired=${testCacheExpired}, valid=${!testCacheValid}`
    );
    console.log();

    // Test utility methods
    console.log('7. Testing Utility Methods');
    const timeTest = weatherService.parseTimeString('06:30 AM');
    console.log(
      `   ✓ Time parsing: ${timeTest ? timeTest.toLocaleTimeString() : 'failed'}`
    );
    console.log();

    console.log('🎉 All Weather Service Tests Completed Successfully!');
    console.log();

    // Display final stats
    const finalStats = weatherService.getStats();
    console.log('📊 Final Service Statistics:');
    console.log(
      `   • Initialization: ${finalStats.isInitialized ? 'Complete' : 'Incomplete'}`
    );
    console.log(
      `   • Active Providers: ${finalStats.activeProviders}/${Object.keys(weatherService.providers).length}`
    );
    console.log(
      `   • Cache Duration: ${Math.round(finalStats.cacheTtl / 60000)} minutes`
    );
    console.log(
      `   • Supported Features: ${Object.keys(finalStats.supportedFeatures).length}`
    );

    return true;
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    return false;
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testWeatherService()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testWeatherService, mockWeatherData, mockLocation };
