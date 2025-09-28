/**
 * Weather Command
 * Comprehensive weather information display with multiple providers and formats
 */

const chalk = require('chalk');
const weatherService = require('../services/weather');
const weatherAscii = require('../assets/weather-ascii');
const i18n = require('../services/i18n');
const loggerService = require('../services/logger');
const outputFormatter = require('../services/output-formatter');
const errorHandler = require('../services/error-handler');
const debugService = require('../services/debug-service');

class WeatherCommand {
  constructor() {
    this.proxyAPI = null;
    this.weatherIcons = {
      clear: '☀️',
      cloudy: '☁️',
      partlyCloudy: '⛅',
      rain: '🌧️',
      snow: '❄️',
      thunderstorm: '⛈️',
      mist: '🌫️',
      fog: '🌫️',
      wind: '💨',
      hot: '🔥',
      cold: '🥶'
    };

    this.windDirections = [
      'N', 'NNE', 'NE', 'ENE',
      'E', 'ESE', 'SE', 'SSE',
      'S', 'SSW', 'SW', 'WSW',
      'W', 'WNW', 'NW', 'NNW'
    ];

    this.aqiLabels = {
      1: { label: 'Good', color: 'green' },
      2: { label: 'Fair', color: 'yellow' },
      3: { label: 'Moderate', color: 'yellowBright' },
      4: { label: 'Poor', color: 'red' },
      5: { label: 'Very Poor', color: 'redBright' },
      6: { label: 'Extremely Poor', color: 'magenta' }
    };
  }

  /**
   * Execute weather command with comprehensive display options
   */
  async execute(location, options = {}) {
    try {
      debugService.markPerformance('weather_command', 'start');
      debugService.debug('Executing weather command', { location, options }, 'weather');

      // Check if we should use proxy API or direct API keys
      const useProxyAPI = process.env.MDSAAD_USE_PROXY !== 'false'; // Default to proxy
      
      if (useProxyAPI) {
        // Use proxy API (no API keys needed for users)
        console.log(chalk.cyan('🌤️ Connecting to MDSAAD Weather Service...'));
        const proxyResult = await this.handleProxyRequest(location, options);
        if (proxyResult) return;
        
        // If proxy fails, fall back to direct API if keys available
        console.log(chalk.yellow('⚠️ Proxy service unavailable, checking for local API keys...'));
      }

      // Check if weather API keys are configured for direct access
      const { checkApiKeysConfigured, getSetupInstructions } = require('../config/mdsaad-keys');
      const keyStatus = checkApiKeysConfigured();
      
      if (!keyStatus.weather) {
        if (useProxyAPI) {
          console.log(chalk.red('❌ MDSAAD Weather Service is temporarily unavailable and no local API keys are configured.'));
          console.log(chalk.yellow('\n🔄 You have two options:\n'));
          console.log(chalk.cyan('1. Wait for the service to come back online (recommended)'));
          console.log(chalk.cyan('2. Configure your own API keys as backup:\n'));
        } else {
          console.log(chalk.red('❌ No Weather API keys configured!'));
          console.log(chalk.yellow('\n🌤️ To use weather features, you need to configure a weather API key:\n'));
        }
        
        const instructions = getSetupInstructions();
        console.log(chalk.cyan(instructions.message));
        
        instructions.methods.forEach(method => {
          console.log(chalk.yellow(`\n${method.title}:`));
          method.instructions.forEach(inst => {
            console.log(`   ${inst}`);
          });
        });
        
        console.log(chalk.green('\n💡 Quick start: Run "mdsaad config setup" for interactive configuration'));
        return;
      }

      // Initialize services if needed
      if (!errorHandler.isInitialized) {
        await errorHandler.initialize();
      }
      
      if (!weatherService.isInitialized) {
        console.log(chalk.yellow('🌤️ Initializing weather service...'));
        await weatherService.initialize();
      }

      // Handle special commands
      if (await this.handleSpecialCommands(location, options)) {
        debugService.markPerformance('weather_command', 'end');
        return;
      }

      // Get weather data based on options
      if (options.forecast) {
        await this.displayForecast(location, options);
      } else {
        await this.displayCurrentWeather(location, options);
      }

      // Show alerts if requested
      if (options.alerts) {
        await this.displayWeatherAlerts(location, options);
      }

      debugService.markPerformance('weather_command', 'end');
      debugService.debug('Weather command completed successfully');

    } catch (error) {
      debugService.markPerformance('weather_command', 'end');
      
      const result = await errorHandler.handleError(error, {
        command: 'weather',
        context: { location, options },
        userFriendly: true
      });

      if (result.action === 'retry' && result.context?.retryData) {
        debugService.debug('Retrying weather command with fallback data');
        this.displayFallbackWeather(result.context.retryData);
      }
    }
  }

  /**
   * Handle special commands (status, providers, etc.)
   */
  async handleSpecialCommands(location, options) {
    const command = location?.toLowerCase();

    switch (command) {
      case 'help':
      case '?':
        this.showHelp();
        return true;

      case 'status':
        this.showServiceStatus();
        return true;

      case 'providers':
        this.showProviderStatus();
        return true;

      case 'stats':
      case 'statistics':
        this.showStatistics();
        return true;

      default:
        return false;
    }
  }

  /**
   * Display current weather conditions
   */
  async displayCurrentWeather(location, options = {}) {
    try {
      console.log(outputFormatter.loading('🌤️ Getting current weather...'));

      const weatherData = await weatherService.getCurrentWeather(location, {
        units: options.units || 'metric',
        lang: options.lang || 'en'
      });

      // Display header
      this.displayWeatherHeader(weatherData);

      // Display current conditions
      const current = weatherData.current;
      const locationInfo = weatherData.location;

      console.log(outputFormatter.header('📍 Current Conditions'));

      // Main temperature and condition with enhanced formatting
      if (options.detailed) {
        const ascii = this.getWeatherAscii(current.conditionCode, current.icon);
        const tempColor = this.getTemperatureColor(current.temperature);
        
        console.log(outputFormatter.code(ascii, 'ascii'));
        console.log();
        console.log(outputFormatter.highlight(`${current.temperature}°`, 'temperature') + 
          ` ${chalk.gray('(')}${chalk[tempColor](`feels like ${current.feelsLike}°`)}${chalk.gray(')')}`);
        console.log(outputFormatter.info(current.condition));
      } else {
        const icon = this.getWeatherIcon(current.conditionCode, current.icon);
        const tempColor = this.getTemperatureColor(current.temperature);
        
        console.log(`${icon} ${outputFormatter.highlight(`${current.temperature}°`, 'temperature')} ` +
          `${chalk.gray('(')}${chalk[tempColor](`feels like ${current.feelsLike}°`)}${chalk.gray(')')}`);
        console.log(`   ${outputFormatter.info(current.condition)}`);
      }
      
      console.log();

      // Weather details in columns
      this.displayWeatherDetails(current, options.units || 'metric');

      // Wind information
      if (current.wind.speed > 0) {
        console.log();
        console.log(chalk.cyan('💨 Wind'));
        const windDir = this.getWindDirection(current.wind.direction);
        const windArrow = weatherAscii.windArrows[windDir] || '';
        console.log(`   Speed: ${chalk.white(current.wind.speed)} ${this.getSpeedUnit(options.units || 'metric')} ${windDir ? `${windArrow} (${windDir})` : ''}`);
        if (current.wind.gust > 0) {
          console.log(`   Gusts: ${chalk.white(current.wind.gust)} ${this.getSpeedUnit(options.units || 'metric')}`);
        }
      }

      // Air quality (if available)
      if (current.airQuality) {
        console.log();
        this.displayAirQuality(current.airQuality);
      }

      // Sun times
      if (current.sunrise && current.sunset) {
        console.log();
        console.log(chalk.cyan('🌅 Sun Times'));
        console.log(`   Sunrise: ${chalk.white(this.formatTime(current.sunrise))}`);
        console.log(`   Sunset:  ${chalk.white(this.formatTime(current.sunset))}`);
      }

      console.log();
      console.log(chalk.gray(`Data from ${weatherData.provider.toUpperCase()} • Last updated: ${this.formatTime(new Date(weatherData.timestamp))}`));

    } catch (error) {
      throw new Error(`Failed to get current weather: ${error.message}`);
    }
  }

  /**
   * Display weather forecast
   */
  async displayForecast(location, options = {}) {
    try {
      const days = parseInt(options.days) || 5;
      console.log(chalk.yellow(`🌤️ Getting ${days}-day forecast...`));
      console.log();

      const forecastData = await weatherService.getWeatherForecast(location, {
        units: options.units || 'metric',
        lang: options.lang || 'en',
        days: days
      });

      // Display header
      this.displayWeatherHeader(forecastData);

      console.log(chalk.cyan(`📅 ${days}-Day Forecast`));
      console.log();

      // Group forecast by days
      const dailyForecasts = this.groupForecastByDay(forecastData.forecast);

      dailyForecasts.slice(0, days).forEach((day, index) => {
        const date = new Date(day.date);
        const dayName = index === 0 ? 'Today' : 
                       index === 1 ? 'Tomorrow' : 
                       date.toLocaleDateString('en', { weekday: 'short' });

        console.log(chalk.white(`${dayName} ${chalk.gray(date.toLocaleDateString())}`));
        
        const icon = this.getWeatherIcon(day.conditionCode, day.icon);
        const tempColor = this.getTemperatureColor(day.temperature.max);
        
        console.log(`  ${icon} ${chalk[tempColor](`${day.temperature.max}°`)}${chalk.gray('/')}${chalk.blue(`${day.temperature.min}°`)} ${chalk.gray(day.condition)}`);
        
        if (day.pop > 0) {
          console.log(`     ${chalk.blue('💧')} ${day.pop}% chance of precipitation`);
        }
        
        if (day.wind && day.wind.speed > 0) {
          const windDir = this.getWindDirection(day.wind.direction);
          console.log(`     ${chalk.gray('💨')} ${day.wind.speed} ${this.getSpeedUnit(options.units || 'metric')} ${windDir || ''}`);
        }
        
        console.log();
      });

      console.log(chalk.gray(`Data from ${forecastData.provider.toUpperCase()} • Last updated: ${this.formatTime(new Date(forecastData.timestamp))}`));

    } catch (error) {
      throw new Error(`Failed to get weather forecast: ${error.message}`);
    }
  }

  /**
   * Display weather alerts
   */
  async displayWeatherAlerts(location, options = {}) {
    try {
      console.log(chalk.yellow('⚠️ Checking weather alerts...'));
      
      const alerts = await weatherService.getWeatherAlerts(location, options);

      console.log();
      
      if (alerts.length === 0) {
        console.log(chalk.green('✅ No active weather alerts'));
        return;
      }

      console.log(chalk.red(`🚨 ${alerts.length} Active Weather Alert(s)`));
      console.log();

      alerts.forEach((alert, index) => {
        console.log(chalk.red(`${index + 1}. ${alert.event || 'Weather Alert'}`));
        console.log(chalk.yellow(`   Severity: ${alert.severity || 'Unknown'}`));
        
        if (alert.start) {
          console.log(`   Start: ${chalk.white(this.formatDateTime(new Date(alert.start * 1000)))}`);
        }
        
        if (alert.end) {
          console.log(`   End: ${chalk.white(this.formatDateTime(new Date(alert.end * 1000)))}`);
        }
        
        if (alert.description) {
          console.log(`   ${chalk.gray(alert.description.substring(0, 200))}${alert.description.length > 200 ? '...' : ''}`);
        }
        
        console.log();
      });

    } catch (error) {
      console.log(chalk.yellow('⚠️ Unable to retrieve weather alerts'));
      loggerService.warn('Weather alerts failed:', error.message);
    }
  }

  /**
   * Display weather header with location info
   */
  displayWeatherHeader(weatherData) {
    const location = weatherData.location;
    const locationStr = location.country !== 'N/A' 
      ? `${location.name}, ${location.country}`
      : location.name;

    console.log(chalk.white.bold(`🌍 Weather for ${locationStr}`));
    if (location.region && location.region !== location.name) {
      console.log(chalk.gray(`   ${location.region}`));
    }
    console.log(chalk.gray(`   ${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}`));
    console.log();
  }

  /**
   * Display detailed weather information
   */
  displayWeatherDetails(current, units) {
    // Prepare weather details data for table
    const weatherData = [
      ['Humidity', `${current.humidity}%`],
      ['Pressure', `${current.pressure} ${this.getPressureUnit(units)}`]
    ];

    if (current.visibility) {
      weatherData.push(['Visibility', `${current.visibility} km`]);
    }

    if (current.uvIndex !== null && current.uvIndex !== undefined) {
      const uvColor = this.getUvIndexColor(current.uvIndex);
      weatherData.push(['UV Index', `${current.uvIndex} ${this.getUvIndexLevel(current.uvIndex)}`]);
    }

    weatherData.push(['Cloudiness', `${current.clouds}%`]);

    if (current.rain > 0) {
      weatherData.push(['Rainfall', `${current.rain} mm`]);
    }

    if (current.snow > 0) {
      weatherData.push(['Snowfall', `${current.snow} mm`]);
    }

    // Display as formatted table
    console.log(outputFormatter.formatTable('📊 Weather Details', weatherData, {
      compact: true,
      colors: {
        header: 'cyan',
        border: 'gray'
      }
    }));
  }

  /**
   * Display air quality information
   */
  displayAirQuality(airQuality) {
    console.log(chalk.cyan('💨 Air Quality'));
    
    if (airQuality.usEpaIndex) {
      const aqi = this.aqiLabels[airQuality.usEpaIndex] || { label: 'Unknown', color: 'gray' };
      const aqiIcon = this.getAirQualityIcon(airQuality.usEpaIndex);
      console.log(`   EPA Index:    ${aqiIcon} ${chalk[aqi.color](airQuality.usEpaIndex)} (${aqi.label})`);
    }
    
    if (airQuality.pm2_5) {
      console.log(`   PM2.5:        ${chalk.white(airQuality.pm2_5.toFixed(1))} μg/m³`);
    }
    
    if (airQuality.pm10) {
      console.log(`   PM10:         ${chalk.white(airQuality.pm10.toFixed(1))} μg/m³`);
    }
  }

  /**
   * Get air quality indicator icon
   */
  getAirQualityIcon(epaIndex) {
    if (epaIndex <= 1) return weatherAscii.airQuality.good;
    if (epaIndex <= 2) return weatherAscii.airQuality.fair;
    if (epaIndex <= 3) return weatherAscii.airQuality.moderate;
    if (epaIndex <= 4) return weatherAscii.airQuality.poor;
    if (epaIndex <= 5) return weatherAscii.airQuality.veryPoor;
    return weatherAscii.airQuality.extremelyPoor;
  }

  /**
   * Show service status
   */
  showServiceStatus() {
    console.log(chalk.yellow('🌤️ Weather Service Status'));
    console.log();

    const stats = weatherService.getStats();
    
    console.log(`${chalk.cyan('Service Status:')} ${stats.isInitialized ? chalk.green('Initialized') : chalk.red('Not Initialized')}`);
    console.log(`${chalk.cyan('Active Providers:')} ${chalk.white(stats.activeProviders)}`);
    
    if (stats.providerNames.length > 0) {
      console.log(`${chalk.cyan('Provider Names:')} ${chalk.white(stats.providerNames.join(', '))}`);
    }
    
    console.log(`${chalk.cyan('Cache TTL:')} ${chalk.white(Math.round(stats.cacheTtl / 60000))} minutes`);
    console.log();
    
    console.log(chalk.cyan('Supported Features:'));
    Object.entries(stats.supportedFeatures).forEach(([feature, supported]) => {
      const status = supported ? chalk.green('✓') : chalk.red('✗');
      console.log(`  ${status} ${feature}`);
    });
  }

  /**
   * Show provider status
   */
  showProviderStatus() {
    console.log(chalk.yellow('🔑 Weather Provider Status'));
    console.log();

    const providers = weatherService.getProviderStatus();
    
    providers.forEach(provider => {
      const status = provider.isActive ? chalk.green('Active') : chalk.red('Inactive');
      const keyStatus = provider.hasApiKey ? chalk.green('✓') : chalk.red('✗');
      
      console.log(`${chalk.cyan(provider.name)}: ${status}`);
      console.log(`  API Key: ${keyStatus} ${provider.requiresApiKey ? '(Required)' : '(Optional)'}`);
      console.log();
    });
    
    if (providers.filter(p => p.isActive).length === 0) {
      console.log(chalk.yellow('⚠️ No weather providers are active. Please configure API keys.'));
      console.log(chalk.gray('Use: mdsaad config set weather.openweathermap.apiKey <your-key>'));
      console.log(chalk.gray('Or:  mdsaad config set weather.weatherapi.apiKey <your-key>'));
    }
  }

  /**
   * Show weather service statistics
   */
  showStatistics() {
    console.log(chalk.yellow('📊 Weather Service Statistics'));
    console.log();

    const stats = weatherService.getStats();
    
    console.log(`${chalk.cyan('Initialization:')} ${stats.isInitialized ? 'Complete' : 'Pending'}`);
    console.log(`${chalk.cyan('Active Providers:')} ${stats.activeProviders}/${Object.keys(weatherService.providers).length}`);
    console.log(`${chalk.cyan('Cache Duration:')} ${Math.round(stats.cacheTtl / 60000)} minutes`);
    console.log();
    
    if (stats.activeProviders > 0) {
      console.log(chalk.cyan('Available Features:'));
      const features = [
        'Current weather conditions',
        'Weather forecasts (up to 10 days)',
        'Weather alerts and warnings',
        'Location geocoding',
        'Automatic location detection',
        stats.supportedFeatures.airQuality ? 'Air quality monitoring' : null
      ].filter(Boolean);
      
      features.forEach(feature => {
        console.log(`  • ${feature}`);
      });
    } else {
      console.log(chalk.red('No active providers. Weather functionality is limited.'));
    }
  }

  /**
   * Utility methods
   */
  getWeatherIcon(conditionCode, iconCode) {
    // Map weather condition codes to appropriate emojis
    if (conditionCode) {
      // OpenWeatherMap codes
      if (conditionCode >= 200 && conditionCode < 300) return this.weatherIcons.thunderstorm;
      if (conditionCode >= 300 && conditionCode < 400) return this.weatherIcons.rain;
      if (conditionCode >= 500 && conditionCode < 600) return this.weatherIcons.rain;
      if (conditionCode >= 600 && conditionCode < 700) return this.weatherIcons.snow;
      if (conditionCode >= 700 && conditionCode < 800) return this.weatherIcons.mist;
      if (conditionCode === 800) return this.weatherIcons.clear;
      if (conditionCode > 800) return this.weatherIcons.cloudy;
    }
    
    // Fallback to icon code if available
    if (iconCode) {
      if (iconCode.includes('01')) return this.weatherIcons.clear;
      if (iconCode.includes('02') || iconCode.includes('03')) return this.weatherIcons.partlyCloudy;
      if (iconCode.includes('04')) return this.weatherIcons.cloudy;
      if (iconCode.includes('09') || iconCode.includes('10')) return this.weatherIcons.rain;
      if (iconCode.includes('11')) return this.weatherIcons.thunderstorm;
      if (iconCode.includes('13')) return this.weatherIcons.snow;
      if (iconCode.includes('50')) return this.weatherIcons.mist;
    }
    
    return '🌤️'; // Default
  }

  /**
   * Get ASCII art for weather condition
   */
  getWeatherAscii(conditionCode, iconCode) {
    if (conditionCode) {
      // OpenWeatherMap codes
      if (conditionCode >= 200 && conditionCode < 300) return weatherAscii.thunderstorm;
      if (conditionCode >= 300 && conditionCode < 400) return weatherAscii.rainy;
      if (conditionCode >= 500 && conditionCode < 600) return weatherAscii.rainy;
      if (conditionCode >= 600 && conditionCode < 700) return weatherAscii.snowy;
      if (conditionCode >= 700 && conditionCode < 800) return weatherAscii.foggy;
      if (conditionCode === 800) return weatherAscii.sunny;
      if (conditionCode > 800) return weatherAscii.cloudy;
    }
    
    // Fallback to icon code if available
    if (iconCode) {
      if (iconCode.includes('01')) return weatherAscii.sunny;
      if (iconCode.includes('02') || iconCode.includes('03')) return weatherAscii.partlyCloudy;
      if (iconCode.includes('04')) return weatherAscii.cloudy;
      if (iconCode.includes('09') || iconCode.includes('10')) return weatherAscii.rainy;
      if (iconCode.includes('11')) return weatherAscii.thunderstorm;
      if (iconCode.includes('13')) return weatherAscii.snowy;
      if (iconCode.includes('50')) return weatherAscii.foggy;
    }
    
    return weatherAscii.partlyCloudy; // Default
  }

  getTemperatureColor(temp) {
    if (temp >= 30) return 'red';
    if (temp >= 20) return 'yellow';
    if (temp >= 10) return 'green';
    if (temp >= 0) return 'cyan';
    return 'blue';
  }

  getWindDirection(degrees) {
    if (degrees === null || degrees === undefined) return '';
    const index = Math.round(degrees / 22.5) % 16;
    return this.windDirections[index];
  }

  getUvIndexColor(uvIndex) {
    if (uvIndex <= 2) return 'green';
    if (uvIndex <= 5) return 'yellow';
    if (uvIndex <= 7) return 'red';
    if (uvIndex <= 10) return 'magenta';
    return 'redBright';
  }

  getUvIndexLevel(uvIndex) {
    if (uvIndex <= 2) return 'Low';
    if (uvIndex <= 5) return 'Moderate';
    if (uvIndex <= 7) return 'High';
    if (uvIndex <= 10) return 'Very High';
    return 'Extreme';
  }

  getSpeedUnit(units) {
    return units === 'imperial' ? 'mph' : 'm/s';
  }

  getPressureUnit(units) {
    return units === 'imperial' ? 'inHg' : 'hPa';
  }

  formatTime(date) {
    if (!date) return 'N/A';
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      hour12: false 
    });
  }

  formatDateTime(date) {
    if (!date) return 'N/A';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  groupForecastByDay(forecast) {
    const dailyForecasts = new Map();
    
    forecast.forEach(item => {
      const date = new Date(item.date);
      const dateKey = date.toDateString();
      
      if (!dailyForecasts.has(dateKey)) {
        dailyForecasts.set(dateKey, item);
      }
    });
    
    return Array.from(dailyForecasts.values());
  }

  /**
   * Show comprehensive help
   */
  showHelp() {
    console.log(chalk.yellow('🌤️ Weather Information System Help'));
    console.log();
    
    console.log(chalk.cyan('Basic Usage:'));
    console.log('  mdsaad weather                     →  Current weather (auto-detected location)');
    console.log('  mdsaad weather "New York"          →  Current weather for specific city');
    console.log('  mdsaad weather "40.7128,-74.0060"  →  Weather for coordinates (lat,lon)');
    console.log();
    
    console.log(chalk.cyan('Display Options:'));
    console.log('  -d, --detailed                     →  Show detailed weather information');
    console.log('  -f, --forecast                     →  Show weather forecast');
    console.log('  --days <number>                    →  Forecast days (1-10, default: 5)');
    console.log('  -u, --units <system>               →  Temperature units (metric, imperial)');
    console.log('  --alerts                           →  Show weather alerts and warnings');
    console.log();
    
    console.log(chalk.cyan('Information Commands:'));
    console.log('  mdsaad weather status              →  Show service status');
    console.log('  mdsaad weather providers           →  Show provider status');
    console.log('  mdsaad weather stats               →  Show service statistics');
    console.log();
    
    console.log(chalk.cyan('Examples:'));
    console.log('  mdsaad weather                              # Auto-detect location');
    console.log('  mdsaad weather "London, UK" --detailed      # Detailed London weather');
    console.log('  mdsaad weather Tokyo --forecast --days 7    # 7-day Tokyo forecast');
    console.log('  mdsaad weather Miami --alerts               # Miami with alerts');
    console.log('  mdsaad weather "Paris" --units imperial     # Paris weather in Fahrenheit');
    console.log();
    
    console.log(chalk.cyan('Configuration:'));
    console.log('  To enable weather features, configure API keys:');
    console.log('  mdsaad config set weather.openweathermap.apiKey <your-key>');
    console.log('  mdsaad config set weather.weatherapi.apiKey <your-key>');
    console.log();
    console.log(chalk.gray('Get free API keys from:'));
    console.log(chalk.gray('• OpenWeatherMap: https://openweathermap.org/api'));
    console.log(chalk.gray('• WeatherAPI: https://www.weatherapi.com/'));
  }

  /**
   * Handle weather requests through proxy API
   */
  async handleProxyRequest(location, options) {
    try {
      // Initialize proxy service if needed
      if (!this.proxyAPI) {
        const ProxyAPIService = require('../services/proxy-api');
        this.proxyAPI = new ProxyAPIService();
      }

      // Make request through proxy
      const result = await this.proxyAPI.weatherRequest(location, options);
      
      if (result.success) {
        // Display weather data
        const data = result.data;
        
        console.log(chalk.blue(`\n📍 ${data.location.name}, ${data.location.region}, ${data.location.country}`));
        
        // Current weather
        console.log(chalk.green('\n🌤️ Current Weather:'));
        console.log(chalk.white(`🌡️ Temperature: ${data.current.temperature}°${options.units === 'imperial' ? 'F' : 'C'}`));
        console.log(chalk.white(`☁️ Condition: ${data.current.condition}`));
        console.log(chalk.white(`💧 Humidity: ${data.current.humidity}%`));
        console.log(chalk.white(`🌬️ Wind: ${data.current.wind} ${options.units === 'imperial' ? 'mph' : 'kph'}`));
        console.log(chalk.white(`👁️ Visibility: ${data.current.visibility} ${options.units === 'imperial' ? 'miles' : 'km'}`));
        
        // Forecast if requested
        if (options.forecast && data.forecast) {
          console.log(chalk.green('\n📅 Forecast:'));
          data.forecast.forEach(day => {
            console.log(chalk.cyan(`${day.date}: ${day.min_temp}°-${day.max_temp}° ${day.condition}`));
          });
        }

        return true; // Success
      } else {
        // Handle proxy API errors
        if (result.code === 'RATE_LIMIT_EXCEEDED') {
          console.log(chalk.red('❌ ' + result.error));
          console.log(chalk.yellow('💡 Tip: Rate limits reset every hour. You can also configure your own API keys as backup.'));
        } else if (result.code === 'CONNECTION_ERROR' && result.fallback) {
          console.log(chalk.yellow('⚠️ ' + result.error));
          console.log(chalk.cyan('🔄 Falling back to direct API access...'));
          return false; // Allow fallback to direct API
        } else {
          console.log(chalk.red('❌ ' + result.error));
        }
        return true; // Don't fallback for other errors
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Proxy service connection failed, trying direct API access...'));
      loggerService.debug('Proxy API error:', error);
      return false; // Allow fallback
    }
  }

  /**
   * Display fallback weather data when main services fail
   */
  displayFallbackWeather(fallbackData) {
    console.log(outputFormatter.warning('⚠️ Using fallback weather data'));
    
    if (fallbackData && fallbackData.location) {
      console.log(outputFormatter.header(`📍 ${fallbackData.location}`));
      console.log(outputFormatter.info('🌤️ Weather information temporarily unavailable'));
      console.log(outputFormatter.info('📊 Showing last known conditions or offline data'));
      
      if (fallbackData.temperature) {
        const tempDisplay = `${fallbackData.temperature}°${fallbackData.units === 'imperial' ? 'F' : 'C'}`;
        console.log(outputFormatter.success(`🌡️ Temperature: ${tempDisplay}`));
      }
      
      if (fallbackData.condition) {
        console.log(outputFormatter.info(`☁️ Conditions: ${fallbackData.condition}`));
      }
      
      if (fallbackData.timestamp) {
        const time = new Date(fallbackData.timestamp).toLocaleString();
        console.log(outputFormatter.muted(`⏰ Last updated: ${time}`));
      }
    } else {
      console.log(outputFormatter.info('🌤️ Weather services are temporarily unavailable'));
      console.log(outputFormatter.muted('Please try again later or check your internet connection'));
    }
  }

  /**
   * Handle errors with user-friendly messages (legacy method for compatibility)
   */
  handleError(error) {
    // This method is kept for backward compatibility but errors are now handled by errorHandler service
    debugService.debug('Legacy error handler called', { error: error.message }, 'weather');
    console.log(chalk.red('❌ Weather request failed:'), error.message);
    
    if (error.message.includes('not found')) {
      console.log(chalk.yellow('💡 Try using a more specific location name or coordinates'));
      console.log(chalk.gray('Examples: "New York, NY" or "40.7128,-74.0060"'));
    } else if (error.message.includes('providers failed') || error.message.includes('no providers')) {
      console.log(chalk.yellow('💡 Configure weather API keys to enable weather features'));
      console.log(chalk.gray('Use: mdsaad weather providers (to see current status)'));
      console.log(chalk.gray('Use: mdsaad weather help (for configuration instructions)'));
    } else if (error.message.includes('timeout') || error.message.includes('network')) {
      console.log(chalk.yellow('💡 Check your internet connection and try again'));
    }
    
    console.log(chalk.gray('Use "mdsaad weather help" for usage information'));
  }
}

module.exports = new WeatherCommand();