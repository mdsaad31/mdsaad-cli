# Internationalization (i18n) System

The mdsaad CLI tool includes a comprehensive internationalization system supporting 9 languages with RTL (Right-to-Left) support, locale detection, pluralization, and advanced translation features.

## Supported Languages

| Code | Language | Native Name | Direction | Status      |
| ---- | -------- | ----------- | --------- | ----------- |
| `en` | English  | English     | LTR       | ✅ Complete |
| `hi` | Hindi    | हिंदी       | LTR       | ✅ Complete |
| `es` | Spanish  | Español     | LTR       | ✅ Complete |
| `fr` | French   | Français    | LTR       | ✅ Complete |
| `de` | German   | Deutsch     | LTR       | ✅ Complete |
| `zh` | Chinese  | 中文(简体)  | LTR       | ✅ Complete |
| `ja` | Japanese | 日本語      | LTR       | ✅ Complete |
| `ru` | Russian  | Русский     | LTR       | ✅ Complete |
| `ar` | Arabic   | العربية     | RTL       | ✅ Complete |

## Features

### 🌍 Multi-Language Support

- **9 Languages**: Comprehensive coverage of major world languages
- **RTL Support**: Full support for right-to-left languages (Arabic)
- **Unicode Support**: Proper handling of all character sets
- **Locale Detection**: Automatic detection from system environment

### 🔄 Dynamic Language Switching

- **Runtime Switching**: Change languages without restarting
- **Persistent Settings**: Language preference saved to configuration
- **Fallback System**: Graceful degradation to English for missing translations

### 📝 Advanced Translation Features

- **Parameter Interpolation**: `{{param}}` syntax for dynamic content
- **Pluralization**: Language-specific plural rules
- **Nested Keys**: Hierarchical translation organization
- **Validation**: Translation completeness checking

### 🛠️ Developer Tools

- **Interactive Manager**: CLI utility for translation management
- **Export/Import**: CSV, TSV, JSON format support
- **Statistics**: Translation coverage and file size metrics
- **Validation**: Missing translation detection

## Usage

### Command Line Interface

#### List Available Languages

```bash
mdsaad language --list
# or
mdsaad lang --list
```

#### Show Current Language

```bash
mdsaad language --current
# or
mdsaad lang --current
```

#### Set Language

```bash
mdsaad language --set es    # Spanish
mdsaad language --set hi    # Hindi
mdsaad language --set ar    # Arabic (RTL)
mdsaad language --set zh    # Chinese
```

#### Interactive Selection

```bash
mdsaad language
# Opens interactive language selection menu
```

### Programmatic Usage

#### Basic Translation

```javascript
const i18n = require('./src/services/i18n');

await i18n.initialize();

// Simple translation
const message = i18n.translate('global.appName');

// Translation with parameters
const greeting = i18n.translate('test.message', { name: 'John' });
// Output: "Hello John" (in current language)
```

#### Language Management

```javascript
// Check supported languages
const languages = i18n.getSupportedLanguages();
console.log(languages);
// [{ code: 'en', name: 'English', direction: 'ltr' }, ...]

// Change language
await i18n.setLanguage('es');

// Get current language info
const current = i18n.getCurrentLanguage();
console.log(current);
// { code: 'es', name: 'Español', direction: 'ltr' }
```

#### Pluralization

```javascript
// Automatic plural form selection
const items1 = i18n.translatePlural('items.count', 1); // "1 item"
const items5 = i18n.translatePlural('items.count', 5); // "5 items"
const items0 = i18n.translatePlural('items.count', 0); // "0 items"

// With additional parameters
const message = i18n.translatePlural('notifications', count, {
  user: 'Alice',
});
```

#### Locale-aware Formatting

```javascript
// Format numbers according to current locale
const price = i18n.formatNumber(1234.56, {
  style: 'currency',
  currency: 'USD',
});

// Format dates according to current locale
const date = i18n.formatDate(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
```

## Translation File Structure

### File Organization

```
src/assets/translations/
├── en.json     # English (base language)
├── hi.json     # Hindi
├── es.json     # Spanish
├── fr.json     # French
├── de.json     # German
├── zh.json     # Chinese (Simplified)
├── ja.json     # Japanese
├── ru.json     # Russian
└── ar.json     # Arabic
```

### Translation File Format

```json
{
  "meta": {
    "language": "English",
    "locale": "en",
    "version": "1.0.0",
    "direction": "ltr"
  },
  "global": {
    "appName": "mdsaad CLI Tool",
    "success": "Success",
    "loading": "Loading..."
  },
  "commands": {
    "calculate": {
      "description": "Perform mathematical calculations",
      "examples": {
        "basic": "Basic arithmetic: mdsaad calculate '2 + 3'"
      }
    }
  },
  "errors": {
    "commandFailed": "Command failed: {{error}}"
  }
}
```

### Pluralization Support

```json
{
  "items": {
    "one": "{{count}} item",
    "other": "{{count}} items"
  },
  "notifications": {
    "zero": "No new messages",
    "one": "{{count}} new message for {{user}}",
    "other": "{{count}} new messages for {{user}}"
  }
}
```

## Locale Detection

The system automatically detects the user's preferred language from multiple sources:

### Detection Priority

1. **Environment Variables**:
   - `LANG`
   - `LANGUAGE`
   - `LC_ALL`
   - `LC_MESSAGES`
   - `LC_CTYPE`

2. **System Locale** (Node.js Intl API)
3. **Language Family Fallbacks**:
   - Portuguese → Spanish
   - Italian → Spanish
   - Dutch → German
   - Korean → Japanese

### Language Code Mapping

```javascript
// Examples of automatic detection
'en_US.UTF-8' → 'en'
'es_ES'       → 'es'
'zh-CN'       → 'zh'
'pt_BR'       → 'es' (fallback)
```

## Management Tools

### I18N Manager Utility

```bash
node utils/i18n-manager.js
```

Interactive management system with features:

- 🌐 Show current language settings
- 🔄 Change language interactively
- 📊 View translation statistics
- 🔍 Test translation keys across languages
- 📋 List all supported languages
- 🔧 Validate translation completeness
- 📤 Export translations (CSV/TSV/JSON)

### Translation Validation

```bash
# Check for missing translations
node utils/i18n-manager.js
# Select "Validate Translations"
```

Sample validation output:

```
🔧 Validating Translations...

✅ Español (es): Complete
✅ Français (fr): Complete
⚠️  हिंदी (hi): Missing 3 keys
   Missing: commands.ai.examples.code, errors.validationError
❌ العربية (ar): File missing
```

### Export Translations

```bash
# Export to CSV for external editing
node utils/i18n-manager.js
# Select "Export Translations" → "CSV"
```

## RTL (Right-to-Left) Support

### Arabic Language Support

The system includes full RTL support for Arabic:

```javascript
// Detect RTL languages
const isRTL = i18n.getLanguageDirection('ar') === 'rtl';

// Get direction info
const langInfo = i18n.getCurrentLanguage();
console.log(langInfo.direction); // 'rtl' for Arabic
```

### RTL Considerations

- **Text Direction**: Automatic detection and metadata
- **Layout Adjustments**: Direction information for UI frameworks
- **Unicode Support**: Proper handling of Arabic script
- **Mixed Content**: Support for LTR text within RTL context

## Configuration Integration

### Persistent Language Settings

```javascript
// Language preference is automatically saved
await i18n.setLanguage('es');

// Restored on next CLI invocation
await i18n.initialize(); // Loads saved preference
```

### Configuration File

```json
{
  "language": "es",
  "user": {
    "name": "User"
  },
  "apiKeys": {
    "openai": "sk-..."
  }
}
```

## Pluralization Rules

### Language-Specific Rules

#### English, Spanish, French, German

- **one**: n = 1
- **other**: n ≠ 1

#### Hindi, French

- **one**: n = 0 or n = 1
- **other**: n > 1

#### Russian (Complex)

- **one**: n % 10 = 1 and n % 100 ≠ 11
- **few**: n % 10 ∈ {2,3,4} and n % 100 ∉ {12,13,14}
- **other**: all other cases

#### Arabic (Most Complex)

- **zero**: n = 0
- **one**: n = 1
- **two**: n = 2
- **few**: n % 100 ∈ {3...10}
- **many**: n % 100 ∈ {11...99}
- **other**: all other cases

#### Chinese, Japanese

- **other**: No plural distinctions

## Error Handling

### Graceful Degradation

```javascript
// Missing translation falls back to English
i18n.translate('missing.key'); // Returns English version

// Missing English falls back to key
i18n.translate('completely.missing'); // Returns 'completely.missing'

// File loading errors
// Falls back to in-memory basic translations
```

### Error Scenarios

1. **Missing Translation Files**: Creates basic fallback
2. **Malformed JSON**: Reports error, continues with English
3. **Unsupported Language**: Throws clear error message
4. **Network Issues**: Not applicable (local files)

## Performance Considerations

### Loading Strategy

- **Lazy Loading**: Languages loaded only when needed
- **Memory Efficient**: Only active language + English in memory
- **Caching**: Translation lookups are O(1) after parsing

### File Sizes

- **English (base)**: ~8KB
- **Other languages**: ~6-10KB each
- **Total package**: ~65KB for all translations

### Benchmarks

```
Translation lookup: <1ms
Language switching: ~10ms
File loading: ~5ms
Pluralization: <1ms
```

## Best Practices

### For Developers

#### Translation Keys

```javascript
// ✅ Good: Hierarchical, descriptive
'commands.calculate.description';
'errors.validation.required';
'prompts.confirm.delete';

// ❌ Bad: Flat, unclear
'calc_desc';
'err1';
'confirm';
```

#### Parameter Usage

```javascript
// ✅ Good: Clear parameter names
i18n.translate('welcome.message', {
  userName: 'Alice',
  itemCount: 5,
});

// ❌ Bad: Unclear parameters
i18n.translate('msg', { a: 'Alice', b: 5 });
```

#### Pluralization

```javascript
// ✅ Good: Use translatePlural for counts
i18n.translatePlural('items.found', count);

// ❌ Bad: Manual plural handling
const msg = count === 1 ? 'item' : 'items';
```

### For Translators

#### Translation Guidelines

1. **Maintain Context**: Understand where text appears
2. **Preserve Parameters**: Keep `{{param}}` placeholders intact
3. **Cultural Adaptation**: Adapt content to local culture
4. **Consistency**: Use consistent terminology
5. **Length Considerations**: Account for text expansion/contraction

#### Common Patterns

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "status": {
    "loading": "Loading...",
    "success": "Success",
    "error": "Error"
  }
}
```

## Testing

### Automated Tests

```bash
npm test -- --testPathPatterns=i18n
```

Test coverage includes:

- ✅ Language loading and switching
- ✅ Translation parameter interpolation
- ✅ Pluralization rules for all languages
- ✅ Locale detection scenarios
- ✅ Error handling and fallbacks
- ✅ RTL language support
- ✅ Configuration integration

### Manual Testing

```bash
# Test different languages
mdsaad language --set es && mdsaad --help
mdsaad language --set ar && mdsaad calculate --help
mdsaad language --set zh && mdsaad version
```

## Extending the System

### Adding New Languages

1. **Check Support**: Verify language is in `supportedLanguages` Map
2. **Create Translation File**: Add `{code}.json` in translations directory
3. **Implement Pluralization**: Add rule to `translatePlural` method
4. **Test Thoroughly**: Verify all features work
5. **Update Documentation**: Add to language table

### Adding New Translation Keys

1. **Add to English**: Start with base translation in `en.json`
2. **Translate All Languages**: Update all language files
3. **Test Usage**: Verify parameter interpolation works
4. **Run Validation**: Use i18n-manager to check completeness

### Custom Formatting

```javascript
// Add custom locale-aware formatting
formatCurrency(amount) {
  const locale = this.getLocaleForFormatting();
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: this.getCurrencyForLocale()
  }).format(amount);
}
```

## Troubleshooting

### Common Issues

#### Language Not Persisting

```bash
# Check configuration
mdsaad config

# Manually set in config
node -e "
const config = require('./src/services/config');
config.initialize().then(() => {
  config.set('language', 'es');
  return config.save();
});
"
```

#### Missing Translations

```bash
# Validate completeness
node utils/i18n-manager.js
# Select "Validate Translations"
```

#### RTL Display Issues

- Ensure terminal supports RTL rendering
- Check font support for Arabic characters
- Verify terminal encoding (UTF-8)

### Debug Mode

```bash
# Enable debug logging
mdsaad --debug language --current
```

## Migration Guide

### From Basic to Advanced i18n

If migrating from a simple string-based system:

1. **Audit Current Strings**: Identify all user-facing text
2. **Create Key Structure**: Design hierarchical key naming
3. **Extract to English**: Move strings to `en.json`
4. **Update Code**: Replace strings with `i18n.translate()` calls
5. **Add Languages**: Translate to target languages
6. **Test Thoroughly**: Verify all functionality

### Version Compatibility

- **v1.0.0+**: Full i18n system with 9 languages
- **v0.x**: Basic English-only support
- **Migration**: Automatic, no breaking changes

## Resources

### External Tools

- **Google Translate**: For initial translations (manual review required)
- **Crowdin**: For collaborative translation management
- **Transifex**: Alternative translation platform
- **i18n-ally**: VS Code extension for translation editing

### Standards

- **ICU Message Format**: For advanced pluralization
- **CLDR**: Unicode locale data repository
- **BCP 47**: Language tags specification
- **ISO 639**: Language codes standard

---

_The i18n system in mdsaad CLI provides enterprise-grade internationalization features while maintaining simplicity and ease of use. It's designed to scale from simple applications to complex multi-language deployments._
