/**
 * Ollama Service
 * Offline AI model management and processing
 */

const axios = require('axios');
const chalk = require('chalk');
const configService = require('./config');
const loggerService = require('./logger');

class OllamaService {
  constructor() {
    this.baseUrl = configService.get('ollama.url', 'http://localhost:11434');
    this.initialized = false;
    this.availableModels = [];
  }

  /**
   * Initialize Ollama service
   */
  async initialize() {
    try {
      await this.checkConnection();
      await this.loadModels();
      this.initialized = true;
      loggerService.info('Ollama service initialized successfully');
    } catch (error) {
      loggerService.warn('Ollama service unavailable:', error.message);
      // Don't throw error - Ollama is optional
    }
  }

  /**
   * Check if Ollama is running and accessible
   */
  async checkConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/version`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      throw new Error(`Ollama not accessible at ${this.baseUrl}: ${error.message}`);
    }
  }

  /**
   * Load available models
   */
  async loadModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      this.availableModels = response.data.models || [];
      loggerService.info(`Loaded ${this.availableModels.length} Ollama models`);
    } catch (error) {
      loggerService.warn('Failed to load Ollama models:', error.message);
      this.availableModels = [];
    }
  }

  /**
   * Check if Ollama is available
   */
  isAvailable() {
    return this.initialized;
  }

  /**
   * Get available models
   */
  getModels() {
    return this.availableModels.map(model => ({
      name: model.name,
      size: this.formatBytes(model.size),
      modified: new Date(model.modified_at).toLocaleDateString()
    }));
  }

  /**
   * Generate response using Ollama
   */
  async generate(prompt, options = {}) {
    if (!this.initialized) {
      throw new Error('Ollama service not available');
    }

    const model = options.model || this.getDefaultModel();
    if (!this.hasModel(model)) {
      throw new Error(`Model ${model} not available. Available models: ${this.availableModels.map(m => m.name).join(', ')}`);
    }

    try {
      const requestData = {
        model,
        prompt,
        stream: options.stream || false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 1000,
          top_p: options.topP || 0.9
        }
      };

      if (options.system) {
        requestData.system = options.system;
      }

      const response = await axios.post(`${this.baseUrl}/api/generate`, requestData, {
        timeout: 60000
      });

      return {
        content: response.data.response,
        model: model,
        done: response.data.done,
        totalDuration: response.data.total_duration,
        loadDuration: response.data.load_duration,
        promptEvalCount: response.data.prompt_eval_count,
        evalCount: response.data.eval_count
      };

    } catch (error) {
      throw new Error(`Ollama generation failed: ${error.message}`);
    }
  }

  /**
   * Chat with context using Ollama
   */
  async chat(messages, options = {}) {
    if (!this.initialized) {
      throw new Error('Ollama service not available');
    }

    const model = options.model || this.getDefaultModel();
    if (!this.hasModel(model)) {
      throw new Error(`Model ${model} not available`);
    }

    try {
      const requestData = {
        model,
        messages,
        stream: options.stream || false,
        options: {
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 1000
        }
      };

      const response = await axios.post(`${this.baseUrl}/api/chat`, requestData, {
        timeout: 60000
      });

      return {
        content: response.data.message.content,
        role: response.data.message.role,
        model: model,
        done: response.data.done,
        totalDuration: response.data.total_duration,
        loadDuration: response.data.load_duration,
        promptEvalCount: response.data.prompt_eval_count,
        evalCount: response.data.eval_count
      };

    } catch (error) {
      throw new Error(`Ollama chat failed: ${error.message}`);
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName) {
    if (!this.initialized) {
      throw new Error('Ollama service not available');
    }

    try {
      console.log(chalk.yellow(`📥 Pulling model ${modelName}...`));
      
      const response = await axios.post(`${this.baseUrl}/api/pull`, {
        name: modelName
      }, {
        timeout: 300000 // 5 minutes for model download
      });

      await this.loadModels(); // Refresh model list
      
      console.log(chalk.green(`✅ Model ${modelName} pulled successfully`));
      return true;

    } catch (error) {
      throw new Error(`Failed to pull model ${modelName}: ${error.message}`);
    }
  }

  /**
   * Remove a model
   */
  async removeModel(modelName) {
    if (!this.initialized) {
      throw new Error('Ollama service not available');
    }

    try {
      await axios.delete(`${this.baseUrl}/api/delete`, {
        data: { name: modelName }
      });

      await this.loadModels(); // Refresh model list
      
      console.log(chalk.green(`🗑️ Model ${modelName} removed successfully`));
      return true;

    } catch (error) {
      throw new Error(`Failed to remove model ${modelName}: ${error.message}`);
    }
  }

  /**
   * Check if model exists locally
   */
  hasModel(modelName) {
    return this.availableModels.some(model => model.name === modelName);
  }

  /**
   * Get default model
   */
  getDefaultModel() {
    if (this.availableModels.length === 0) {
      return null;
    }

    // Prefer llama2 or llama3 models
    const preferred = this.availableModels.find(model => 
      model.name.includes('llama2') || model.name.includes('llama3')
    );

    return preferred ? preferred.name : this.availableModels[0].name;
  }

  /**
   * Get model info
   */
  async getModelInfo(modelName) {
    if (!this.initialized) {
      throw new Error('Ollama service not available');
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/show`, {
        name: modelName
      });

      return {
        name: response.data.name,
        size: this.formatBytes(response.data.size),
        digest: response.data.digest,
        family: response.data.details?.family,
        families: response.data.details?.families,
        format: response.data.details?.format,
        parameterSize: response.data.details?.parameter_size,
        quantizationLevel: response.data.details?.quantization_level
      };

    } catch (error) {
      throw new Error(`Failed to get model info: ${error.message}`);
    }
  }

  /**
   * List popular models for installation
   */
  getPopularModels() {
    return [
      {
        name: 'llama3.2',
        size: '2.0GB',
        description: 'Latest Llama 3.2 model, good for general purpose'
      },
      {
        name: 'llama3.2:1b',
        size: '1.3GB', 
        description: 'Smaller, faster Llama 3.2 model'
      },
      {
        name: 'phi3',
        size: '2.3GB',
        description: 'Microsoft Phi-3 model, efficient and capable'
      },
      {
        name: 'mistral',
        size: '4.1GB',
        description: 'Mistral 7B model, good balance of size and performance'
      },
      {
        name: 'codellama',
        size: '3.8GB',
        description: 'Code Llama, specialized for programming tasks'
      },
      {
        name: 'gemma2:2b',
        size: '1.6GB',
        description: 'Google Gemma 2B, lightweight and fast'
      }
    ];
  }

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get service status
   */
  async getStatus() {
    try {
      const isConnected = await this.checkConnection();
      return {
        available: isConnected,
        url: this.baseUrl,
        models: this.availableModels.length,
        initialized: this.initialized
      };
    } catch (error) {
      return {
        available: false,
        url: this.baseUrl,
        models: 0,
        initialized: false,
        error: error.message
      };
    }
  }
}

module.exports = new OllamaService();