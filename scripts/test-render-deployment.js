#!/usr/bin/env node
/**
 * Test Render Deployment
 * Tests the deployed proxy API endpoints
 */

const axios = require('axios');

// Replace with your actual Render URL after deployment
const RENDER_URL = process.argv[2] || 'https://mdsaad-proxy-api.onrender.com';

async function testDeployment() {
  console.log('🧪 Testing MDSAAD Proxy API Deployment');
  console.log(`📍 URL: ${RENDER_URL}\n`);

  try {
    // Test 1: Health Check
    console.log('1️⃣ Testing Health Check...');
    const healthResponse = await axios.get(`${RENDER_URL}/health`);
    console.log(`   ✅ Health: ${healthResponse.status} - ${healthResponse.data.status}`);
    console.log(`   📊 Services: AI=${healthResponse.data.services.ai}, Weather=${healthResponse.data.services.weather}\n`);

    // Test 2: AI Endpoint
    console.log('2️⃣ Testing AI Endpoint...');
    const aiResponse = await axios.post(`${RENDER_URL}/v1/ai/chat`, {
      prompt: 'Hello! Just testing the API.',
      max_tokens: 50,
      client_id: 'test-client'
    }, {
      timeout: 30000
    });
    console.log(`   ✅ AI: ${aiResponse.status} - Response received`);
    console.log(`   🤖 Model: ${aiResponse.data.model_used}`);
    console.log(`   💬 Response: "${aiResponse.data.response.substring(0, 100)}..."\n`);

    // Test 3: Weather Endpoint
    console.log('3️⃣ Testing Weather Endpoint...');
    const weatherResponse = await axios.get(`${RENDER_URL}/v1/weather/current`, {
      params: {
        location: 'London',
        client_id: 'test-client'
      },
      timeout: 15000
    });
    console.log(`   ✅ Weather: ${weatherResponse.status} - Data received`);
    console.log(`   🌤️ Location: ${weatherResponse.data.location.name}`);
    console.log(`   🌡️ Temperature: ${weatherResponse.data.current.temp_c}°C\n`);

    console.log('🎉 ALL TESTS PASSED!');
    console.log('✅ Your proxy API is working correctly');
    console.log(`📝 Update your CLI proxy URL to: ${RENDER_URL}/v1\n`);

    // Show CLI update command
    console.log('🔧 To update CLI:');
    console.log(`   export MDSAAD_PROXY_API="${RENDER_URL}/v1"`);
    console.log('   # OR update ~/.mdsaad/config.json with:');
    console.log(`   {"proxyUrl": "${RENDER_URL}/v1"}\n`);

  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Data:`, error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('   🔗 Connection refused - server may still be starting up');
      console.error('   ⏰ Wait a few minutes and try again');
    } else {
      console.error('   Error details:', error);
    }
    
    process.exit(1);
  }
}

// Usage instructions
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: node test-render-deployment.js [URL]');
  console.log('Example: node test-render-deployment.js https://your-app.onrender.com');
  process.exit(0);
}

testDeployment();