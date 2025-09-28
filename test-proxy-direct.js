// Quick test of proxy API from CLI
const axios = require('axios');

async function testProxy() {
  console.log('🧪 Testing Proxy API directly...');
  
  try {
    const response = await axios.post('https://mdsaad-proxy-api.onrender.com/v1/ai/chat', {
      prompt: 'Hello from CLI test!',
      max_tokens: 50,
      client_id: 'test-cli'
    }, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'mdsaad-cli/1.0.0'
      },
      timeout: 30000
    });
    
    console.log('✅ Success:', response.data);
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

testProxy();