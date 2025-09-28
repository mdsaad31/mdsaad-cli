/**
 * AI Command Tests
 * Comprehensive testing for multi-provider AI interactions
 */

const aiCommand = require('../src/commands/ai');
const apiManager = require('../src/services/api-manager');
const configService = require('../src/services/config');
const cacheService = require('../src/services/cache');
const loggerService = require('../src/services/logger');

// Mock dependencies
jest.mock('../src/services/api-manager');
jest.mock('../src/services/config');
jest.mock('../src/services/cache');
jest.mock('../src/services/logger');
jest.mock('readline');

describe('AI Command', () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    // Reset AI command state
    aiCommand.conversationHistory = [];
    aiCommand.rateLimitTracker = new Map();

    // Mock API manager
    apiManager.initialized = false;
    apiManager.initialize = jest.fn().mockResolvedValue();
    apiManager.getProvider = jest.fn().mockReturnValue({
      enabled: true,
      priority: 1,
      rateLimit: { requests: 100, window: 3600000 }
    });
    apiManager.isProviderHealthy = jest.fn().mockReturnValue(true);
    apiManager.makeRequest = jest.fn().mockResolvedValue({
      data: {
        candidates: [{
          content: { parts: [{ text: 'Mock AI response' }] },
          finishReason: 'stop'
        }]
      }
    });

    // Mock config service
    configService.get = jest.fn().mockReturnValue('test-api-key');

    // Mock cache service
    cacheService.set = jest.fn();
    cacheService.get = jest.fn().mockReturnValue(null);
    cacheService.invalidate = jest.fn();

    // Mock logger service
    loggerService.warn = jest.fn();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Basic Functionality', () => {
    test('should handle valid AI request', async () => {
      const options = { provider: 'gemini' };
      
      await aiCommand.execute('What is AI?', options);

      expect(apiManager.initialize).toHaveBeenCalled();
      expect(apiManager.makeRequest).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Google Gemini')
      );
    });

    test('should reject empty prompts', async () => {
      await aiCommand.execute('', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please provide a valid prompt')
      );
      expect(apiManager.makeRequest).not.toHaveBeenCalled();
    });

    test('should handle null/undefined prompts', async () => {
      await aiCommand.execute(null, {});
      await aiCommand.execute(undefined, {});
      
      expect(apiManager.makeRequest).not.toHaveBeenCalled();
    });
  });

  describe('Special Commands', () => {
    test('should show help for help command', async () => {
      await aiCommand.execute('help', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI Assistant Help')
      );
    });

    test('should show providers for providers command', async () => {
      await aiCommand.execute('providers', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available AI Providers')
      );
    });

    test('should show history for history command', async () => {
      // Add some history
      aiCommand.conversationHistory = [{
        timestamp: new Date().toISOString(),
        prompt: 'Test question',
        response: 'Test answer',
        provider: 'gemini',
        model: 'gemini-pro'
      }];

      await aiCommand.execute('history', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conversation History')
      );
    });

    test('should clear history for clear command', async () => {
      aiCommand.conversationHistory = [{ test: 'data' }];
      
      await aiCommand.execute('clear', {});
      
      expect(aiCommand.conversationHistory).toHaveLength(0);
      expect(cacheService.invalidate).toHaveBeenCalledWith('ai_conversation_history', 'ai');
    });

    test('should show quota for quota command', async () => {
      await aiCommand.execute('quota', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate Limit Status')
      );
    });

    test('should show models for models command', async () => {
      await aiCommand.execute('models', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Available Models')
      );
    });
  });

  describe('Provider Selection', () => {
    test('should select preferred provider when available', () => {
      const provider = aiCommand.selectProvider('gemini');
      expect(provider).toBe('gemini');
    });

    test('should fallback when preferred provider unavailable', () => {
      apiManager.getProvider.mockImplementation((name) => {
        if (name === 'gemini') return null; // Not available
        return { enabled: true, priority: 1 };
      });

      const provider = aiCommand.selectProvider('gemini');
      expect(provider).toBeTruthy(); // Should get fallback
    });

    test('should return null when no providers available', () => {
      apiManager.getProvider.mockReturnValue(null);
      
      const provider = aiCommand.selectProvider();
      expect(provider).toBeNull();
    });

    test('should select highest priority provider', () => {
      apiManager.getProvider.mockImplementation((name) => ({
        enabled: true,
        priority: name === 'openrouter' ? 3 : 1
      }));

      const provider = aiCommand.selectProvider();
      expect(provider).toBe('openrouter');
    });
  });

  describe('Request Formatting', () => {
    test('should format Gemini request correctly', () => {
      const request = aiCommand.formatGeminiRequest('Test prompt', {
        temperature: 0.7,
        maxTokens: 1000
      });

      expect(request).toHaveProperty('contents');
      expect(request).toHaveProperty('generationConfig');
      expect(request.contents[0].parts[0].text).toBe('Test prompt');
      expect(request.generationConfig.temperature).toBe(0.7);
    });

    test('should format OpenAI request correctly', () => {
      const request = aiCommand.formatOpenAIRequest('Test prompt', {
        model: 'gpt-3.5-turbo',
        temperature: 0.8,
        maxTokens: 500
      });

      expect(request).toHaveProperty('messages');
      expect(request).toHaveProperty('model');
      expect(request.messages[0].content).toBe('Test prompt');
      expect(request.temperature).toBe(0.8);
    });

    test('should include system prompt when provided', () => {
      const request = aiCommand.formatOpenAIRequest('Test prompt', {
        systemPrompt: 'You are a helpful assistant',
        model: 'gpt-3.5-turbo'
      });

      expect(request.messages[0].role).toBe('system');
      expect(request.messages[0].content).toBe('You are a helpful assistant');
    });

    test('should include conversation context', () => {
      const context = [
        { prompt: 'Previous question', response: 'Previous answer' }
      ];

      const request = aiCommand.formatOpenAIRequest('New question', {
        context,
        model: 'gpt-3.5-turbo'
      });

      expect(request.messages).toHaveLength(3); // system + context pair + new question
      expect(request.messages[0].content).toBe('Previous question');
      expect(request.messages[1].content).toBe('Previous answer');
    });
  });

  describe('Response Parsing', () => {
    test('should parse Gemini response correctly', () => {
      const mockResponse = {
        data: {
          candidates: [{
            content: { parts: [{ text: 'Test response' }] },
            finishReason: 'stop'
          }],
          usageMetadata: { totalTokens: 100 }
        }
      };

      const parsed = aiCommand.parseGeminiResponse(mockResponse);
      
      expect(parsed.content).toBe('Test response');
      expect(parsed.model).toBe('gemini-pro');
      expect(parsed.finishReason).toBe('stop');
    });

    test('should parse OpenAI response correctly', () => {
      const mockResponse = {
        data: {
          choices: [{
            message: { content: 'Test response' },
            finish_reason: 'stop'
          }],
          model: 'gpt-3.5-turbo',
          usage: { total_tokens: 100 }
        }
      };

      const parsed = aiCommand.parseOpenAIResponse(mockResponse);
      
      expect(parsed.content).toBe('Test response');
      expect(parsed.model).toBe('gpt-3.5-turbo');
      expect(parsed.finishReason).toBe('stop');
    });

    test('should handle invalid Gemini response', () => {
      const mockResponse = { data: { candidates: [] } };
      
      expect(() => {
        aiCommand.parseGeminiResponse(mockResponse);
      }).toThrow('Invalid response from Gemini API');
    });

    test('should handle invalid OpenAI response', () => {
      const mockResponse = { data: { choices: [] } };
      
      expect(() => {
        aiCommand.parseOpenAIResponse(mockResponse);
      }).toThrow('Invalid response from OpenAI-compatible API');
    });
  });

  describe('Rate Limiting', () => {
    test('should allow request within rate limit', () => {
      const result = aiCommand.checkRateLimit('gemini');
      expect(result).toBe(true);
    });

    test('should block request when rate limit exceeded', () => {
      // Simulate 10 requests in the last hour
      const now = Date.now();
      aiCommand.rateLimitTracker.set('gemini', 
        Array.from({ length: 10 }, () => now - 1000)
      );

      const result = aiCommand.checkRateLimit('gemini');
      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Rate limit exceeded')
      );
    });

    test('should clean old requests from rate limiter', () => {
      // Add old requests (more than 1 hour ago)
      const twoHoursAgo = Date.now() - 7200000;
      aiCommand.rateLimitTracker.set('gemini', [twoHoursAgo, twoHoursAgo]);

      const result = aiCommand.checkRateLimit('gemini');
      expect(result).toBe(true);
      expect(aiCommand.rateLimitTracker.get('gemini')).toHaveLength(0);
    });

    test('should record successful requests', () => {
      aiCommand.recordRequest('gemini', true);
      
      const requests = aiCommand.rateLimitTracker.get('gemini');
      expect(requests).toHaveLength(1);
      expect(typeof requests[0]).toBe('number');
    });
  });

  describe('Conversation History', () => {
    test('should add interactions to history', () => {
      aiCommand.addToHistory('Test question', 'Test answer', 'gemini', 'gemini-pro');
      
      expect(aiCommand.conversationHistory).toHaveLength(1);
      expect(aiCommand.conversationHistory[0]).toMatchObject({
        provider: 'gemini',
        model: 'gemini-pro',
        fullPrompt: 'Test question',
        fullResponse: 'Test answer'
      });
    });

    test('should limit history to 50 entries', () => {
      // Add 60 entries
      for (let i = 0; i < 60; i++) {
        aiCommand.addToHistory(`Question ${i}`, `Answer ${i}`, 'gemini', 'gemini-pro');
      }
      
      expect(aiCommand.conversationHistory).toHaveLength(50);
      // Should keep the latest 50
      expect(aiCommand.conversationHistory[0].fullPrompt).toBe('Question 10');
    });

    test('should truncate long prompts and responses in history', () => {
      const longPrompt = 'a'.repeat(200);
      const longResponse = 'b'.repeat(300);
      
      aiCommand.addToHistory(longPrompt, longResponse, 'gemini', 'gemini-pro');
      
      const entry = aiCommand.conversationHistory[0];
      expect(entry.prompt).toHaveLength(103); // 100 chars + "..."
      expect(entry.response).toHaveLength(203); // 200 chars + "..."
      expect(entry.fullPrompt).toBe(longPrompt);
      expect(entry.fullResponse).toBe(longResponse);
    });

    test('should load recent context', async () => {
      // Add some history
      for (let i = 0; i < 10; i++) {
        aiCommand.addToHistory(`Question ${i}`, `Answer ${i}`, 'gemini', 'gemini-pro');
      }
      
      const context = await aiCommand.loadContext('recent');
      
      expect(context).toHaveLength(5); // Recent 5
      expect(context[0].prompt).toBe('Question 5');
      expect(context[4].prompt).toBe('Question 9');
    });

    test('should load all context', async () => {
      // Add some history
      for (let i = 0; i < 3; i++) {
        aiCommand.addToHistory(`Question ${i}`, `Answer ${i}`, 'gemini', 'gemini-pro');
      }
      
      const context = await aiCommand.loadContext('all');
      
      expect(context).toHaveLength(3);
    });

    test('should handle context loading errors gracefully', async () => {
      loggerService.warn.mockImplementation(() => {
        throw new Error('Test error');
      });
      
      const context = await aiCommand.loadContext('recent');
      expect(context).toEqual([]);
    });
  });

  describe('Default Models', () => {
    test('should return correct default models', () => {
      expect(aiCommand.getDefaultModel('gemini')).toBe('gemini-pro');
      expect(aiCommand.getDefaultModel('openrouter')).toBe('openai/gpt-3.5-turbo');
      expect(aiCommand.getDefaultModel('deepseek')).toBe('deepseek-chat');
      expect(aiCommand.getDefaultModel('groq')).toBe('llama3-8b-8192');
      expect(aiCommand.getDefaultModel('nvidia')).toBe('meta/llama3-70b-instruct');
      expect(aiCommand.getDefaultModel('unknown')).toBe('default');
    });
  });

  describe('Response Formatting', () => {
    test('should format markdown content', () => {
      const content = '**bold** *italic* `code` ### Header';
      const formatted = aiCommand.formatResponseContent(content);
      
      // Check that formatting functions are applied
      expect(formatted).not.toBe(content);
      expect(formatted.length).toBeGreaterThan(content.length);
    });

    test('should display response metadata', () => {
      const aiResponse = {
        model: 'gpt-3.5-turbo',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        },
        finishReason: 'stop'
      };
      
      aiCommand.displayResponseMetadata(aiResponse, 1500);
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Model: gpt-3.5-turbo')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Response Time: 1500ms')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Tokens: 10 prompt + 20 completion = 30 total')
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle API manager initialization failure', async () => {
      apiManager.initialize.mockRejectedValue(new Error('Init failed'));
      
      await aiCommand.execute('Test question', {});
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ AI request failed:'), 'Init failed'
      );
    });

    test('should handle API request failures', async () => {
      apiManager.makeRequest.mockRejectedValue(new Error('API failed'));
      
      await aiCommand.execute('Test question', { provider: 'gemini' });
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ AI request failed:'), 'API failed'
      );
    });

    test('should provide helpful error messages', () => {
      aiCommand.handleError(new Error('rate limit exceeded'));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Try again in a few minutes')
      );
    });

    test('should handle API key errors', () => {
      aiCommand.handleError(new Error('Invalid API key'));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configure your API key')
      );
    });

    test('should handle no available providers error', () => {
      aiCommand.handleError(new Error('No available providers'));
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Configure at least one AI provider')
      );
    });
  });

  describe('Time Window Formatting', () => {
    test('should format time windows correctly', () => {
      expect(aiCommand.formatWindow(1000)).toBe('1s');
      expect(aiCommand.formatWindow(60000)).toBe('1m');
      expect(aiCommand.formatWindow(3600000)).toBe('1h');
      expect(aiCommand.formatWindow(7200000)).toBe('2h');
    });
  });

  describe('Request Preparation', () => {
    test('should prepare valid request', async () => {
      const request = await aiCommand.prepareRequest('Test prompt', {
        provider: 'gemini',
        temperature: '0.8',
        maxTokens: '1500'
      });

      expect(request).toMatchObject({
        prompt: 'Test prompt',
        provider: 'gemini',
        options: {
          temperature: 0.8,
          maxTokens: 1500,
          model: 'gemini-pro'
        }
      });
    });

    test('should handle invalid temperature and maxTokens', async () => {
      const request = await aiCommand.prepareRequest('Test prompt', {
        provider: 'gemini',
        temperature: 'invalid',
        maxTokens: 'invalid'
      });

      expect(request.options.temperature).toBe(0.7); // Default
      expect(request.options.maxTokens).toBe(1000); // Default
    });
  });
});