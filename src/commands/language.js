/**
 * Language Command
 * Interactive language selection and management
 */

const chalk = require('chalk');
const inquirer = require('inquirer');
const i18n = require('../services/i18n');
const configService = require('../services/config');

class LanguageCommand {
  async execute(options = {}) {
    try {
      await i18n.initialize();

      if (options.list) {
        return await this.listLanguages();
      }

      if (options.current) {
        return await this.showCurrentLanguage();
      }

      if (options.set) {
        return await this.setLanguage(options.set);
      }

      // Interactive language selection
      return await this.interactiveSelection();
    } catch (error) {
      console.error(chalk.red('❌ Language command failed:'), error.message);
      process.exit(1);
    }
  }

  async listLanguages() {
    console.log(chalk.blue.bold('\n🌍 Available Languages:\n'));

    const languages = i18n.getSupportedLanguages();
    const current = i18n.getCurrentLanguage();

    languages.forEach((lang, index) => {
      const isActive = lang.code === current.code;
      const prefix = isActive ? chalk.green('● ') : '  ';
      const rtlIndicator =
        lang.direction === 'rtl' ? chalk.yellow(' (RTL)') : '';
      const number = chalk.gray(`${(index + 1).toString().padStart(2)}.`);

      console.log(
        `${prefix}${number} ${chalk.cyan(lang.code)} - ${lang.name}${rtlIndicator}`
      );
    });

    console.log(chalk.gray(`\nTotal: ${languages.length} languages`));
    console.log(chalk.blue(`Current: ${current.name} (${current.code})`));
  }

  async showCurrentLanguage() {
    const current = i18n.getCurrentLanguage();

    console.log(chalk.blue('\n📍 Current Language:'));
    console.log(`Name: ${chalk.green(current.name)}`);
    console.log(`Code: ${chalk.cyan(current.code)}`);
    console.log(`Direction: ${chalk.yellow(current.direction.toUpperCase())}`);

    // Show sample translations
    console.log(chalk.blue('\nSample Translations:'));
    const samples = ['global.appName', 'global.success', 'global.loading'];

    samples.forEach(key => {
      const translation = i18n.translate(key);
      if (translation !== key) {
        console.log(`${chalk.gray(key)}: ${chalk.white(translation)}`);
      }
    });
  }

  async setLanguage(languageCode) {
    try {
      if (!i18n.isLanguageSupported(languageCode)) {
        console.log(
          chalk.red(`❌ Language "${languageCode}" is not supported`)
        );
        console.log(chalk.gray('Use --list to see available languages'));
        return;
      }

      await i18n.setLanguage(languageCode);

      // Save to configuration
      await configService.initialize();
      configService.set('language', languageCode);
      await configService.save();

      const newLang = i18n.getCurrentLanguage();
      console.log(
        chalk.green(`✅ Language changed to ${newLang.name} (${newLang.code})`)
      );

      // Show sample translation
      const sample = i18n.translate('global.appName');
      if (sample && sample !== 'global.appName') {
        console.log(chalk.blue(`Sample: ${sample}`));
      }
    } catch (error) {
      console.log(chalk.red(`❌ Failed to set language: ${error.message}`));
    }
  }

  async interactiveSelection() {
    const languages = i18n.getSupportedLanguages();
    const current = i18n.getCurrentLanguage();

    console.log(chalk.blue.bold('\n🌐 Language Selection\n'));
    console.log(chalk.gray(`Current: ${current.name} (${current.code})\n`));

    const { selectedLang } = await inquirer.prompt([
      {
        type: 'list',
        name: 'selectedLang',
        message: 'Choose your preferred language:',
        choices: languages.map(lang => {
          const isActive = lang.code === current.code;
          const rtlIndicator = lang.direction === 'rtl' ? ' ← RTL' : '';
          const activeMarker = isActive ? ' (current)' : '';

          return {
            name: `${lang.name} (${lang.code})${rtlIndicator}${activeMarker}`,
            value: lang.code,
            short: lang.name,
          };
        }),
        default: current.code,
      },
    ]);

    if (selectedLang === current.code) {
      console.log(chalk.yellow('Language unchanged'));
      return;
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Save this language preference?',
        default: true,
      },
    ]);

    if (confirm) {
      await this.setLanguage(selectedLang);
    } else {
      console.log(chalk.gray('Language change cancelled'));
    }
  }

  getUsage() {
    return `
${chalk.bold('language')} - Manage interface language

${chalk.yellow('Usage:')}
  mdsaad language                    Interactive language selection
  mdsaad language --list             List available languages  
  mdsaad language --current          Show current language
  mdsaad language --set <code>       Set language by code

${chalk.yellow('Examples:')}
  mdsaad language                    # Interactive menu
  mdsaad language --list             # Show all languages
  mdsaad language --set es           # Set to Spanish
  mdsaad language --set hi           # Set to Hindi
  mdsaad language --current          # Show current settings

${chalk.yellow('Supported Languages:')}
  en - English        es - Español       fr - Français
  de - Deutsch        hi - हिंदी          zh - 中文(简体)
  ja - 日本語          ru - Русский       ar - العربية (RTL)
`;
  }
}

module.exports = LanguageCommand;
