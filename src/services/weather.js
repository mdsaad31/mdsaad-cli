/**
 * Weather Service
 * Comprehensive weather information retrieval with multiple provider support
 */

const axios = require('axios');
const loggerService = require('./logger');
const cacheService = require('./cache');
const configService = require('./config');
const mdsaadKeys = require('../config/mdsaad-keys');

class WeatherService {
  constructor() {
    this.providers = {
      mdsaad: {
        name: 'MDSAAD Weather API',
        baseUrl: mdsaadKeys.weather.baseUrl,
        requiresApiKey: true,
        isActive: true,
        priority: 1,
      },
      openweathermap: {
        name: 'OpenWeatherMap',
        baseUrl: 'http://api.openweathermap.org/data/2.5',
        geocodingUrl: 'http://api.openweathermap.org/geo/1.0',
        requiresApiKey: true,
        isActive: false, // Will be activated in init if API key is configured
        priority: 2,
      },
      weatherapi: {
        name: 'WeatherAPI (Free)',
        baseUrl: 'http://api.weatherapi.com/v1',
        requiresApiKey: true,
        isActive: false, // Will be activated in init if API key is configured
        priority: 3,
      },
    };

    this.cacheTtl = 30 * 60 * 1000; // 30 minutes in milliseconds
    this.isInitialized = false;
  }

  /**
   * Initialize weather service with API keys and provider configuration
   */
  async initialize() {
    try {
      // Disable MDSAAD API (using your APIs instead)
      this.providers.mdsaad.isActive = false;

      // Use your OpenWeatherMap API key (free access for users)
      const openWeatherKey = mdsaadKeys.weather.openweathermap.apiKey;
      if (openWeatherKey && !openWeatherKey.includes('YOUR_')) {
        this.providers.openweathermap.apiKey = openWeatherKey;
        this.providers.openweathermap.isActive = true;
        loggerService.info(
          'OpenWeatherMap provider initialized (free via MDSAAD API key)'
        );
      }

      // Use your WeatherAPI key (free access for users)
      const weatherApiKey = mdsaadKeys.weather.weatherapi.apiKey;
      if (weatherApiKey && !weatherApiKey.includes('YOUR_')) {
        this.providers.weatherapi.apiKey = weatherApiKey;
        this.providers.weatherapi.isActive = true;
        loggerService.info(
          'WeatherAPI provider initialized (free via MDSAAD API key)'
        );
      }

      // Check if any providers are active
      const activeProviders = Object.values(this.providers).filter(
        p => p.isActive
      );
      if (activeProviders.length === 0) {
        loggerService.warn(
          'No weather providers configured. Please set your API keys in src/config/mdsaad-keys.js'
        );
      } else {
        loggerService.info(
          `Weather service initialized with ${activeProviders.length} provider(s) (${activeProviders.map(p => p.name).join(', ')})`
        );
      }

      this.isInitialized = true;
    } catch (error) {
      loggerService.error('Failed to initialize weather service:', error);
      throw error;
    }
  }

  /**
   * Get current weather for a location
   */
  async getCurrentWeather(location, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { units = 'metric', lang = 'en' } = options;

    try {
      // Try to resolve location first
      const resolvedLocation = await this.resolveLocation(location);
      if (!resolvedLocation) {
        throw new Error(`Location "${location}" not found`);
      }

      // Check if we have active providers first
      const activeProviders = Object.entries(this.providers).filter(
        ([, provider]) => provider.isActive
      );
      if (activeProviders.length === 0) {
        throw new Error('No weather providers configured or active');
      }

      // Check cache first
      const cacheKey = `current:${resolvedLocation.lat}:${resolvedLocation.lon}:${units}`;

      try {
        const cached = await cacheService.get('weather', cacheKey);
        if (cached && cached.data) {
          loggerService.info('Returning cached weather data');
          return cached.data;
        }
      } catch (cacheError) {
        loggerService.warn('Cache retrieval failed:', cacheError.message);
        // Continue without cache
      }

      // Try to get weather from providers (prioritize by priority level)
      let weatherData = null;
      const sortedProviders = activeProviders.sort(
        ([, a], [, b]) => (a.priority || 999) - (b.priority || 999)
      );

      for (const [providerId, provider] of sortedProviders) {
        try {
          loggerService.info(`Fetching weather from ${provider.name}`);

          if (providerId === 'mdsaad') {
            weatherData = await this.getMdsaadWeatherCurrent(resolvedLocation, {
              units,
              lang,
            });
          } else if (providerId === 'openweathermap') {
            weatherData = await this.getOpenWeatherMapCurrent(
              resolvedLocation,
              { units, lang }
            );
          } else if (providerId === 'weatherapi') {
            weatherData = await this.getWeatherAPICurrent(resolvedLocation, {
              units,
              lang,
            });
          }

          if (weatherData) {
            // Cache successful response
            await cacheService.set(
              'weather',
              cacheKey,
              weatherData,
              this.cacheTtl
            );

            loggerService.info(`Weather data retrieved from ${provider.name}`);
            return weatherData;
          }
        } catch (error) {
          loggerService.warn(`${provider.name} failed:`, error.message);
          continue; // Try next provider
        }
      }

      throw new Error(
        'All weather providers failed or no providers configured'
      );
    } catch (error) {
      loggerService.error('Failed to get current weather:', error);
      throw error;
    }
  }

  /**
   * Get weather forecast for a location
   */
  async getWeatherForecast(location, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const { units = 'metric', lang = 'en', days = 5 } = options;

    try {
      const resolvedLocation = await this.resolveLocation(location);
      if (!resolvedLocation) {
        throw new Error(`Location "${location}" not found`);
      }

      // Check if we have active providers first
      const activeProviders = Object.entries(this.providers).filter(
        ([, provider]) => provider.isActive
      );
      if (activeProviders.length === 0) {
        throw new Error('No weather providers configured or active');
      }

      // Check cache first
      const cacheKey = `forecast:${resolvedLocation.lat}:${resolvedLocation.lon}:${units}:${days}`;

      try {
        const cached = await cacheService.get('weather', cacheKey);
        if (cached && cached.data) {
          loggerService.info('Returning cached forecast data');
          return cached.data;
        }
      } catch (cacheError) {
        loggerService.warn('Cache retrieval failed:', cacheError.message);
        // Continue without cache
      }

      // Try to get forecast from providers (prioritize by priority level)
      let forecastData = null;
      const sortedProviders = activeProviders.sort(
        ([, a], [, b]) => (a.priority || 999) - (b.priority || 999)
      );

      for (const [providerId, provider] of sortedProviders) {
        try {
          loggerService.info(`Fetching forecast from ${provider.name}`);

          if (providerId === 'mdsaad') {
            forecastData = await this.getMdsaadWeatherForecast(
              resolvedLocation,
              { units, lang, days }
            );
          } else if (providerId === 'openweathermap') {
            forecastData = await this.getOpenWeatherMapForecast(
              resolvedLocation,
              { units, lang, days }
            );
          } else if (providerId === 'weatherapi') {
            forecastData = await this.getWeatherAPIForecast(resolvedLocation, {
              units,
              lang,
              days,
            });
          }

          if (forecastData) {
            // Cache successful response
            await cacheService.set(
              'weather',
              cacheKey,
              forecastData,
              this.cacheTtl
            );

            loggerService.info(`Forecast data retrieved from ${provider.name}`);
            return forecastData;
          }
        } catch (error) {
          loggerService.warn(
            `${provider.name} forecast failed:`,
            error.message
          );
          continue;
        }
      }

      throw new Error(
        'All weather providers failed or no providers configured'
      );
    } catch (error) {
      loggerService.error('Failed to get weather forecast:', error);
      throw error;
    }
  }

  /**
   * Resolve location name to coordinates
   */
  async resolveLocation(location) {
    if (!location) {
      // Try to auto-detect location using IP geolocation
      return await this.autoDetectLocation();
    }

    // Check if location is already coordinates (lat,lon)
    const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
    if (coordMatch) {
      return {
        lat: parseFloat(coordMatch[1]),
        lon: parseFloat(coordMatch[2]),
        name: 'Custom Location',
        country: 'N/A',
      };
    }

    // Check cache first
    const cacheKey = location.toLowerCase();
    const cached = await cacheService.get('geocoding', cacheKey);
    if (cached && cached.data) {
      return cached.data;
    }

    try {
      // Try MDSAAD geocoding first (free service)
      if (this.providers.mdsaad.isActive) {
        const resolved = await this.geocodeWithMdsaad(location);
        if (resolved) {
          await cacheService.set(
            'geocoding',
            cacheKey,
            resolved,
            24 * 60 * 60 * 1000
          ); // Cache for 24 hours
          return resolved;
        }
      }

      // Try OpenWeatherMap geocoding if available
      if (this.providers.openweathermap.isActive) {
        const resolved = await this.geocodeWithOpenWeatherMap(location);
        if (resolved) {
          await cacheService.set(
            'geocoding',
            cacheKey,
            resolved,
            24 * 60 * 60 * 1000
          );
          return resolved;
        }
      }

      // Try WeatherAPI geocoding if available
      if (this.providers.weatherapi.isActive) {
        const resolved = await this.geocodeWithWeatherAPI(location);
        if (resolved) {
          await cacheService.set(
            'geocoding',
            cacheKey,
            resolved,
            24 * 60 * 60 * 1000
          );
          return resolved;
        }
      }

      return null;
    } catch (error) {
      loggerService.error('Location resolution failed:', error);
      return null;
    }
  }

  /**
   * Get weather alerts for a location
   */
  async getWeatherAlerts(location, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const resolvedLocation = await this.resolveLocation(location);
      if (!resolvedLocation) {
        throw new Error(`Location "${location}" not found`);
      }

      // Check if we have active providers first
      const activeProviders = Object.entries(this.providers).filter(
        ([, provider]) => provider.isActive
      );
      if (activeProviders.length === 0) {
        return []; // No alerts available without providers
      }

      // Check cache first
      const cacheKey = `alerts:${resolvedLocation.lat}:${resolvedLocation.lon}`;

      try {
        const cached = await cacheService.get('weather', cacheKey);
        if (cached && cached.data) {
          return cached.data;
        }
      } catch (cacheError) {
        loggerService.warn('Cache retrieval failed:', cacheError.message);
        // Continue without cache
      }

      let alertData = null;
      const sortedProviders = activeProviders.sort(
        ([, a], [, b]) => (a.priority || 999) - (b.priority || 999)
      );

      for (const [providerId, provider] of sortedProviders) {
        try {
          if (providerId === 'mdsaad') {
            alertData = await this.getMdsaadWeatherAlerts(resolvedLocation);
          } else if (providerId === 'openweathermap') {
            alertData = await this.getOpenWeatherMapAlerts(resolvedLocation);
          } else if (providerId === 'weatherapi') {
            alertData = await this.getWeatherAPIAlerts(resolvedLocation);
          }

          if (alertData) {
            await cacheService.set(
              'weather',
              cacheKey,
              alertData,
              this.cacheTtl
            );

            return alertData;
          }
        } catch (error) {
          loggerService.warn(`${provider.name} alerts failed:`, error.message);
          continue;
        }
      }

      return []; // No alerts or providers failed
    } catch (error) {
      loggerService.error('Failed to get weather alerts:', error);
      return [];
    }
  }

  /**
   * Auto-detect location using IP geolocation
   */
  async autoDetectLocation() {
    try {
      // Use ipapi.co for IP geolocation (no API key required)
      const response = await axios.get('https://ipapi.co/json/', {
        timeout: 5000,
        headers: {
          'User-Agent': 'MDSAAD CLI Tool',
        },
      });

      if (response.data && response.data.latitude && response.data.longitude) {
        return {
          lat: response.data.latitude,
          lon: response.data.longitude,
          name: response.data.city || 'Current Location',
          country:
            response.data.country_name || response.data.country || 'Unknown',
          region: response.data.region || null,
        };
      }

      return null;
    } catch (error) {
      loggerService.warn('Auto location detection failed:', error.message);
      return null;
    }
  }

  /**
   * MDSAAD Weather API methods (Free service)
   */
  async getMdsaadWeatherCurrent(location, options = {}) {
    const { units, lang } = options;
    const url = `${this.providers.mdsaad.baseUrl}/current`;

    const params = {
      lat: location.lat,
      lon: location.lon,
      units: units || 'metric',
      lang: lang || 'en',
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          Authorization: `Bearer ${mdsaadKeys.weather.apiKey}`,
          'User-Agent': 'MDSAAD CLI Tool v1.0.0',
          'X-Client': 'mdsaad-cli',
        },
      });

      return this.normalizeCurrentWeather(response.data, 'mdsaad', location);
    } catch (error) {
      // If MDSAAD API fails, throw to try fallback providers
      throw new Error(
        `MDSAAD API failed: ${error.response?.status || error.message}`
      );
    }
  }

  async getMdsaadWeatherForecast(location, options = {}) {
    const { units, lang, days } = options;
    const url = `${this.providers.mdsaad.baseUrl}/forecast`;

    const params = {
      lat: location.lat,
      lon: location.lon,
      units: units || 'metric',
      lang: lang || 'en',
      days: Math.min(days || 5, 7), // MDSAAD API supports up to 7 days
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          Authorization: 'Bearer YOUR_WEATHER_API_KEY_HERE', // Replace with your actual weather API key
          'User-Agent': 'MDSAAD CLI Tool v1.0.0',
          'X-Client': 'mdsaad-cli',
        },
      });

      return this.normalizeForecast(response.data, 'mdsaad', location);
    } catch (error) {
      throw new Error(
        `MDSAAD Forecast API failed: ${error.response?.status || error.message}`
      );
    }
  }

  async getMdsaadWeatherAlerts(location) {
    const url = `${this.providers.mdsaad.baseUrl}/alerts`;

    const params = {
      lat: location.lat,
      lon: location.lon,
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'MDSAAD CLI Tool v1.0.0',
          'X-Client': 'mdsaad-cli',
        },
      });

      return response.data.alerts || [];
    } catch (error) {
      // Alerts are optional, return empty array if failed
      loggerService.warn('MDSAAD alerts API failed:', error.message);
      return [];
    }
  }

  async geocodeWithMdsaad(locationName) {
    const url = `${this.providers.mdsaad.baseUrl}/geocode`;

    const params = {
      q: locationName,
      limit: 1,
    };

    try {
      const response = await axios.get(url, {
        params,
        timeout: 10000,
        headers: {
          'User-Agent': 'MDSAAD CLI Tool v1.0.0',
          'X-Client': 'mdsaad-cli',
        },
      });

      if (
        response.data &&
        response.data.results &&
        response.data.results.length > 0
      ) {
        const result = response.data.results[0];
        return {
          lat: result.lat,
          lon: result.lon,
          name: result.name,
          country: result.country,
          state: result.state || result.region || null,
        };
      }

      return null;
    } catch (error) {
      loggerService.warn('MDSAAD geocoding failed:', error.message);
      return null;
    }
  }

  /**
   * OpenWeatherMap API methods
   */
  async getOpenWeatherMapCurrent(location, options = {}) {
    const { units, lang } = options;
    const url = `${this.providers.openweathermap.baseUrl}/weather`;

    const params = {
      lat: location.lat,
      lon: location.lon,
      appid: this.providers.openweathermap.apiKey,
      units: units,
      lang: lang,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    return this.normalizeCurrentWeather(
      response.data,
      'openweathermap',
      location
    );
  }

  async getOpenWeatherMapForecast(location, options = {}) {
    const { units, lang, days } = options;
    const url = `${this.providers.openweathermap.baseUrl}/forecast`;

    const params = {
      lat: location.lat,
      lon: location.lon,
      appid: this.providers.openweathermap.apiKey,
      units: units,
      lang: lang,
      cnt: Math.min(days * 8, 40), // 8 forecasts per day (3-hour intervals), max 40
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    return this.normalizeForecast(response.data, 'openweathermap', location);
  }

  async getOpenWeatherMapAlerts(location) {
    const url = `${this.providers.openweathermap.baseUrl}/onecall`;

    const params = {
      lat: location.lat,
      lon: location.lon,
      appid: this.providers.openweathermap.apiKey,
      exclude: 'minutely,hourly,daily',
    };

    try {
      const response = await axios.get(url, { params, timeout: 10000 });
      return response.data.alerts || [];
    } catch (error) {
      // OneCall API might not be available in free tier
      return [];
    }
  }

  async geocodeWithOpenWeatherMap(locationName) {
    const url = `${this.providers.openweathermap.geocodingUrl}/direct`;

    const params = {
      q: locationName,
      limit: 1,
      appid: this.providers.openweathermap.apiKey,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: result.lat,
        lon: result.lon,
        name: result.name,
        country: result.country,
        state: result.state || null,
      };
    }

    return null;
  }

  /**
   * WeatherAPI methods
   */
  async getWeatherAPICurrent(location, options = {}) {
    const url = `${this.providers.weatherapi.baseUrl}/current.json`;

    const params = {
      key: this.providers.weatherapi.apiKey,
      q: `${location.lat},${location.lon}`,
      aqi: 'yes',
    };

    loggerService.verbose(
      `WeatherAPI request: ${url} with params:`,
      JSON.stringify(params)
    );

    try {
      const response = await axios.get(url, { params, timeout: 10000 });
      return this.normalizeCurrentWeather(
        response.data,
        'weatherapi',
        location
      );
    } catch (error) {
      loggerService.error(`WeatherAPI request failed:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url,
        params: params,
      });
      throw error;
    }
  }

  async getWeatherAPIForecast(location, options = {}) {
    const { days } = options;
    const url = `${this.providers.weatherapi.baseUrl}/forecast.json`;

    const params = {
      key: this.providers.weatherapi.apiKey,
      q: `${location.lat},${location.lon}`,
      days: Math.min(days, 10), // WeatherAPI supports up to 10 days
      aqi: 'yes',
      alerts: 'yes',
    };

    loggerService.verbose(
      `WeatherAPI forecast request: ${url} with params:`,
      JSON.stringify(params)
    );

    try {
      const response = await axios.get(url, { params, timeout: 10000 });
      return this.normalizeForecast(response.data, 'weatherapi', location);
    } catch (error) {
      loggerService.error(`WeatherAPI forecast request failed:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: url,
        params: params,
      });
      throw error;
    }
  }

  async getWeatherAPIAlerts(location) {
    try {
      const forecastData = await this.getWeatherAPIForecast(location, {
        days: 1,
      });
      return forecastData.alerts || [];
    } catch (error) {
      return [];
    }
  }

  async geocodeWithWeatherAPI(locationName) {
    const url = `${this.providers.weatherapi.baseUrl}/search.json`;

    const params = {
      key: this.providers.weatherapi.apiKey,
      q: locationName,
    };

    const response = await axios.get(url, { params, timeout: 10000 });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      return {
        lat: result.lat,
        lon: result.lon,
        name: result.name,
        country: result.country,
        region: result.region || null,
      };
    }

    return null;
  }

  /**
   * Normalize current weather data from different providers
   */
  normalizeCurrentWeather(data, provider, location) {
    const normalized = {
      provider: provider,
      location: location,
      timestamp: Date.now(),
      current: {},
    };

    if (provider === 'mdsaad') {
      // MDSAAD API returns normalized data structure
      normalized.current = {
        temperature: Math.round(data.temperature || 0),
        feelsLike: Math.round(data.feelsLike || 0),
        humidity: data.humidity || 0,
        pressure: Math.round(data.pressure || 0),
        visibility: data.visibility || null,
        uvIndex: data.uvIndex || null,
        condition: data.condition || 'Unknown',
        conditionCode: data.conditionCode || 0,
        icon: data.icon || null,
        wind: {
          speed: Math.round(data.wind?.speed || 0),
          direction: data.wind?.direction || null,
          gust: Math.round(data.wind?.gust || 0),
        },
        clouds: data.clouds || 0,
        rain: data.precipitation?.rain || 0,
        snow: data.precipitation?.snow || 0,
        sunrise: data.sunrise ? new Date(data.sunrise) : null,
        sunset: data.sunset ? new Date(data.sunset) : null,
        airQuality: data.airQuality || null,
      };
    } else if (provider === 'openweathermap') {
      normalized.current = {
        temperature: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        pressure: data.main.pressure,
        visibility: data.visibility ? Math.round(data.visibility / 1000) : null,
        uvIndex: null, // Not available in current weather API
        condition: data.weather[0].description,
        conditionCode: data.weather[0].id,
        icon: data.weather[0].icon,
        wind: {
          speed: Math.round(data.wind?.speed || 0),
          direction: data.wind?.deg || null,
          gust: Math.round(data.wind?.gust || 0),
        },
        clouds: data.clouds?.all || 0,
        rain: data.rain?.['1h'] || 0,
        snow: data.snow?.['1h'] || 0,
        sunrise: data.sys?.sunrise ? new Date(data.sys.sunrise * 1000) : null,
        sunset: data.sys?.sunset ? new Date(data.sys.sunset * 1000) : null,
      };
    } else if (provider === 'weatherapi') {
      normalized.current = {
        temperature: Math.round(data.current.temp_c),
        feelsLike: Math.round(data.current.feelslike_c),
        humidity: data.current.humidity,
        pressure: Math.round(data.current.pressure_mb),
        visibility: Math.round(data.current.vis_km),
        uvIndex: data.current.uv,
        condition: data.current.condition.text,
        conditionCode: data.current.condition.code,
        icon: data.current.condition.icon,
        wind: {
          speed: Math.round(data.current.wind_kph / 3.6), // Convert to m/s
          direction: data.current.wind_degree,
          gust: Math.round(data.current.gust_kph / 3.6),
        },
        clouds: data.current.cloud,
        rain: data.current.precip_mm || 0,
        snow: 0, // WeatherAPI doesn't separate rain/snow
        airQuality: data.current.air_quality
          ? {
              co: data.current.air_quality.co,
              no2: data.current.air_quality.no2,
              o3: data.current.air_quality.o3,
              so2: data.current.air_quality.so2,
              pm2_5: data.current.air_quality.pm2_5,
              pm10: data.current.air_quality.pm10,
              usEpaIndex: data.current.air_quality['us-epa-index'],
              gbDefraIndex: data.current.air_quality['gb-defra-index'],
            }
          : null,
      };

      // Add sunrise/sunset if available
      if (data.forecast?.forecastday?.[0]?.astro) {
        const astro = data.forecast.forecastday[0].astro;
        normalized.current.sunrise = this.parseTimeString(astro.sunrise);
        normalized.current.sunset = this.parseTimeString(astro.sunset);
      }
    }

    return normalized;
  }

  /**
   * Normalize forecast data from different providers
   */
  normalizeForecast(data, provider, location) {
    const normalized = {
      provider: provider,
      location: location,
      timestamp: Date.now(),
      forecast: [],
    };

    if (provider === 'mdsaad') {
      // MDSAAD API returns normalized forecast data
      normalized.forecast = data.forecast.map(item => ({
        date: new Date(item.date),
        temperature: {
          current: Math.round(item.temperature?.current || 0),
          min: Math.round(item.temperature?.min || 0),
          max: Math.round(item.temperature?.max || 0),
          feelsLike: Math.round(item.temperature?.feelsLike || 0),
        },
        condition: item.condition || 'Unknown',
        conditionCode: item.conditionCode || 0,
        icon: item.icon || null,
        humidity: item.humidity || 0,
        pressure: item.pressure || 0,
        wind: {
          speed: Math.round(item.wind?.speed || 0),
          direction: item.wind?.direction || null,
          gust: Math.round(item.wind?.gust || 0),
        },
        clouds: item.clouds || 0,
        rain: item.precipitation?.rain || 0,
        snow: item.precipitation?.snow || 0,
        pop: item.precipitationChance || 0,
        uvIndex: item.uvIndex || null,
        sunrise: item.sunrise ? new Date(item.sunrise) : null,
        sunset: item.sunset ? new Date(item.sunset) : null,
      }));
    } else if (provider === 'openweathermap') {
      normalized.forecast = data.list.map(item => ({
        date: new Date(item.dt * 1000),
        temperature: {
          current: Math.round(item.main.temp),
          min: Math.round(item.main.temp_min),
          max: Math.round(item.main.temp_max),
          feelsLike: Math.round(item.main.feels_like),
        },
        condition: item.weather[0].description,
        conditionCode: item.weather[0].id,
        icon: item.weather[0].icon,
        humidity: item.main.humidity,
        pressure: item.main.pressure,
        wind: {
          speed: Math.round(item.wind?.speed || 0),
          direction: item.wind?.deg || null,
          gust: Math.round(item.wind?.gust || 0),
        },
        clouds: item.clouds?.all || 0,
        rain: item.rain?.['3h'] || 0,
        snow: item.snow?.['3h'] || 0,
        pop: Math.round((item.pop || 0) * 100), // Probability of precipitation
      }));
    } else if (provider === 'weatherapi') {
      normalized.forecast = [];

      data.forecast.forecastday.forEach(day => {
        // Daily forecast
        normalized.forecast.push({
          date: new Date(day.date),
          temperature: {
            min: Math.round(day.day.mintemp_c),
            max: Math.round(day.day.maxtemp_c),
            current: Math.round(day.day.avgtemp_c),
          },
          condition: day.day.condition.text,
          conditionCode: day.day.condition.code,
          icon: day.day.condition.icon,
          humidity: day.day.avghumidity,
          wind: {
            speed: Math.round(day.day.maxwind_kph / 3.6),
            direction: null,
          },
          rain: day.day.totalprecip_mm || 0,
          snow: day.day.totalsnow_cm || 0,
          pop: day.day.daily_chance_of_rain || 0,
          uvIndex: day.day.uv,
          sunrise: this.parseTimeString(day.astro.sunrise),
          sunset: this.parseTimeString(day.astro.sunset),
        });
      });
    }

    return normalized;
  }

  /**
   * Parse time string (e.g., "06:30 AM") to Date object
   */
  parseTimeString(timeStr) {
    if (!timeStr) return null;

    try {
      const [time, period] = timeStr.split(' ');
      const [hours, minutes] = time.split(':').map(Number);

      let hour24 = hours;
      if (period === 'PM' && hours !== 12) {
        hour24 += 12;
      } else if (period === 'AM' && hours === 12) {
        hour24 = 0;
      }

      const date = new Date();
      date.setHours(hour24, minutes, 0, 0);
      return date;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if cached data is expired
   */
  isCacheExpired(timestamp) {
    return Date.now() - timestamp > this.cacheTtl;
  }

  /**
   * Get weather service statistics
   */
  getStats() {
    const activeProviders = Object.values(this.providers).filter(
      p => p.isActive
    );

    return {
      isInitialized: this.isInitialized,
      activeProviders: activeProviders.length,
      providerNames: activeProviders.map(p => p.name),
      cacheTtl: this.cacheTtl,
      supportedFeatures: {
        currentWeather: true,
        forecast: true,
        alerts: true,
        geocoding: true,
        autoLocation: true,
        airQuality: activeProviders.some(p => p.name === 'WeatherAPI'),
      },
    };
  }

  /**
   * Set API key for a provider
   */
  async setApiKey(provider, apiKey) {
    if (!this.providers[provider]) {
      throw new Error(`Unknown weather provider: ${provider}`);
    }

    // Save to config
    await configService.set(`weather.${provider}.apiKey`, apiKey);

    // Update provider state
    this.providers[provider].apiKey = apiKey;
    this.providers[provider].isActive = true;

    loggerService.info(`API key set for ${this.providers[provider].name}`);

    return true;
  }

  /**
   * Get provider status
   */
  getProviderStatus() {
    return Object.entries(this.providers).map(([id, provider]) => ({
      id,
      name: provider.name,
      isActive: provider.isActive,
      hasApiKey: !!provider.apiKey,
      requiresApiKey: provider.requiresApiKey,
    }));
  }
}

module.exports = new WeatherService();
