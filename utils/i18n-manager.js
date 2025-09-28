/**
 * I18N Management Utility
 * Interactive command-line utility for managing internationalization
 */

const inquirer = require('inquirer');
const chalk = require('chalk');
const fs = require('fs-extra');
const path = require('path');
const i18n = require('../src/services/i18n');

class I18NManager {
  constructor() {
    this.translationsDir = path.join(__dirname, '../src/assets/translations');
  }

  async showMainMenu() {
    console.log(chalk.blue.bold('\n📝 I18N Management System\n'));
    
    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: '🌐 Show Current Language', value: 'current' },
          { name: '🔄 Change Language', value: 'change' },
          { name: '📊 Show Language Statistics', value: 'stats' },
          { name: '🔍 Test Translation Keys', value: 'test' },
          { name: '📋 List All Languages', value: 'list' },
          { name: '🔧 Validate Translations', value: 'validate' },
          { name: '📤 Export Translations', value: 'export' },
          { name: '❌ Exit', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'current':
        await this.showCurrentLanguage();
        break;
      case 'change':
        await this.changeLanguage();
        break;
      case 'stats':
        await this.showLanguageStats();
        break;
      case 'test':
        await this.testTranslations();
        break;
      case 'list':
        await this.listAllLanguages();
        break;
      case 'validate':
        await this.validateTranslations();
        break;
      case 'export':
        await this.exportTranslations();
        break;
      case 'exit':
        console.log(chalk.green('👋 Goodbye!'));
        return false;
    }

    return true;
  }

  async showCurrentLanguage() {
    try {
      await i18n.initialize();
      const current = i18n.getCurrentLanguage();
      
      console.log(chalk.blue('\n📍 Current Language Settings:'));
      console.log(`Language: ${chalk.green(current.name)} (${current.code})`);
      console.log(`Direction: ${chalk.yellow(current.direction.toUpperCase())}`);
      console.log(`Fallback: ${chalk.gray(i18n.fallbackLanguage)}`);
      
      // Show sample translation
      const sample = i18n.translate('global.appName') || 'N/A';
      console.log(`Sample: ${chalk.cyan(sample)}`);
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async changeLanguage() {
    try {
      await i18n.initialize();
      const languages = i18n.getSupportedLanguages();
      
      const { selectedLang } = await inquirer.prompt([
        {
          type: 'list',
          name: 'selectedLang',
          message: 'Select a language:',
          choices: languages.map(lang => ({
            name: `${lang.name} (${lang.code}) ${lang.direction === 'rtl' ? '← RTL' : ''}`,
            value: lang.code
          }))
        }
      ]);

      await i18n.setLanguage(selectedLang);
      console.log(chalk.green(`✅ Language changed to ${selectedLang}`));
      
      // Show sample translation in new language
      const sample = i18n.translate('global.appName');
      console.log(chalk.blue(`Sample: ${sample}`));
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async showLanguageStats() {
    try {
      console.log(chalk.blue('\n📊 Language Statistics:'));
      
      const languages = i18n.getSupportedLanguages();
      for (const lang of languages) {
        const filePath = path.join(this.translationsDir, `${lang.code}.json`);
        
        if (await fs.pathExists(filePath)) {
          const content = await fs.readJson(filePath);
          const keyCount = this.countTranslationKeys(content);
          const fileSize = (await fs.stat(filePath)).size;
          
          console.log(chalk.green(`${lang.name} (${lang.code}):`));
          console.log(`  Keys: ${chalk.yellow(keyCount)}`);
          console.log(`  Size: ${chalk.cyan(this.formatFileSize(fileSize))}`);
          console.log(`  Direction: ${chalk.gray(lang.direction)}\n`);
        } else {
          console.log(chalk.red(`${lang.name} (${lang.code}): Missing file\n`));
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async testTranslations() {
    try {
      await i18n.initialize();
      
      const { testKey } = await inquirer.prompt([
        {
          type: 'input',
          name: 'testKey',
          message: 'Enter translation key to test (e.g., global.appName):',
          default: 'global.appName'
        }
      ]);

      const { params } = await inquirer.prompt([
        {
          type: 'input',
          name: 'params',
          message: 'Enter parameters (JSON format, optional):',
          default: '{}',
          filter: (input) => {
            try {
              return JSON.parse(input);
            } catch {
              return {};
            }
          }
        }
      ]);

      console.log(chalk.blue('\n🔍 Translation Results:'));
      
      const languages = i18n.getSupportedLanguages();
      for (const lang of languages.slice(0, 5)) { // Show first 5 languages
        try {
          await i18n.setLanguage(lang.code);
          const translation = i18n.translate(testKey, params);
          console.log(`${chalk.green(lang.code)}: ${chalk.cyan(translation)}`);
        } catch (error) {
          console.log(`${chalk.red(lang.code)}: ${chalk.gray('Error loading')}`);
        }
      }
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async listAllLanguages() {
    console.log(chalk.blue('\n🌍 Supported Languages:'));
    
    const languages = i18n.getSupportedLanguages();
    languages.forEach((lang, index) => {
      const rtlIndicator = lang.direction === 'rtl' ? chalk.yellow(' ← RTL') : '';
      const number = chalk.gray(`${index + 1}.`.padStart(3));
      console.log(`${number} ${chalk.green(lang.name)} (${chalk.cyan(lang.code)})${rtlIndicator}`);
    });
    
    console.log(chalk.gray(`\nTotal: ${languages.length} languages supported`));
  }

  async validateTranslations() {
    try {
      console.log(chalk.blue('\n🔧 Validating Translations...\n'));
      
      // Load English as reference
      const enPath = path.join(this.translationsDir, 'en.json');
      const enContent = await fs.readJson(enPath);
      const enKeys = this.getAllKeys(enContent);
      
      const languages = i18n.getSupportedLanguages().filter(lang => lang.code !== 'en');
      const results = [];
      
      for (const lang of languages) {
        const filePath = path.join(this.translationsDir, `${lang.code}.json`);
        
        if (!(await fs.pathExists(filePath))) {
          results.push({
            language: lang.name,
            code: lang.code,
            status: 'missing',
            missing: enKeys.length,
            extra: 0
          });
          continue;
        }
        
        const content = await fs.readJson(filePath);
        const langKeys = this.getAllKeys(content);
        
        const missing = enKeys.filter(key => !langKeys.includes(key));
        const extra = langKeys.filter(key => !enKeys.includes(key));
        
        results.push({
          language: lang.name,
          code: lang.code,
          status: missing.length === 0 ? 'complete' : 'incomplete',
          missing: missing.length,
          extra: extra.length,
          missingKeys: missing.slice(0, 5), // Show first 5 missing keys
          extraKeys: extra.slice(0, 5) // Show first 5 extra keys
        });
      }
      
      // Display results
      results.forEach(result => {
        if (result.status === 'missing') {
          console.log(chalk.red(`❌ ${result.language} (${result.code}): File missing`));
        } else if (result.status === 'complete') {
          console.log(chalk.green(`✅ ${result.language} (${result.code}): Complete`));
        } else {
          console.log(chalk.yellow(`⚠️  ${result.language} (${result.code}): Missing ${result.missing} keys`));
          if (result.missingKeys.length > 0) {
            console.log(chalk.gray(`   Missing: ${result.missingKeys.join(', ')}`));
          }
        }
      });
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async exportTranslations() {
    try {
      const { format } = await inquirer.prompt([
        {
          type: 'list',
          name: 'format',
          message: 'Export format:',
          choices: [
            { name: 'CSV (Comma Separated)', value: 'csv' },
            { name: 'TSV (Tab Separated)', value: 'tsv' },
            { name: 'JSON (Combined)', value: 'json' }
          ]
        }
      ]);

      const outputFile = path.join(process.cwd(), `translations-export.${format}`);
      
      if (format === 'csv' || format === 'tsv') {
        await this.exportToDelimited(outputFile, format === 'tsv' ? '\t' : ',');
      } else {
        await this.exportToJSON(outputFile);
      }
      
      console.log(chalk.green(`✅ Exported to: ${outputFile}`));
      
    } catch (error) {
      console.log(chalk.red(`❌ Error: ${error.message}`));
    }
  }

  async exportToDelimited(filePath, delimiter) {
    // Load English as reference for keys
    const enPath = path.join(this.translationsDir, 'en.json');
    const enContent = await fs.readJson(enPath);
    const keys = this.getAllKeys(enContent);
    
    const languages = ['en', ...i18n.getSupportedLanguages().map(l => l.code).filter(c => c !== 'en')];
    
    // Load all translations
    const translations = {};
    for (const lang of languages) {
      const filePath = path.join(this.translationsDir, `${lang}.json`);
      if (await fs.pathExists(filePath)) {
        translations[lang] = await fs.readJson(filePath);
      }
    }
    
    // Create CSV/TSV content
    const header = ['Key', ...languages].join(delimiter);
    const rows = keys.map(key => {
      const values = languages.map(lang => {
        const value = this.getValueByPath(translations[lang], key) || '';
        // Escape delimiter and quotes
        return `"${value.replace(/"/g, '""')}"`;
      });
      return [key, ...values].join(delimiter);
    });
    
    const content = [header, ...rows].join('\n');
    await fs.writeFile(filePath, content, 'utf8');
  }

  async exportToJSON(filePath) {
    const languages = i18n.getSupportedLanguages();
    const combined = {};
    
    for (const lang of languages) {
      const translationPath = path.join(this.translationsDir, `${lang.code}.json`);
      if (await fs.pathExists(translationPath)) {
        combined[lang.code] = await fs.readJson(translationPath);
      }
    }
    
    await fs.writeJson(filePath, combined, { spaces: 2 });
  }

  countTranslationKeys(obj, count = 0) {
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        count = this.countTranslationKeys(obj[key], count);
      } else {
        count++;
      }
    }
    return count;
  }

  getAllKeys(obj, prefix = '') {
    const keys = [];
    
    for (const key in obj) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
        keys.push(...this.getAllKeys(obj[key], fullKey));
      } else {
        keys.push(fullKey);
      }
    }
    
    return keys;
  }

  getValueByPath(obj, path) {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : null;
    }, obj);
  }

  formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

// CLI interface
if (require.main === module) {
  const manager = new I18NManager();
  
  async function run() {
    try {
      let continue_ = true;
      while (continue_) {
        continue_ = await manager.showMainMenu();
      }
    } catch (error) {
      console.error(chalk.red('Fatal error:'), error);
      process.exit(1);
    }
  }
  
  run();
}

module.exports = I18NManager;