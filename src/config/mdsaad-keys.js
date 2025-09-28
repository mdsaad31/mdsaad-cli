/**
 * MDSAAD API Configuration - Proxy-First Architecture
 * 
 * 🚀 ZERO SETUP REQUIRED: This CLI uses a proxy server - no API keys needed!
 * 
 * How it works:
 * 1. CLI sends requests to proxy server (managed by MDSAAD)
 * 2. Proxy server handles all API calls with secure keys
 * 3. Users get instant access without any configuration
 * 
 * Fallback: Direct API keys only used if proxy server is unavailable
 * 
 * SECURITY: No sensitive API keys stored in this codebase
 */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Get user's home directory for config
const CONFIG_DIR = path.join(os.homedir(), '.mdsaad');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Configuration for proxy-first architecture
 * All API calls go through the proxy server, no local API keys needed
 */
function loadApiKeys() {
  const config = loadUserConfig();

  return {
    // Proxy API Configuration (primary method)
    proxy: {
      enabled: true,
      baseUrl: process.env.MDSAAD_PROXY_URL || config.proxyUrl || 'https://mdsaad-proxy-api.onrender.com',
      timeout: 30000,
      retries: 3
    },
    
    // AI Service Configuration (fallback only)
    ai: {
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY || config.apiKeys?.openrouter || null,
        baseUrl: 'https://openrouter.ai/api',
        models: {
          'deepseek-chat': 'deepseek/deepseek-chat',
          'deepseek-coder': 'deepseek/deepseek-coder',
          'llama-3.1-8b': 'meta-llama/llama-3.1-8b-instruct:free',
          'llama-3.1-70b': 'meta-llama/llama-3.1-70b-instruct:free',
          'mixtral-8x7b': 'mistralai/mixtral-8x7b-instruct:free',
          'gemma-7b': 'google/gemma-7b-it:free'
        },
        defaultModel: 'deepseek-chat'
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY || config.apiKeys?.groq || null,
        baseUrl: 'https://api.groq.com/openai',
        models: {
          'llama-3.1-8b': 'llama-3.1-8b-instant',
          'llama-3.1-70b': 'llama-3.1-70b-versatile',
          'mixtral-8x7b': 'mixtral-8x7b-32768',
          'gemma-7b': 'gemma-7b-it'
        },
        defaultModel: 'llama-3.1-8b'
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY || config.apiKeys?.deepseek || null,
        baseUrl: 'https://api.deepseek.com',
        models: {
          'deepseek-chat': 'deepseek-chat',
          'deepseek-coder': 'deepseek-coder'
        },
        defaultModel: 'deepseek-chat'
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || config.apiKeys?.gemini || null,
        baseUrl: 'https://generativelanguage.googleapis.com',
        models: {
          'gemini-pro': 'gemini-pro',
          'gemini-1.5-flash': 'gemini-1.5-flash'
        },
        defaultModel: 'gemini-pro'
      }
    },

    // Provider priority order (first = highest priority)
    aiProviderPriority: ['openrouter', 'groq', 'deepseek', 'gemini'],

    // Weather Service Configuration  
    weather: {
      weatherapi: {
        apiKey: process.env.WEATHERAPI_KEY || config.apiKeys?.weatherapi || null,
        baseUrl: 'http://api.weatherapi.com/v1'
      },
      openweathermap: {
        apiKey: process.env.OPENWEATHERMAP_KEY || config.apiKeys?.openweathermap || null,
        baseUrl: 'http://api.openweathermap.org/data/2.5'
      }
    },

    // Rate Limiting (optional - to prevent abuse)
    rateLimit: {
      ai: {
        requestsPerHour: 100,
        requestsPerDay: 500
      },
      weather: {
        requestsPerHour: 200,
        requestsPerDay: 1000
      }
    },

    // Usage Analytics (optional - to track usage)
    analytics: {
      enabled: false,
      endpoint: 'https://api.your-domain.com/analytics'
    }
  };
}

/**
 * Load user configuration from config file
 */
function loadUserConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const configContent = fs.readFileSync(CONFIG_FILE, 'utf8');
      return JSON.parse(configContent);
    }
  } catch (error) {
    console.warn('Warning: Could not load user config file:', error.message);
  }
  return {};
}

/**
 * Save user configuration to config file
 */
function saveUserConfig(config) {
  try {
    // Create config directory if it doesn't exist
    if (!fs.existsSync(CONFIG_DIR)) {
      fs.mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Save config to file
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving user config:', error.message);
    return false;
  }
}

/**
 * Check if services are available (proxy-first approach)
 */
function checkApiKeysConfigured() {
  const keys = loadApiKeys();
  
  // With proxy, services are always available unless explicitly disabled
  const proxyEnabled = keys.proxy && keys.proxy.enabled !== false;
  
  // Fallback API keys (only used if proxy fails)
  const hasAiKey = keys.ai.openrouter.apiKey || keys.ai.groq.apiKey || 
                   keys.ai.deepseek.apiKey || keys.ai.gemini.apiKey;
  const hasWeatherKey = keys.weather.weatherapi.apiKey || keys.weather.openweathermap.apiKey;
  
  return {
    ai: proxyEnabled || !!hasAiKey,
    weather: proxyEnabled || !!hasWeatherKey,
    proxy: proxyEnabled,
    hasAnyKeys: proxyEnabled || hasAiKey || hasWeatherKey
  };
}

/**
 * Get setup instructions (proxy-first approach)
 */
function getSetupInstructions() {
  return {
    message: '🎉 MDSAAD CLI works out-of-the-box! No setup required.',
    methods: [
      {
        title: '✅ Instant Setup (Recommended)',
        instructions: [
          '🚀 Just run commands - they work immediately!',
          '• mdsaad ai "What is JavaScript?"',
          '• mdsaad weather London',
          '• mdsaad calc "2+2*5"',
          '',
          '💡 How it works:',
          '• All requests go through MDSAAD proxy server',
          '• No API keys or configuration needed from you',
          '• Free tier with generous usage limits',
          '• Secure and reliable service'
        ]
      },
      {
        title: '🔧 Custom Proxy (Optional)',
        instructions: [
          'Set your own proxy URL:',
          '  MDSAAD_PROXY_URL=your_proxy_server_url',
          'Or in config file (~/.mdsaad/config.json):',
          '{',
          '  "proxyUrl": "your_proxy_server_url"',
          '}'
        ]
      },
      {
        title: '🔑 Direct API Keys (Fallback)',
        instructions: [
          'Only needed if you want to use your own API keys:',
          '  OPENROUTER_API_KEY=your_key_here',
          '  GROQ_API_KEY=your_key_here',
          '  WEATHERAPI_KEY=your_key_here',
          '',
          'Get keys from:',
          '• OpenRouter: https://openrouter.ai/',
          '• Groq: https://groq.com/', 
          '• WeatherAPI: https://weatherapi.com/'
        ]
      }
    ]
  };
}

// Export the configuration and utility functions
module.exports = {
  ...loadApiKeys(),
  loadApiKeys,
  loadUserConfig,
  saveUserConfig,
  checkApiKeysConfigured,
  getSetupInstructions,
  CONFIG_DIR,
  CONFIG_FILE
};