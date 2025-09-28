/**
 * Tab Completion Service
 * Provides intelligent tab completion for commands, options, and parameters
 */

const fs = require('fs-extra');
const path = require('path');

class TabCompletion {
  constructor() {
    this.commands = new Map();
    this.globalOptions = [
      '--help',
      '--version',
      '--verbose',
      '--debug',
      '--lang',
    ];
    this.completionCache = new Map();
  }

  /**
   * Register a command with its completion options
   */
  registerCommand(name, config) {
    this.commands.set(name, {
      name,
      aliases: config.aliases || [],
      options: config.options || [],
      subcommands: config.subcommands || [],
      argumentCompletions: config.argumentCompletions || {},
      customCompletions: config.customCompletions || null,
    });
  }

  /**
   * Generate completions for bash
   */
  generateBashCompletion() {
    const commands = Array.from(this.commands.keys());
    const aliases = Array.from(this.commands.values()).flatMap(
      cmd => cmd.aliases
    );

    return `#!/bin/bash
# MDSAAD CLI Tab Completion for Bash

_mdsaad_completion() {
    local cur prev opts commands
    COMPREPLY=()
    cur="\${COMP_WORDS[COMP_CWORD]}"
    prev="\${COMP_WORDS[COMP_CWORD-1]}"
    
    # Available commands
    commands="${commands.concat(aliases).join(' ')}"
    
    # Global options
    opts="${this.globalOptions.join(' ')}"
    
    # Command-specific completions
    case "\${COMP_WORDS[1]}" in
        calculate|calc)
            opts="--precision --verbose --history --help"
            ;;
        ai)
            opts="--model --provider --temperature --max-tokens --stream --context --verbose --help"
            ;;
        weather)
            opts="--detailed --forecast --alerts --units --location --verbose --help"
            ;;
        convert|conv)
            opts="--verbose --historical --rates --favorites --add-favorite --batch --help"
            ;;
        show)
            opts="--animated --color --width --search --category --help"
            ;;
        *)
            ;;
    esac
    
    # Complete based on current word
    if [[ \${cur} == -* ]]; then
        COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
        return 0
    else
        COMPREPLY=( $(compgen -W "\${commands}" -- \${cur}) )
        return 0
    fi
}

# Register the completion function
complete -F _mdsaad_completion mdsaad
`;
  }

  /**
   * Generate completions for zsh
   */
  generateZshCompletion() {
    const commands = Array.from(this.commands.keys());

    let zshScript = `#compdef mdsaad
# MDSAAD CLI Tab Completion for Zsh

_mdsaad() {
    local context state line
    typeset -A opt_args

    _arguments -C \\
        '1: :->commands' \\
        '*: :->args' \\
        && return 0

    case $state in
        commands)
            local commands
            commands=(
`;

    // Add commands with descriptions
    for (const [name, config] of this.commands) {
      zshScript += `                "${name}:${config.description || 'No description'}"\n`;
    }

    zshScript += `            )
            _describe 'commands' commands
            ;;
        args)
            case $words[2] in
                calculate|calc)
                    _arguments \\
                        '--precision[Number of decimal places]:precision:' \\
                        '--verbose[Show detailed output]' \\
                        '--help[Show help]'
                    ;;
                ai)
                    _arguments \\
                        '--model[AI model to use]:model:(gemini gpt-3.5 gpt-4 claude)' \\
                        '--provider[AI provider]:provider:(openai google anthropic)' \\
                        '--temperature[Response creativity]:temperature:' \\
                        '--verbose[Show detailed output]' \\
                        '--help[Show help]'
                    ;;
                weather)
                    _arguments \\
                        '--detailed[Show detailed weather info]' \\
                        '--forecast[Show weather forecast]' \\
                        '--alerts[Show weather alerts]' \\
                        '--units[Temperature units]:units:(metric imperial)' \\
                        '--verbose[Show detailed output]' \\
                        '--help[Show help]'
                    ;;
                convert|conv)
                    _arguments \\
                        '--verbose[Show detailed output]' \\
                        '--rates[Show exchange rates]' \\
                        '--favorites[Show favorites]' \\
                        '--historical[Historical date]:date:' \\
                        '--batch[Batch file]:file:_files' \\
                        '--help[Show help]'
                    ;;
                show)
                    _arguments \\
                        '--animated[Show animated version]' \\
                        '--color[Color scheme]:color:(rainbow fire ocean sunset)' \\
                        '--width[Display width]:width:' \\
                        '--verbose[Show detailed output]' \\
                        '--help[Show help]'
                    ;;
            esac
            ;;
    esac
}

_mdsaad "$@"
`;

    return zshScript;
  }

  /**
   * Generate completions for PowerShell
   */
  generatePowerShellCompletion() {
    const commands = Array.from(this.commands.keys());

    return `# MDSAAD CLI Tab Completion for PowerShell

Register-ArgumentCompleter -Native -CommandName mdsaad -ScriptBlock {
    param($commandName, $wordToComplete, $cursorPosition)
    
    $commands = @(${commands.map(cmd => `'${cmd}'`).join(', ')})
    $globalOptions = @('--help', '--version', '--verbose', '--debug', '--lang')
    
    # Get all arguments so far
    $args = $wordToComplete.Split(' ')
    
    # If completing first argument (command)
    if ($args.Count -le 2 -and -not $wordToComplete.StartsWith('-')) {
        $commands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_)
        }
    }
    # If completing options
    elseif ($wordToComplete.StartsWith('-')) {
        $options = @()
        
        switch ($args[1]) {
            'calculate' { $options = @('--precision', '--verbose', '--help') }
            'ai' { $options = @('--model', '--provider', '--temperature', '--verbose', '--help') }
            'weather' { $options = @('--detailed', '--forecast', '--alerts', '--units', '--verbose', '--help') }
            'convert' { $options = @('--verbose', '--rates', '--favorites', '--historical', '--batch', '--help') }
            'show' { $options = @('--animated', '--color', '--width', '--verbose', '--help') }
            default { $options = $globalOptions }
        }
        
        ($options + $globalOptions) | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterName', $_)
        }
    }
}
`;
  }

  /**
   * Get completions for a given input context
   */
  getCompletions(input, position = input.length) {
    const parts = input.slice(0, position).split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        suggestions: Array.from(this.commands.keys()),
        type: 'command',
      };
    }

    const commandName = parts[0];

    // If we're still typing the command name
    if (parts.length === 1 && !input.endsWith(' ')) {
      const matchingCommands = Array.from(this.commands.keys())
        .filter(cmd => cmd.startsWith(commandName))
        .concat(
          Array.from(this.commands.values())
            .filter(cmd =>
              cmd.aliases.some(alias => alias.startsWith(commandName))
            )
            .map(cmd => cmd.name)
        );

      return {
        suggestions: matchingCommands,
        type: 'command',
      };
    }

    // Get command config
    const command =
      this.commands.get(commandName) ||
      Array.from(this.commands.values()).find(cmd =>
        cmd.aliases.includes(commandName)
      );

    if (!command) {
      return { suggestions: [], type: 'unknown' };
    }

    // If current word starts with -, complete options
    const currentWord = parts[parts.length - 1] || '';
    if (currentWord.startsWith('-') || input.endsWith(' -')) {
      const options = command.options
        .map(opt => opt.flag)
        .concat(this.globalOptions)
        .filter(opt => opt.startsWith(currentWord));

      return {
        suggestions: options,
        type: 'option',
      };
    }

    // Custom completions for specific commands
    if (command.customCompletions) {
      return command.customCompletions(parts.slice(1));
    }

    // Argument completions
    const argIndex = parts.length - 2; // -1 for command, -1 for 0-based index
    if (command.argumentCompletions && command.argumentCompletions[argIndex]) {
      return {
        suggestions: command.argumentCompletions[argIndex],
        type: 'argument',
      };
    }

    return { suggestions: [], type: 'none' };
  }

  /**
   * Install completion scripts for the current shell
   */
  async installCompletions() {
    const shell = process.env.SHELL || '';
    const homeDir = process.env.HOME || process.env.USERPROFILE;

    try {
      if (shell.includes('bash')) {
        await this.installBashCompletion(homeDir);
      } else if (shell.includes('zsh')) {
        await this.installZshCompletion(homeDir);
      } else if (process.platform === 'win32') {
        await this.installPowerShellCompletion(homeDir);
      }

      console.log('✅ Tab completion installed successfully');
      console.log(
        '💡 Restart your shell or run "source ~/.bashrc" to activate'
      );
    } catch (error) {
      console.log('❌ Failed to install tab completion:', error.message);
    }
  }

  /**
   * Install bash completion
   */
  async installBashCompletion(homeDir) {
    const completionScript = this.generateBashCompletion();
    const completionDir = path.join(homeDir, '.bash_completion.d');

    await fs.ensureDir(completionDir);
    await fs.writeFile(path.join(completionDir, 'mdsaad'), completionScript);

    // Add source line to .bashrc if not present
    const bashrcPath = path.join(homeDir, '.bashrc');
    const sourceLine = 'source ~/.bash_completion.d/mdsaad';

    if (await fs.pathExists(bashrcPath)) {
      const bashrcContent = await fs.readFile(bashrcPath, 'utf8');
      if (!bashrcContent.includes(sourceLine)) {
        await fs.appendFile(
          bashrcPath,
          `\n# MDSAAD CLI completion\n${sourceLine}\n`
        );
      }
    }
  }

  /**
   * Install zsh completion
   */
  async installZshCompletion(homeDir) {
    const completionScript = this.generateZshCompletion();
    const completionDir = path.join(homeDir, '.zsh', 'completions');

    await fs.ensureDir(completionDir);
    await fs.writeFile(path.join(completionDir, '_mdsaad'), completionScript);

    // Add fpath to .zshrc if not present
    const zshrcPath = path.join(homeDir, '.zshrc');
    const fpathLine = 'fpath=(~/.zsh/completions $fpath)';

    if (await fs.pathExists(zshrcPath)) {
      const zshrcContent = await fs.readFile(zshrcPath, 'utf8');
      if (!zshrcContent.includes(fpathLine)) {
        await fs.appendFile(
          zshrcPath,
          `\n# MDSAAD CLI completion\n${fpathLine}\nautoload -U compinit && compinit\n`
        );
      }
    }
  }

  /**
   * Install PowerShell completion
   */
  async installPowerShellCompletion(homeDir) {
    const completionScript = this.generatePowerShellCompletion();
    const documentsDir = path.join(homeDir, 'Documents');
    const psDir = path.join(documentsDir, 'PowerShell');

    await fs.ensureDir(psDir);
    await fs.writeFile(
      path.join(psDir, 'mdsaad-completion.ps1'),
      completionScript
    );

    // Add to PowerShell profile
    const profilePath = path.join(psDir, 'Microsoft.PowerShell_profile.ps1');
    const sourceLine = '. $PSScriptRoot/mdsaad-completion.ps1';

    let profileContent = '';
    if (await fs.pathExists(profilePath)) {
      profileContent = await fs.readFile(profilePath, 'utf8');
    }

    if (!profileContent.includes(sourceLine)) {
      await fs.appendFile(
        profilePath,
        `\n# MDSAAD CLI completion\n${sourceLine}\n`
      );
    }
  }

  /**
   * Initialize tab completion system
   */
  initialize() {
    // Register default commands - will be expanded by individual command modules
    this.registerCommand('calculate', {
      aliases: ['calc'],
      options: [
        { flag: '--precision', description: 'Number of decimal places' },
        { flag: '--verbose', description: 'Show detailed output' },
      ],
    });

    this.registerCommand('ai', {
      options: [
        { flag: '--model', description: 'AI model to use' },
        { flag: '--provider', description: 'AI provider' },
        { flag: '--temperature', description: 'Response creativity' },
      ],
    });

    console.log('Tab completion system initialized');
  }
}

module.exports = new TabCompletion();
