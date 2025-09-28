#!/usr/bin/env node

/**
 * Security Validation Script
 * Scans the codebase for any hardcoded API keys, secrets, or sensitive data
 * before publishing to npm
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const crypto = require('crypto');

const SECURITY_PATTERNS = [
  // API Key patterns
  /sk-[a-zA-Z0-9]{20,}/g,          // OpenAI/OpenRouter style
  /gsk_[a-zA-Z0-9]{20,}/g,         // Groq style  
  /AIzaSy[a-zA-Z0-9_-]{33}/g,      // Google/Gemini style
  /[a-f0-9]{32,}/g,                // Generic hex keys (32+ chars)
  
  // Common secret patterns
  /password['":\s]*['"]\w+['"]/gi,
  /secret['":\s]*['"]\w+['"]/gi,
  /token['":\s]*['"]\w+['"]/gi,
  /key['":\s]*['"]\w+['"]/gi,
  
  // Email addresses (could be sensitive)
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  
  // URLs with credentials
  /https?:\/\/[^:]+:[^@]+@[^\s'"]+/g,
  
  // Database connection strings
  /mongodb:\/\/[^:]+:[^@]+@[^\s'"]+/g,
  /postgres:\/\/[^:]+:[^@]+@[^\s'"]+/g,
];

const EXCLUDE_DIRS = [
  'node_modules',
  '.git',
  'coverage',
  'dist',
  'build',
  '.cache',
  'tmp',
  'temp'
];

const EXCLUDE_FILES = [
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  'package-lock.json',
  'yarn.lock'
];

class SecurityValidator {
  constructor() {
    this.findings = [];
    this.scannedFiles = 0;
    this.startTime = Date.now();
  }

  async validate() {
    console.log(chalk.blue('🔒 Running security validation scan...\n'));

    try {
      await this.scanDirectory(process.cwd());
      return this.generateReport();
    } catch (error) {
      console.error(chalk.red('❌ Security validation failed:'), error.message);
      return false;
    }
  }

  async scanDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const itemPath = path.join(dirPath, item);
      const stat = fs.statSync(itemPath);

      if (stat.isDirectory()) {
        if (!EXCLUDE_DIRS.includes(item)) {
          await this.scanDirectory(itemPath);
        }
      } else {
        if (!EXCLUDE_FILES.includes(item) && this.shouldScanFile(item)) {
          await this.scanFile(itemPath);
        }
      }
    }
  }

  shouldScanFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    const scanExtensions = ['.js', '.json', '.md', '.txt', '.yml', '.yaml', '.env'];
    return scanExtensions.includes(ext) || !ext;
  }

  async scanFile(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      this.scannedFiles++;
      
      // Skip very large files (>1MB) to avoid performance issues
      if (content.length > 1024 * 1024) {
        return;
      }

      const relativePath = path.relative(process.cwd(), filePath);
      
      for (const pattern of SECURITY_PATTERNS) {
        const matches = content.match(pattern);
        if (matches) {
          for (const match of matches) {
            // Filter out obvious false positives
            if (this.isLikelySecret(match, content, relativePath)) {
              this.findings.push({
                file: relativePath,
                pattern: pattern.toString(),
                match: this.maskSecret(match),
                line: this.getLineNumber(content, match),
                severity: this.getSeverity(match, relativePath)
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(chalk.yellow(`⚠️ Could not scan file ${filePath}: ${error.message}`));
    }
  }

  isLikelySecret(match, content, filePath) {
    // Skip obvious false positives
    const falsePositives = [
      'example.com',
      'placeholder', 
      'dummy',
      'test@test.com',
      'your-key-here',
      'sk-example',
      'gsk_example',
      'your_key_here',
      'your-openrouter-key',
      'your-groq-key',
      'your-weatherapi-key',
      'your-gemini-key',
      'localhost',
      'github.com',
      'npmjs.org',
      'codecov.io',
      'shields.io',
      'badge.fury.io'
    ];

    const lowerMatch = match.toLowerCase();
    for (const fp of falsePositives) {
      if (lowerMatch.includes(fp)) {
        return false;
      }
    }

    // Skip cache keys and property names (not secrets)
    if (match.includes('cacheKey:') || match.includes('cache_') || 
        match.includes('Key:') && !match.includes('API')) {
      return false;
    }

    // Skip environment variable names (not the values)
    if (match.includes('_API_KEY') || match.includes('_KEY') && content.includes('process.env')) {
      return false;
    }

    // Skip if it's in a comment explaining the format
    const lines = content.split('\n');
    const matchLine = lines.find(line => line.includes(match));
    if (matchLine) {
      const trimmedLine = matchLine.trim();
      if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || 
          trimmedLine.startsWith('#') || trimmedLine.includes('Example:') ||
          trimmedLine.includes('Format:') || trimmedLine.includes('like:')) {
        return false;
      }
    }

    // Skip documentation files with example content
    if (filePath.includes('.md') && (match.includes('your') || match.includes('example'))) {
      return false;
    }

    // Skip test files with obvious test data  
    if (filePath.includes('test') && match.includes('test')) {
      return false;
    }

    // Skip URLs that are clearly documentation links
    if (match.startsWith('http') && (
        match.includes('github.com') || 
        match.includes('npmjs.org') ||
        match.includes('shields.io') ||
        match.includes('codecov.io') ||
        match.includes('badge.fury.io')
      )) {
      return false;
    }

    return true;
  }

  maskSecret(secret) {
    if (secret.length <= 8) {
      return '***';
    }
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }

  getLineNumber(content, match) {
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(match)) {
        return i + 1;
      }
    }
    return 'Unknown';
  }

  getSeverity(match, filePath) {
    // Critical: Actual API keys in source files
    if ((match.startsWith('sk-') || match.startsWith('gsk_') || match.startsWith('AIzaSy')) 
        && !filePath.includes('test') && !filePath.includes('example')) {
      return 'CRITICAL';
    }

    // High: Other potential secrets in source files
    if (filePath.endsWith('.js') && !filePath.includes('test')) {
      return 'HIGH';
    }

    // Medium: Secrets in config or documentation
    if (filePath.includes('config') || filePath.endsWith('.json')) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  generateReport() {
    const duration = Date.now() - this.startTime;
    
    console.log(chalk.blue('📊 Security Validation Report'));
    console.log('='.repeat(50));
    console.log(`Files scanned: ${this.scannedFiles}`);
    console.log(`Duration: ${duration}ms`);
    console.log(`Findings: ${this.findings.length}`);
    console.log('');

    if (this.findings.length === 0) {
      console.log(chalk.green('✅ No security issues found!'));
      console.log(chalk.green('🚀 Safe to publish to npm'));
      return true;
    }

    // Group findings by severity
    const critical = this.findings.filter(f => f.severity === 'CRITICAL');
    const high = this.findings.filter(f => f.severity === 'HIGH');
    const medium = this.findings.filter(f => f.severity === 'MEDIUM');
    const low = this.findings.filter(f => f.severity === 'LOW');

    if (critical.length > 0) {
      console.log(chalk.red('🚨 CRITICAL ISSUES (MUST FIX):'));
      critical.forEach(finding => {
        console.log(`  ${finding.file}:${finding.line} - ${finding.match}`);
      });
      console.log('');
    }

    if (high.length > 0) {
      console.log(chalk.redBright('⚠️ HIGH PRIORITY ISSUES:'));
      high.forEach(finding => {
        console.log(`  ${finding.file}:${finding.line} - ${finding.match}`);
      });
      console.log('');
    }

    if (medium.length > 0) {
      console.log(chalk.yellow('⚠️ MEDIUM PRIORITY ISSUES:'));
      medium.forEach(finding => {
        console.log(`  ${finding.file}:${finding.line} - ${finding.match}`);
      });
      console.log('');
    }

    if (low.length > 0) {
      console.log(chalk.gray('ℹ️ LOW PRIORITY ISSUES:'));
      low.forEach(finding => {
        console.log(`  ${finding.file}:${finding.line} - ${finding.match}`);
      });
      console.log('');
    }

    if (critical.length > 0 || high.length > 0) {
      console.log(chalk.red('❌ PUBLISHING BLOCKED - Fix critical/high issues first'));
      return false;
    } else {
      if (medium.length > 0 || low.length > 0) {
        console.log(chalk.yellow('⚠️ Medium/low issues found but safe to publish'));
      }
      console.log(chalk.green('🚀 Safe to publish - no critical security issues'));
      return true;
    }
  }
}

async function main() {
  const validator = new SecurityValidator();
  const isValid = await validator.validate();
  
  if (!isValid) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error(chalk.red('❌ Validation failed:'), error);
    process.exit(1);
  });
}

module.exports = SecurityValidator;