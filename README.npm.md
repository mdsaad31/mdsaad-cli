# 🚀 MDSAAD CLI

[![NPM Version](https://img.shields.io/npm/v/mdsaad-cli.svg)](https://www.npmjs.com/package/mdsaad-cli)
[![Downloads](https://img.shields.io/npm/dm/mdsaad-cli.svg)](https://www.npmjs.com/package/mdsaad-cli)
[![Node.js](https://img.shields.io/node/v/mdsaad-cli.svg)](https://nodejs.org/)
[![License](https://img.shields.io/npm/l/mdsaad-cli.svg)](https://github.com/mdsaad31/mdsaad-cli/blob/main/LICENSE)

> **A powerful, secure CLI toolkit with 20+ commands for AI chat, weather, math, ASCII art, and productivity - no API keys required!**

## ✨ **Features**

🤖 **AI Assistant** - Chat with AI models without API keys  
🌤️ **Weather Info** - Real-time weather and forecasts  
🧮 **Math Calculator** - Advanced mathematical calculations  
🎨 **ASCII Art** - Beautiful text art generation  
💱 **Currency Converter** - Live exchange rates  
📏 **Unit Converter** - Length, weight, temperature, and more  
🔢 **Number Systems** - Binary, hex, octal conversions  
📊 **Data Analysis** - Statistics and data processing  
⏰ **Time Zone** - World time conversions  
🎲 **Random Generators** - Passwords, UUIDs, and more  
🔒 **Security Tools** - Hash generation and validation  
💻 **System Info** - Hardware and OS information  
🎯 **QR Codes** - Generate QR codes for text/URLs  
📝 **Text Processing** - Case conversion, validation  
🌐 **IP Tools** - Network utilities  
🎵 **Fun Extras** - Jokes, quotes, and games

## 🚀 **Quick Start**

### Installation

```bash
npm install -g mdsaad-cli
```

### Usage

```bash
# AI Chat
mdsaad ai "Explain quantum computing"

# Weather
mdsaad weather London

# Math Calculator
mdsaad calc "sin(45) + cos(30)"

# ASCII Art
mdsaad ascii "Hello World"

# Currency Conversion
mdsaad currency 100 USD EUR

# And much more...
mdsaad help
```

### 🚨 **Troubleshooting: Command Not Found**

If you get `'mdsaad' is not recognized` after installation:

**Quick Fix (Works Everywhere):**

```bash
npx mdsaad-cli --version
npx mdsaad-cli ai "Hello!"
```

**Permanent Fix:**

- **Windows**: Restart your terminal, or download our [fix script](https://github.com/mdsaad31/mdsaad-cli/raw/main/scripts/fix-windows.bat)
- **macOS/Linux**: Run `echo 'export PATH=$(npm config get prefix)/bin:$PATH' >> ~/.bashrc && source ~/.bashrc`

**Why This Happens**: npm's global directory isn't in your system PATH. Our fix scripts resolve this automatically.

📖 **Full troubleshooting guide**: [INSTALLATION_TROUBLESHOOTING.md](https://github.com/mdsaad31/mdsaad-cli/blob/main/INSTALLATION_TROUBLESHOOTING.md)

## 🎯 **Command Categories**

### 🤖 **AI & Chat**

```bash
mdsaad ai "your question"          # Chat with AI
mdsaad explain "code snippet"      # Code explanation
mdsaad code "create a function"    # Code generation
```

### 🌤️ **Weather & Environment**

```bash
mdsaad weather <location>          # Current weather
mdsaad weather <location> --forecast # 5-day forecast
```

### 🧮 **Mathematics & Calculations**

```bash
mdsaad calc "2 + 2 * 3"           # Basic math
mdsaad calc "sqrt(16) + log(10)"  # Advanced functions
mdsaad stats 1,2,3,4,5            # Statistical analysis
```

### 💱 **Converters & Tools**

```bash
mdsaad currency 100 USD EUR       # Currency conversion
mdsaad units 100 kg lb            # Unit conversion
mdsaad base 42 dec hex            # Number system conversion
mdsaad time "New York"            # Time zones
```

### 🎨 **Text & Art**

```bash
mdsaad ascii "Hello"              # ASCII art
mdsaad qr "https://example.com"   # QR code generation
mdsaad text "hello" upper         # Text transformation
```

### 🔒 **Security & System**

```bash
mdsaad hash "text" sha256         # Hash generation
mdsaad password 16 --secure       # Password generation
mdsaad uuid                       # UUID generation
mdsaad system                     # System information
mdsaad ip                         # IP utilities
```

### 🎲 **Fun & Random**

```bash
mdsaad random 1 100               # Random numbers
mdsaad joke                       # Random jokes
mdsaad quote                      # Inspirational quotes
mdsaad dice 6                     # Dice roll
```

## 🔒 **Security & Privacy**

✅ **No API Keys Required** - Uses secure proxy service  
✅ **Zero Data Storage** - No personal data collected  
✅ **Open Source** - Full transparency  
✅ **Rate Limited** - Prevents abuse  
✅ **Encrypted Communication** - HTTPS only

## 📖 **Full Command List**

| Command    | Description              | Example                        |
| ---------- | ------------------------ | ------------------------------ |
| `ai`       | Chat with AI assistant   | `mdsaad ai "What is Node.js?"` |
| `weather`  | Get weather information  | `mdsaad weather Paris`         |
| `calc`     | Mathematical calculator  | `mdsaad calc "2^8 + sqrt(64)"` |
| `ascii`    | Generate ASCII art       | `mdsaad ascii "HELLO"`         |
| `currency` | Convert currencies       | `mdsaad currency 50 GBP USD`   |
| `units`    | Unit conversions         | `mdsaad units 25 C F`          |
| `base`     | Number system conversion | `mdsaad base 255 dec hex`      |
| `time`     | Time zone information    | `mdsaad time Tokyo`            |
| `stats`    | Statistical analysis     | `mdsaad stats 1,2,3,4,5`       |
| `hash`     | Generate hashes          | `mdsaad hash "secret" md5`     |
| `password` | Generate passwords       | `mdsaad password 12 --secure`  |
| `uuid`     | Generate UUIDs           | `mdsaad uuid`                  |
| `qr`       | Generate QR codes        | `mdsaad qr "Hello World"`      |
| `text`     | Text transformations     | `mdsaad text "hello" title`    |
| `random`   | Random numbers           | `mdsaad random 10 99`          |
| `system`   | System information       | `mdsaad system`                |
| `ip`       | IP address utilities     | `mdsaad ip`                    |
| `joke`     | Random jokes             | `mdsaad joke`                  |
| `quote`    | Inspirational quotes     | `mdsaad quote`                 |
| `dice`     | Roll dice                | `mdsaad dice 20`               |

## 🛠️ **Requirements**

- **Node.js** 16.0.0 or higher
- **NPM** 8.0.0 or higher
- **Internet connection** (for AI, weather, currency features)

## 🌐 **Cross-Platform**

✅ **Windows** (PowerShell, CMD)  
✅ **macOS** (Terminal, iTerm2)  
✅ **Linux** (Bash, Zsh, Fish)

## 🔧 **Configuration**

The CLI works out-of-the-box with no configuration required. All API calls are routed through our secure proxy service.

### Optional: Update Check

```bash
mdsaad --version        # Check version
mdsaad --help          # Full help
mdsaad <command> --help # Command-specific help
```

## 🤝 **Contributing**

We welcome contributions! Please see our [Contributing Guide](https://github.com/mdsaad31/mdsaad-cli/blob/main/CONTRIBUTING.md).

### Development Setup

```bash
git clone https://github.com/mdsaad31/mdsaad-cli.git
cd mdsaad-cli
npm install
npm run dev
```

## 🐛 **Bug Reports & Feature Requests**

- **GitHub Issues**: https://github.com/mdsaad31/mdsaad-cli/issues
- **Email**: mohammedsaad0462@gmail.com

## 📄 **License**

MIT License - see [LICENSE](https://github.com/mdsaad31/mdsaad-cli/blob/main/LICENSE) file.

## 🙏 **Acknowledgments**

- Built with ❤️ using Node.js
- Powered by secure proxy architecture
- Inspired by developer productivity needs

---

**⭐ Star us on [GitHub](https://github.com/mdsaad31/mdsaad-cli) if you find this tool helpful!**
