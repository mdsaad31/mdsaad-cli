/**
 * Convert Command
 * Handles currency and unit conversions with support for 150+ currencies
 * and various unit types (length, weight, temperature)
 */

const { Command } = require('commander');
const chalk = require('chalk');
const Table = require('cli-table3');
const loggerService = require('../services/logger');
const configService = require('../services/config');
const cacheService = require('../services/cache');
const i18nService = require('../services/i18n');
const outputFormatter = require('../services/output-formatter');
const errorHandler = require('../services/error-handler');
const debugService = require('../services/debug-service');

class ConvertCommand {
  constructor() {
    this.apiKeys = {};
    this.isInitialized = false;
    this.cacheTtl = 1800; // 30 minutes for exchange rates
  }

  /**
   * Initialize the convert service
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      // Load API keys from configuration
      this.apiKeys = {
        fixer: configService.getApiKey('fixer'),
        'fixer-io': configService.getApiKey('fixer-io'),
        'exchangerate-api':
          configService.getApiKey('exchangerate-api') ||
          'ef49ea934522c581d0e31254',
      };
      this.isInitialized = true;
      loggerService.info('Convert service initialized successfully');
    } catch (error) {
      loggerService.error(
        'Failed to initialize convert service:',
        error.message
      );
      throw error;
    }
  }

  /**
   * Create the convert command
   */
  createCommand() {
    const convertCmd = new Command('convert')
      .alias('conv')
      .description(i18nService.t('commands.convert.description'))
      .argument('<amount>', 'Amount to convert')
      .argument('<from>', 'Source unit/currency')
      .argument('<to>', 'Target unit/currency')
      .option('-v, --verbose', 'Show detailed conversion information')
      .option(
        '-h, --historical [date]',
        'Use historical exchange rates (YYYY-MM-DD)'
      )
      .option('-r, --rates', 'Show current exchange rates')
      .option('-f, --favorites', 'Show favorite conversion pairs')
      .option('-a, --add-favorite', 'Add this conversion to favorites')
      .option('-b, --batch <file>', 'Process batch conversions from file')
      .action(async (amount, from, to, options) => {
        await this.execute(amount, from, to, options);
      });

    return convertCmd;
  }

  /**
   * Execute the convert command
   */
  async execute(amount, from, to, options = {}) {
    try {
      debugService.markPerformance('convert_command', 'start');
      debugService.debug(
        'Executing convert command',
        { amount, from, to, options },
        'convert'
      );

      await this.initialize();

      // Handle special commands first (no amount/from/to required)
      if (options.rates) {
        await this.showExchangeRates();
        debugService.markPerformance('convert_command', 'end');
        return;
      }

      if (options.favorites) {
        await this.showFavorites();
        debugService.markPerformance('convert_command', 'end');
        return;
      }

      if (options.batch) {
        await this.processBatchConversions(options.batch);
        debugService.markPerformance('convert_command', 'end');
        return;
      }

      // Validate required arguments for conversion
      if (!amount || !from || !to) {
        console.log(chalk.cyan('💱 MDSAAD Currency & Unit Converter'));
        console.log();
        console.log(chalk.yellow('Usage Examples:'));
        console.log(chalk.gray('  Currency:'), 'mdsaad convert 100 USD EUR');
        console.log(chalk.gray('  Temperature:'), 'mdsaad convert 32 F C');
        console.log(chalk.gray('  Length:'), 'mdsaad convert 10 KM MI');
        console.log(chalk.gray('  Weight:'), 'mdsaad convert 5 KG LB');
        console.log();
        console.log(chalk.yellow('Special Options:'));
        console.log(chalk.gray('  Exchange rates:'), 'mdsaad convert --rates');
        console.log(chalk.gray('  Favorites:'), 'mdsaad convert --favorites');
        console.log(
          chalk.gray('  Verbose:'),
          'mdsaad convert 100 C F --verbose'
        );
        console.log();
        return;
      }

      // Parse amount
      const numericAmount = parseFloat(amount);
      if (isNaN(numericAmount)) {
        throw new Error(
          `Invalid amount: ${amount}. Please provide a numeric value.`
        );
      }

      // Normalize currency/unit codes
      const fromCode = from.toUpperCase();
      const toCode = to.toUpperCase();

      // Determine conversion type (currency vs unit)
      const conversionType = this.getConversionType(fromCode, toCode);

      let result;
      if (conversionType === 'currency') {
        result = await this.convertCurrency(
          numericAmount,
          fromCode,
          toCode,
          options
        );
      } else if (conversionType === 'unit') {
        result = this.convertUnit(numericAmount, fromCode, toCode);
      } else {
        // Provide helpful suggestions
        console.log(
          chalk.red('❌ Unsupported conversion:'),
          `${fromCode} to ${toCode}`
        );
        console.log();
        console.log(chalk.yellow('💡 Supported conversions:'));
        console.log(
          chalk.gray('  Currencies:'),
          'USD, EUR, GBP, JPY, CAD, AUD, etc.'
        );
        console.log(
          chalk.gray('  Temperature:'),
          'C, F, K, R (Celsius, Fahrenheit, Kelvin, Rankine)'
        );
        console.log(chalk.gray('  Length:'), 'M, FT, IN, KM, MI, CM, MM, YD');
        console.log(chalk.gray('  Weight:'), 'KG, LB, G, OZ, TON');
        console.log(chalk.gray('  Volume:'), 'L, GAL, ML, FL_OZ, CUP');
        console.log(chalk.gray('  Time:'), 'S, MIN, H, D, WK, YR');
        console.log();
        return;
      }

      // Display result
      await this.displayConversionResult(result, options);

      // Add to favorites if requested
      if (options.addFavorite) {
        await this.addToFavorites(fromCode, toCode);
      }

      debugService.markPerformance('convert_command', 'end');
      debugService.debug('Convert command completed successfully');
    } catch (error) {
      debugService.markPerformance('convert_command', 'end');

      const result = await errorHandler.handleError(error, {
        command: 'convert',
        context: { amount, from, to, options },
        userFriendly: true,
      });

      if (result.action === 'retry' && result.context?.fallbackRate) {
        debugService.debug('Using fallback conversion rate');
        const fallbackResult = amount * result.context.fallbackRate;
        console.log(outputFormatter.warning('⚠️ Using fallback exchange rate'));
        console.log(
          outputFormatter.success(
            `💱 ${amount} ${from} ≈ ${fallbackResult.toFixed(4)} ${to} (approximate)`
          )
        );
      }
    }
  }

  /**
   * Determine if this is a currency or unit conversion
   */
  getConversionType(from, to) {
    const currencies = this.getSupportedCurrencies();

    // Check if both are currencies (requires API)
    const fromIsCurrency = currencies.includes(from);
    const toIsCurrency = currencies.includes(to);

    if (fromIsCurrency && toIsCurrency) {
      return 'currency';
    }

    // Check if both are units (local calculation)
    const unitCategory = this.findUnitCategory(from, to);
    if (unitCategory) {
      return 'unit';
    }

    return 'unknown';
  }

  /**
   * Find which category both units belong to (if any)
   */
  findUnitCategory(from, to) {
    const units = this.getSupportedUnits();

    for (const [categoryName, categoryUnits] of Object.entries(units)) {
      if (
        categoryUnits[from] !== undefined &&
        categoryUnits[to] !== undefined
      ) {
        return categoryName;
      }
    }

    return null;
  }

  /**
   * Convert currency using exchange rates
   */
  async convertCurrency(amount, fromCurrency, toCurrency, options = {}) {
    // Check cache first
    const cacheKey = `exchange_rate:${fromCurrency}:${toCurrency}:${options.historical || 'latest'}`;

    try {
      const cached = await cacheService.get('currency', cacheKey);
      if (cached && cached.data && !options.historical) {
        const rate = cached.data.rate;
        const convertedAmount = amount * rate;

        return {
          amount: amount,
          fromCurrency: fromCurrency,
          toCurrency: toCurrency,
          rate: rate,
          convertedAmount: convertedAmount,
          cached: true,
          timestamp: cached.timestamp,
        };
      }
    } catch (cacheError) {
      loggerService.warn('Cache retrieval failed:', cacheError.message);
    }

    // Fetch exchange rate from API
    const exchangeData = await this.fetchExchangeRate(
      fromCurrency,
      toCurrency,
      options
    );
    const rate = exchangeData.rate;
    const convertedAmount = amount * rate;

    // Cache the exchange rate
    try {
      await cacheService.set(
        'currency',
        cacheKey,
        {
          rate: rate,
          date: exchangeData.date,
          provider: exchangeData.provider,
        },
        this.cacheTtl
      );
    } catch (cacheError) {
      loggerService.warn('Cache storage failed:', cacheError.message);
    }

    return {
      amount: amount,
      fromCurrency: fromCurrency,
      toCurrency: toCurrency,
      rate: rate,
      convertedAmount: convertedAmount,
      date: exchangeData.date,
      provider: exchangeData.provider,
      cached: false,
    };
  }

  /**
   * Fetch exchange rate from API
   */
  async fetchExchangeRate(fromCurrency, toCurrency, options = {}) {
    const providers = [
      { name: 'ExchangeRate-API', method: 'fetchFromExchangeRateAPI' },
      { name: 'Fixer.io', method: 'fetchFromFixerIO' },
    ];

    for (const provider of providers) {
      try {
        const result = await this[provider.method](
          fromCurrency,
          toCurrency,
          options
        );
        if (result) {
          return {
            ...result,
            provider: provider.name,
          };
        }
      } catch (error) {
        loggerService.warn(
          `${provider.name} exchange rate fetch failed:`,
          error.message
        );
        continue;
      }
    }

    throw new Error('All exchange rate providers failed');
  }

  /**
   * Fetch from ExchangeRate-API (with API key)
   */
  async fetchFromExchangeRateAPI(fromCurrency, toCurrency, options = {}) {
    const axios = require('axios');
    const apiKey = this.apiKeys['exchangerate-api'];

    let url;
    if (apiKey) {
      // Use v6 API with API key for better rates and limits
      if (options.historical) {
        url = `https://v6.exchangerate-api.com/v6/${apiKey}/history/${fromCurrency}/${options.historical}`;
      } else {
        url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${fromCurrency}`;
      }
    } else {
      // Fallback to v4 API without key (limited)
      if (options.historical) {
        url = `https://api.exchangerate-api.com/v4/history/${fromCurrency}/${options.historical}`;
      } else {
        url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;
      }
    }

    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'MDSAAD-CLI/1.0.0',
      },
    });

    if (
      response.data &&
      response.data.conversion_rates &&
      response.data.conversion_rates[toCurrency]
    ) {
      // v6 API format
      return {
        rate: response.data.conversion_rates[toCurrency],
        date: response.data.time_last_update_utc
          ? response.data.time_last_update_utc.split(' ')[0]
          : new Date().toISOString().split('T')[0],
      };
    } else if (
      response.data &&
      response.data.rates &&
      response.data.rates[toCurrency]
    ) {
      // v4 API format
      return {
        rate: response.data.rates[toCurrency],
        date: response.data.date,
      };
    }

    throw new Error(
      `Exchange rate not found for ${fromCurrency} to ${toCurrency}`
    );
  }

  /**
   * Fetch from Fixer.io (requires API key)
   */
  async fetchFromFixerIO(fromCurrency, toCurrency, options = {}) {
    const apiKey = this.apiKeys.fixer || this.apiKeys['fixer-io'];
    if (!apiKey) {
      throw new Error('Fixer.io API key not configured');
    }

    const axios = require('axios');

    let url;
    if (options.historical) {
      url = `https://api.fixer.io/${options.historical}?access_key=${apiKey}&base=${fromCurrency}&symbols=${toCurrency}`;
    } else {
      url = `https://api.fixer.io/latest?access_key=${apiKey}&base=${fromCurrency}&symbols=${toCurrency}`;
    }

    const response = await axios.get(url, {
      timeout: 10000,
    });

    if (
      response.data &&
      response.data.rates &&
      response.data.rates[toCurrency]
    ) {
      return {
        rate: response.data.rates[toCurrency],
        date: response.data.date,
      };
    }

    throw new Error(
      `Exchange rate not found for ${fromCurrency} to ${toCurrency}`
    );
  }

  /**
   * Convert units (length, weight, temperature) - ALL LOCAL CALCULATIONS
   */
  convertUnit(amount, fromUnit, toUnit) {
    // Find the conversion category
    const category = this.findUnitCategory(fromUnit, toUnit);

    if (!category) {
      throw new Error(
        `Cannot convert ${fromUnit} to ${toUnit}. Units must be from the same category.`
      );
    }

    // Handle temperature conversions (special formulas)
    if (category === 'temperature') {
      return this.convertTemperature(amount, fromUnit, toUnit);
    }

    // Handle length, weight, volume conversions (factor-based)
    return this.convertWithFactors(amount, fromUnit, toUnit, category);
  }

  /**
   * Convert using multiplication factors (length, weight, volume, etc.)
   */
  convertWithFactors(amount, fromUnit, toUnit, category) {
    const conversions = this.getUnitConversions();
    const categoryUnits = conversions[category];

    const fromFactor = categoryUnits[fromUnit];
    const toFactor = categoryUnits[toUnit];

    if (fromFactor === undefined || toFactor === undefined) {
      throw new Error(
        `Conversion factors not found for ${fromUnit} to ${toUnit}`
      );
    }

    // Convert to base unit, then to target unit
    const baseAmount = amount * fromFactor;
    const convertedAmount = baseAmount / toFactor;

    return {
      amount: amount,
      fromUnit: fromUnit,
      toUnit: toUnit,
      convertedAmount: convertedAmount,
      category: category,
      formula: `${amount} ${fromUnit} × ${fromFactor} ÷ ${toFactor} = ${convertedAmount.toFixed(6)} ${toUnit}`,
      calculation: `Base: ${baseAmount} → Result: ${convertedAmount}`,
    };
  }

  /**
   * Convert temperature (LOCAL CALCULATION - special formulas for C, F, K, R)
   */
  convertTemperature(amount, fromUnit, toUnit) {
    // Normalize unit names
    const from = this.normalizeTemperatureUnit(fromUnit);
    const to = this.normalizeTemperatureUnit(toUnit);

    if (!from || !to) {
      throw new Error(
        `Unknown temperature unit. Supported: C, F, K, R (Celsius, Fahrenheit, Kelvin, Rankine)`
      );
    }

    let result;
    let formula;

    // Direct conversion formulas (no intermediate step for better accuracy)
    const conversionKey = `${from}_${to}`;

    switch (conversionKey) {
      // Celsius conversions
      case 'C_F':
        result = (amount * 9) / 5 + 32;
        formula = `(${amount}°C × 9/5) + 32`;
        break;
      case 'C_K':
        result = amount + 273.15;
        formula = `${amount}°C + 273.15`;
        break;
      case 'C_R':
        result = ((amount + 273.15) * 9) / 5;
        formula = `(${amount}°C + 273.15) × 9/5`;
        break;
      case 'C_C':
        result = amount;
        formula = `${amount}°C`;
        break;

      // Fahrenheit conversions
      case 'F_C':
        result = ((amount - 32) * 5) / 9;
        formula = `(${amount}°F - 32) × 5/9`;
        break;
      case 'F_K':
        result = ((amount - 32) * 5) / 9 + 273.15;
        formula = `((${amount}°F - 32) × 5/9) + 273.15`;
        break;
      case 'F_R':
        result = amount + 459.67;
        formula = `${amount}°F + 459.67`;
        break;
      case 'F_F':
        result = amount;
        formula = `${amount}°F`;
        break;

      // Kelvin conversions
      case 'K_C':
        result = amount - 273.15;
        formula = `${amount}K - 273.15`;
        break;
      case 'K_F':
        result = ((amount - 273.15) * 9) / 5 + 32;
        formula = `(${amount}K - 273.15) × 9/5 + 32`;
        break;
      case 'K_R':
        result = (amount * 9) / 5;
        formula = `${amount}K × 9/5`;
        break;
      case 'K_K':
        result = amount;
        formula = `${amount}K`;
        break;

      // Rankine conversions
      case 'R_C':
        result = ((amount - 491.67) * 5) / 9;
        formula = `(${amount}°R - 491.67) × 5/9`;
        break;
      case 'R_F':
        result = amount - 459.67;
        formula = `${amount}°R - 459.67`;
        break;
      case 'R_K':
        result = (amount * 5) / 9;
        formula = `${amount}°R × 5/9`;
        break;
      case 'R_R':
        result = amount;
        formula = `${amount}°R`;
        break;

      default:
        throw new Error(`Unsupported temperature conversion: ${from} to ${to}`);
    }

    return {
      amount: amount,
      fromUnit: fromUnit,
      toUnit: toUnit,
      convertedAmount: result,
      category: 'temperature',
      formula: `${formula} = ${result.toFixed(4)}°${to}`,
      calculation: `Direct conversion using temperature formula`,
    };
  }

  /**
   * Normalize temperature unit names
   */
  normalizeTemperatureUnit(unit) {
    const normalized = unit.toUpperCase();

    if (['C', 'CELSIUS', '°C'].includes(normalized)) return 'C';
    if (['F', 'FAHRENHEIT', '°F'].includes(normalized)) return 'F';
    if (['K', 'KELVIN'].includes(normalized)) return 'K';
    if (['R', 'RANKINE', '°R'].includes(normalized)) return 'R';

    return null;
  }

  /**
   * Get temperature conversion formula
   */
  getTemperatureFormula(from, to, input, output) {
    const formulas = {
      C_F: `(${input}°C × 9/5) + 32 = ${output.toFixed(2)}°F`,
      F_C: `(${input}°F - 32) × 5/9 = ${output.toFixed(2)}°C`,
      C_K: `${input}°C + 273.15 = ${output.toFixed(2)}K`,
      K_C: `${input}K - 273.15 = ${output.toFixed(2)}°C`,
      F_K: `((${input}°F - 32) × 5/9) + 273.15 = ${output.toFixed(2)}K`,
      K_F: `(${input}K - 273.15) × 9/5 + 32 = ${output.toFixed(2)}°F`,
    };

    const key = `${from.charAt(0)}_${to.charAt(0)}`;
    return formulas[key] || `${input} ${from} = ${output.toFixed(2)} ${to}`;
  }

  /**
   * Display conversion result
   */
  async displayConversionResult(result, options = {}) {
    console.log();

    if (result.category) {
      // Unit conversion result (LOCAL CALCULATION)
      console.log(chalk.cyan(`🔄 Unit Conversion (${result.category})`));
      console.log();

      // Format number display based on category
      let precision = 6;
      if (result.category === 'temperature') precision = 4;
      if (result.category === 'length' && result.convertedAmount > 1000)
        precision = 2;

      console.log(
        chalk.green(
          `${result.amount} ${result.fromUnit} = ${chalk.bold(result.convertedAmount.toFixed(precision))} ${result.toUnit}`
        )
      );

      if (options.verbose) {
        console.log();
        if (result.formula) {
          console.log(chalk.gray('Formula:'), result.formula);
        }
        if (result.calculation) {
          console.log(chalk.gray('Method:'), result.calculation);
        }
        console.log(chalk.gray('Type:'), 'Local calculation (no API required)');
      }
    } else {
      // Currency conversion result (API REQUIRED)
      console.log(chalk.cyan('💱 Currency Conversion'));
      console.log();
      console.log(
        chalk.green(
          `${result.amount} ${result.fromCurrency} = ${chalk.bold(result.convertedAmount.toFixed(2))} ${result.toCurrency}`
        )
      );
      console.log();
      console.log(
        chalk.gray('Exchange Rate:'),
        `1 ${result.fromCurrency} = ${result.rate} ${result.toCurrency}`
      );

      if (result.date) {
        console.log(chalk.gray('Date:'), result.date);
      }

      if (result.provider) {
        console.log(chalk.gray('Provider:'), result.provider);
      }

      if (result.cached) {
        console.log(chalk.yellow('📦 Data from cache'));
      } else {
        console.log(chalk.blue('🌐 Live data from API'));
      }

      if (options.verbose) {
        console.log();
        console.log(
          chalk.gray('Calculation:'),
          `${result.amount} × ${result.rate} = ${result.convertedAmount.toFixed(2)}`
        );
        console.log(
          chalk.gray('Type:'),
          'Dynamic exchange rate (API required)'
        );
      }
    }

    console.log();
  }

  /**
   * Show current exchange rates
   */
  async showExchangeRates() {
    console.log(chalk.cyan('💱 Current Exchange Rates (USD Base)'));
    console.log();

    const majorCurrencies = [
      'EUR',
      'GBP',
      'JPY',
      'CAD',
      'AUD',
      'CHF',
      'CNY',
      'INR',
    ];

    try {
      const table = new Table({
        head: [chalk.cyan('Currency'), chalk.cyan('Rate'), chalk.cyan('Name')],
        colWidths: [12, 15, 30],
      });

      for (const currency of majorCurrencies) {
        try {
          const result = await this.fetchExchangeRate('USD', currency);
          const rate = result.rate;
          const name = this.getCurrencyName(currency);
          table.push([currency, rate.toFixed(4), name]);
        } catch (error) {
          table.push([currency, 'N/A', this.getCurrencyName(currency)]);
        }
      }

      console.log(table.toString());
    } catch (error) {
      console.log(
        chalk.red('❌ Failed to fetch exchange rates:'),
        error.message
      );
    }
  }

  /**
   * Show favorite conversion pairs
   */
  async showFavorites() {
    try {
      const favorites = await configService.get('convert.favorites', []);

      if (favorites.length === 0) {
        console.log(chalk.yellow('📋 No favorite conversions saved'));
        console.log(
          chalk.gray('Add conversions to favorites using --add-favorite')
        );
        return;
      }

      console.log(chalk.cyan('⭐ Favorite Conversions'));
      console.log();

      const table = new Table({
        head: [
          chalk.cyan('#'),
          chalk.cyan('From'),
          chalk.cyan('To'),
          chalk.cyan('Type'),
        ],
        colWidths: [5, 10, 10, 15],
      });

      favorites.forEach((fav, index) => {
        table.push([(index + 1).toString(), fav.from, fav.to, fav.type]);
      });

      console.log(table.toString());
    } catch (error) {
      console.log(chalk.red('❌ Failed to load favorites:'), error.message);
    }
  }

  /**
   * Add conversion to favorites
   */
  async addToFavorites(from, to) {
    try {
      const favorites = await configService.get('convert.favorites', []);
      const type = this.getConversionType(from, to);

      // Check if already exists
      const exists = favorites.some(fav => fav.from === from && fav.to === to);
      if (exists) {
        console.log(chalk.yellow('⭐ Conversion already in favorites'));
        return;
      }

      favorites.push({
        from: from,
        to: to,
        type: type,
        addedAt: new Date().toISOString(),
      });

      await configService.set('convert.favorites', favorites);
      console.log(chalk.green('⭐ Added to favorites'));
    } catch (error) {
      console.log(chalk.red('❌ Failed to add to favorites:'), error.message);
    }
  }

  /**
   * Process batch conversions from file
   */
  async processBatchConversions(filePath) {
    const fs = require('fs-extra');

    try {
      console.log(chalk.cyan('📄 Processing batch conversions...'));

      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.split('\n').filter(line => line.trim());

      console.log();

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith('#')) continue;

        const parts = line.split(/\s+/);
        if (parts.length !== 3) {
          console.log(chalk.red(`❌ Invalid format on line ${i + 1}: ${line}`));
          continue;
        }

        const [amount, from, to] = parts;
        console.log(
          chalk.blue(`${i + 1}. Converting ${amount} ${from} to ${to}:`)
        );

        try {
          await this.execute(amount, from, to);
        } catch (error) {
          console.log(chalk.red(`   Error: ${error.message}`));
        }

        console.log();
      }
    } catch (error) {
      console.log(chalk.red('❌ Failed to process batch file:'), error.message);
    }
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return [
      'USD',
      'EUR',
      'GBP',
      'JPY',
      'CAD',
      'AUD',
      'CHF',
      'CNY',
      'INR',
      'KRW',
      'BRL',
      'MXN',
      'SGD',
      'HKD',
      'NOK',
      'SEK',
      'DKK',
      'PLN',
      'CZK',
      'HUF',
      'RON',
      'BGN',
      'HRK',
      'RUB',
      'TRY',
      'ZAR',
      'THB',
      'MYR',
      'IDR',
      'PHP',
      'NZD',
      'ILS',
      'EGP',
      'AED',
      'SAR',
      'QAR',
      'KWD',
      'BHD',
      'OMR',
      'JOD',
      'LBP',
      'PKR',
      'BDT',
      'LKR',
      'NPR',
      'AFN',
      'IRR',
      'IQD',
      'SYP',
      'YER',
    ];
  }

  /**
   * Get supported units with conversion factors (ALL LOCAL CALCULATIONS)
   */
  getSupportedUnits() {
    return {
      // Length conversions (base: meters)
      length: {
        // Metric
        MM: 0.001,
        MILLIMETER: 0.001,
        MILLIMETERS: 0.001,
        CM: 0.01,
        CENTIMETER: 0.01,
        CENTIMETERS: 0.01,
        M: 1,
        METER: 1,
        METERS: 1,
        KM: 1000,
        KILOMETER: 1000,
        KILOMETERS: 1000,

        // Imperial
        IN: 0.0254,
        INCH: 0.0254,
        INCHES: 0.0254,
        FT: 0.3048,
        FOOT: 0.3048,
        FEET: 0.3048,
        YD: 0.9144,
        YARD: 0.9144,
        YARDS: 0.9144,
        MI: 1609.344,
        MILE: 1609.344,
        MILES: 1609.344,

        // Nautical
        NM: 1852,
        NAUTICAL_MILE: 1852,
        NAUTICAL_MILES: 1852,
      },

      // Weight conversions (base: grams)
      weight: {
        // Metric
        MG: 0.001,
        MILLIGRAM: 0.001,
        MILLIGRAMS: 0.001,
        G: 1,
        GRAM: 1,
        GRAMS: 1,
        KG: 1000,
        KILOGRAM: 1000,
        KILOGRAMS: 1000,
        TONNE: 1000000,
        TONNES: 1000000,
        MT: 1000000,

        // Imperial
        OZ: 28.3495231,
        OUNCE: 28.3495231,
        OUNCES: 28.3495231,
        LB: 453.59237,
        LBS: 453.59237,
        POUND: 453.59237,
        POUNDS: 453.59237,
        ST: 6350.29318,
        STONE: 6350.29318,
        STONES: 6350.29318,
        TON: 907184.74,
        TONS: 907184.74,
        SHORT_TON: 907184.74,
      },

      // Volume conversions (base: liters)
      volume: {
        // Metric
        ML: 0.001,
        MILLILITER: 0.001,
        MILLILITERS: 0.001,
        L: 1,
        LITER: 1,
        LITERS: 1,
        LITRE: 1,
        LITRES: 1,

        // US Liquid
        FL_OZ: 0.0295735,
        FLUID_OUNCE: 0.0295735,
        FLUID_OUNCES: 0.0295735,
        CUP: 0.236588,
        CUPS: 0.236588,
        PINT: 0.473176,
        PINTS: 0.473176,
        PT: 0.473176,
        QUART: 0.946353,
        QUARTS: 0.946353,
        QT: 0.946353,
        GALLON: 3.78541,
        GALLONS: 3.78541,
        GAL: 3.78541,

        // Imperial
        IMP_FL_OZ: 0.0284131,
        IMP_PINT: 0.568261,
        IMP_QUART: 1.13652,
        IMP_GALLON: 4.54609,
      },

      // Area conversions (base: square meters)
      area: {
        // Metric
        SQ_MM: 0.000001,
        SQ_CM: 0.0001,
        SQ_M: 1,
        SQ_KM: 1000000,
        HECTARE: 10000,
        HA: 10000,

        // Imperial
        SQ_IN: 0.00064516,
        SQ_FT: 0.092903,
        SQ_YD: 0.836127,
        ACRE: 4046.86,
        ACRES: 4046.86,
        SQ_MILE: 2589988.11,
      },

      // Temperature (special handling - no conversion factors)
      temperature: {
        C: 1,
        CELSIUS: 1,
        '°C': 1,
        F: 1,
        FAHRENHEIT: 1,
        '°F': 1,
        K: 1,
        KELVIN: 1,
        R: 1,
        RANKINE: 1,
        '°R': 1,
      },

      // Time conversions (base: seconds)
      time: {
        MS: 0.001,
        MILLISECOND: 0.001,
        MILLISECONDS: 0.001,
        S: 1,
        SEC: 1,
        SECOND: 1,
        SECONDS: 1,
        MIN: 60,
        MINUTE: 60,
        MINUTES: 60,
        H: 3600,
        HR: 3600,
        HOUR: 3600,
        HOURS: 3600,
        D: 86400,
        DAY: 86400,
        DAYS: 86400,
        WK: 604800,
        WEEK: 604800,
        WEEKS: 604800,
        YR: 31536000,
        YEAR: 31536000,
        YEARS: 31536000,
      },
    };
  }

  /**
   * Get unit conversions object
   */
  getUnitConversions() {
    return this.getSupportedUnits();
  }

  /**
   * Get currency name
   */
  getCurrencyName(code) {
    const names = {
      USD: 'US Dollar',
      EUR: 'Euro',
      GBP: 'British Pound',
      JPY: 'Japanese Yen',
      CAD: 'Canadian Dollar',
      AUD: 'Australian Dollar',
      CHF: 'Swiss Franc',
      CNY: 'Chinese Yuan',
      INR: 'Indian Rupee',
      KRW: 'South Korean Won',
      BRL: 'Brazilian Real',
      MXN: 'Mexican Peso',
      SGD: 'Singapore Dollar',
      HKD: 'Hong Kong Dollar',
      NOK: 'Norwegian Krone',
      SEK: 'Swedish Krona',
      DKK: 'Danish Krone',
      PLN: 'Polish Złoty',
      CZK: 'Czech Koruna',
    };
    return names[code] || code;
  }
}

module.exports = new ConvertCommand();
