# Configuration Management

The mdsaad CLI tool uses a comprehensive configuration management system to handle user preferences, API keys, and application settings. Configuration is stored in `~/.mdsaad/config.json` and can be managed through various methods.

## Configuration Structure

```json
{
  "language": "en",
  "defaultPrecision": 4,
  "cacheDirectory": "~/.mdsaad/cache",
  "apiKeys": {
    "openweather": null,
    "exchangerate": null,
    "gemini": null,
    "deepseek": null,
    "openrouter": null,
    "nvidia": null,
    "groq": null
  },
  "preferences": {
    "weatherUnits": "metric",
    "currencyFavorites": ["USD", "EUR", "GBP"],
    "colorScheme": "auto"
  },
  "rateLimit": {
    "ai": { "requests": 10, "window": 3600000 },
    "weather": { "requests": 1000, "window": 86400000 }
  }
}
```

## Configuration Management Methods

### 1. Command Line Options

Set configuration values directly through CLI commands:

```bash
# Set language preference
mdsaad --lang es

# Enable verbose logging
mdsaad --verbose

# Enable debug mode
mdsaad --debug
```

### 2. Configuration Manager Utility

Use the built-in configuration manager for comprehensive setup:

```bash
# Show current configuration
npm run config show
# or
node utils/config-manager.js show

# Interactive API key setup
npm run config setup-api

# Set specific configuration values
npm run config set language "es"
npm run config set preferences.weatherUnits "imperial"

# Get configuration values
npm run config get language
npm run config get preferences.weatherUnits

# Show configuration statistics
npm run config stats

# Export configuration to file
npm run config export my-config.json

# Import configuration from file
npm run config import my-config.json

# Reset to defaults
npm run config reset
```

### 3. Environment Variables

Override configuration using environment variables (useful for CI/CD):

```bash
# API Keys
export MDSAAD_OPENWEATHER_KEY="your-api-key"
export MDSAAD_EXCHANGERATE_KEY="your-api-key"
export MDSAAD_GEMINI_KEY="your-api-key"
export MDSAAD_DEEPSEEK_KEY="your-api-key"
export MDSAAD_OPENROUTER_KEY="your-api-key"
export MDSAAD_NVIDIA_KEY="your-api-key"
export MDSAAD_GROQ_KEY="your-api-key"

# Other settings
export MDSAAD_LANGUAGE="es"
export MDSAAD_CACHE_DIR="/custom/cache/path"
```

### 4. Direct File Editing

Manually edit the configuration file:

```bash
# Location varies by OS:
# Windows: C:\Users\username\.mdsaad\config.json
# macOS: /Users/username/.mdsaad/config.json
# Linux: /home/username/.mdsaad/config.json
```

## API Key Setup

The tool supports multiple AI and service providers. Set up API keys for the services you want to use:

### Free Tier APIs

1. **OpenWeatherMap** - Weather data
   - Sign up at: https://openweathermap.org/api
   - Free tier: 1000 calls/day

2. **ExchangeRate-API** - Currency conversion
   - Sign up at: https://exchangerate-api.com/
   - Free tier: 1500 requests/month

3. **Gemini** - Google's AI model
   - Get API key from: https://makersuite.google.com/
   - Free tier with generous limits

4. **Deepseek AI** - AI assistance
   - Sign up at: https://platform.deepseek.com/
   - Free tier available

5. **OpenRouter** - Multiple AI models
   - Sign up at: https://openrouter.ai/
   - Pay-per-use pricing

6. **NVIDIA AI** - AI models
   - Get access at: https://developer.nvidia.com/
   - Free tier for developers

7. **Groq** - Fast AI inference
   - Sign up at: https://console.groq.com/
   - Free tier available

### Interactive Setup

The easiest way to configure API keys:

```bash
npm run config setup-api
```

This will guide you through setting up each API key with prompts and validation.

## Configuration Validation

The system automatically validates configuration to ensure:

- Language codes are supported
- Precision values are within valid range (0-20)
- Required configuration properties exist
- API keys are properly formatted

Invalid configurations are rejected and fallback to defaults.

## Cache Management

Configuration includes cache directory management:

```bash
# Default cache location
~/.mdsaad/cache/

# Custom cache directory
npm run config set cacheDirectory "/custom/path"
```

The cache stores:

- Weather data (30-minute TTL)
- Exchange rates (daily updates)
- AI response caching (configurable)

## Backup and Migration

Export and import configurations for backup or migration:

```bash
# Backup current configuration
npm run config export backup-$(date +%Y%m%d).json

# Restore from backup
npm run config import backup-20230927.json
```

## Security Considerations

- API keys are stored in plain text in the config file
- Ensure proper file permissions on the config directory
- Use environment variables in production environments
- Never commit config files with API keys to version control

## Troubleshooting

### Configuration File Corrupted

```bash
# Reset to defaults
npm run config reset --yes
```

### Permission Issues

```bash
# Check directory permissions
ls -la ~/.mdsaad/

# Fix permissions if needed (Unix/macOS)
chmod 755 ~/.mdsaad/
chmod 644 ~/.mdsaad/config.json
```

### API Key Issues

```bash
# Verify API key configuration
npm run config get apiKeys

# Test specific service (example for weather)
mdsaad weather London --verbose
```

### Cache Issues

```bash
# Check cache statistics
npm run config stats

# Clear cache manually
rm -rf ~/.mdsaad/cache/*
```
