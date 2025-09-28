/**
 * Network Security Service
 * Handles secure HTTP communications and network security measures
 */

const https = require('https');
const crypto = require('crypto');

class NetworkSecurity {
  constructor() {
    this.userAgent = 'mdsaad-cli/1.0.0';
    this.timeout = 30000; // 30 seconds
    this.maxRedirects = 3;
    this.allowedProtocols = ['https:'];

    // Certificate pinning for critical services (SHA-256 fingerprints)
    this.pinnedCertificates = new Map([
      ['api.weatherapi.com', []],
      ['v6.exchangerate-api.com', []],
      ['api.deepseek.com', []],
      ['api.groq.com', []],
      ['generativelanguage.googleapis.com', []],
      ['openrouter.ai', []],
      ['integrate.api.nvidia.com', []],
    ]);

    // Rate limiting configuration
    this.rateLimits = new Map();
    this.defaultRateLimit = {
      requests: 60,
      window: 60000, // 1 minute
      burst: 10,
    };
  }

  /**
   * Create secure HTTP agent with custom settings
   */
  createSecureAgent() {
    return new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: this.timeout,
      // Security settings
      secureProtocol: 'TLSv1_2_method',
      ciphers: [
        'ECDHE-RSA-AES128-GCM-SHA256',
        'ECDHE-RSA-AES256-GCM-SHA384',
        'ECDHE-RSA-AES128-SHA256',
        'ECDHE-RSA-AES256-SHA384',
      ].join(':'),
      honorCipherOrder: true,
      checkServerIdentity: this.checkServerIdentity.bind(this),
    });
  }

  /**
   * Custom server identity verification
   */
  checkServerIdentity(hostname, cert) {
    // Standard hostname verification
    const result = https.Agent.prototype.checkServerIdentity(hostname, cert);
    if (result) {
      return result;
    }

    // Certificate pinning check
    if (this.pinnedCertificates.has(hostname)) {
      const pinnedFingerprints = this.pinnedCertificates.get(hostname);
      if (pinnedFingerprints.length > 0) {
        const certFingerprint = crypto
          .createHash('sha256')
          .update(cert.raw)
          .digest('hex')
          .toUpperCase();

        if (!pinnedFingerprints.includes(certFingerprint)) {
          return new Error(`Certificate pinning failed for ${hostname}`);
        }
      }
    }

    return undefined; // Success
  }

  /**
   * Validate request headers for security
   */
  validateHeaders(headers) {
    const secureHeaders = {
      'User-Agent': this.userAgent,
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      DNT: '1', // Do Not Track
    };

    // Remove potentially dangerous headers
    const dangerousHeaders = [
      'X-Forwarded-For',
      'X-Real-IP',
      'X-Originating-IP',
      'CF-Connecting-IP',
    ];

    const cleanHeaders = { ...headers };
    dangerousHeaders.forEach(header => {
      delete cleanHeaders[header.toLowerCase()];
    });

    // Add security headers
    return { ...cleanHeaders, ...secureHeaders };
  }

  /**
   * Rate limiting for API requests
   */
  checkRateLimit(hostname, endpoint = '/') {
    const key = `${hostname}${endpoint}`;
    const now = Date.now();

    let limiter = this.rateLimits.get(key);
    if (!limiter) {
      limiter = {
        requests: [],
        config: this.defaultRateLimit,
      };
      this.rateLimits.set(key, limiter);
    }

    // Clean old requests
    limiter.requests = limiter.requests.filter(
      time => now - time < limiter.config.window
    );

    // Check rate limit
    if (limiter.requests.length >= limiter.config.requests) {
      const oldestRequest = Math.min(...limiter.requests);
      const resetTime = oldestRequest + limiter.config.window;
      const waitTime = Math.ceil((resetTime - now) / 1000);

      throw new Error(`Rate limit exceeded. Try again in ${waitTime} seconds`);
    }

    // Check burst limit
    const recentRequests = limiter.requests.filter(
      time => now - time < 1000 // Last second
    );

    if (recentRequests.length >= limiter.config.burst) {
      throw new Error('Burst limit exceeded. Please slow down requests');
    }

    // Record request
    limiter.requests.push(now);
    return true;
  }

  /**
   * Secure request wrapper
   */
  async secureRequest(url, options = {}) {
    const parsedUrl = new URL(url);

    // Protocol validation
    if (!this.allowedProtocols.includes(parsedUrl.protocol)) {
      throw new Error(`Protocol ${parsedUrl.protocol} not allowed`);
    }

    // Rate limiting
    this.checkRateLimit(parsedUrl.hostname, parsedUrl.pathname);

    // Prepare secure options
    const secureOptions = {
      ...options,
      agent: this.createSecureAgent(),
      timeout: this.timeout,
      headers: this.validateHeaders(options.headers || {}),
      maxRedirects: this.maxRedirects,
    };

    // Add request signature for integrity
    if (options.body) {
      const signature = this.signRequest(options.body);
      secureOptions.headers['X-Request-Signature'] = signature;
    }

    return secureOptions;
  }

  /**
   * Sign request for integrity verification
   */
  signRequest(data) {
    const timestamp = Date.now();
    const payload = JSON.stringify({ data, timestamp });
    const signature = crypto
      .createHmac('sha256', 'mdsaad-cli-secret')
      .update(payload)
      .digest('hex');

    return `${timestamp}.${signature}`;
  }

  /**
   * Verify response integrity
   */
  verifyResponse(response, expectedSignature) {
    if (!expectedSignature) {
      return true; // No signature expected
    }

    const [timestamp, signature] = expectedSignature.split('.');
    const payload = JSON.stringify({
      data: response,
      timestamp: parseInt(timestamp),
    });
    const expectedSig = crypto
      .createHmac('sha256', 'mdsaad-cli-secret')
      .update(payload)
      .digest('hex');

    return signature === expectedSig;
  }

  /**
   * Sanitize response data
   */
  sanitizeResponse(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [] : {};

    for (const [key, value] of Object.entries(data)) {
      // Skip potentially dangerous properties
      if (key.startsWith('__') || key.includes('prototype')) {
        continue;
      }

      if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeResponse(value);
      } else if (typeof value === 'string') {
        // Remove potential XSS
        sanitized[key] = value
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '');
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Validate API response structure
   */
  validateApiResponse(response, expectedStructure) {
    if (!expectedStructure) {
      return true;
    }

    const validateObject = (obj, structure) => {
      for (const [key, type] of Object.entries(structure)) {
        if (!(key in obj)) {
          throw new Error(`Missing required field: ${key}`);
        }

        const value = obj[key];
        if (typeof type === 'string') {
          if (typeof value !== type) {
            throw new Error(
              `Invalid type for ${key}: expected ${type}, got ${typeof value}`
            );
          }
        } else if (typeof type === 'object' && type !== null) {
          if (typeof value !== 'object' || value === null) {
            throw new Error(`Invalid type for ${key}: expected object`);
          }
          validateObject(value, type);
        }
      }
    };

    validateObject(response, expectedStructure);
    return true;
  }

  /**
   * Create secure WebSocket connection (if needed)
   */
  createSecureWebSocket(url, options = {}) {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'wss:') {
      throw new Error('Only secure WebSocket connections (wss:) are allowed');
    }

    // Add security headers
    const secureOptions = {
      ...options,
      headers: {
        ...options.headers,
        'User-Agent': this.userAgent,
        Origin: parsedUrl.origin,
      },
      rejectUnauthorized: true,
      checkServerIdentity: this.checkServerIdentity.bind(this),
    };

    return secureOptions;
  }

  /**
   * Network security audit
   */
  audit() {
    const report = {
      timestamp: new Date().toISOString(),
      userAgent: this.userAgent,
      timeout: this.timeout,
      maxRedirects: this.maxRedirects,
      allowedProtocols: this.allowedProtocols,
      pinnedCertificates: Array.from(this.pinnedCertificates.keys()),
      rateLimits: {
        activeEndpoints: this.rateLimits.size,
        defaultConfig: this.defaultRateLimit,
      },
      recommendations: [],
    };

    // Security recommendations
    if (this.timeout > 60000) {
      report.recommendations.push(
        'Consider reducing request timeout for better security'
      );
    }

    if (this.maxRedirects > 5) {
      report.recommendations.push(
        'Consider reducing max redirects to prevent redirect loops'
      );
    }

    if (this.pinnedCertificates.size === 0) {
      report.recommendations.push(
        'Consider implementing certificate pinning for critical services'
      );
    }

    return report;
  }

  /**
   * Clear rate limiting data
   */
  clearRateLimits() {
    this.rateLimits.clear();
  }

  /**
   * Update rate limit configuration for a specific endpoint
   */
  setRateLimit(hostname, config) {
    const key = hostname;
    let limiter = this.rateLimits.get(key);
    if (!limiter) {
      limiter = { requests: [] };
      this.rateLimits.set(key, limiter);
    }
    limiter.config = { ...this.defaultRateLimit, ...config };
  }
}

module.exports = NetworkSecurity;
