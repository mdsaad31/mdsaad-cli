# Cache Management

The mdsaad CLI tool includes a sophisticated caching system that provides offline functionality and improves performance by storing API responses, weather data, exchange rates, and other frequently accessed data locally.

## Architecture

### Cache Structure

```
~/.mdsaad/cache/
├── weather/          # Weather API responses
├── currency/         # Exchange rate data
├── ai/              # AI model responses
└── general/         # General purpose cache
```

### Cache Entry Format

Each cache entry is stored as a JSON file with the following structure:

```json
{
  "key": "generated-cache-key",
  "data": { /* Cached data */ },
  "timestamp": 1640995200000,
  "ttl": 1800000,
  "expiresAt": 1640997000000,
  "namespace": "weather",
  "size": 256
}
```

## Core Features

### 1. Automatic TTL Management
- Time-To-Live (TTL) support for all cache entries
- Automatic expiration based on timestamp
- Configurable TTL per cache operation

### 2. Namespace Organization
- Organized cache storage by service type
- Easy namespace-specific operations
- Isolated data management

### 3. Size Management
- Configurable maximum cache size (default: 100MB)
- Automatic LRU (Least Recently Used) cleanup
- Size monitoring and statistics

### 4. Offline Support
- Graceful degradation when APIs are unavailable
- Serve cached data with age indicators
- Cache middleware for seamless integration

## Usage Examples

### Basic Cache Operations

```javascript
const cache = require('./src/services/cache');

// Initialize cache service
await cache.initialize();

// Store data with 30-minute TTL
await cache.set('weather', 'london-current', weatherData, 30 * 60 * 1000);

// Retrieve data
const cached = await cache.get('weather', 'london-current');
if (cached) {
  console.log('Data:', cached.data);
  console.log('Age:', cached.age, 'ms');
}

// Check if entry exists
if (await cache.has('weather', 'london-current')) {
  console.log('Cache hit!');
}

// Generate consistent keys
const key = cache.generateKey('weather', 'london', 'current', '2023-09-27');
```

### Cache Middleware

The middleware provides seamless caching for API calls:

```javascript
// Create middleware for weather API with 30-minute cache
const weatherMiddleware = cache.middleware('weather', 30 * 60 * 1000);

// Use middleware - automatically handles caching
const weatherData = await weatherMiddleware(
  ['london', 'current'], 
  async () => {
    // This function only runs on cache miss
    return await fetchWeatherFromAPI('london');
  }
);

console.log('Data from cache or API:', weatherData);
console.log('Was cached:', weatherData._cached);
```

### Advanced Operations

```javascript
// Clear specific namespace
await cache.clearNamespace('weather');

// Clear all cache
await cache.clearAll();

// Cleanup expired entries
const removedCount = await cache.cleanup();

// Get comprehensive statistics
const stats = await cache.getStats();
console.log(`Total entries: ${stats.totalEntries}`);
console.log(`Total size: ${stats.totalSize} bytes`);

// Set maximum cache size (50MB)
cache.setMaxSize(50 * 1024 * 1024);
```

## Cache Management CLI

Use the built-in cache manager for maintenance:

```bash
# Show cache statistics
npm run cache stats
npm run cache stats --json

# List cache entries
npm run cache list
npm run cache list weather

# Clear cache
npm run cache clear weather    # Clear weather namespace
npm run cache clear --yes     # Clear all cache (skip confirmation)

# Cleanup expired entries
npm run cache cleanup

# Test cache functionality
npm run cache test

# Set cache size limit (in MB)
npm run cache size 200
```

### Cache Manager Commands

| Command | Description | Example |
|---------|-------------|---------|
| `stats` | Show cache statistics | `npm run cache stats --json` |
| `list` | List cache entries by namespace | `npm run cache list weather` |
| `clear` | Clear cache entries | `npm run cache clear currency` |
| `cleanup` | Remove expired entries | `npm run cache cleanup` |
| `test` | Test cache functionality | `npm run cache test` |
| `size` | Set maximum cache size | `npm run cache size 100` |

## Integration Examples

### Weather Service Integration

```javascript
const cache = require('./services/cache');

class WeatherService {
  async getCurrentWeather(location) {
    const cacheKey = `${location}-current`;
    const middleware = cache.middleware('weather', 30 * 60 * 1000); // 30 min
    
    return await middleware(cacheKey, async () => {
      const response = await fetch(`${API_URL}/current?q=${location}`);
      return await response.json();
    });
  }
}
```

### Currency Service Integration

```javascript
class CurrencyService {
  async convertCurrency(amount, from, to) {
    const cacheKey = `${from}-${to}`;
    const middleware = cache.middleware('currency', 24 * 60 * 60 * 1000); // 24 hours
    
    const rates = await middleware(cacheKey, async () => {
      return await this.fetchExchangeRates(from);
    });
    
    return amount * rates.data.rates[to];
  }
}
```

### AI Service Integration

```javascript
class AIService {
  async getResponse(prompt, model = 'gemini') {
    // Cache AI responses for 1 hour
    const cacheKey = cache.generateKey('ai', model, prompt);
    const middleware = cache.middleware('ai', 60 * 60 * 1000);
    
    return await middleware(cacheKey, async () => {
      return await this.callAIAPI(prompt, model);
    });
  }
}
```

## Configuration

### Cache Settings

Configure cache behavior through the configuration service:

```javascript
// Set cache directory
config.set('cacheDirectory', '/custom/cache/path');

// Configure cache in config.json
{
  "cacheDirectory": "~/.mdsaad/cache",
  "cache": {
    "maxSize": 104857600,     // 100MB
    "defaultTTL": 3600000,    // 1 hour
    "cleanupInterval": 3600000 // 1 hour
  }
}
```

### Environment Variables

```bash
# Override cache directory
export MDSAAD_CACHE_DIR="/custom/cache/path"
```

## Performance Considerations

### Cache Hit Rates

Monitor cache performance:

```javascript
const stats = await cache.getStats();
console.log('Cache efficiency:', {
  totalEntries: stats.totalEntries,
  expiredEntries: stats.expiredEntries,
  hitRate: ((stats.totalEntries - stats.expiredEntries) / stats.totalEntries * 100).toFixed(2) + '%'
});
```

### Optimal TTL Values

Recommended TTL values by service:

- **Weather Data**: 30 minutes (data changes frequently)
- **Exchange Rates**: 24 hours (daily rate updates)
- **AI Responses**: 1 hour (for repeated queries)
- **Static Content**: 7 days (rarely changing data)

### Size Management

```javascript
// Monitor cache size
const stats = await cache.getStats();
if (stats.totalSize > 50 * 1024 * 1024) { // 50MB
  console.warn('Cache size is large, consider cleanup');
  await cache.cleanup();
}
```

## Error Handling

The cache service provides graceful error handling:

```javascript
try {
  const data = await cache.get('weather', 'london');
  if (!data) {
    // Cache miss or expired - fetch fresh data
    const freshData = await fetchFromAPI();
    await cache.set('weather', 'london', freshData);
    return freshData;
  }
  return data.data;
} catch (error) {
  console.error('Cache error:', error.message);
  // Fallback to direct API call
  return await fetchFromAPI();
}
```

## Troubleshooting

### Common Issues

1. **Cache Directory Permissions**
   ```bash
   # Fix permissions (Unix/macOS)
   chmod 755 ~/.mdsaad/cache
   ```

2. **Cache Size Issues**
   ```bash
   # Check cache size
   npm run cache stats
   
   # Clean up expired entries
   npm run cache cleanup
   
   # Clear all cache if necessary
   npm run cache clear --yes
   ```

3. **Corrupted Cache Files**
   ```bash
   # The cleanup process automatically removes corrupted files
   npm run cache cleanup
   ```

### Debugging

Enable verbose logging to debug cache operations:

```bash
# Run with verbose output
mdsaad weather London --verbose
```

### Cache Validation

Test cache functionality:

```bash
# Run comprehensive cache tests
npm run cache test
```

## Best Practices

1. **Choose Appropriate TTL**: Balance freshness with performance
2. **Monitor Cache Size**: Set reasonable limits and monitor usage
3. **Handle Cache Misses**: Always have fallback logic for cache misses
4. **Regular Cleanup**: Use automatic cleanup or periodic manual cleanup
5. **Namespace Organization**: Keep related data in appropriate namespaces
6. **Error Resilience**: Don't let cache failures break the application

The cache system is designed to be transparent and resilient, providing performance benefits without compromising functionality when caching is unavailable.