/**
 * MDSAAD Proxy API Server
 * 
 * Deploy this on services like:
 * - Vercel (easiest, free tier)
 * - Railway
 * - Heroku 
 * - DigitalOcean App Platform
 * - AWS Lambda + API Gateway
 * 
 * This server handles all API requests from CLI users
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors());

// Your actual API keys (keep these in environment variables on server)
const API_KEYS = {
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  WEATHERAPI_KEY: process.env.WEATHERAPI_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY
};

// Keep-alive mechanism to prevent cold starts
let keepAliveInterval;
let keepAliveCount = 0;

function startKeepAlive() {
  // Self-ping every 12 minutes to prevent Render from sleeping (Render sleeps after 15 minutes)
  if (process.env.NODE_ENV === 'production') {
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL || 
                        process.env.RAILWAY_STATIC_URL || 
                        `http://localhost:${PORT}`;
    
    console.log(`🏓 Starting keep-alive system targeting: ${keepAliveUrl}`);
    
    keepAliveInterval = setInterval(async () => {
      keepAliveCount++;
      const timestamp = new Date().toISOString();
      
      try {
        // Ping health endpoint
        const healthResponse = await axios.get(`${keepAliveUrl}/health`, { timeout: 10000 });
            const timestamp = new Date().toISOString();
    console.log(`\n🔄 Keep-alive check at ${timestamp}`);
    console.log(`🌐 Testing endpoints for: ${EXTERNAL_URL}`);
    
    const results = {
      health: '❌ Failed',
      ai: '❌ Failed', 
      weather: '❌ Failed'
    };
    
    try {
      // Test health endpoint
      const healthResponse = await axios.get(`${EXTERNAL_URL}/health`, {
        timeout: 10000,
        validateStatus: (status) => status < 500
      });
      
      results.health = `✅ ${healthResponse.status} - ${healthResponse.data?.status || 'OK'}`;
      console.log(`   Health: ${results.health}`);
      
    } catch (error) {
      results.health = `❌ Health failed: ${error.code || error.message}`;
      console.log(`   ${results.health}`);
    }
    
    try {
      // Test AI endpoint with minimal request
      const aiTestResponse = await axios.post(`${EXTERNAL_URL}/v1/chat/completions`, {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
        temperature: 0
      }, {
        timeout: 20000,
        validateStatus: (status) => status < 500,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MdSaad-CLI-KeepAlive/1.0'
        }
      });
      
      results.ai = `✅ AI: ${aiTestResponse.status}`;
      if (aiTestResponse.data?.error) {
        results.ai += ` - Error: ${aiTestResponse.data.error.type || 'Unknown'}`;
      }
      console.log(`   ${results.ai}`);
      
    } catch (error) {
      results.ai = `❌ AI failed: ${error.response?.status || error.code} - ${error.response?.data?.error?.message || error.message}`;
      console.log(`   ${results.ai}`);
    }
    
    try {
      // Test weather endpoint
      const weatherResponse = await axios.get(`${EXTERNAL_URL}/weather?location=London`, {
        timeout: 12000,
        validateStatus: (status) => status < 500
      });
      
      results.weather = `✅ Weather: ${weatherResponse.status}`;
      console.log(`   ${results.weather}`);
      
    } catch (error) {
      results.weather = `❌ Weather failed: ${error.response?.status || error.code} - ${error.message}`;
      console.log(`   ${results.weather}`);
    }
    
    console.log(`📊 Keep-alive summary: Health(${results.health.includes('✅') ? 'OK' : 'FAIL'}) | AI(${results.ai.includes('✅') ? 'OK' : 'FAIL'}) | Weather(${results.weather.includes('✅') ? 'OK' : 'FAIL'})\n`);
        
        // Occasionally test API endpoints to keep them warm
        if (keepAliveCount % 5 === 0) {
          try {
            // Test AI endpoint
            await axios.post(`${keepAliveUrl}/v1/ai/chat`, {
              prompt: 'Keep-alive test',
              client_id: 'internal-keepalive',
              max_tokens: 5
            }, { timeout: 15000 });
            console.log(`🤖 Keep-alive #${keepAliveCount}: AI endpoint tested ✅`);
          } catch (aiError) {
            console.log(`🤖 Keep-alive #${keepAliveCount}: AI test failed - ${aiError.message}`);
          }
        }
        
      } catch (error) {
        console.log(`🏓 Keep-alive #${keepAliveCount} failed: ${error.message} - ${timestamp}`);
      }
    }, 12 * 60 * 1000); // 12 minutes
    
    // Initial ping after 30 seconds
    setTimeout(async () => {
      try {
        await axios.get(`${keepAliveUrl}/health`, { timeout: 10000 });
        console.log(`🏓 Initial keep-alive ping successful`);
      } catch (error) {
        console.log(`🏓 Initial keep-alive ping failed: ${error.message}`);
      }
    }, 30000);
  }
}

// Stop keep-alive on shutdown
process.on('SIGTERM', () => {
  console.log('📴 Shutting down keep-alive system...');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
});

process.on('SIGINT', () => {
  console.log('📴 Shutting down keep-alive system...');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  process.exit(0);
});

// Rate limiting - adjust based on your API quotas
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Global limit
  message: { error: 'Too many requests, please try again later' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Increased to 100 requests per hour for AI
  message: { 
    error: { 
      message: 'AI rate limit exceeded. Try again in an hour.',
      type: 'rate_limit_exceeded',
      code: 'RATE_LIMITED'
    } 
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for keep-alive requests
    const userAgent = req.get('User-Agent') || '';
    return userAgent.includes('KeepAlive') || userAgent.includes('GitHub-Actions');
  }
});

const weatherLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour  
  max: 200, // Increased to 200 requests per hour for weather
  message: { 
    error: { 
      message: 'Weather rate limit exceeded. Try again in an hour.',
      type: 'rate_limit_exceeded',
      code: 'RATE_LIMITED'
    } 
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(globalLimiter);

// Usage tracking (optional - store in database for analytics)
const usageStats = new Map();

function trackUsage(clientId, service, tokens = 0) {
  const key = `${clientId}_${service}`;
  const today = new Date().toISOString().split('T')[0];
  
  if (!usageStats.has(key)) {
    usageStats.set(key, { requests: 0, tokens: 0, lastUsed: today });
  }
  
  const stats = usageStats.get(key);
  stats.requests++;
  stats.tokens += tokens;
  stats.lastUsed = today;
}

// Health check endpoints
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    services: {
      ai: !!API_KEYS.OPENROUTER_API_KEY,
      weather: !!API_KEYS.WEATHERAPI_KEY
    },
    timestamp: new Date().toISOString()
  });
});

app.get('/v1/status', (req, res) => {
  res.json({
    status: 'online',
    services: {
      ai: !!API_KEYS.OPENROUTER_API_KEY,
      weather: !!API_KEYS.WEATHERAPI_KEY
    },
    limits: {
      ai: '50 requests/hour per user',
      weather: '100 requests/hour per user'
    },
    timestamp: new Date().toISOString()
  });
});

// OpenAI Compatible Chat Completions endpoint (used by CLI)
app.post('/v1/chat/completions', aiLimiter, async (req, res) => {
  try {
    const { messages, model = 'gpt-3.5-turbo', max_tokens = 1000, temperature = 0.7 } = req.body;
    
    console.log(`🤖 AI Request: ${messages?.[0]?.content?.substring(0, 50)}... | Model: ${model}`);

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ 
        error: { 
          message: 'Messages array is required',
          type: 'invalid_request_error',
          code: 'missing_messages'
        } 
      });
    }

    const prompt = messages[messages.length - 1]?.content;
    if (!prompt) {
      return res.status(400).json({ 
        error: { 
          message: 'Message content is required',
          type: 'invalid_request_error',
          code: 'missing_content'
        } 
      });
    }

    // Track usage
    trackUsage('cli-user', 'ai', max_tokens);

    // Try OpenRouter first (most reliable)
    let response;
    let modelUsed = 'gpt-3.5-turbo';
    let provider = 'openrouter';

    try {
      if (API_KEYS.OPENROUTER_API_KEY) {
        console.log(`🔄 Trying OpenRouter with deepseek-chat...`);
        response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'deepseek/deepseek-chat',
          messages: messages,
          max_tokens: Math.min(max_tokens, 4000),
          temperature: Math.max(0, Math.min(temperature, 2))
        }, {
          headers: {
            'Authorization': `Bearer ${API_KEYS.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'X-Title': 'MdSaad CLI Tool',
            'HTTP-Referer': 'https://github.com/mdsaad13/mdsaad-cli'
          },
          timeout: 35000
        });

        modelUsed = 'deepseek-chat';
        provider = 'openrouter';
        
        console.log(`✅ OpenRouter successful: ${response.data.choices[0]?.message?.content?.substring(0, 50)}...`);
        
        return res.json({
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelUsed,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: response.data.choices[0].message.content
            },
            finish_reason: response.data.choices[0].finish_reason || 'stop'
          }],
          usage: response.data.usage || { 
            prompt_tokens: 10,
            completion_tokens: response.data.choices[0].message.content.split(' ').length,
            total_tokens: 10 + response.data.choices[0].message.content.split(' ').length
          },
          system_fingerprint: `${provider}_${Date.now()}`
        });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      console.error(`❌ OpenRouter failed: ${error.response?.status} - ${errorMsg}`);
      
      if (error.response?.status === 401) {
        console.error('🔑 API Key issue with OpenRouter');
      } else if (error.response?.status === 429) {
        console.error('🚫 Rate limited by OpenRouter');
      }
    }

    // Fallback to Groq
    try {
      if (API_KEYS.GROQ_API_KEY) {
        console.log(`🔄 Trying Groq with llama-3.1-8b-instant...`);
        response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: messages,
          max_tokens: Math.min(max_tokens, 8000),
          temperature: Math.max(0, Math.min(temperature, 2))
        }, {
          headers: {
            'Authorization': `Bearer ${API_KEYS.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        modelUsed = 'llama-3.1-8b';
        provider = 'groq';
        
        console.log(`✅ Groq successful: ${response.data.choices[0]?.message?.content?.substring(0, 50)}...`);
        
        return res.json({
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          created: Math.floor(Date.now() / 1000),
          model: modelUsed,
          choices: [{
            index: 0,
            message: {
              role: 'assistant',
              content: response.data.choices[0].message.content
            },
            finish_reason: response.data.choices[0].finish_reason || 'stop'
          }],
          usage: response.data.usage || { 
            prompt_tokens: 10,
            completion_tokens: response.data.choices[0].message.content.split(' ').length,
            total_tokens: 10 + response.data.choices[0].message.content.split(' ').length
          },
          system_fingerprint: `${provider}_${Date.now()}`
        });
      }
    } catch (error) {
      const errorMsg = error.response?.data?.error?.message || error.message;
      console.error(`❌ Groq failed: ${error.response?.status} - ${errorMsg}`);
    }

    // If all providers fail
    console.error(`💥 All AI providers failed`);
    return res.status(503).json({
      error: {
        message: 'All AI services are currently unavailable. Please try again later.',
        type: 'service_unavailable',
        code: 'all_providers_failed'
      }
    });

  } catch (error) {
    console.error('❌ AI endpoint error:', error.message);
    return res.status(500).json({
      error: {
        message: 'Internal server error while processing AI request.',
        type: 'internal_server_error',
        code: 'server_error'
      }
    });
  }
});

// Legacy AI Chat endpoint (keeping for backward compatibility)
app.post('/v1/ai/chat', aiLimiter, async (req, res) => {
  try {
    const { prompt, model = 'auto', max_tokens = 1000, temperature = 0.7, client_id } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Track usage
    trackUsage(client_id || 'anonymous', 'ai');

    // Try OpenRouter first (most reliable)
    let response;
    let modelUsed;

    try {
      if (API_KEYS.OPENROUTER_API_KEY) {
        response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: 'deepseek/deepseek-chat', // Free model
          messages: [{ role: 'user', content: prompt }],
          max_tokens,
          temperature
        }, {
          headers: {
            'Authorization': `Bearer ${API_KEYS.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        modelUsed = 'deepseek-chat';
        const aiResponse = response.data.choices[0].message.content;
        
        res.json({
          response: aiResponse,
          model_used: modelUsed,
          usage: response.data.usage || { tokens: max_tokens }
        });
        return;
      }
    } catch (error) {
      console.error('OpenRouter failed, trying Groq:', error.message);
    }

    // Fallback to Groq
    try {
      if (API_KEYS.GROQ_API_KEY) {
        response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          max_tokens,
          temperature
        }, {
          headers: {
            'Authorization': `Bearer ${API_KEYS.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        });

        modelUsed = 'llama-3.1-8b';
        const aiResponse = response.data.choices[0].message.content;
        
        res.json({
          response: aiResponse,
          model_used: modelUsed,
          usage: response.data.usage || { tokens: max_tokens }
        });
        return;
      }
    } catch (error) {
      console.error('Groq failed:', error.message);
    }

    // If all providers fail
    res.status(503).json({
      error: 'AI services temporarily unavailable',
      message: 'All AI providers are currently experiencing issues. Please try again later.'
    });

  } catch (error) {
    console.error('AI request error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request.'
    });
  }
});

// Weather endpoint
app.get('/v1/weather/current', weatherLimiter, async (req, res) => {
  try {
    const { location, units = 'metric', language = 'en', forecast = false, days = 1, client_id } = req.query;

    if (!location) {
      return res.status(400).json({ error: 'Location is required' });
    }

    // Track usage
    trackUsage(client_id || 'anonymous', 'weather');

    if (!API_KEYS.WEATHERAPI_KEY) {
      return res.status(503).json({
        error: 'Weather service unavailable',
        message: 'Weather API is not configured'
      });
    }

    const endpoint = forecast === 'true' ? 'forecast.json' : 'current.json';
    const params = {
      key: API_KEYS.WEATHERAPI_KEY,
      q: location,
      lang: language
    };

    if (forecast === 'true') {
      params.days = Math.min(parseInt(days) || 1, 10);
    }

    const response = await axios.get(`http://api.weatherapi.com/v1/${endpoint}`, {
      params,
      timeout: 15000
    });

    // Transform the response to a consistent format
    const weatherData = {
      location: {
        name: response.data.location.name,
        region: response.data.location.region,
        country: response.data.location.country
      },
      current: {
        temperature: units === 'metric' ? response.data.current.temp_c : response.data.current.temp_f,
        condition: response.data.current.condition.text,
        humidity: response.data.current.humidity,
        pressure: response.data.current.pressure_mb,
        wind: units === 'metric' ? response.data.current.wind_kph : response.data.current.wind_mph,
        visibility: units === 'metric' ? response.data.current.vis_km : response.data.current.vis_miles
      }
    };

    if (forecast === 'true' && response.data.forecast) {
      weatherData.forecast = response.data.forecast.forecastday.map(day => ({
        date: day.date,
        max_temp: units === 'metric' ? day.day.maxtemp_c : day.day.maxtemp_f,
        min_temp: units === 'metric' ? day.day.mintemp_c : day.day.mintemp_f,
        condition: day.day.condition.text,
        humidity: day.day.avghumidity,
        chance_of_rain: day.day.daily_chance_of_rain
      }));
    }

    res.json(weatherData);

  } catch (error) {
    console.error('Weather request error:', error);
    
    if (error.response?.status === 400) {
      res.status(400).json({
        error: 'Invalid location',
        message: 'The specified location could not be found'
      });
    } else {
      res.status(500).json({
        error: 'Weather service error',
        message: 'Unable to retrieve weather data at this time'
      });
    }
  }
});

// Usage stats endpoint (optional)
app.get('/v1/usage/:clientId', (req, res) => {
  const { clientId } = req.params;
  const stats = {
    ai: usageStats.get(`${clientId}_ai`) || { requests: 0, tokens: 0 },
    weather: usageStats.get(`${clientId}_weather`) || { requests: 0, tokens: 0 }
  };

  res.json(stats);
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: 'The requested endpoint does not exist'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 MDSAAD Proxy API Server running on port ${PORT}`);
  console.log(`📊 Services available: AI=${!!API_KEYS.OPENROUTER_API_KEY}, Weather=${!!API_KEYS.WEATHERAPI_KEY}`);
  
  // Start keep-alive mechanism
  startKeepAlive();
  console.log(`⏰ Keep-alive mechanism started for production`);
});

module.exports = app;