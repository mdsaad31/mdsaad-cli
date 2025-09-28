/**
 * Internationalization Service
 * Handles multi-language support and translation management
 */

const path = require('path');
const fs = require('fs-extra');

class I18NService {
  constructor() {
    this.currentLanguage = 'en';
    this.translations = {};
    this.fallbackLanguage = 'en';
    this.translationsDir = path.join(__dirname, '../assets/translations');
    this.supportedLanguages = new Map([
      ['en', 'English'],
      ['hi', 'हिंदी'],
      ['es', 'Español'],
      ['fr', 'Français'],
      ['de', 'Deutsch'],
      ['zh', '中文(简体)'],
      ['ja', '日本語'],
      ['ru', 'Русский'],
      ['ar', 'العربية']
    ]);
    this.rtlLanguages = new Set(['ar']); // Right-to-left languages
  }

  async initialize() {
    try {
      // Load default English translations first
      await this.loadLanguage(this.fallbackLanguage);
      
      // Detect system locale
      const systemLocale = this.detectLocale();
      if (systemLocale && systemLocale !== this.fallbackLanguage && this.isLanguageSupported(systemLocale)) {
        try {
          await this.loadLanguage(systemLocale);
          this.currentLanguage = systemLocale;
        } catch (error) {
          // Fallback to English if system locale loading fails
          console.warn(`Failed to load language ${systemLocale}, using English`);
        }
      }
      
    } catch (error) {
      console.error('Failed to initialize i18n service:', error.message);
      // Create basic fallback translations in memory
      this.translations[this.fallbackLanguage] = this.getBasicTranslations();
    }
  }

  async loadLanguage(language) {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Language "${language}" is not supported`);
    }

    const translationFile = path.join(this.translationsDir, `${language}.json`);
    
    if (await fs.pathExists(translationFile)) {
      try {
        const translations = await fs.readJson(translationFile);
        this.translations[language] = translations;
      } catch (error) {
        throw new Error(`Failed to parse translation file for ${language}: ${error.message}`);
      }
    } else {
      throw new Error(`Translation file not found for language: ${language}`);
    }
  }

  async setLanguage(language) {
    if (!this.isLanguageSupported(language)) {
      throw new Error(`Language "${language}" is not supported`);
    }

    if (!this.translations[language]) {
      await this.loadLanguage(language);
    }
    
    this.currentLanguage = language;
  }

  isLanguageSupported(language) {
    return this.supportedLanguages.has(language);
  }

  getSupportedLanguages() {
    return Array.from(this.supportedLanguages.entries()).map(([code, name]) => ({
      code,
      name,
      direction: this.getLanguageDirection(code)
    }));
  }

  getLanguageDirection(language) {
    return this.rtlLanguages.has(language) ? 'rtl' : 'ltr';
  }

  getCurrentLanguage() {
    return {
      code: this.currentLanguage,
      name: this.supportedLanguages.get(this.currentLanguage),
      direction: this.getLanguageDirection(this.currentLanguage)
    };
  }

  translate(key, params = {}) {
    const translation = this.getTranslation(key, this.currentLanguage) || 
                       this.getTranslation(key, this.fallbackLanguage) || 
                       key;
    
    // Ensure translation is a string
    const translationStr = typeof translation === 'string' ? translation : String(translation);
    
    // Replace parameters in translation
    return translationStr.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : match;
    });
  }

  getTranslation(key, language) {
    const keys = key.split('.');
    let value = this.translations[language];
    
    for (const k of keys) {
      if (value && typeof value === 'object' && value.hasOwnProperty(k)) {
        value = value[k];
      } else {
        return null;
      }
    }
    
    // Only return strings or null, not objects
    return typeof value === 'string' ? value : null;
  }

  detectLocale() {
    // Try multiple sources for locale detection
    const sources = [
      process.env.LANG,
      process.env.LANGUAGE,
      process.env.LC_ALL,
      process.env.LC_MESSAGES,
      // Windows specific
      process.env.LC_CTYPE,
      // Detect from system (Node.js 16+)
      typeof Intl !== 'undefined' && Intl.DateTimeFormat && 
        Intl.DateTimeFormat().resolvedOptions().locale
    ];

    for (const locale of sources) {
      if (locale) {
        // Extract language code (e.g., 'en_US.UTF-8' -> 'en', 'en-US' -> 'en')
        const langCode = locale.split(/[_.-]/)[0].toLowerCase();
        
        // Check if we support this language
        if (this.isLanguageSupported(langCode)) {
          return langCode;
        }

        // Try language family mappings
        const familyMap = {
          'zh-cn': 'zh',
          'zh-hans': 'zh',
          'zh-sg': 'zh',
          'pt': 'es', // Fallback Portuguese to Spanish
          'it': 'es', // Fallback Italian to Spanish
          'ca': 'es', // Fallback Catalan to Spanish
          'nl': 'de', // Fallback Dutch to German
          'no': 'de', // Fallback Norwegian to German
          'da': 'de', // Fallback Danish to German
          'sv': 'de', // Fallback Swedish to German
          'ko': 'ja', // Fallback Korean to Japanese
          'th': 'en', // Fallback Thai to English
          'vi': 'en', // Fallback Vietnamese to English
        };

        if (familyMap[langCode] && this.isLanguageSupported(familyMap[langCode])) {
          return familyMap[langCode];
        }
      }
    }
    
    return this.fallbackLanguage;
  }

  getAvailableLanguages() {
    return Object.keys(this.translations);
  }

  // Enhanced translation method with pluralization support
  translatePlural(key, count, params = {}) {
    const rules = {
      'en': (n) => n === 1 ? 'one' : 'other',
      'hi': (n) => n === 0 || n === 1 ? 'one' : 'other',
      'es': (n) => n === 1 ? 'one' : 'other',
      'fr': (n) => n === 0 || n === 1 ? 'one' : 'other',
      'de': (n) => n === 1 ? 'one' : 'other',
      'zh': (n) => 'other', // Chinese has no plural forms
      'ja': (n) => 'other', // Japanese has no plural forms
      'ru': (n) => {
        if (n % 10 === 1 && n % 100 !== 11) return 'one';
        if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'few';
        return 'other';
      },
      'ar': (n) => {
        if (n === 0) return 'zero';
        if (n === 1) return 'one';
        if (n === 2) return 'two';
        if (n % 100 >= 3 && n % 100 <= 10) return 'few';
        if (n % 100 >= 11 && n % 100 <= 99) return 'many';
        return 'other';
      }
    };

    const rule = rules[this.currentLanguage] || rules['en'];
    const form = rule(count);
    const pluralKey = `${key}.${form}`;
    
    // Try plural form first, then fallback to singular
    const translation = this.getTranslation(pluralKey, this.currentLanguage) ||
                       this.getTranslation(key, this.currentLanguage) ||
                       this.getTranslation(pluralKey, this.fallbackLanguage) ||
                       this.getTranslation(key, this.fallbackLanguage) ||
                       key;

    // Replace parameters including count
    const allParams = { ...params, count };
    return translation.replace(/\{\{(\w+)\}\}/g, (match, paramKey) => {
      return allParams[paramKey] !== undefined ? allParams[paramKey] : match;
    });
  }

  // Format numbers according to locale
  formatNumber(number, options = {}) {
    try {
      const locale = this.getLocaleForFormatting();
      return new Intl.NumberFormat(locale, options).format(number);
    } catch (error) {
      // Fallback to simple string conversion
      return number.toString();
    }
  }

  // Format dates according to locale
  formatDate(date, options = {}) {
    try {
      const locale = this.getLocaleForFormatting();
      return new Intl.DateTimeFormat(locale, options).format(new Date(date));
    } catch (error) {
      // Fallback to ISO string
      return new Date(date).toISOString();
    }
  }

  // Get proper locale string for Intl formatting
  getLocaleForFormatting() {
    const localeMap = {
      'en': 'en-US',
      'hi': 'hi-IN',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'zh': 'zh-CN',
      'ja': 'ja-JP',
      'ru': 'ru-RU',
      'ar': 'ar-SA'
    };
    
    return localeMap[this.currentLanguage] || 'en-US';
  }

  getBasicTranslations() {
    return {
      global: {
        version: 'Show version information',
        language: 'Set interface language',
        verbose: 'Enable verbose output',
        debug: 'Enable debug mode',
        help: 'Show help information'
      },
      commands: {
        calculate: {
          description: 'Perform mathematical calculations',
          precision: 'Number of decimal places',
          verbose: 'Show step-by-step calculation'
        },
        ai: {
          description: 'Interact with AI models',
          model: 'AI model to use',
          stream: 'Stream response in real-time',
          temperature: 'Response creativity (0.0-1.0)',
          maxTokens: 'Maximum response length',
          context: 'Conversation context'
        },
        show: {
          description: 'Display ASCII art',
          animated: 'Show animated version',
          color: 'Color scheme to apply',
          width: 'Display width'
        },
        weather: {
          description: 'Get weather information',
          detailed: 'Show detailed weather info',
          units: 'Temperature units (metric/imperial)',
          alerts: 'Show weather alerts'
        },
        convert: {
          description: 'Convert currencies and units',
          date: 'Historical date for conversion',
          batch: 'Process multiple conversions'
        },
        version: {
          description: 'Show version information'
        }
      },
      errors: {
        command_failed: 'Command failed: {{error}}',
        invalid_input: 'Invalid input provided',
        network_error: 'Network connection failed',
        api_error: 'API request failed'
      },
      update: {
        available: 'Update available: {{current}} → {{latest}}'
      }
    };
  }
}

module.exports = new I18NService();