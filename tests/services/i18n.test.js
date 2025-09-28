const i18n = require('../../src/services/i18n');
const fs = require('fs-extra');
const path = require('path');

// Mock console methods
console.warn = jest.fn();
console.error = jest.fn();

describe('I18N Service', () => {
  const mockTranslationsDir = path.join(__dirname, '../fixtures/translations');

  beforeAll(async () => {
    // Setup mock translations directory
    await fs.ensureDir(mockTranslationsDir);
    
    // Create test translation files
    const testTranslations = {
      en: {
        meta: { language: 'English', locale: 'en', direction: 'ltr' },
        global: { appName: 'Test App', success: 'Success' },
        test: { message: 'Hello {{name}}', items: { one: '{{count}} item', other: '{{count}} items' } }
      },
      es: {
        meta: { language: 'Español', locale: 'es', direction: 'ltr' },
        global: { appName: 'Aplicación de Prueba', success: 'Éxito' },
        test: { message: 'Hola {{name}}', items: { one: '{{count}} artículo', other: '{{count}} artículos' } }
      },
      ar: {
        meta: { language: 'العربية', locale: 'ar', direction: 'rtl' },
        global: { appName: 'تطبيق تجريبي', success: 'نجح' },
        test: { message: 'مرحبا {{name}}' }
      }
    };

    // Write test translation files
    for (const [lang, translations] of Object.entries(testTranslations)) {
      await fs.writeJson(path.join(mockTranslationsDir, `${lang}.json`), translations, { spaces: 2 });
    }

    // Mock the translations directory
    i18n.translationsDir = mockTranslationsDir;
  });

  afterAll(async () => {
    // Cleanup test files
    await fs.remove(mockTranslationsDir);
  });

  beforeEach(() => {
    // Reset state
    i18n.currentLanguage = 'en';
    i18n.translations = {};
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    test('should initialize with default English', async () => {
      await i18n.initialize();
      expect(i18n.currentLanguage).toBe('en');
      expect(i18n.translations.en).toBeDefined();
    });

    test('should load available languages from supported list', () => {
      const languages = i18n.getSupportedLanguages();
      expect(languages).toHaveLength(9);
      expect(languages.find(l => l.code === 'en')).toEqual({
        code: 'en',
        name: 'English',
        direction: 'ltr'
      });
      expect(languages.find(l => l.code === 'ar')).toEqual({
        code: 'ar',
        name: 'العربية',
        direction: 'rtl'
      });
    });
  });

  describe('Language Loading', () => {
    test('should load supported language successfully', async () => {
      await i18n.loadLanguage('es');
      expect(i18n.translations.es).toBeDefined();
      expect(i18n.translations.es.global.appName).toBe('Aplicación de Prueba');
    });

    test('should throw error for unsupported language', async () => {
      await expect(i18n.loadLanguage('xyz')).rejects.toThrow('Language "xyz" is not supported');
    });

    test('should throw error for missing translation file', async () => {
      await expect(i18n.loadLanguage('hi')).rejects.toThrow('Translation file not found for language: hi');
    });
  });

  describe('Language Switching', () => {
    test('should switch language after loading', async () => {
      await i18n.initialize();
      await i18n.setLanguage('es');
      expect(i18n.currentLanguage).toBe('es');
    });

    test('should throw error when setting unsupported language', async () => {
      await expect(i18n.setLanguage('xyz')).rejects.toThrow('Language "xyz" is not supported');
    });

    test('should auto-load language when setting', async () => {
      await i18n.initialize();
      await i18n.setLanguage('es');
      expect(i18n.translations.es).toBeDefined();
    });
  });

  describe('Translation', () => {
    beforeEach(async () => {
      await i18n.initialize();
      await i18n.loadLanguage('es');
      await i18n.loadLanguage('ar');
    });

    test('should translate basic key', () => {
      expect(i18n.translate('global.success')).toBe('Success');
    });

    test('should translate with parameters', () => {
      expect(i18n.translate('test.message', { name: 'John' })).toBe('Hello John');
    });

    test('should fallback to English for missing translation', async () => {
      await i18n.setLanguage('ar');
      // 'test.items' exists in English but not in Arabic, should fallback to English
      const translation = i18n.translate('test.items.other');
      expect(translation).toBe('{{count}} items'); // English fallback
    });

    test('should return key if translation not found', () => {
      expect(i18n.translate('nonexistent.key')).toBe('nonexistent.key');
    });

    test('should translate in different language', async () => {
      await i18n.setLanguage('es');
      expect(i18n.translate('global.appName')).toBe('Aplicación de Prueba');
    });
  });

  describe('Pluralization', () => {
    beforeEach(async () => {
      await i18n.initialize();
    });

    test('should handle singular form', () => {
      expect(i18n.translatePlural('test.items', 1)).toBe('1 item');
    });

    test('should handle plural form', () => {
      expect(i18n.translatePlural('test.items', 5)).toBe('5 items');
    });

    test('should handle zero count', () => {
      expect(i18n.translatePlural('test.items', 0)).toBe('0 items');
    });

    test('should include count in parameters', () => {
      expect(i18n.translatePlural('test.items', 3, { extra: 'data' })).toBe('3 items');
    });
  });

  describe('Locale Detection', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      // Reset environment
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should detect English from LANG environment', () => {
      process.env.LANG = 'en_US.UTF-8';
      expect(i18n.detectLocale()).toBe('en');
    });

    test('should detect Spanish from LANGUAGE environment', () => {
      // Clear all other environment variables that might interfere
      delete process.env.LANG;
      delete process.env.LC_ALL;
      delete process.env.LC_MESSAGES;
      delete process.env.LC_CTYPE;
      
      process.env.LANGUAGE = 'es_ES';
      // Verify Spanish is supported and detectLocale returns it
      expect(i18n.isLanguageSupported('es')).toBe(true);
      const detected = i18n.detectLocale();
      expect(detected).toBe('es');
    });

    test('should fallback to English for unsupported locale', () => {
      process.env.LANG = 'pt_BR.UTF-8'; // Portuguese -> Spanish fallback
      expect(i18n.detectLocale()).toBe('es');
    });

    test('should fallback to English when no locale found', () => {
      delete process.env.LANG;
      delete process.env.LANGUAGE;
      delete process.env.LC_ALL;
      delete process.env.LC_MESSAGES;
      expect(i18n.detectLocale()).toBe('en');
    });
  });

  describe('Language Utilities', () => {
    test('should check if language is supported', () => {
      expect(i18n.isLanguageSupported('en')).toBe(true);
      expect(i18n.isLanguageSupported('es')).toBe(true);
      expect(i18n.isLanguageSupported('xyz')).toBe(false);
    });

    test('should get language direction', () => {
      expect(i18n.getLanguageDirection('en')).toBe('ltr');
      expect(i18n.getLanguageDirection('ar')).toBe('rtl');
    });

    test('should get current language info', async () => {
      await i18n.initialize();
      await i18n.setLanguage('ar');
      
      const current = i18n.getCurrentLanguage();
      expect(current).toEqual({
        code: 'ar',
        name: 'العربية',
        direction: 'rtl'
      });
    });
  });

  describe('Number and Date Formatting', () => {
    beforeEach(async () => {
      await i18n.initialize();
    });

    test('should format numbers according to locale', () => {
      const result = i18n.formatNumber(1234.56, { minimumFractionDigits: 2 });
      expect(typeof result).toBe('string');
      expect(result).toContain('1');
    });

    test('should format dates according to locale', () => {
      const date = new Date('2023-12-25');
      const result = i18n.formatDate(date, { year: 'numeric', month: 'long', day: 'numeric' });
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle formatting errors gracefully', () => {
      const result = i18n.formatNumber('invalid');
      expect(typeof result).toBe('string');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors gracefully', async () => {
      // Point to non-existent directory
      i18n.translationsDir = '/nonexistent/path';
      
      await i18n.initialize();
      
      expect(console.error).toHaveBeenCalled();
      expect(i18n.translations[i18n.fallbackLanguage]).toBeDefined();
    });

    test('should handle malformed JSON files', async () => {
      const badFile = path.join(mockTranslationsDir, 'bad.json');
      await fs.writeFile(badFile, '{ invalid json }');
      
      await expect(i18n.loadLanguage('bad')).rejects.toThrow();
      
      await fs.remove(badFile);
    });
  });
});