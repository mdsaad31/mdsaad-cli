/**
 * Tab Completion Service
 * Handles shell completion setup for different platforms and shells
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const platformService = require('./platform-service');
const outputFormatter = require('./output-formatter');
const debugService = require('./debug-service');

class TabCompletionService {
  constructor() {
    this.isInitialized = false;
    this.supportedShells = ['bash', 'zsh', 'fish', 'powershell'];
    this.completionScripts = {};
  }

  /**
   * Initialize tab completion service
   */
  async initialize() {
    try {
      await platformService.initialize();
      await this.generateCompletionScripts();
      
      this.isInitialized = true;
      debugService.debug('Tab completion service initialized');
      return true;
    } catch (error) {
      debugService.debug('Tab completion service initialization failed', { error: error.message });
      return false;
    }
  }

  /**
   * Generate completion scripts for different shells
   */
  async generateCompletionScripts() {
    this.completionScripts = {
      bash: this.generateBashCompletion(),
      zsh: this.generateZshCompletion(),
      fish: this.generateFishCompletion(),
      powershell: this.generatePowerShellCompletion()
    };
  }

  /**
   * Generate Bash completion script
   */
  generateBashCompletion() {
    return `#!/bin/bash
# mdsaad bash completion script

_mdsaad_completions() {
    local cur prev words cword
    _init_completion || return

    # Available commands
    local commands="calculate ai api show weather convert language enhanced debug plugin update maintenance version help"
    
    # Command options
    local calculate_opts="-p --precision -v --verbose"
    local ai_opts="-m --model -s --stream -t --temperature --max-tokens -c --context"
    local show_opts="-a --animated --animation -c --color --color-scheme -w --width --speed --direction --category --query --limit"
    local weather_opts="-d --detailed -f --forecast --days -u --units --alerts --lang"
    local convert_opts="-v --verbose -h --historical -r --rates -f --favorites -a --add-favorite -b --batch"
    local plugin_opts="--list --info --stats --create --validate --install --uninstall --enable --disable --reload --update"
    local update_opts="-c --check -f --force --info -l --changelog -r --range -s --settings --enable-auto-check --disable-auto-check --compatibility --deprecations"
    local maintenance_opts="-d --diagnostics -c --clean-cache -t --clean-temp -l --clean-logs -s --storage --migrate-config --reset --health --fix"
    
    # Global options
    local global_opts="-v --version -l --lang --verbose --debug -h --help"

    case \${prev} in
        mdsaad)
            COMPREPLY=( \$(compgen -W "\${commands}" -- \${cur}) )
            return 0
            ;;
        calculate|calc)
            COMPREPLY=( \$(compgen -W "\${calculate_opts}" -- \${cur}) )
            return 0
            ;;
        ai)
            COMPREPLY=( \$(compgen -W "\${ai_opts}" -- \${cur}) )
            return 0
            ;;
        show)
            COMPREPLY=( \$(compgen -W "\${show_opts}" -- \${cur}) )
            return 0
            ;;
        weather)
            COMPREPLY=( \$(compgen -W "\${weather_opts}" -- \${cur}) )
            return 0
            ;;
        convert|conv)
            COMPREPLY=( \$(compgen -W "\${convert_opts}" -- \${cur}) )
            return 0
            ;;
        plugin)
            COMPREPLY=( \$(compgen -W "\${plugin_opts}" -- \${cur}) )
            return 0
            ;;
        update)
            COMPREPLY=( \$(compgen -W "\${update_opts}" -- \${cur}) )
            return 0
            ;;
        maintenance|maint)
            COMPREPLY=( \$(compgen -W "\${maintenance_opts}" -- \${cur}) )
            return 0
            ;;
        --lang|-l)
            COMPREPLY=( \$(compgen -W "en hi es fr de zh ja ru ar" -- \${cur}) )
            return 0
            ;;
        --units|-u)
            COMPREPLY=( \$(compgen -W "metric imperial" -- \${cur}) )
            return 0
            ;;
        --color-scheme)
            COMPREPLY=( \$(compgen -W "default rainbow fire ocean forest sunset monochrome" -- \${cur}) )
            return 0
            ;;
        --animation)
            COMPREPLY=( \$(compgen -W "typewriter fadein slidein matrix pulse wave" -- \${cur}) )
            return 0
            ;;
    esac

    # Default to global options
    COMPREPLY=( \$(compgen -W "\${global_opts} \${commands}" -- \${cur}) )
}

complete -F _mdsaad_completions mdsaad
`;
  }

  /**
   * Generate Zsh completion script
   */
  generateZshCompletion() {
    return `#compdef mdsaad
# mdsaad zsh completion script

_mdsaad() {
    local context state line
    typeset -A opt_args

    _arguments -C \\
        '(--version -v)'{--version,-v}'[Show version information]' \\
        '(--lang -l)'{--lang,-l}'[Set interface language]:language:(en hi es fr de zh ja ru ar)' \\
        '--verbose[Enable verbose output]' \\
        '--debug[Enable debug mode]' \\
        '(--help -h)'{--help,-h}'[Show help information]' \\
        '1: :->commands' \\
        '*: :->args' && return 0

    case \$state in
        commands)
            local commands=(
                'calculate:Perform mathematical calculations'
                'ai:Interact with AI models'
                'api:Manage API providers and view statistics'
                'show:Display ASCII art'
                'weather:Get weather information'
                'convert:Convert between currencies and units'
                'language:Manage interface language'
                'enhanced:Enhanced UX features and configuration'
                'debug:Debugging and diagnostic tools'
                'plugin:Plugin management system'
                'update:Check for updates and manage version information'
                'maintenance:System maintenance and diagnostics'
                'version:Show version information'
                'help:Display help for command'
            )
            _describe 'commands' commands
            ;;
        args)
            case \$words[2] in
                calculate|calc)
                    _arguments \\
                        '(--precision -p)'{--precision,-p}'[Set decimal precision]:precision:' \\
                        '(--verbose -v)'{--verbose,-v}'[Enable verbose output]'
                    ;;
                ai)
                    _arguments \\
                        '(--model -m)'{--model,-m}'[AI model to use]:model:' \\
                        '(--stream -s)'{--stream,-s}'[Enable streaming response]' \\
                        '(--temperature -t)'{--temperature,-t}'[Set temperature]:temperature:' \\
                        '--max-tokens[Maximum tokens]:tokens:' \\
                        '(--context -c)'{--context,-c}'[Context for conversation]:context:'
                    ;;
                show)
                    _arguments \\
                        '(--animated -a)'{--animated,-a}'[Enable animation]' \\
                        '--animation[Animation type]:animation:(typewriter fadein slidein matrix pulse wave)' \\
                        '(--color -c)'{--color,-c}'[Color scheme]:color:' \\
                        '--color-scheme[Color scheme]:scheme:(default rainbow fire ocean forest sunset monochrome)' \\
                        '(--width -w)'{--width,-w}'[Display width]:width:' \\
                        '--speed[Animation speed]:speed:' \\
                        '--direction[Slide direction]:direction:(left right up down)' \\
                        '--category[Filter by category]:category:(superheroes logos animals)' \\
                        '--query[Search query]:query:' \\
                        '--limit[Limit results]:limit:'
                    ;;
                weather)
                    _arguments \\
                        '(--detailed -d)'{--detailed,-d}'[Show detailed information]' \\
                        '(--forecast -f)'{--forecast,-f}'[Show forecast]' \\
                        '--days[Forecast days]:days:' \\
                        '(--units -u)'{--units,-u}'[Units]:units:(metric imperial)' \\
                        '--alerts[Show weather alerts]' \\
                        '--lang[Language]:language:(en hi es fr de zh ja ru ar)'
                    ;;
                convert|conv)
                    _arguments \\
                        '(--verbose -v)'{--verbose,-v}'[Show detailed information]' \\
                        '(--historical -h)'{--historical,-h}'[Use historical rates]:date:' \\
                        '(--rates -r)'{--rates,-r}'[Show exchange rates]' \\
                        '(--favorites -f)'{--favorites,-f}'[Show favorites]' \\
                        '(--add-favorite -a)'{--add-favorite,-a}'[Add to favorites]' \\
                        '(--batch -b)'{--batch,-b}'[Batch process file]:file:_files'
                    ;;
                plugin)
                    _arguments \\
                        '--list[List installed plugins]' \\
                        '--info[Show plugin information]:plugin:' \\
                        '--stats[Show plugin statistics]' \\
                        '--create[Create new plugin]:name:' \\
                        '--validate[Validate plugin]:plugin:' \\
                        '--install[Install plugin]:plugin:' \\
                        '--uninstall[Uninstall plugin]:plugin:' \\
                        '--enable[Enable plugin]:plugin:' \\
                        '--disable[Disable plugin]:plugin:' \\
                        '--reload[Reload plugins]' \\
                        '--update[Update plugin]:plugin:'
                    ;;
                update)
                    _arguments \\
                        '(--check -c)'{--check,-c}'[Check for updates]' \\
                        '(--force -f)'{--force,-f}'[Force update check]' \\
                        '--info[Show version information]' \\
                        '(--changelog -l)'{--changelog,-l}'[Show changelog]:version:' \\
                        '(--range -r)'{--range,-r}'[Version range]:range:' \\
                        '(--settings -s)'{--settings,-s}'[Show settings]' \\
                        '--enable-auto-check[Enable auto check]' \\
                        '--disable-auto-check[Disable auto check]' \\
                        '--compatibility[Check compatibility]' \\
                        '--deprecations[Check deprecations]'
                    ;;
                maintenance|maint)
                    _arguments \\
                        '(--diagnostics -d)'{--diagnostics,-d}'[Run diagnostics]' \\
                        '(--clean-cache -c)'{--clean-cache,-c}'[Clean cache]:type:(all expired)' \\
                        '(--clean-temp -t)'{--clean-temp,-t}'[Clean temp files]' \\
                        '(--clean-logs -l)'{--clean-logs,-l}'[Clean log files]:days:' \\
                        '(--storage -s)'{--storage,-s}'[Show storage usage]' \\
                        '--migrate-config[Migrate configuration]' \\
                        '--reset[Reset data]:type:(all config cache temp logs)' \\
                        '--health[Quick health check]' \\
                        '--fix[Auto-fix issues]'
                    ;;
            esac
            ;;
    esac
}

_mdsaad "\$@"
`;
  }

  /**
   * Generate Fish completion script
   */
  generateFishCompletion() {
    return `# mdsaad fish completion script

# Main commands
complete -c mdsaad -f -a "calculate" -d "Perform mathematical calculations"
complete -c mdsaad -f -a "ai" -d "Interact with AI models"
complete -c mdsaad -f -a "api" -d "Manage API providers"
complete -c mdsaad -f -a "show" -d "Display ASCII art"
complete -c mdsaad -f -a "weather" -d "Get weather information"
complete -c mdsaad -f -a "convert" -d "Convert currencies and units"
complete -c mdsaad -f -a "language" -d "Manage interface language"
complete -c mdsaad -f -a "enhanced" -d "Enhanced UX features"
complete -c mdsaad -f -a "debug" -d "Debugging tools"
complete -c mdsaad -f -a "plugin" -d "Plugin management"
complete -c mdsaad -f -a "update" -d "Update management"
complete -c mdsaad -f -a "maintenance" -d "System maintenance"
complete -c mdsaad -f -a "version" -d "Show version"
complete -c mdsaad -f -a "help" -d "Show help"

# Global options
complete -c mdsaad -s v -l version -d "Show version information"
complete -c mdsaad -s l -l lang -d "Set interface language" -xa "en hi es fr de zh ja ru ar"
complete -c mdsaad -l verbose -d "Enable verbose output"
complete -c mdsaad -l debug -d "Enable debug mode"
complete -c mdsaad -s h -l help -d "Show help information"

# Calculate command options
complete -c mdsaad -n "__fish_seen_subcommand_from calculate calc" -s p -l precision -d "Set decimal precision"
complete -c mdsaad -n "__fish_seen_subcommand_from calculate calc" -s v -l verbose -d "Enable verbose output"

# AI command options
complete -c mdsaad -n "__fish_seen_subcommand_from ai" -s m -l model -d "AI model to use"
complete -c mdsaad -n "__fish_seen_subcommand_from ai" -s s -l stream -d "Enable streaming response"
complete -c mdsaad -n "__fish_seen_subcommand_from ai" -s t -l temperature -d "Set temperature"
complete -c mdsaad -n "__fish_seen_subcommand_from ai" -l max-tokens -d "Maximum tokens"
complete -c mdsaad -n "__fish_seen_subcommand_from ai" -s c -l context -d "Context for conversation"

# Show command options
complete -c mdsaad -n "__fish_seen_subcommand_from show" -s a -l animated -d "Enable animation"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l animation -d "Animation type" -xa "typewriter fadein slidein matrix pulse wave"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -s c -l color -d "Color scheme"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l color-scheme -d "Color scheme" -xa "default rainbow fire ocean forest sunset monochrome"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -s w -l width -d "Display width"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l speed -d "Animation speed"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l direction -d "Slide direction" -xa "left right up down"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l category -d "Filter by category" -xa "superheroes logos animals"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l query -d "Search query"
complete -c mdsaad -n "__fish_seen_subcommand_from show" -l limit -d "Limit results"

# Weather command options
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -s d -l detailed -d "Show detailed information"
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -s f -l forecast -d "Show forecast"
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -l days -d "Forecast days"
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -s u -l units -d "Units" -xa "metric imperial"
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -l alerts -d "Show weather alerts"
complete -c mdsaad -n "__fish_seen_subcommand_from weather" -l lang -d "Language" -xa "en hi es fr de zh ja ru ar"

# Convert command options
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s v -l verbose -d "Show detailed information"
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s h -l historical -d "Use historical rates"
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s r -l rates -d "Show exchange rates"
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s f -l favorites -d "Show favorites"
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s a -l add-favorite -d "Add to favorites"
complete -c mdsaad -n "__fish_seen_subcommand_from convert conv" -s b -l batch -d "Batch process file"

# Plugin command options
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l list -d "List installed plugins"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l info -d "Show plugin information"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l stats -d "Show plugin statistics"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l create -d "Create new plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l validate -d "Validate plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l install -d "Install plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l uninstall -d "Uninstall plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l enable -d "Enable plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l disable -d "Disable plugin"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l reload -d "Reload plugins"
complete -c mdsaad -n "__fish_seen_subcommand_from plugin" -l update -d "Update plugin"

# Update command options
complete -c mdsaad -n "__fish_seen_subcommand_from update" -s c -l check -d "Check for updates"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -s f -l force -d "Force update check"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -l info -d "Show version information"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -s l -l changelog -d "Show changelog"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -s r -l range -d "Version range"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -s s -l settings -d "Show settings"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -l enable-auto-check -d "Enable auto check"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -l disable-auto-check -d "Disable auto check"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -l compatibility -d "Check compatibility"
complete -c mdsaad -n "__fish_seen_subcommand_from update" -l deprecations -d "Check deprecations"

# Maintenance command options
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -s d -l diagnostics -d "Run diagnostics"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -s c -l clean-cache -d "Clean cache" -xa "all expired"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -s t -l clean-temp -d "Clean temp files"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -s l -l clean-logs -d "Clean log files"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -s s -l storage -d "Show storage usage"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -l migrate-config -d "Migrate configuration"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -l reset -d "Reset data" -xa "all config cache temp logs"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -l health -d "Quick health check"
complete -c mdsaad -n "__fish_seen_subcommand_from maintenance maint" -l fix -d "Auto-fix issues"
`;
  }

  /**
   * Generate PowerShell completion script
   */
  generatePowerShellCompletion() {
    return `# mdsaad PowerShell completion script

Register-ArgumentCompleter -Native -CommandName mdsaad -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $commands = @(
        'calculate', 'ai', 'api', 'show', 'weather', 'convert', 'language', 
        'enhanced', 'debug', 'plugin', 'update', 'maintenance', 'version', 'help'
    )

    $globalOptions = @(
        '--version', '-v', '--lang', '-l', '--verbose', '--debug', '--help', '-h'
    )

    # Get the current command being typed
    $commandElements = $commandAst.CommandElements
    $subCommand = $null
    
    if ($commandElements.Count -gt 1) {
        $subCommand = $commandElements[1].Value
    }

    switch ($subCommand) {
        'calculate' {
            $options = @('--precision', '-p', '--verbose', '-v')
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'ai' {
            $options = @('--model', '-m', '--stream', '-s', '--temperature', '-t', '--max-tokens', '--context', '-c')
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'show' {
            $options = @(
                '--animated', '-a', '--animation', '--color', '-c', '--color-scheme',
                '--width', '-w', '--speed', '--direction', '--category', '--query', '--limit'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'weather' {
            $options = @(
                '--detailed', '-d', '--forecast', '-f', '--days', '--units', '-u', 
                '--alerts', '--lang'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'convert' {
            $options = @(
                '--verbose', '-v', '--historical', '-h', '--rates', '-r',
                '--favorites', '-f', '--add-favorite', '-a', '--batch', '-b'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'plugin' {
            $options = @(
                '--list', '--info', '--stats', '--create', '--validate', '--install',
                '--uninstall', '--enable', '--disable', '--reload', '--update'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'update' {
            $options = @(
                '--check', '-c', '--force', '-f', '--info', '--changelog', '-l',
                '--range', '-r', '--settings', '-s', '--enable-auto-check',
                '--disable-auto-check', '--compatibility', '--deprecations'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        'maintenance' {
            $options = @(
                '--diagnostics', '-d', '--clean-cache', '-c', '--clean-temp', '-t',
                '--clean-logs', '-l', '--storage', '-s', '--migrate-config',
                '--reset', '--health', '--fix'
            )
            $options | Where-Object { $_ -like "$wordToComplete*" }
        }
        default {
            # If no subcommand or unrecognized subcommand, suggest commands and global options
            $allOptions = $commands + $globalOptions
            $allOptions | Where-Object { $_ -like "$wordToComplete*" }
        }
    }
}

# Tab completion for specific option values
Register-ArgumentCompleter -Native -CommandName mdsaad -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)
    
    $commandElements = $commandAst.CommandElements
    $previousElement = $null
    
    if ($commandElements.Count -gt 1) {
        $previousElement = $commandElements[-2].Value
    }

    switch ($previousElement) {
        '--lang' {
            @('en', 'hi', 'es', 'fr', 'de', 'zh', 'ja', 'ru', 'ar') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--units' {
            @('metric', 'imperial') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--color-scheme' {
            @('default', 'rainbow', 'fire', 'ocean', 'forest', 'sunset', 'monochrome') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--animation' {
            @('typewriter', 'fadein', 'slidein', 'matrix', 'pulse', 'wave') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--direction' {
            @('left', 'right', 'up', 'down') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--category' {
            @('superheroes', 'logos', 'animals') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--clean-cache' {
            @('all', 'expired') | Where-Object { $_ -like "$wordToComplete*" }
        }
        '--reset' {
            @('all', 'config', 'cache', 'temp', 'logs') | Where-Object { $_ -like "$wordToComplete*" }
        }
    }
}
`;
  }

  /**
   * Install tab completion for current shell
   */
  async installTabCompletion(shell = null, options = {}) {
    const { force = false, global = true } = options;
    
    if (!shell) {
      shell = platformService.detectShell();
    }

    if (!this.supportedShells.includes(shell)) {
      throw new Error(`Shell '${shell}' is not supported for tab completion`);
    }

    const result = {
      shell,
      success: false,
      installed: false,
      configFile: null,
      backupCreated: false,
      instructions: []
    };

    try {
      const completion = this.completionScripts[shell];
      const completionDir = platformService.getCompletionDirectory();
      await fs.ensureDir(completionDir);

      // Save completion script
      const scriptPath = path.join(completionDir, `mdsaad-completion.${shell}`);
      await fs.writeFile(scriptPath, completion);
      await platformService.setFilePermissions(scriptPath, '644');

      result.scriptPath = scriptPath;

      // Install based on shell type
      switch (shell) {
        case 'bash':
          result.configFile = await this.installBashCompletion(scriptPath, global, force);
          break;
        case 'zsh':
          result.configFile = await this.installZshCompletion(scriptPath, global, force);
          break;
        case 'fish':
          result.configFile = await this.installFishCompletion(scriptPath, global, force);
          break;
        case 'powershell':
          result.configFile = await this.installPowerShellCompletion(scriptPath, global, force);
          break;
      }

      result.success = true;
      result.installed = true;
      result.instructions = this.getPostInstallInstructions(shell);

    } catch (error) {
      result.error = error.message;
      debugService.debug('Tab completion installation failed', { shell, error: error.message });
    }

    return result;
  }

  /**
   * Install Bash completion
   */
  async installBashCompletion(scriptPath, global, force) {
    const homeDir = os.homedir();
    const bashrcPath = path.join(homeDir, '.bashrc');
    const bashProfilePath = path.join(homeDir, '.bash_profile');
    
    // Choose config file (prefer .bashrc)
    const configFile = await fs.pathExists(bashrcPath) ? bashrcPath : bashProfilePath;
    
    const sourceLine = `# mdsaad tab completion\nsource "${scriptPath}"`;
    
    if (await fs.pathExists(configFile)) {
      const content = await fs.readFile(configFile, 'utf8');
      
      if (content.includes('mdsaad tab completion') && !force) {
        throw new Error('Tab completion already installed. Use --force to reinstall.');
      }
      
      if (!content.includes(sourceLine)) {
        await fs.appendFile(configFile, `\n${sourceLine}\n`);
      }
    } else {
      await fs.writeFile(configFile, `${sourceLine}\n`);
    }
    
    return configFile;
  }

  /**
   * Install Zsh completion
   */
  async installZshCompletion(scriptPath, global, force) {
    const homeDir = os.homedir();
    const zshrcPath = path.join(homeDir, '.zshrc');
    
    const sourceLine = `# mdsaad tab completion\nsource "${scriptPath}"`;
    
    if (await fs.pathExists(zshrcPath)) {
      const content = await fs.readFile(zshrcPath, 'utf8');
      
      if (content.includes('mdsaad tab completion') && !force) {
        throw new Error('Tab completion already installed. Use --force to reinstall.');
      }
      
      if (!content.includes(sourceLine)) {
        await fs.appendFile(zshrcPath, `\n${sourceLine}\n`);
      }
    } else {
      await fs.writeFile(zshrcPath, `${sourceLine}\n`);
    }
    
    return zshrcPath;
  }

  /**
   * Install Fish completion
   */
  async installFishCompletion(scriptPath, global, force) {
    const homeDir = os.homedir();
    const fishConfigDir = path.join(homeDir, '.config', 'fish', 'completions');
    await fs.ensureDir(fishConfigDir);
    
    const fishCompletionPath = path.join(fishConfigDir, 'mdsaad.fish');
    const completion = this.completionScripts.fish;
    
    if (await fs.pathExists(fishCompletionPath) && !force) {
      throw new Error('Tab completion already installed. Use --force to reinstall.');
    }
    
    await fs.writeFile(fishCompletionPath, completion);
    await platformService.setFilePermissions(fishCompletionPath, '644');
    
    return fishCompletionPath;
  }

  /**
   * Install PowerShell completion
   */
  async installPowerShellCompletion(scriptPath, global, force) {
    // Get PowerShell profile path
    let profilePath;
    
    try {
      const profileOutput = execSync('powershell -Command "$PROFILE"', { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      }).trim();
      profilePath = profileOutput;
    } catch (error) {
      // Fallback to default profile path
      const documentsPath = path.join(os.homedir(), 'Documents');
      profilePath = path.join(documentsPath, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    }
    
    const sourceLine = `# mdsaad tab completion\n. "${scriptPath}"`;
    
    // Ensure profile directory exists
    await fs.ensureDir(path.dirname(profilePath));
    
    if (await fs.pathExists(profilePath)) {
      const content = await fs.readFile(profilePath, 'utf8');
      
      if (content.includes('mdsaad tab completion') && !force) {
        throw new Error('Tab completion already installed. Use --force to reinstall.');
      }
      
      if (!content.includes(sourceLine)) {
        await fs.appendFile(profilePath, `\n${sourceLine}\n`);
      }
    } else {
      await fs.writeFile(profilePath, `${sourceLine}\n`);
    }
    
    return profilePath;
  }

  /**
   * Uninstall tab completion
   */
  async uninstallTabCompletion(shell = null) {
    if (!shell) {
      shell = platformService.detectShell();
    }

    const result = {
      shell,
      success: false,
      removed: false,
      configFile: null
    };

    try {
      const completionDir = platformService.getCompletionDirectory();
      const scriptPath = path.join(completionDir, `mdsaad-completion.${shell}`);
      
      // Remove completion script
      if (await fs.pathExists(scriptPath)) {
        await fs.remove(scriptPath);
      }

      // Remove from shell config
      switch (shell) {
        case 'bash':
          result.configFile = await this.removeFromBashConfig();
          break;
        case 'zsh':
          result.configFile = await this.removeFromZshConfig();
          break;
        case 'fish':
          result.configFile = await this.removeFromFishConfig();
          break;
        case 'powershell':
          result.configFile = await this.removeFromPowerShellConfig();
          break;
      }

      result.success = true;
      result.removed = true;

    } catch (error) {
      result.error = error.message;
      debugService.debug('Tab completion uninstallation failed', { shell, error: error.message });
    }

    return result;
  }

  /**
   * Remove from Bash config
   */
  async removeFromBashConfig() {
    const homeDir = os.homedir();
    const bashrcPath = path.join(homeDir, '.bashrc');
    const bashProfilePath = path.join(homeDir, '.bash_profile');
    
    for (const configFile of [bashrcPath, bashProfilePath]) {
      if (await fs.pathExists(configFile)) {
        const content = await fs.readFile(configFile, 'utf8');
        const lines = content.split('\n');
        const filteredLines = lines.filter(line => 
          !line.includes('mdsaad tab completion') && 
          !line.includes('mdsaad-completion.bash')
        );
        
        if (filteredLines.length !== lines.length) {
          await fs.writeFile(configFile, filteredLines.join('\n'));
          return configFile;
        }
      }
    }
    
    return null;
  }

  /**
   * Remove from Zsh config
   */
  async removeFromZshConfig() {
    const homeDir = os.homedir();
    const zshrcPath = path.join(homeDir, '.zshrc');
    
    if (await fs.pathExists(zshrcPath)) {
      const content = await fs.readFile(zshrcPath, 'utf8');
      const lines = content.split('\n');
      const filteredLines = lines.filter(line => 
        !line.includes('mdsaad tab completion') && 
        !line.includes('mdsaad-completion.zsh')
      );
      
      if (filteredLines.length !== lines.length) {
        await fs.writeFile(zshrcPath, filteredLines.join('\n'));
        return zshrcPath;
      }
    }
    
    return null;
  }

  /**
   * Remove from Fish config
   */
  async removeFromFishConfig() {
    const homeDir = os.homedir();
    const fishCompletionPath = path.join(homeDir, '.config', 'fish', 'completions', 'mdsaad.fish');
    
    if (await fs.pathExists(fishCompletionPath)) {
      await fs.remove(fishCompletionPath);
      return fishCompletionPath;
    }
    
    return null;
  }

  /**
   * Remove from PowerShell config
   */
  async removeFromPowerShellConfig() {
    let profilePath;
    
    try {
      const profileOutput = execSync('powershell -Command "$PROFILE"', { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      }).trim();
      profilePath = profileOutput;
    } catch (error) {
      const documentsPath = path.join(os.homedir(), 'Documents');
      profilePath = path.join(documentsPath, 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1');
    }
    
    if (await fs.pathExists(profilePath)) {
      const content = await fs.readFile(profilePath, 'utf8');
      const lines = content.split('\n');
      const filteredLines = lines.filter(line => 
        !line.includes('mdsaad tab completion') && 
        !line.includes('mdsaad-completion.powershell')
      );
      
      if (filteredLines.length !== lines.length) {
        await fs.writeFile(profilePath, filteredLines.join('\n'));
        return profilePath;
      }
    }
    
    return null;
  }

  /**
   * Check if tab completion is installed
   */
  async checkInstallation(shell = null) {
    if (!shell) {
      shell = platformService.detectShell();
    }

    const status = {
      shell,
      installed: false,
      configFile: null,
      scriptPath: null,
      working: false
    };

    try {
      const completionDir = platformService.getCompletionDirectory();
      const scriptPath = path.join(completionDir, `mdsaad-completion.${shell}`);
      
      status.scriptPath = scriptPath;
      
      if (await fs.pathExists(scriptPath)) {
        status.installed = true;
        
        // Check if it's loaded in shell config
        switch (shell) {
          case 'bash':
            status.configFile = await this.checkBashConfig(scriptPath);
            break;
          case 'zsh':
            status.configFile = await this.checkZshConfig(scriptPath);
            break;
          case 'fish':
            status.configFile = await this.checkFishConfig();
            break;
          case 'powershell':
            status.configFile = await this.checkPowerShellConfig(scriptPath);
            break;
        }
        
        status.working = Boolean(status.configFile);
      }

    } catch (error) {
      debugService.debug('Tab completion check failed', { shell, error: error.message });
    }

    return status;
  }

  /**
   * Check Bash config for completion
   */
  async checkBashConfig(scriptPath) {
    const homeDir = os.homedir();
    const configFiles = [
      path.join(homeDir, '.bashrc'),
      path.join(homeDir, '.bash_profile')
    ];
    
    for (const configFile of configFiles) {
      if (await fs.pathExists(configFile)) {
        const content = await fs.readFile(configFile, 'utf8');
        if (content.includes(scriptPath) || content.includes('mdsaad tab completion')) {
          return configFile;
        }
      }
    }
    
    return null;
  }

  /**
   * Check Zsh config for completion
   */
  async checkZshConfig(scriptPath) {
    const homeDir = os.homedir();
    const zshrcPath = path.join(homeDir, '.zshrc');
    
    if (await fs.pathExists(zshrcPath)) {
      const content = await fs.readFile(zshrcPath, 'utf8');
      if (content.includes(scriptPath) || content.includes('mdsaad tab completion')) {
        return zshrcPath;
      }
    }
    
    return null;
  }

  /**
   * Check Fish config for completion
   */
  async checkFishConfig() {
    const homeDir = os.homedir();
    const fishCompletionPath = path.join(homeDir, '.config', 'fish', 'completions', 'mdsaad.fish');
    
    if (await fs.pathExists(fishCompletionPath)) {
      return fishCompletionPath;
    }
    
    return null;
  }

  /**
   * Check PowerShell config for completion
   */
  async checkPowerShellConfig(scriptPath) {
    let profilePath;
    
    try {
      const profileOutput = execSync('powershell -Command "$PROFILE"', { 
        encoding: 'utf8', 
        timeout: 5000,
        stdio: 'pipe'
      }).trim();
      profilePath = profileOutput;
    } catch (error) {
      return null;
    }
    
    if (await fs.pathExists(profilePath)) {
      const content = await fs.readFile(profilePath, 'utf8');
      if (content.includes(scriptPath) || content.includes('mdsaad tab completion')) {
        return profilePath;
      }
    }
    
    return null;
  }

  /**
   * Get post-installation instructions
   */
  getPostInstallInstructions(shell) {
    const instructions = [];
    
    switch (shell) {
      case 'bash':
        instructions.push('Restart your terminal or run: source ~/.bashrc');
        instructions.push('Tab completion should now work for mdsaad commands');
        break;
      case 'zsh':
        instructions.push('Restart your terminal or run: source ~/.zshrc');
        instructions.push('Tab completion should now work for mdsaad commands');
        break;
      case 'fish':
        instructions.push('Fish will automatically load the completion');
        instructions.push('No restart required - tab completion is ready');
        break;
      case 'powershell':
        instructions.push('Restart PowerShell or run: . $PROFILE');
        instructions.push('Tab completion should now work for mdsaad commands');
        break;
    }
    
    instructions.push('Try typing "mdsaad " and press Tab to test completion');
    
    return instructions;
  }

  /**
   * Generate completion setup command for current platform
   */
  getSetupCommand() {
    const shell = platformService.detectShell();
    
    if (this.supportedShells.includes(shell)) {
      return `mdsaad enhanced setup --completion ${shell}`;
    } else {
      return `mdsaad enhanced setup --completion bash  # ${shell} not supported, using bash`;
    }
  }
}

module.exports = new TabCompletionService();