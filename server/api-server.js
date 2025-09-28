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
function startKeepAlive() {
  // Self-ping every 14 minutes to prevent Render from sleeping
  if (process.env.NODE_ENV === 'production') {
    keepAliveInterval = setInterval(async () => {
      try {
        const response = await axios.get(`${process.env.RENDER_EXTERNAL_URL || 'http://localhost:' + PORT}/health`);
        console.log(`🏓 Keep-alive ping: ${response.status} - ${new Date().toISOString()}`);
      } catch (error) {
        console.log(`🏓 Keep-alive ping failed: ${error.message}`);
      }
    }, 14 * 60 * 1000); // 14 minutes
  }
}

// Stop keep-alive on shutdown
process.on('SIGTERM', () => {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
});

// Rate limiting - adjust based on your API quotas
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Global limit
  message: { error: 'Too many requests, please try again later' }
});

const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Per IP limit for AI requests
  message: { error: 'AI request limit exceeded, please try again later' }
});

const weatherLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Per IP limit for weather requests
  message: { error: 'Weather request limit exceeded, please try again later' }
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

// AI Chat endpoint
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