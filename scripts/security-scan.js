#!/usr/bin/env node
/**
 * Security Validation Script
 * Scans the codebase for potential API keys or sensitive data
 */

const fs = require('fs');
const path = require('path');

// Patterns to search for (potential API keys)
const SENSITIVE_PATTERNS = [
  /sk-or-v1-[a-zA-Z0-9]{64}/g,  // OpenRouter keys
  /gsk_[a-zA-Z0-9]{50,}/g,       // Groq keys
  /[a-f0-9]{32}/g,               // 32-char hex (common API key format)
  /AIza[0-9A-Za-z_\-]{35}/g,     // Google API keys
  /AKIA[0-9A-Z]{16}/g,           // AWS Access Keys
];

// Files/directories to exclude
const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git/,
  /coverage/,
  /dist/,
  /build/,
  /\.nyc_output/,
  /\.env$/,
  /\.log$/,
  /SECURITY_AUDIT/,
  /security-scan\.js$/
];

function scanFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const results = [];
    
    SENSITIVE_PATTERNS.forEach((pattern, index) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Skip if it's clearly a placeholder
          if (match.includes('your_') || match.includes('[YOUR_') || 
              match.includes('placeholder') || match.includes('example')) {
            return;
          }
          
          results.push({
            pattern: pattern.toString(),
            match: match,
            file: filePath
          });
        });
      }
    });
    
    return results;
  } catch (error) {
    return [];
  }
}

function scanDirectory(dirPath) {
  let allResults = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(itemPath))) {
        return;
      }
      
      const stat = fs.statSync(itemPath);
      
      if (stat.isDirectory()) {
        allResults = allResults.concat(scanDirectory(itemPath));
      } else if (stat.isFile()) {
        const results = scanFile(itemPath);
        allResults = allResults.concat(results);
      }
    });
  } catch (error) {
    // Directory access error, skip
  }
  
  return allResults;
}

function main() {
  console.log('🔍 MDSAAD Security Scan - Checking for API keys...\n');
  
  const projectRoot = process.cwd();
  const results = scanDirectory(projectRoot);
  
  if (results.length === 0) {
    console.log('✅ SECURITY SCAN PASSED');
    console.log('🔒 No API keys or sensitive data found!');
    console.log('🚀 Codebase is secure and ready for deployment.\n');
    
    console.log('📋 Scan Summary:');
    console.log('   • Checked for OpenRouter API keys (sk-or-v1-...)');
    console.log('   • Checked for Groq API keys (gsk_...)');
    console.log('   • Checked for generic hex keys (32+ characters)');
    console.log('   • Checked for Google/AWS API key patterns');
    console.log('   • Excluded .env files and node_modules');
    
    process.exit(0);
  } else {
    console.log('❌ SECURITY SCAN FAILED');
    console.log('🚨 Found potential API keys or sensitive data:\n');
    
    results.forEach((result, index) => {
      console.log(`${index + 1}. File: ${result.file}`);
      console.log(`   Pattern: ${result.pattern}`);
      console.log(`   Match: ${result.match.substring(0, 20)}...`);
      console.log('');
    });
    
    console.log('🔧 Action Required:');
    console.log('   1. Remove or replace sensitive data with placeholders');
    console.log('   2. Move actual keys to environment variables');
    console.log('   3. Run this script again to verify');
    
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { scanDirectory, scanFile };