# 🔑 API Keys Configuration for MDSAAD CLI

## Overview
Your MDSAAD CLI now provides **FREE AI and Weather services** to all users by using your API keys. Users don't need to configure anything - they get free access through your accounts.

## 📍 Where to Add Your API Keys

### File Location: `src/config/mdsaad-keys.js`

Replace the placeholder values with your actual API keys:

```javascript
module.exports = {
  // AI Service Configuration - Multiple providers for free access
  ai: {
    gemini: {
      apiKey: 'YOUR_GEMINI_API_KEY_HERE',    // 🔑 PUT YOUR GEMINI API KEY HERE
      baseUrl: 'https://generativelanguage.googleapis.com',
      model: 'gemini-pro'
    },
    deepseek: {
      apiKey: 'YOUR_DEEPSEEK_API_KEY_HERE',  // 🔑 PUT YOUR DEEPSEEK API KEY HERE
      baseUrl: 'https://api.deepseek.com',
      model: 'deepseek-chat'
    },
    openrouter: {
      apiKey: 'YOUR_OPENROUTER_API_KEY_HERE', // 🔑 PUT YOUR OPENROUTER API KEY HERE
      baseUrl: 'https://openrouter.ai/api',
      model: 'meta-llama/llama-3.1-8b-instruct:free' // Free model
    }
  },

  // Weather Service Configuration  
  weather: {
    openweathermap: {
      apiKey: 'YOUR_OPENWEATHERMAP_API_KEY_HERE', // 🔑 PUT YOUR OPENWEATHERMAP API KEY HERE
      baseUrl: 'https://api.openweathermap.org/data/2.5'
    },
    weatherapi: {
      apiKey: 'YOUR_WEATHERAPI_API_KEY_HERE',     // 🔑 PUT YOUR WEATHERAPI API KEY HERE  
      baseUrl: 'https://api.weatherapi.com/v1'
    }
  }
}
```

## 🎯 What Gets the Free API Access

### AI Services (Free Models):
1. **Google Gemini** (gemini-pro) - Free tier
2. **DeepSeek** (deepseek-chat) - Free API  
3. **OpenRouter** (meta-llama/llama-3.1-8b-instruct:free) - Free model
4. **Ollama** (local models) - Always free

### Weather Services:
1. **OpenWeatherMap** - Free tier (1000 calls/day)
2. **WeatherAPI** - Free tier (1M calls/month)

## 🔄 How It Works

### AI Commands:
- Users run: `mdsaad ai "Hello world"`
- System automatically selects the best available free provider
- Uses your API keys in the background
- Users get responses without any configuration

### Weather Commands:
- Users run: `mdsaad weather "New York"`
- System tries providers in priority order (your API keys)
- Users get weather data without any setup

## 🚀 Priority Order

### AI Providers (by priority):
1. **Gemini** (priority: 1) - Usually selected first
2. **DeepSeek** (priority: 2) - Fallback if Gemini fails  
3. **OpenRouter** (priority: 3) - Second fallback
4. **Ollama** (priority: 4) - Local fallback if available

### Weather Providers (by priority):
1. **OpenWeatherMap** (priority: 2) - Primary weather source
2. **WeatherAPI** (priority: 3) - Fallback weather source

## 🛡️ Security Notes

- Your API keys are stored locally in the CLI code
- Users never see your keys - they're hidden in the implementation  
- Each API call includes proper attribution headers
- Rate limiting is handled gracefully with fallbacks

## 📊 Usage Monitoring

The system will automatically:
- Track API usage per provider
- Handle rate limits gracefully  
- Switch to backup providers when needed
- Log all API interactions for monitoring

## 🎨 User Experience

Users will see:
```bash
$ mdsaad ai "Hello world"
🤖 Google Gemini (Free) (gemini-pro)

Hello! I'm here to help you with any questions or tasks you have...

Response generated in 1.2s
```

```bash
$ mdsaad weather "London"  
🌤️ London, England, United Kingdom

Current Weather:
Temperature: 15°C (59°F)
Condition: Partly Cloudy
...
```

## ✅ Testing After Setup

1. Add your API keys to `mdsaad-keys.js`
2. Test AI: `mdsaad ai "Test message"`  
3. Test Weather: `mdsaad weather "Your City"`
4. Check logs to see which providers are active

---

**Ready to provide free AI and weather services to your users! 🚀**