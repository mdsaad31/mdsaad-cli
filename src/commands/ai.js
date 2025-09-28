/**
 * AI Command
 * Multi-provider AI interaction system with streaming, context management, and rate limiting
 */

const chalk = require('chalk');
const readline = require('readline');
const axios = require('axios');
const apiManager = require('../services/api-manager');
const configService = require('../services/config');
const cacheService = require('../services/cache');
const loggerService = require('../services/logger');
const mdsaadKeys = require('../config/mdsaad-keys');
const ollamaService = require('../services/ollama');

class AICommand {
  constructor() {
    this.conversationHistory = [];
    this.rateLimitTracker = new Map();
    this.proxyAPI = null;
    this.providers = {
      openrouter: {
        name: 'OpenRouter (Free Models)',
        endpoint: '/v1/chat/completions',
        formatRequest: this.formatOpenAIRequest.bind(this),
        parseResponse: this.parseOpenAIResponse.bind(this),
        supportsStreaming: true,
        isFree: true,
        priority: 1  // Highest priority (DeepSeek through OpenRouter)
      },
      groq: {
        name: 'Groq (Free)',
        endpoint: '/v1/chat/completions',
        formatRequest: this.formatOpenAIRequest.bind(this),
        parseResponse: this.parseOpenAIResponse.bind(this),
        supportsStreaming: true,
        isFree: true,
        priority: 2
      },
      deepseek: {
        name: 'DeepSeek (Free)',
        endpoint: '/v1/chat/completions',
        formatRequest: this.formatOpenAIRequest.bind(this),
        parseResponse: this.parseOpenAIResponse.bind(this),
        supportsStreaming: true,
        isFree: true,
        priority: 3
      },
      gemini: {
        name: 'Google Gemini (Free)', 
        endpoint: '/v1/models/gemini-1.5-flash:generateContent',
        formatRequest: this.formatGeminiRequest.bind(this),
        parseResponse: this.parseGeminiResponse.bind(this),
        supportsStreaming: false,
        isFree: true,
        priority: 4  // Lowest priority
      },
      ollama: {
        name: 'Ollama (Local)',
        endpoint: null, // Handled differently
        formatRequest: this.formatOllamaRequest.bind(this),
        parseResponse: this.parseOllamaResponse.bind(this),
        supportsStreaming: false,
        isFree: true,
        priority: 4
      }
    };
  }

  /**
   * Execute AI command with comprehensive multi-provider support
   */
  async execute(prompt, options = {}) {
    try {
      // Check if we should use proxy API or direct API keys
      const useProxyAPI = process.env.MDSAAD_USE_PROXY !== 'false'; // Default to proxy
      
      if (useProxyAPI) {
        // Use proxy API (no API keys needed for users)
        console.log(chalk.cyan('🤖 Connecting to MDSAAD AI Service...'));
        const proxyResult = await this.handleProxyRequest(prompt, options);
        if (proxyResult) return;
        
        // If proxy fails, fall back to direct API if keys available
        console.log(chalk.yellow('⚠️ Proxy service unavailable, checking for local API keys...'));
      }

      // Check if API keys are configured for direct access
      const { checkApiKeysConfigured, getSetupInstructions } = require('../config/mdsaad-keys');
      const keyStatus = checkApiKeysConfigured();
      
      if (!keyStatus.ai) {
        if (useProxyAPI) {
          console.log(chalk.red('❌ MDSAAD AI Service is temporarily unavailable and no local API keys are configured.'));
          console.log(chalk.yellow('\n🔄 You have two options:\n'));
          console.log(chalk.cyan('1. Wait for the service to come back online (recommended)'));
          console.log(chalk.cyan('2. Configure your own API keys as backup:\n'));
        } else {
          console.log(chalk.red('❌ No AI API keys configured!'));
          console.log(chalk.yellow('\n🔑 To use AI features, you need to configure API keys:\n'));
        }
        
        const instructions = getSetupInstructions();
        console.log(chalk.cyan(instructions.message));
        
        instructions.methods.forEach(method => {
          console.log(chalk.yellow(`\n${method.title}:`));
          method.instructions.forEach(inst => {
            console.log(`   ${inst}`);
          });
        });
        
        console.log(chalk.green('\n💡 Quick start: Run "mdsaad config setup" for interactive configuration'));
        return;
      }

      // Initialize services
      if (!apiManager.initialized) {
        await apiManager.initialize();
      }
      if (!ollamaService.initialized) {
        await ollamaService.initialize();
      }
      
      // Handle special commands
      if (await this.handleSpecialCommands(prompt, options)) {
        return;
      }

      // If using direct API keys, validate and prepare request
      const preparedRequest = await this.prepareRequest(prompt, options);
      if (!preparedRequest) return;

      // Check rate limits
      if (!this.checkRateLimit(preparedRequest.provider)) {
        return;
      }

      // Execute AI request
      await this.executeAIRequest(preparedRequest);

    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Handle special commands (help, history, clear, etc.)
   */
  async handleSpecialCommands(prompt, options) {
    const command = prompt?.toLowerCase();

    switch (command) {
      case 'help':
      case '?':
        this.showHelp();
        return true;

      case 'providers':
        await this.showProviders();
        return true;

      case 'history':
        this.showHistory();
        return true;

      case 'clear':
        this.clearHistory();
        console.log(chalk.green('🧹 Conversation history cleared'));
        return true;

      case 'quota':
      case 'limits':
        this.showRateLimits();
        return true;

      case 'models':
        await this.showAvailableModels(); // Don't filter by provider for models command
        return true;

      case 'interactive':
      case 'chat':
        await this.startInteractiveMode(options);
        return true;

      case 'ollama':
        await this.showOllamaStatus();
        return true;

      case 'pull':
        if (options.model) {
          await this.pullOllamaModel(options.model);
        } else {
          console.log(chalk.red('❌ Please specify a model to pull: --model <model-name>'));
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * Prepare and validate AI request
   */
  async prepareRequest(prompt, options) {
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log(chalk.red('❌ Please provide a valid prompt'));
      return null;
    }

    const provider = this.selectProvider(options.model || options.provider);
    if (!provider) {
      console.log(chalk.red('❌ No available AI providers'));
      console.log(chalk.gray('Use "mdsaad config" to configure API keys'));
      return null;
    }

    // Load conversation context if requested
    let context = [];
    if (options.context && options.context !== 'none') {
      context = await this.loadContext(options.context);
    }

    return {
      prompt: prompt.trim(),
      provider,
      options: {
        model: options.model || this.getDefaultModel(provider),
        provider: provider, // Add provider to options
        temperature: parseFloat(options.temperature) || 0.7,
        maxTokens: parseInt(options.maxTokens) || 1000,
        stream: options.stream || false,
        context: context,
        systemPrompt: options.system || null
      }
    };
  }

  /**
   * Execute AI request with provider-specific formatting
   */
  async executeAIRequest(request) {
    const { prompt, provider, options } = request;
    const providerConfig = this.providers[provider];

    if (!providerConfig) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    console.log(chalk.cyan(`🤖 ${providerConfig.name}`) + chalk.gray(` (${options.model})`));
    console.log();

    try {
      let response, aiResponse, responseTime;
      const startTime = Date.now();

      if (provider === 'ollama') {
        // Handle Ollama locally
        const ollamaResponse = await ollamaService.generate(prompt, options);
        aiResponse = providerConfig.parseResponse({ data: ollamaResponse });
      } else {
        // Handle all API providers directly with your API keys
        response = await this.makeDirectApiRequest(provider, prompt, options, providerConfig);
        aiResponse = providerConfig.parseResponse(response);
      }

      responseTime = Date.now() - startTime;
      
      if (options.stream && providerConfig.supportsStreaming) {
        await this.displayStreamingResponse(aiResponse, responseTime);
      } else {
        this.displayResponse(aiResponse, responseTime);
      }

      // Add to conversation history
      this.addToHistory(prompt, aiResponse.content, provider, options.model);

      // Record successful request for rate limiting (except Ollama)
      if (provider !== 'ollama') {
        this.recordRequest(provider, true);
      }

    } catch (error) {
      if (provider !== 'ollama') {
        this.recordRequest(provider, false);
      }
      throw error;
    }
  }

  /**
   * Format request for Gemini API
   */
  formatGeminiRequest(prompt, options) {
    const contents = [];

    // Add system prompt if provided
    if (options.systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: options.systemPrompt }]
      });
    }

    // Add context from conversation history
    if (options.context && options.context.length > 0) {
      options.context.forEach(item => {
        contents.push({
          role: 'user',
          parts: [{ text: item.prompt }]
        });
        contents.push({
          role: 'model',
          parts: [{ text: item.response }]
        });
      });
    }

    // Add current prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }]
    });

    return {
      contents,
      generationConfig: {
        temperature: options.temperature,
        maxOutputTokens: options.maxTokens,
        topP: 0.8,
        topK: 10
      }
    };
  }

  /**
   * Format request for OpenAI-compatible APIs (OpenRouter, DeepSeek, Groq, Nvidia)
   */
  formatOpenAIRequest(prompt, options) {
    const messages = [];

    // Add system prompt if provided
    if (options.systemPrompt) {
      messages.push({
        role: 'system',
        content: options.systemPrompt
      });
    }

    // Add context from conversation history
    if (options.context && options.context.length > 0) {
      options.context.forEach(item => {
        messages.push({ role: 'user', content: item.prompt });
        messages.push({ role: 'assistant', content: item.response });
      });
    }

    // Add current prompt
    messages.push({
      role: 'user',
      content: prompt
    });

    // Convert model name to actual API value
    const actualModel = this.getActualModelName(options.model, options.provider);

    return {
      model: actualModel,
      messages,
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: options.stream,
      top_p: 0.9
    };
  }

  /**
   * Convert model key to actual API model name
   */
  getActualModelName(modelName, provider) {
    const aiConfig = mdsaadKeys.ai;
    
    if (aiConfig[provider] && aiConfig[provider].models && aiConfig[provider].models[modelName]) {
      const actualModel = aiConfig[provider].models[modelName];
      loggerService.verbose(`Model mapping: ${modelName} -> ${actualModel} (provider: ${provider})`);
      return actualModel;
    }
    
    loggerService.verbose(`No model mapping found for ${modelName} on ${provider}, using as-is`);
    // Return as-is if not found in config
    return modelName;
  }

  /**
   * Parse Gemini API response
   */
  parseGeminiResponse(response) {
    if (!response.data || !response.data.candidates || response.data.candidates.length === 0) {
      throw new Error('Invalid response from Gemini API');
    }

    const candidate = response.data.candidates[0];
    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('No content in Gemini response');
    }

    return {
      content: candidate.content.parts[0].text,
      model: 'gemini-pro',
      usage: response.data.usageMetadata || {},
      finishReason: candidate.finishReason || 'stop'
    };
  }

  /**
   * Parse OpenAI-compatible API response
   */
  parseOpenAIResponse(response) {
    if (!response.data || !response.data.choices || response.data.choices.length === 0) {
      throw new Error('Invalid response from OpenAI-compatible API');
    }

    const choice = response.data.choices[0];
    const content = choice.message?.content || choice.text || '';

    return {
      content: content.trim(),
      model: response.data.model || 'unknown',
      usage: response.data.usage || {},
      finishReason: choice.finish_reason || 'stop'
    };
  }

  /**
   * Make direct request to MDSAAD AI API
   */
  async makeDirectApiRequest(provider, prompt, options, providerConfig) {
    const requestData = providerConfig.formatRequest(prompt, options);
    
    // Get API configuration for each provider
    let apiKey, baseUrl, url, headers;
    
    switch (provider) {
      case 'gemini':
        apiKey = mdsaadKeys.ai.gemini.apiKey;
        baseUrl = mdsaadKeys.ai.gemini.baseUrl;
        url = `${baseUrl}${providerConfig.endpoint}?key=${apiKey}`;
        headers = {
          'Content-Type': 'application/json'
        };
        break;
        
      case 'deepseek':
        apiKey = mdsaadKeys.ai.deepseek.apiKey;
        baseUrl = mdsaadKeys.ai.deepseek.baseUrl;
        url = `${baseUrl}${providerConfig.endpoint}`;
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        break;
        
      case 'groq':
        apiKey = mdsaadKeys.ai.groq.apiKey;
        baseUrl = mdsaadKeys.ai.groq.baseUrl;
        url = `${baseUrl}${providerConfig.endpoint}`;
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        };
        break;
        
      case 'openrouter':
        apiKey = mdsaadKeys.ai.openrouter.apiKey;
        baseUrl = mdsaadKeys.ai.openrouter.baseUrl;
        url = `${baseUrl}${providerConfig.endpoint}`;
        headers = {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/mdsaad/cli', // Required for OpenRouter
          'X-Title': 'MDSAAD CLI'
        };
        break;
        
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
    
    try {
      const response = await axios.post(url, requestData, {
        headers: {
          ...headers,
          'User-Agent': 'MDSAAD CLI v1.0.0'
        },
        timeout: 60000
      });

      return response;
    } catch (error) {
      // Handle API-specific errors
      if (error.response?.status === 401) {
        throw new Error(`${provider} API authentication failed - check your API key in mdsaad-keys.js`);
      } else if (error.response?.status === 429) {
        throw new Error(`${provider} API rate limit exceeded - trying next provider`);
      } else if (error.response?.status === 402) {
        throw new Error(`${provider} API requires payment - trying next provider`);
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        throw new Error(`${provider} API temporarily unavailable - trying next provider`);
      } else {
        throw new Error(`${provider} API error: ${error.response?.data?.error?.message || error.message}`);
      }
    }
  }

  /**
   * Format request for Ollama
   */
  formatOllamaRequest(prompt, options) {
    return {
      model: options.model,
      prompt: prompt,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      system: options.systemPrompt
    };
  }

  /**
   * Parse Ollama response
   */
  parseOllamaResponse(response) {
    const data = response.data;
    
    return {
      content: data.content || data.response || '',
      model: data.model || 'ollama',
      usage: {
        promptTokens: data.promptEvalCount || 0,
        completionTokens: data.evalCount || 0,
        totalTokens: (data.promptEvalCount || 0) + (data.evalCount || 0)
      },
      finishReason: data.done ? 'stop' : 'length',
      timing: {
        totalDuration: data.totalDuration,
        loadDuration: data.loadDuration
      }
    };
  }

  /**
   * Display AI response with formatting
   */
  displayResponse(aiResponse, responseTime) {
    console.log(chalk.white('💬 Response:'));
    console.log();
    
    // Format and display the response content
    const formattedContent = this.formatResponseContent(aiResponse.content);
    console.log(formattedContent);
    console.log();

    // Show metadata
    this.displayResponseMetadata(aiResponse, responseTime);
  }

  /**
   * Display streaming response (simulated for non-streaming providers)
   */
  async displayStreamingResponse(aiResponse, responseTime) {
    console.log(chalk.white('💬 Response:'));
    console.log();

    // Simulate streaming by displaying content word by word
    const words = aiResponse.content.split(' ');
    let displayedContent = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i] + (i < words.length - 1 ? ' ' : '');
      displayedContent += word;
      
      // Clear and redraw
      process.stdout.write('\r' + ' '.repeat(80) + '\r');
      process.stdout.write(this.formatResponseContent(displayedContent));
      
      // Add slight delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log();
    console.log();

    this.displayResponseMetadata(aiResponse, responseTime);
  }

  /**
   * Format response content with basic markdown-like formatting
   */
  formatResponseContent(content) {
    return content
      // Bold text
      .replace(/\*\*(.*?)\*\*/g, chalk.bold('$1'))
      // Italic text
      .replace(/\*(.*?)\*/g, chalk.italic('$1'))
      // Code blocks
      .replace(/`(.*?)`/g, chalk.bgGray.white(' $1 '))
      // Headers
      .replace(/^### (.*$)/gm, chalk.yellow.bold('### $1'))
      .replace(/^## (.*$)/gm, chalk.cyan.bold('## $1'))
      .replace(/^# (.*$)/gm, chalk.magenta.bold('# $1'));
  }

  /**
   * Display response metadata
   */
  displayResponseMetadata(aiResponse, responseTime) {
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(`Model: ${aiResponse.model || 'unknown'}`));
    console.log(chalk.gray(`Response Time: ${responseTime}ms`));
    
    if (aiResponse.usage) {
      if (aiResponse.usage.promptTokens || aiResponse.usage.prompt_tokens) {
        const promptTokens = aiResponse.usage.promptTokens || aiResponse.usage.prompt_tokens;
        const completionTokens = aiResponse.usage.completionTokens || aiResponse.usage.completion_tokens;
        const totalTokens = aiResponse.usage.totalTokens || aiResponse.usage.total_tokens;
        
        console.log(chalk.gray(`Tokens: ${promptTokens} prompt + ${completionTokens} completion = ${totalTokens} total`));
      }
    }
    
    console.log(chalk.gray(`Finish Reason: ${aiResponse.finishReason}`));
    console.log();
  }

  /**
   * Select best available provider
   */
  selectProvider(preferredProvider) {
    // First, check if preferredProvider is a model name and get its provider
    if (preferredProvider) {
      const providerForModel = this.getProviderForModel(preferredProvider);
      if (providerForModel && this.checkProviderApiKey(providerForModel)) {
        return providerForModel;
      }
    }

    // If specific provider requested directly, try it
    if (preferredProvider && this.providers[preferredProvider]) {
      if (preferredProvider === 'ollama') {
        return ollamaService.isAvailable() ? 'ollama' : null;
      }
      
      // Check if API key is configured for this provider
      if (this.checkProviderApiKey(preferredProvider)) {
        return preferredProvider;
      }
    }

    // Auto-select best available provider using priority order from config
    const priorityOrder = mdsaadKeys.aiProviderPriority || ['openrouter', 'groq', 'deepseek', 'gemini'];
    
    // Find first available provider from priority list
    for (const providerName of priorityOrder) {
      const hasApiKey = this.checkProviderApiKey(providerName);
      if (hasApiKey) {
        loggerService.verbose(`Selected provider: ${providerName} (priority: ${priorityOrder.indexOf(providerName) + 1})`);
        return providerName;
      }
    }
    
    // Fallback to Ollama if no API providers available
    if (ollamaService.isAvailable()) {
      loggerService.verbose('Selected provider: ollama (fallback)');
      return 'ollama';
    }
    
    // No providers available
    console.log(chalk.yellow('💡 All AI providers are unavailable. Check API keys in mdsaad-keys.js'));
    return null;
  }

  /**
   * Check if provider has API key configured
   */
  checkProviderApiKey(provider) {
    try {
      switch (provider) {
        case 'gemini':
          return mdsaadKeys.ai.gemini.apiKey && !mdsaadKeys.ai.gemini.apiKey.includes('YOUR_');
        case 'deepseek':
          return mdsaadKeys.ai.deepseek.apiKey && !mdsaadKeys.ai.deepseek.apiKey.includes('YOUR_');
        case 'groq':
          return mdsaadKeys.ai.groq.apiKey && !mdsaadKeys.ai.groq.apiKey.includes('YOUR_');
        case 'openrouter':
          return mdsaadKeys.ai.openrouter.apiKey && !mdsaadKeys.ai.openrouter.apiKey.includes('YOUR_');
        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Get default model for provider
   */
  getDefaultModel(provider) {
    const aiConfig = mdsaadKeys.ai;
    
    if (provider === 'ollama') {
      return ollamaService.getDefaultModel() || 'llama3.2';
    }
    
    if (aiConfig[provider] && aiConfig[provider].defaultModel) {
      return aiConfig[provider].defaultModel;
    }
    
    // Fallback to first model if no default specified
    if (aiConfig[provider] && aiConfig[provider].models) {
      const firstModel = Object.keys(aiConfig[provider].models)[0];
      return firstModel || 'default';
    }
    
    return 'default';
  }

  /**
   * Get provider for a specific model
   */
  getProviderForModel(modelName) {
    // Build model-to-provider mapping from configuration
    const aiConfig = mdsaadKeys.ai;
    
    for (const [providerName, config] of Object.entries(aiConfig)) {
      if (config.models) {
        // Check if model exists in this provider
        if (config.models[modelName]) {
          return providerName;
        }
        
        // Also check by the actual model value (e.g., 'deepseek/deepseek-chat')
        for (const [modelKey, modelValue] of Object.entries(config.models)) {
          if (modelValue === modelName) {
            return providerName;
          }
        }
      }
    }
    
    // Legacy model mapping for backward compatibility
    const legacyMapping = {
      // Common model name patterns
      'llama-3.1-8b': 'groq',
      'llama-3.1-70b': 'groq',
      'mixtral-8x7b': 'groq',
      'gemma-7b': 'groq',
      'deepseek-chat': 'openrouter', // Default to OpenRouter for DeepSeek
      'deepseek-coder': 'openrouter',
      'gemini-pro': 'gemini',
      'gemini-1.5-flash': 'gemini'
    };
    
    return legacyMapping[modelName] || null;
  }

  /**
   * Check rate limiting (10 requests per hour)
   */
  checkRateLimit(provider) {
    const now = Date.now();
    const hourAgo = now - 3600000; // 1 hour in ms
    
    if (!this.rateLimitTracker.has(provider)) {
      this.rateLimitTracker.set(provider, []);
    }
    
    const requests = this.rateLimitTracker.get(provider);
    
    // Clean old requests
    const recentRequests = requests.filter(time => time > hourAgo);
    this.rateLimitTracker.set(provider, recentRequests);
    
    // Check limit (10 requests per hour)
    if (recentRequests.length >= 10) {
      const oldestRequest = Math.min(...recentRequests);
      const resetTime = new Date(oldestRequest + 3600000);
      
      console.log(chalk.red('❌ Rate limit exceeded (10 requests/hour)'));
      console.log(chalk.yellow(`⏰ Limit resets at: ${resetTime.toLocaleTimeString()}`));
      console.log(chalk.gray('Use "mdsaad ai quota" to check current usage'));
      return false;
    }
    
    return true;
  }

  /**
   * Record request for rate limiting
   */
  recordRequest(provider, success) {
    const now = Date.now();
    
    if (!this.rateLimitTracker.has(provider)) {
      this.rateLimitTracker.set(provider, []);
    }
    
    const requests = this.rateLimitTracker.get(provider);
    requests.push(now);
  }

  /**
   * Add interaction to conversation history
   */
  addToHistory(prompt, response, provider, model) {
    const entry = {
      timestamp: new Date().toISOString(),
      prompt: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
      response: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
      provider,
      model,
      fullPrompt: prompt,
      fullResponse: response
    };

    this.conversationHistory.push(entry);

    // Keep only last 50 conversations
    if (this.conversationHistory.length > 50) {
      this.conversationHistory = this.conversationHistory.slice(-50);
    }

    // Cache history for persistence
    cacheService.set('ai_conversation_history', this.conversationHistory, 'ai', 86400000);
  }

  /**
   * Load conversation context
   */
  async loadContext(contextType) {
    try {
      if (contextType === 'recent') {
        return this.conversationHistory.slice(-5).map(entry => ({
          prompt: entry.fullPrompt,
          response: entry.fullResponse
        }));
      }
      
      if (contextType === 'all') {
        return this.conversationHistory.map(entry => ({
          prompt: entry.fullPrompt,
          response: entry.fullResponse
        }));
      }
      
      return [];
    } catch (error) {
      loggerService.warn('Failed to load conversation context:', error.message);
      return [];
    }
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(chalk.yellow('🤖 AI Assistant Help'));
    console.log();
    
    console.log(chalk.cyan('Basic Usage:'));
    console.log('  mdsaad ai "your question here"           →  Ask AI a question');
    console.log('  mdsaad ai "explain quantum computing"    →  Get explanations');
    console.log('  mdsaad ai "write a python function"      →  Code assistance');
    console.log();
    
    console.log(chalk.cyan('Options:'));
    console.log('  -m, --model <model>        →  Specify AI model to use');
    console.log('  -p, --provider <name>      →  Prefer specific provider');
    console.log('  -t, --temperature <0-1>    →  Control creativity (0=focused, 1=creative)');
    console.log('  --max-tokens <number>      →  Maximum response length');
    console.log('  -c, --context <type>       →  Include conversation context');
    console.log('  -s, --stream              →  Stream response in real-time');
    console.log('  --system <prompt>         →  Set system prompt');
    console.log();
    
    console.log(chalk.cyan('Special Commands:'));
    console.log('  mdsaad ai providers       →  Show available AI providers');
    console.log('  mdsaad ai models          →  Show available models');
    console.log('  mdsaad ai history         →  Show conversation history');
    console.log('  mdsaad ai quota           →  Show rate limit status');
    console.log('  mdsaad ai clear           →  Clear conversation history');
    console.log('  mdsaad ai interactive     →  Start interactive chat mode');
    console.log('  mdsaad ai ollama          →  Show Ollama status and models');
    console.log('  mdsaad ai pull --model <name>  →  Install Ollama model');
    console.log();
    
    console.log(chalk.cyan('Examples:'));
    console.log('  mdsaad ai "What is machine learning?" --provider gemini');
    console.log('  mdsaad ai "Write a poem" --temperature 0.9 --stream');
    console.log('  mdsaad ai "Debug this code" --context recent');
    console.log('  mdsaad ai "Act as a helpful assistant" --system');
  }

  /**
   * Show available providers
   */
  async showProviders() {
    console.log(chalk.yellow('🤖 Available AI Providers'));
    console.log();

    for (const [key, config] of Object.entries(this.providers)) {
      let isHealthy;
      
      if (key === 'ollama') {
        isHealthy = ollamaService.isAvailable();
      } else {
        const provider = apiManager.getProvider(key);
        isHealthy = provider && provider.enabled && apiManager.isProviderHealthy(key);
      }
      
      console.log(chalk.white(`${config.name} (${key}):`));
      console.log(`  Status: ${isHealthy ? chalk.green('✅ Available') : chalk.red('❌ Unavailable')}`);
      console.log(`  Default Model: ${chalk.cyan(this.getDefaultModel(key))}`);
      console.log(`  Streaming: ${config.supportsStreaming ? chalk.green('Yes') : chalk.yellow('No')}`);
      
      if (key === 'ollama') {
        console.log(`  Type: ${chalk.white('Local/Offline')}`);
        if (isHealthy) {
          console.log(`  Models: ${chalk.white(ollamaService.getModels().length)} installed`);
        }
      } else {
        const provider = apiManager.getProvider(key);
        if (provider) {
          console.log(`  Priority: ${chalk.white(provider.priority)}`);
          console.log(`  Rate Limit: ${chalk.white(provider.rateLimit.requests)} req/${this.formatWindow(provider.rateLimit.window)}`);
        }
      }
      console.log();
    }
  }

  /**
   * Show conversation history
   */
  showHistory() {
    console.log(chalk.yellow('📚 Conversation History'));
    console.log();

    if (this.conversationHistory.length === 0) {
      console.log(chalk.gray('No conversations yet'));
      return;
    }

    this.conversationHistory.slice(-10).forEach((entry, index) => {
      const number = this.conversationHistory.length - 9 + index;
      const time = new Date(entry.timestamp).toLocaleTimeString();
      
      console.log(chalk.gray(`${number}. `) + chalk.cyan(`[${time}]`) + chalk.white(` ${entry.provider}`));
      console.log(chalk.gray('   Q: ') + entry.prompt);
      console.log(chalk.gray('   A: ') + entry.response);
      console.log();
    });

    if (this.conversationHistory.length > 10) {
      console.log(chalk.gray(`... and ${this.conversationHistory.length - 10} more conversations`));
    }
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    cacheService.invalidate('ai_conversation_history', 'ai');
  }

  /**
   * Show rate limit status
   */
  showRateLimits() {
    console.log(chalk.yellow('⏱️  Rate Limit Status'));
    console.log();

    const now = Date.now();
    const hourAgo = now - 3600000;

    for (const provider of Object.keys(this.providers)) {
      if (!this.rateLimitTracker.has(provider)) {
        console.log(chalk.white(`${provider}:`));
        console.log(`  Requests this hour: ${chalk.green('0/10')}`);
        console.log(`  Remaining: ${chalk.green('10')}`);
        continue;
      }

      const requests = this.rateLimitTracker.get(provider);
      const recentRequests = requests.filter(time => time > hourAgo);
      const remaining = Math.max(0, 10 - recentRequests.length);

      console.log(chalk.white(`${provider}:`));
      console.log(`  Requests this hour: ${recentRequests.length >= 8 ? chalk.yellow(`${recentRequests.length}/10`) : chalk.green(`${recentRequests.length}/10`)}`);
      console.log(`  Remaining: ${remaining === 0 ? chalk.red(remaining) : chalk.green(remaining)}`);
      
      if (recentRequests.length > 0) {
        const nextReset = new Date(Math.min(...recentRequests) + 3600000);
        console.log(`  Next reset: ${chalk.gray(nextReset.toLocaleTimeString())}`);
      }
      console.log();
    }
  }

  /**
   * Show available models for provider
   */
  async showAvailableModels(provider) {
    console.log(chalk.yellow(`🎯 Available AI Models${provider ? ` for ${provider}` : ''}`));
    console.log();

    // Get provider configuration from mdsaad-keys.js
    const aiConfig = mdsaadKeys.ai;
    const priorityOrder = mdsaadKeys.aiProviderPriority || Object.keys(aiConfig);
    
    const providersToShow = provider ? [provider] : priorityOrder;

    let totalModels = 0;

    providersToShow.forEach(p => {
      if (aiConfig[p] && aiConfig[p].models) {
        const providerInfo = this.providers[p] || { name: p };
        const isTopPriority = priorityOrder[0] === p;
        
        console.log(chalk.white(`${providerInfo.name || p}:`) + 
          (isTopPriority ? chalk.green(' (Primary)') : '') +
          (aiConfig[p].apiKey ? chalk.gray(' [Configured]') : chalk.red(' [No API Key]')));
        
        const models = aiConfig[p].models;
        const defaultModel = aiConfig[p].defaultModel;
        
        Object.keys(models).forEach(modelKey => {
          const modelValue = models[modelKey];
          const isDefault = modelKey === defaultModel;
          const isFree = modelValue.includes(':free') || p === 'groq' || p === 'deepseek';
          
          console.log(`  ${chalk.cyan(modelKey)}${isDefault ? chalk.green(' (default)') : ''}${isFree ? chalk.yellow(' [FREE]') : ''}`);
          console.log(`    ${chalk.gray('→')} ${modelValue}`);
          totalModels++;
        });
        console.log();
      }
    });

    // Add Ollama models if available
    try {
      const ollamaStatus = await ollamaService.getStatus();
      if (ollamaStatus.available && ollamaStatus.models > 0) {
        console.log(chalk.white(`Ollama (Local):`) + chalk.yellow(' [FREE]') + chalk.gray(' [Local]'));
        const models = await ollamaService.listModels();
        models.forEach(model => {
          console.log(`  ${chalk.cyan(model.name)} ${chalk.gray(`(${model.size})`)}`);
          totalModels++;
        });
        console.log();
      }
    } catch (error) {
      // Ollama not available, skip silently
    }

    console.log(chalk.gray(`Total: ${totalModels} models across ${providersToShow.length} providers`));
    console.log();
    console.log(chalk.gray('Usage: mdsaad ai "your prompt" --model <model-name>'));
    console.log(chalk.gray('   or: mdsaad ai "your prompt" --provider <provider-name>'));
  }

  /**
   * Start interactive chat mode
   */
  async startInteractiveMode(options) {
    console.log(chalk.yellow('💬 Interactive AI Chat Mode'));
    console.log(chalk.gray('Type "exit" or "quit" to end the session'));
    console.log();

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: chalk.cyan('You: ')
    });

    rl.prompt();

    rl.on('line', async (input) => {
      const trimmed = input.trim();
      
      if (trimmed === 'exit' || trimmed === 'quit') {
        rl.close();
        return;
      }

      if (trimmed === '') {
        rl.prompt();
        return;
      }

      try {
        // Use recent context in interactive mode
        const contextOptions = { ...options, context: 'recent' };
        await this.execute(trimmed, contextOptions);
      } catch (error) {
        console.log(chalk.red('❌ Error:'), error.message);
      }

      console.log();
      rl.prompt();
    });

    rl.on('close', () => {
      console.log(chalk.gray('Interactive session ended'));
    });
  }

  /**
   * Handle errors with user-friendly messages
   */
  handleError(error) {
    console.log(chalk.red('❌ AI request failed:'), error.message);
    
    if (error.message.includes('rate limit')) {
      console.log(chalk.yellow('💡 Try again in a few minutes or use a different provider'));
    } else if (error.message.includes('API key')) {
      console.log(chalk.yellow('💡 Configure your API key: mdsaad config set apiProviders.<provider>.apiKey "your-key"'));
    } else if (error.message.includes('No available')) {
      console.log(chalk.yellow('💡 Configure at least one AI provider: mdsaad api providers'));
    }
    
    console.log(chalk.gray('Use "mdsaad ai help" for usage information'));
  }

  /**
   * Show Ollama status and available models
   */
  async showOllamaStatus() {
    console.log(chalk.yellow('🦙 Ollama Status'));
    console.log();

    const status = await ollamaService.getStatus();
    
    console.log(`Status: ${status.available ? chalk.green('✅ Available') : chalk.red('❌ Unavailable')}`);
    console.log(`URL: ${chalk.cyan(status.url)}`);
    console.log(`Models: ${chalk.white(status.models)}`);
    console.log();

    if (status.available) {
      const models = ollamaService.getModels();
      if (models.length > 0) {
        console.log(chalk.cyan('Installed Models:'));
        models.forEach(model => {
          console.log(`  ${chalk.white(model.name)} - ${chalk.gray(model.size)} (${model.modified})`);
        });
      } else {
        console.log(chalk.yellow('No models installed'));
      }
      console.log();
      
      console.log(chalk.cyan('Popular Models to Install:'));
      ollamaService.getPopularModels().forEach(model => {
        console.log(`  ${chalk.white(model.name)} - ${chalk.gray(model.size)}`);
        console.log(`    ${chalk.gray(model.description)}`);
      });
      console.log();
      console.log(chalk.gray('Use "mdsaad ai pull --model <model-name>" to install a model'));
      
    } else if (status.error) {
      console.log(chalk.red('Error:'), status.error);
      console.log();
      console.log(chalk.yellow('💡 Make sure Ollama is installed and running:'));
      console.log('   1. Install Ollama from https://ollama.ai');
      console.log('   2. Start Ollama with "ollama serve"');
      console.log('   3. Pull a model with "ollama pull llama3.2"');
    }
  }

  /**
   * Pull an Ollama model
   */
  async pullOllamaModel(modelName) {
    try {
      if (!ollamaService.isAvailable()) {
        console.log(chalk.red('❌ Ollama is not available'));
        return;
      }

      await ollamaService.pullModel(modelName);
      
    } catch (error) {
      console.log(chalk.red('❌ Failed to pull model:'), error.message);
    }
  }

  /**
   * Handle AI requests through proxy API
   */
  async handleProxyRequest(prompt, options) {
    try {
      // Initialize proxy service if needed
      if (!this.proxyAPI) {
        const ProxyAPIService = require('../services/proxy-api');
        this.proxyAPI = new ProxyAPIService();
      }

      // Make request through proxy
      const result = await this.proxyAPI.aiRequest(prompt, options);
      
      if (result.success) {
        // Display the AI response
        console.log(chalk.green('\n🤖 AI Response:'));
        console.log(chalk.white(result.data));
        
        if (options.verbose || options.debug) {
          console.log(chalk.gray(`\n📊 Model: ${result.model}`));
          if (result.usage) {
            console.log(chalk.gray(`💰 Tokens used: ${result.usage.total_tokens || 'N/A'}`));
          }
        }

        // Add to conversation history
        this.conversationHistory.push({
          role: 'user',
          content: prompt,
          timestamp: new Date().toISOString()
        });
        
        this.conversationHistory.push({
          role: 'assistant', 
          content: result.data,
          model: result.model,
          timestamp: new Date().toISOString()
        });

        return true; // Success
      } else {
        // Handle proxy API errors
        if (result.code === 'RATE_LIMIT_EXCEEDED') {
          console.log(chalk.red('❌ ' + result.error));
          console.log(chalk.yellow('💡 Tip: Rate limits reset every hour. You can also configure your own API keys as backup.'));
        } else if (result.code === 'CONNECTION_ERROR' && result.fallback) {
          console.log(chalk.yellow('⚠️ ' + result.error));
          console.log(chalk.cyan('🔄 Falling back to direct API access...'));
          return false; // Allow fallback to direct API
        } else if (result.error && result.error.includes('401')) {
          console.log(chalk.yellow('⚠️ MDSAAD AI Service is temporarily under maintenance.'));
          console.log(chalk.cyan('🔄 Falling back to direct API access...'));
          return false; // Allow fallback for authentication issues
        } else {
          console.log(chalk.red('❌ ' + result.error));
        }
        return true; // Don't fallback for other errors
      }
    } catch (error) {
      console.log(chalk.yellow('⚠️ Proxy service connection failed, trying direct API access...'));
      loggerService.debug('Proxy API error:', error);
      return false; // Allow fallback
    }
  }

  /**
   * Helper method to format time windows
   */
  formatWindow(ms) {
    if (ms >= 3600000) return `${ms / 3600000}h`;
    if (ms >= 60000) return `${ms / 60000}m`;
    return `${ms / 1000}s`;
  }
}

module.exports = new AICommand();