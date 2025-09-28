/**
 * Security Manager Service
 * Centralized security management for the CLI application
 */

const crypto = require('crypto');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class SecurityManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.mdsaad');
    this.keyFile = path.join(this.configDir, '.keys');
    this.salt = 'mdsaad_cli_salt_2024';
    this.algorithm = 'aes-256-gcm';
    this.encryptionKey = 'mdsaad_default_key_2024';
    
    // Security settings
    this.settings = {
      maxApiKeyAge: 90 * 24 * 60 * 60 * 1000, // 90 days
      passwordMinLength: 8,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      maxLoginAttempts: 5,
      lockoutDuration: 15 * 60 * 1000, // 15 minutes
      requireHttps: true,
      allowedDomains: [
        'api.weatherapi.com',
        'v6.exchangerate-api.com',
        'api.deepseek.com',
        'api.groq.com',
        'generativelanguage.googleapis.com',
        'openrouter.ai',
        'integrate.api.nvidia.com'
      ]
    };

    this.loginAttempts = new Map();
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      await fs.ensureDir(this.configDir);
      
      // Set restrictive permissions on config directory (Unix only)
      if (os.platform() !== 'win32') {
        await fs.chmod(this.configDir, 0o700);
      }

      return true;
    } catch (error) {
      console.error('Failed to initialize security manager:', error.message);
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encrypt(text, password = null) {
    try {
      const key = this.deriveKey(password);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decrypt(encryptedData, password = null) {
    try {
      const key = this.deriveKey(password);
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  /**
   * Derive encryption key from password
   */
  deriveKey(password = null) {
    const basePassword = password || this.getSystemId();
    return crypto.pbkdf2Sync(basePassword, this.salt, 10000, 32, 'sha256');
  }

  /**
   * Get system-specific identifier for key derivation
   */
  getSystemId() {
    const hostname = os.hostname();
    const platform = os.platform();
    const arch = os.arch();
    return crypto.createHash('sha256')
      .update(`${hostname}-${platform}-${arch}`)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Securely store API key
   */
  async storeApiKey(service, apiKey) {
    try {
      const encrypted = this.encrypt(apiKey);
      const keyData = {
        service,
        encrypted,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString()
      };

      let keys = [];
      if (await fs.pathExists(this.keyFile)) {
        try {
          const content = await fs.readFile(this.keyFile, 'utf8');
          keys = JSON.parse(content);
        } catch (error) {
          // File corrupted, start fresh
          keys = [];
        }
      }

      // Remove existing key for this service
      keys = keys.filter(k => k.service !== service);
      
      // Add new key
      keys.push(keyData);

      await fs.writeFile(this.keyFile, JSON.stringify(keys, null, 2));
      
      // Set restrictive permissions (Unix only)
      if (os.platform() !== 'win32') {
        await fs.chmod(this.keyFile, 0o600);
      }

      return true;
    } catch (error) {
      throw new Error('Failed to store API key: ' + error.message);
    }
  }

  /**
   * Retrieve API key
   */
  async getApiKey(service) {
    try {
      if (!await fs.pathExists(this.keyFile)) {
        return null;
      }

      const content = await fs.readFile(this.keyFile, 'utf8');
      const keys = JSON.parse(content);
      
      const keyData = keys.find(k => k.service === service);
      if (!keyData) {
        return null;
      }

      // Check if key is expired
      const createdAt = new Date(keyData.createdAt);
      const now = new Date();
      if (now - createdAt > this.settings.maxApiKeyAge) {
        console.warn(`API key for ${service} has expired`);
        return null;
      }

      // Update last used timestamp
      keyData.lastUsed = new Date().toISOString();
      await fs.writeFile(this.keyFile, JSON.stringify(keys, null, 2));

      return this.decrypt(keyData.encrypted);
    } catch (error) {
      console.error('Failed to retrieve API key:', error.message);
      return null;
    }
  }

  /**
   * Remove API key
   */
  async removeApiKey(service) {
    try {
      if (!await fs.pathExists(this.keyFile)) {
        return true;
      }

      const content = await fs.readFile(this.keyFile, 'utf8');
      const keys = JSON.parse(content);
      
      const filteredKeys = keys.filter(k => k.service !== service);
      
      await fs.writeFile(this.keyFile, JSON.stringify(filteredKeys, null, 2));
      return true;
    } catch (error) {
      throw new Error('Failed to remove API key: ' + error.message);
    }
  }

  /**
   * List stored API keys (without revealing the actual keys)
   */
  async listApiKeys() {
    try {
      if (!await fs.pathExists(this.keyFile)) {
        return [];
      }

      const content = await fs.readFile(this.keyFile, 'utf8');
      const keys = JSON.parse(content);
      
      return keys.map(k => ({
        service: k.service,
        createdAt: k.createdAt,
        lastUsed: k.lastUsed,
        isExpired: (new Date() - new Date(k.createdAt)) > this.settings.maxApiKeyAge
      }));
    } catch (error) {
      console.error('Failed to list API keys:', error.message);
      return [];
    }
  }

  /**
   * Validate URL security
   */
  validateUrl(url) {
    try {
      const parsedUrl = new URL(url);
      
      // Require HTTPS in production
      if (this.settings.requireHttps && parsedUrl.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed');
      }

      // Check against allowed domains
      if (!this.settings.allowedDomains.includes(parsedUrl.hostname)) {
        throw new Error(`Domain ${parsedUrl.hostname} is not in allowed list`);
      }

      // Block private IP ranges
      const hostname = parsedUrl.hostname;
      if (this.isPrivateIP(hostname)) {
        throw new Error('Private IP addresses are not allowed');
      }

      return true;
    } catch (error) {
      throw new Error('Invalid URL: ' + error.message);
    }
  }

  /**
   * Check if hostname is a private IP
   */
  isPrivateIP(hostname) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/,
      /^fe80:/
    ];

    return privateRanges.some(range => range.test(hostname));
  }

  /**
   * Rate limiting for login attempts
   */
  checkLoginAttempts(identifier) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(identifier) || [];
    
    // Clean old attempts
    const recentAttempts = attempts.filter(
      time => now - time < this.settings.lockoutDuration
    );

    if (recentAttempts.length >= this.settings.maxLoginAttempts) {
      const oldestAttempt = Math.min(...recentAttempts);
      const remainingTime = this.settings.lockoutDuration - (now - oldestAttempt);
      throw new Error(`Too many failed attempts. Try again in ${Math.ceil(remainingTime / 60000)} minutes`);
    }

    return true;
  }

  /**
   * Record failed login attempt
   */
  recordFailedAttempt(identifier) {
    const now = Date.now();
    const attempts = this.loginAttempts.get(identifier) || [];
    attempts.push(now);
    this.loginAttempts.set(identifier, attempts);
  }

  /**
   * Clear login attempts on successful authentication
   */
  clearLoginAttempts(identifier) {
    this.loginAttempts.delete(identifier);
  }

  /**
   * Generate secure random token
   */
  generateToken(length = 32) {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Hash password securely
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256');
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  /**
   * Verify password
   */
  verifyPassword(password, storedHash, storedSalt) {
    const salt = Buffer.from(storedSalt, 'hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha256');
    return hash.toString('hex') === storedHash;
  }

  /**
   * Secure file permissions
   */
  async setSecurePermissions(filePath) {
    if (os.platform() !== 'win32') {
      try {
        await fs.chmod(filePath, 0o600); // Read/write for owner only
        return true;
      } catch (error) {
        console.warn('Failed to set secure permissions:', error.message);
        return false;
      }
    }
    return true; // Windows doesn't use Unix permissions
  }

  /**
   * Clean up expired keys
   */
  async cleanupExpiredKeys() {
    try {
      if (!await fs.pathExists(this.keyFile)) {
        return 0;
      }

      const content = await fs.readFile(this.keyFile, 'utf8');
      const keys = JSON.parse(content);
      
      const now = new Date();
      const validKeys = keys.filter(k => {
        const createdAt = new Date(k.createdAt);
        return (now - createdAt) <= this.settings.maxApiKeyAge;
      });

      const removedCount = keys.length - validKeys.length;
      
      if (removedCount > 0) {
        await fs.writeFile(this.keyFile, JSON.stringify(validKeys, null, 2));
      }

      return removedCount;
    } catch (error) {
      console.error('Failed to cleanup expired keys:', error.message);
      return 0;
    }
  }

  /**
   * Generate security report
   */
  async generateSecurityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      configDir: this.configDir,
      keyFile: this.keyFile,
      settings: this.settings,
      apiKeys: await this.listApiKeys(),
      expiredKeysCount: 0,
      securityLevel: 'HIGH'
    };

    // Check for expired keys
    report.expiredKeysCount = report.apiKeys.filter(k => k.isExpired).length;

    // Determine security level
    if (report.expiredKeysCount > 0) {
      report.securityLevel = 'MEDIUM';
    }

    // Check file permissions
    if (os.platform() !== 'win32') {
      try {
        const stats = await fs.stat(this.configDir);
        const mode = stats.mode & parseInt('777', 8);
        if (mode !== parseInt('700', 8)) {
          report.securityLevel = 'LOW';
          report.warnings = report.warnings || [];
          report.warnings.push('Config directory has insecure permissions');
        }
      } catch (error) {
        // Ignore permission check errors
      }
    }

    return report;
  }

  /**
   * Audit security events
   */
  logSecurityEvent(event, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      details,
      pid: process.pid,
      user: os.userInfo().username
    };

    console.log(`[SECURITY] ${event}:`, JSON.stringify(details));
    return logEntry;
  }
}

module.exports = SecurityManager;