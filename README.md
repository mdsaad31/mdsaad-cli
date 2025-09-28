# mdsaad CLI Tool

A comprehensive, secure, and feature-rich command-line utility for mathematical calculations, AI interactions, weather information, currency conversions, ASCII art, and much more.

[![npm version](https://badge.fury.io/js/mdsaad-cli.svg)](https://badge.fury.io/js/mdsaad-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js CI](https://github.com/yourusername/mdsaad-cli/workflows/Node.js%20CI/badge.svg)](https://github.com/yourusername/mdsaad-cli/actions)
[![Coverage Status](https://coveralls.io/repos/github/yourusername/mdsaad-cli/badge.svg?branch=main)](https://coveralls.io/github/yourusername/mdsaad-cli?branch=main)

## ✨ Features

### 🔐 **Security First**
- **Input Validation**: Comprehensive validation and sanitization for all user inputs
- **Encrypted Storage**: AES-256-GCM encryption for API keys and sensitive data
- **Network Security**: TLS enforcement, certificate pinning, and secure communications
- **Rate Limiting**: Protection against abuse and DoS attacks

### 🧮 **Mathematical Operations**
- Advanced mathematical expressions with support for trigonometric, logarithmic, and statistical functions
- High-precision calculations with configurable decimal places
- Support for constants like π, e, and mathematical functions

### 🤖 **AI Integration**
- Multiple AI provider support (OpenAI, Anthropic, Cohere, Hugging Face)
- Streaming responses for real-time AI interactions  
- Context management for conversational AI
- Configurable model parameters (temperature, max tokens, etc.)

### 🌤️ **Weather Information**
- Current weather conditions for any location worldwide
- Detailed forecasts with up to 10 days ahead
- Weather alerts and warnings
- Multiple unit systems (metric, imperial, kelvin)
- Multi-language weather descriptions

### 💱 **Currency & Unit Conversion**
- Real-time currency exchange rates with 150+ currencies
- Historical exchange rate data
- Unit conversions (length, weight, temperature, volume, area, speed, energy)
- Batch conversions from files
- Favorite conversion pairs management

### � **ASCII Art & Entertainment**
- Extensive ASCII art collection with 100+ designs
- Animated ASCII art with multiple animation styles
- Customizable colors and themes
- Category-based art organization (superheroes, logos, animals)

### 🔌 **Plugin System**
- Extensible architecture with custom plugins
- Plugin marketplace and management
- Hot-reloading plugin development
- Secure plugin sandboxing

### 🚀 **Performance Optimization**
- Startup optimization with lazy loading
- Memory management and garbage collection monitoring
- Performance profiling and benchmarking
- Offline capabilities with caching

### 🌐 **Cross-Platform Support**
- Windows, macOS, and Linux compatibility
- Shell completion for bash, zsh, fish, and PowerShell
- Package manager integration (npm, brew, chocolatey, apt)
- Platform-specific optimizations

## 📦 Installation

### Using npm (Recommended)
```bash
# Install globally
npm install -g mdsaad-cli

# Or run without installing
npx mdsaad-cli --help
```

### Using Package Managers

#### macOS (Homebrew)
```bash
brew tap yourusername/mdsaad
brew install mdsaad-cli
```

#### Windows (Chocolatey)
```bash
choco install mdsaad-cli
```

#### Linux (APT)
```bash
curl -fsSL https://deb.yourdomain.com/gpg | sudo apt-key add -
echo "deb https://deb.yourdomain.com/ stable main" | sudo tee /etc/apt/sources.list.d/mdsaad.list
sudo apt update && sudo apt install mdsaad-cli
```

### From Source
```bash
git clone https://github.com/yourusername/mdsaad-cli.git
cd mdsaad-cli
npm install
npm link
```

## � Initial Setup

**⚠️ IMPORTANT: Configure API Keys First**

MDSAAD requires API keys for AI and weather services. **No API keys are included** for security reasons.

### Quick Setup
```bash
# Interactive setup (recommended)
mdsaad config setup

# Check configuration status  
mdsaad config show

# Set individual keys
mdsaad config set openrouter sk-your-key-here
mdsaad config set weatherapi your-weather-key
```

### Get Free API Keys

1. **OpenRouter** (AI Models): https://openrouter.ai/
   - Free tier with multiple AI models
   - Best option for AI features

2. **Groq** (Fast AI): https://groq.com/
   - Free tier with fast inference
   - Good backup option

3. **WeatherAPI** (Weather): https://weatherapi.com/
   - Free tier with 1M requests/month
   - Required for weather features

### Configuration Methods

#### Method 1: Interactive Setup
```bash
mdsaad config setup
# Follow the prompts to enter your API keys
```

#### Method 2: Environment Variables
```bash
export OPENROUTER_API_KEY="sk-your-key-here"
export GROQ_API_KEY="gsk_your-key-here" 
export WEATHERAPI_KEY="your-weather-key"
export GEMINI_API_KEY="your-gemini-key"  # Optional
```

#### Method 3: Configuration File
Create `~/.mdsaad/config.json`:
```json
{
  "apiKeys": {
    "openrouter": "sk-your-openrouter-key",
    "groq": "gsk_your-groq-key",
    "weatherapi": "your-weatherapi-key",
    "gemini": "your-gemini-key"
  }
}
```

## �🚀 Quick Start

### Basic Examples

```bash
# Mathematical calculations (no API key required)
mdsaad calculate "sin(pi/2) + cos(0)"
mdsaad calc "sqrt(16) * log(10)" --precision 6

# AI interactions (requires API key)
mdsaad ai "Explain quantum computing in simple terms"
mdsaad ai "Write a Python function to sort a list" --model deepseek-chat

# Weather information (requires weather API key)
mdsaad weather "New York"
mdsaad weather "London, UK" --forecast --days 7

# Currency conversion (no API key required)
mdsaad convert 100 USD EUR
mdsaad convert 50 GBP JPY --historical 2024-01-01

# ASCII art (no API key required)
mdsaad show batman --animated --color green
mdsaad show logo --animation wave --speed 150

# Configuration management
mdsaad config show
mdsaad config setup
```

### Advanced Usage

```bash
# Plugin management
mdsaad plugin list
mdsaad plugin install weather-extended
mdsaad plugin develop my-plugin

# Performance monitoring
mdsaad performance monitor --duration 30 --watch
mdsaad performance optimize

# Maintenance operations
mdsaad maintenance cleanup
mdsaad maintenance backup --encrypt

# Cross-platform setup
mdsaad platform --setup-completion bash
mdsaad platform --info
```

## 🔐 Security

Security is a top priority for mdsaad CLI. The tool implements multiple security layers:

### Input Security
- **Validation**: All inputs are validated against strict patterns
- **Sanitization**: Automatic sanitization of potentially dangerous content
- **Rate Limiting**: Protection against abuse and DoS attacks

### Data Security  
- **Encryption**: AES-256-GCM encryption for sensitive data at rest
- **Secure Storage**: OS-appropriate secure directories with proper permissions
- **Key Management**: Secure API key storage with automatic rotation

### Network Security
- **TLS Enforcement**: All network communications use TLS 1.2+
- **Certificate Validation**: Strict certificate verification and pinning
- **Request Signing**: HMAC-based request/response integrity verification

### Usage Security
```bash
# Check security status
mdsaad security status --verbose

# Perform security audit
mdsaad security audit --detailed

# Manage API keys securely
mdsaad security keys set weather-api
mdsaad security keys list

# Validate inputs
mdsaad security validate "user@example.com" --type email
```

## 📚 Available Commands

### Core Commands
- `calculate` - Mathematical calculations and expressions
- `ai` - AI-powered interactions and responses
- `weather` - Weather information and forecasts
- `convert` - Currency and unit conversions
- `show` - ASCII art display with animations

### System Commands
- `security` - Security management and validation
- `performance` - Performance monitoring and optimization
- `plugin` - Plugin management and development
- `maintenance` - System maintenance and cleanup
- `platform` - Cross-platform compatibility tools
- `update` - Update management and version control

### Utility Commands
- `language` - Interface language management
- `enhanced` - Enhanced UX features and configuration
- `debug` - Debugging and diagnostics
- `api` - API provider management

## 🔧 Configuration

The CLI tool uses a hierarchical configuration system located at `~/.config/mdsaad/`.

### Security Configuration
All sensitive data is encrypted and stored securely. API keys are never stored in plain text.

```bash
# Configure security settings
mdsaad security status
mdsaad security keys set <service-name>
```

### Performance Configuration
```bash
# Optimize for your system
mdsaad performance optimize
mdsaad performance status
```

## 🧪 Testing

Comprehensive test suite with high coverage:

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:security
npm run test:performance

# Generate coverage report
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone repository
git clone https://github.com/yourusername/mdsaad-cli.git
cd mdsaad-cli

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 📞 Support

- 📖 Documentation: Full documentation available in the `/docs` directory
- 🐛 Issues: [GitHub Issues](https://github.com/yourusername/mdsaad-cli/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/yourusername/mdsaad-cli/discussions)

---

**Made with ❤️ and 🔐 security in mind**

*mdsaad CLI - Your comprehensive, secure command-line companion.*