# API Management Service Documentation

## Overview

The **API Management Service** provides centralized management of multiple API providers with automatic failover, rate limiting, circuit breaker patterns, and comprehensive monitoring. This service is the backbone for all external API integrations in the mdsaad CLI tool.

## Architecture

### Core Components

1. **API Manager**: Central service managing all API providers
2. **Provider Registry**: Manages provider configurations and metadata
3. **Rate Limiter**: Tracks and enforces request limits per provider
4. **Circuit Breaker**: Prevents cascading failures by temporarily disabling unhealthy providers
5. **Request Router**: Intelligently routes requests to the best available provider
6. **Monitoring System**: Tracks statistics, performance, and health metrics

### Design Patterns

- **Circuit Breaker Pattern**: Prevents system overload during provider failures
- **Retry with Backoff**: Automatic retry logic with exponential backoff
- **Priority-based Routing**: Routes requests to providers based on priority and health
- **Rate Limiting**: Per-provider request rate limiting with configurable windows
- **Health Monitoring**: Continuous health checks and failure tracking

## Features

### 🔄 Automatic Provider Failover

```javascript
// Automatically tries providers in priority order until one succeeds
const result = await apiManager.makeRequest('ai-service', '/chat', {
  method: 'POST',
  data: { message: 'Hello' },
  preferredProvider: 'gemini',
});
```

### ⚡ Circuit Breaker Protection

- **Closed**: Normal operation, requests pass through
- **Open**: Provider temporarily disabled due to failures
- **Half-Open**: Testing if provider has recovered

### 🚦 Rate Limiting

- Per-provider request limits with configurable time windows
- Automatic blocking when limits exceeded
- Sliding window implementation for accurate rate tracking

### 📊 Comprehensive Monitoring

- Request/response tracking with detailed metrics
- Success/failure rates and performance statistics
- Circuit breaker state monitoring
- Rate limit status tracking

## Usage

### Basic Setup

```javascript
const apiManager = require('./services/api-manager');

// Initialize the service
await apiManager.initialize();

// Register a provider
apiManager.registerProvider('gemini', {
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
  apiKey: process.env.GEMINI_API_KEY,
  priority: 5,
  rateLimit: { requests: 60, window: 60000 }, // 60 req/min
  timeout: 30000,
});
```

### Making Requests

```javascript
// Simple request with automatic provider selection
const response = await apiManager.makeRequest('ai-service', '/models', {
  method: 'GET',
});

// Request with preferred provider and custom options
const response = await apiManager.makeRequest('ai-service', '/chat', {
  method: 'POST',
  data: { message: 'Hello, world!' },
  preferredProvider: 'gemini',
  timeout: 15000,
});
```

### Provider Management

```javascript
// Enable/disable providers
apiManager.setProviderEnabled('gemini', false);

// Reset circuit breaker
apiManager.resetCircuitBreaker('gemini');

// Get provider statistics
const stats = apiManager.getStatistics();
```

## CLI Commands

### Status and Monitoring

```bash
# Show overall API status
mdsaad api status

# List all providers with details
mdsaad api providers

# Show detailed statistics
mdsaad api stats

# Show configuration
mdsaad api config
```

### Provider Management

```bash
# Enable a provider
mdsaad api enable --provider gemini

# Disable a provider
mdsaad api disable --provider gemini

# Reset provider circuit breaker
mdsaad api reset --provider gemini

# Test provider connection
mdsaad api test --provider gemini
```

### Configuration

```bash
# Configure API providers
mdsaad config set apiProviders.gemini.baseURL "https://api.gemini.com"
mdsaad config set apiProviders.gemini.apiKey "your-api-key"
mdsaad config set apiProviders.gemini.enabled true
mdsaad config set apiProviders.gemini.priority 5
```

## Configuration Schema

### Provider Configuration

```json
{
  "apiProviders": {
    "gemini": {
      "baseURL": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": "your-api-key",
      "enabled": true,
      "priority": 5,
      "timeout": 30000,
      "retryCount": 3,
      "retryDelay": 1000,
      "rateLimit": {
        "requests": 60,
        "window": 60000
      },
      "healthCheck": "https://generativelanguage.googleapis.com/v1beta/models"
    }
  }
}
```

### Configuration Options

| Option               | Type    | Default  | Description                            |
| -------------------- | ------- | -------- | -------------------------------------- |
| `baseURL`            | string  | required | API base URL                           |
| `apiKey`             | string  | null     | Authentication key                     |
| `enabled`            | boolean | true     | Whether provider is enabled            |
| `priority`           | number  | 1        | Provider priority (higher = preferred) |
| `timeout`            | number  | 30000    | Request timeout in milliseconds        |
| `retryCount`         | number  | 3        | Number of retry attempts               |
| `retryDelay`         | number  | 1000     | Delay between retries in ms            |
| `rateLimit.requests` | number  | 100      | Max requests per window                |
| `rateLimit.window`   | number  | 3600000  | Time window in milliseconds            |
| `healthCheck`        | string  | null     | Health check endpoint URL              |

## Rate Limiting

### Implementation

- **Sliding Window**: Uses sliding window algorithm for accurate rate limiting
- **Per-Provider**: Each provider has independent rate limits
- **Automatic Blocking**: Requests blocked when limits exceeded
- **Configurable Windows**: Support for second, minute, hour-based windows

### Example Rate Limits

```javascript
// Different rate limit configurations
const providers = {
  gemini: { requests: 60, window: 60000 }, // 60 req/minute
  openrouter: { requests: 100, window: 60000 }, // 100 req/minute
  deepseek: { requests: 50, window: 60000 }, // 50 req/minute
};
```

## Circuit Breaker

### States and Transitions

1. **CLOSED** → **OPEN**: After 5 consecutive failures
2. **OPEN** → **HALF_OPEN**: After 60-second timeout
3. **HALF_OPEN** → **CLOSED**: On successful request
4. **HALF_OPEN** → **OPEN**: On failure

### Configuration

```javascript
const circuitBreakerConfig = {
  failureThreshold: 5, // Failures to trigger opening
  timeout: 60000, // Time before attempting recovery
  monitoringPeriod: 10000, // Health check interval
};
```

## Monitoring and Logging

### Statistics Tracked

- **Request Counts**: Total, successful, failed requests per provider
- **Performance Metrics**: Response times, throughput
- **Health Status**: Circuit breaker states, rate limit status
- **Failure Tracking**: Consecutive failures, total failures

### Log Entry Format

```json
{
  "requestId": "req_1234567890_abc123",
  "timestamp": "2025-09-27T12:00:00.000Z",
  "provider": "gemini",
  "endpoint": "/chat/completions",
  "method": "POST",
  "duration": 1250,
  "success": true,
  "status": 200,
  "error": null
}
```

## Error Handling

### Error Types

- **Network Errors**: Connection timeouts, DNS failures
- **HTTP Errors**: 4xx/5xx status codes
- **Rate Limit Errors**: 429 Too Many Requests
- **Circuit Breaker Errors**: Provider temporarily unavailable

### Automatic Recovery

- **Retry Logic**: Exponential backoff for transient failures
- **Circuit Recovery**: Automatic attempt after timeout period
- **Rate Limit Recovery**: Automatic unblocking after window expiry

### Error Response Format

```javascript
{
  error: 'All API providers failed. Last error: Connection timeout',
  provider: 'last-attempted-provider',
  failedProviders: ['provider1', 'provider2'],
  canRetry: true,
  retryAfter: 60000
}
```

## Performance Optimization

### Caching Strategy

- **Request Logging**: Cached for 24 hours for analysis
- **Statistics**: Real-time statistics with efficient in-memory storage
- **Health Checks**: Cached health status to reduce overhead

### Memory Management

- **Sliding Windows**: Automatic cleanup of old rate limit entries
- **Request History**: Limited to last 100 entries per provider
- **Log Rotation**: Automatic cleanup of old log entries

### Asynchronous Operations

- **Non-blocking**: All operations designed to be non-blocking
- **Background Tasks**: Health checks and cleanup run in background
- **Promise-based**: Full Promise support for async operations

## Security Considerations

### API Key Management

- **Environment Variables**: Store API keys in environment variables
- **Configuration Security**: Never log API keys in plain text
- **Key Rotation**: Support for updating API keys without restart

### Request Sanitization

- **Input Validation**: All requests validated before sending
- **Header Sanitization**: Automatic sanitization of request headers
- **URL Validation**: Ensure all URLs are properly formatted

### Rate Limit Protection

- **DDoS Prevention**: Rate limiting prevents abuse
- **Fair Usage**: Ensures fair distribution of API quota
- **Automatic Blocking**: Temporary blocking of abusive patterns

## Testing

### Unit Tests

```bash
# Run API manager tests
npm test -- tests/services/api-manager.test.js
```

### Test Coverage

- **Provider Registration**: Registration and configuration tests
- **Rate Limiting**: Rate limit enforcement and recovery
- **Circuit Breaker**: All state transitions and recovery
- **Request Execution**: Success and failure scenarios
- **Failover Logic**: Multi-provider failover scenarios
- **Statistics**: Metrics accuracy and completeness

### Integration Tests

```javascript
// Example integration test
describe('API Integration', () => {
  test('should handle real API requests', async () => {
    const result = await apiManager.makeRequest('test-service', '/health');
    expect(result.status).toBe(200);
  });
});
```

## Troubleshooting

### Common Issues

1. **All Providers Disabled**

   ```bash
   mdsaad api status
   mdsaad api enable --provider gemini
   ```

2. **Circuit Breaker Stuck Open**

   ```bash
   mdsaad api reset --provider gemini
   ```

3. **Rate Limit Exceeded**

   ```bash
   mdsaad api stats
   # Wait for rate limit window to reset
   ```

4. **Provider Not Responding**
   ```bash
   mdsaad api test --provider gemini
   ```

### Debug Mode

```bash
# Enable debug logging
mdsaad config set debug true
mdsaad api status
```

### Health Checks

```bash
# Manual health check
mdsaad api test --provider gemini

# View provider statistics
mdsaad api stats
```

## Future Enhancements

### Planned Features

- **Load Balancing**: Round-robin and weighted load balancing
- **Geographic Routing**: Route requests based on geographic location
- **Custom Retry Strategies**: Configurable retry patterns per provider
- **Advanced Metrics**: Detailed performance analytics and reporting
- **Provider Discovery**: Automatic discovery of available providers
- **Webhook Support**: Real-time notifications for provider status changes

### API Extensions

- **GraphQL Support**: Native GraphQL provider support
- **Streaming**: Real-time streaming API support
- **Batch Requests**: Batch multiple requests for efficiency
- **Caching Layer**: Intelligent response caching
- **Compression**: Automatic request/response compression

This comprehensive API management service provides a robust foundation for all external API integrations, ensuring reliability, performance, and excellent developer experience.
