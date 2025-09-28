/**
 * MDSAAD Proxy API Service
 * 
 * This service acts as a proxy between the CLI and external APIs.
 * Benefits:
 * - Users don't need API keys
 * - You control all API usage and costs
 * - Rate limiting and monitoring
 * - Potential monetization options
 */

const axios = require('axios');
const crypto = require('crypto');

class ProxyAPIService {
  constructor() {
    // Primary: Render (when deployed)
    // Fallback: Vercel (if Render fails)
    // Local: For development
    this.proxyUrls = [
      process.env.MDSAAD_PROXY_API,
      'https://mdsaad-proxy-api.onrender.com/v1',
      'https://cli-server-q7mymwmli-md-saads-projects.vercel.app/v1',
      'http://localhost:3000/v1'
    ].filter(Boolean);
    
    this.baseUrl = this.proxyUrls[0];
    this.clientId = this.generateClientId();
    this.rateLimiter = new Map();
    this.currentUrlIndex = 0;
  }

  /**
   * Generate a unique client ID for tracking usage
   */
  generateClientId() {
    // Generate a unique but anonymous client ID
    const machineId = require('os').hostname() + require('os').platform();
    return crypto.createHash('sha256').update(machineId).digest('hex').substring(0, 16);
  }

  /**
   * Try making a request with fallback URLs
   */
  async makeRequestWithFallback(requestFn) {
    let lastError;
    
    for (let i = 0; i < this.proxyUrls.length; i++) {
      try {
        this.baseUrl = this.proxyUrls[i];
        this.currentUrlIndex = i;
        return await requestFn();
      } catch (error) {
        lastError = error;
        console.log(`Proxy URL ${this.proxyUrls[i]} failed, trying next...`);
        
        // If it's a network error, try next URL
        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.response?.status >= 500) {
          continue;
        }
        
        // If it's a client error (400-499), don't retry
        if (error.response?.status >= 400 && error.response?.status < 500) {
          break;
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Make AI requests through your proxy API
   */
  async aiRequest(prompt, options = {}) {
    // Check client-side rate limiting first
    if (!this.checkRateLimit('ai', 50, 3600000)) { // 50 requests per hour
      throw new Error('Rate limit exceeded. Please wait before making more AI requests.');
    }

    return await this.makeRequestWithFallback(async () => {
      const response = await axios.post(`${this.baseUrl}/ai/chat`, {
        prompt: prompt,
        model: options.model || 'auto',
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7,
        client_id: this.clientId,
        version: require('../../package.json').version
      }, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': `mdsaad-cli/${require('../../package.json').version}`,
          'X-Client-ID': this.clientId
        },
        timeout: 30000
      });

      return {
        success: true,
        data: response.data.response,
        model: response.data.model_used,
        usage: response.data.usage
      };
    });
  }

  /**
   * Make weather requests through your proxy API
   */
  async weatherRequest(location, options = {}) {
    if (!this.checkRateLimit('weather', 100, 3600000)) { // 100 requests per hour
      throw new Error('Rate limit exceeded. Please wait before making more weather requests.');
    }

    return await this.makeRequestWithFallback(async () => {
      const response = await axios.get(`${this.baseUrl}/weather/current`, {
        params: {
          location: location,
          units: options.units || 'metric',
          language: options.language || 'en',
          forecast: options.forecast || false,
          days: options.days || 1,
          client_id: this.clientId
        },
        headers: {
          'User-Agent': `mdsaad-cli/${require('../../package.json').version}`,
          'X-Client-ID': this.clientId
        },
        timeout: 15000
      });

      return {
        success: true,
        data: response.data
      };
    });
  }

  /**
   * Client-side rate limiting
   */
  checkRateLimit(service, maxRequests, windowMs) {
    const now = Date.now();
    const key = `${service}_${this.clientId}`;
    
    if (!this.rateLimiter.has(key)) {
      this.rateLimiter.set(key, { count: 0, resetTime: now + windowMs });
    }

    const limit = this.rateLimiter.get(key);
    
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + windowMs;
    }

    if (limit.count >= maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  /**
   * Handle API errors gracefully
   */
  handleError(error, service) {
    if (error.response) {
      const status = error.response.status;
      const message = error.response.data?.message || error.message;

      switch (status) {
        case 429:
          return {
            success: false,
            error: 'Rate limit exceeded. Please try again later.',
            code: 'RATE_LIMIT_EXCEEDED'
          };
        case 503:
          return {
            success: false,
            error: `${service} service temporarily unavailable. Please try again later.`,
            code: 'SERVICE_UNAVAILABLE'
          };
        case 402:
          return {
            success: false,
            error: 'Service quota exceeded. Please contact support for increased limits.',
            code: 'QUOTA_EXCEEDED'
          };
        default:
          return {
            success: false,
            error: `${service} service error: ${message}`,
            code: 'API_ERROR'
          };
      }
    } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: `Cannot connect to ${service} service. Please check your internet connection.`,
        code: 'CONNECTION_ERROR',
        fallback: true
      };
    } else {
      return {
        success: false,
        error: `${service} request failed: ${error.message}`,
        code: 'REQUEST_ERROR'
      };
    }
  }

  /**
   * Check service status
   */
  async checkServiceStatus() {
    try {
      const response = await axios.get(`${this.baseUrl}/status`, {
        headers: {
          'User-Agent': `mdsaad-cli/${require('../../package.json').version}`,
          'X-Client-ID': this.clientId
        },
        timeout: 5000
      });

      return {
        success: true,
        status: response.data.status,
        services: response.data.services,
        limits: response.data.limits
      };
    } catch (error) {
      return {
        success: false,
        error: 'Cannot connect to MDSAAD API service'
      };
    }
  }

  /**
   * Get usage statistics for the client
   */
  async getUsageStats() {
    try {
      const response = await axios.get(`${this.baseUrl}/usage/${this.clientId}`, {
        headers: {
          'User-Agent': `mdsaad-cli/${require('../../package.json').version}`,
          'X-Client-ID': this.clientId
        },
        timeout: 5000
      });

      return {
        success: true,
        usage: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: 'Cannot retrieve usage statistics'
      };
    }
  }
}

module.exports = ProxyAPIService;