# 🚀 MDSAAD Proxy API Deployment Guide

## 🎯 Overview

This proxy API allows users to use your CLI tool **without needing their own API keys**. All requests go through YOUR backend, giving you:

- **🛡️ Full control** over API usage and costs
- **📊 Analytics** on how users are using your tool
- **💰 Monetization options** (premium tiers, usage limits)
- **🔒 Security** - your API keys stay private on the server

---

## 🏗️ Architecture

```
User CLI Tool → Your Proxy API → External APIs (OpenRouter, WeatherAPI)
     ↑                ↑                    ↑
 No API keys    Your API keys        Your actual accounts
   needed       (server-side)       (billed to you)
```

---

## 🚀 Quick Deployment Options

### **Option 1: Vercel (Recommended - Free)**

1. **Create `package.json` for server:**
```bash
cd server/
npm init -y
npm install express cors express-rate-limit axios
```

2. **Create `vercel.json`:**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api-server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "/api-server.js"
    }
  ],
  "env": {
    "OPENROUTER_API_KEY": "@openrouter_key",
    "GROQ_API_KEY": "@groq_key", 
    "WEATHERAPI_KEY": "@weatherapi_key"
  }
}
```

3. **Deploy:**
```bash
npx vercel --prod
# Set environment variables in Vercel dashboard
```

### **Option 2: Railway (Easy, $5/month)**

1. **Connect GitHub repo**
2. **Set environment variables:**
   - `OPENROUTER_API_KEY=your_key`
   - `WEATHERAPI_KEY=your_key`
3. **Deploy automatically**

### **Option 3: Heroku (Classic)**

1. **Create Heroku app:**
```bash
heroku create mdsaad-proxy-api
```

2. **Set config vars:**
```bash
heroku config:set OPENROUTER_API_KEY=your_key
heroku config:set WEATHERAPI_KEY=your_key
```

3. **Deploy:**
```bash
git push heroku main
```

---

## 🔐 Environment Variables Setup

Set these on your hosting platform:

```bash
# Required for AI features
OPENROUTER_API_KEY=sk-or-v1-your-key-here
GROQ_API_KEY=gsk_your-groq-key-here
DEEPSEEK_API_KEY=sk-your-deepseek-key (optional)

# Required for weather features  
WEATHERAPI_KEY=your-weather-api-key

# Optional
GEMINI_API_KEY=your-gemini-key
PORT=3000
```

---

## 🔧 Update CLI Tool Configuration

Update your CLI tool to use the proxy by default:

### **Option A: Environment Variable (Flexible)**
Users can choose proxy or direct:
```bash
# Use proxy (default)
export MDSAAD_PROXY_API=https://your-proxy-api.vercel.app/v1

# Use direct API keys
export MDSAAD_USE_PROXY=false
```

### **Option B: Hardcode Proxy URL (Simplest)**
In `proxy-api.js`, change:
```javascript
this.baseUrl = 'https://your-actual-proxy-url.vercel.app/v1';
```

---

## 📊 Usage Analytics & Monetization

### **Track Usage:**
```javascript
// In your server, you can track:
- Total requests per user
- API costs per user  
- Most popular features
- Usage patterns
```

### **Monetization Options:**
1. **Freemium Model:**
   - Free: 50 AI requests/day
   - Pro: Unlimited for $5/month

2. **Pay-per-use:**
   - $0.01 per AI request
   - $0.001 per weather request

3. **Enterprise:**
   - Custom rate limits
   - Priority support
   - Advanced analytics

---

## 🛡️ Rate Limiting & Cost Control

### **Current Limits (adjust as needed):**
- AI: 50 requests/hour per user
- Weather: 100 requests/hour per user
- Global: 1000 requests/15min

### **Cost Estimation:**
```
OpenRouter (DeepSeek): ~$0.0001 per request
WeatherAPI: Free tier = 1M requests/month

For 1000 users making 10 requests/day:
- Cost: ~$3-5/month
- Very affordable!
```

---

## 🚀 Go Live Checklist

### **1. Deploy Proxy API**
- [ ] Choose hosting platform
- [ ] Set environment variables
- [ ] Deploy server code
- [ ] Test endpoints

### **2. Update CLI Tool**
- [ ] Set proxy URL in code
- [ ] Test proxy integration
- [ ] Update documentation
- [ ] Publish to npm

### **3. User Experience**
- [ ] Users install CLI: `npm install -g mdsaad-cli`
- [ ] No API key setup needed!
- [ ] Commands work immediately

---

## 🎉 Benefits Summary

### **For You:**
- ✅ Control API costs and usage
- ✅ Collect analytics on feature usage
- ✅ Monetization opportunities
- ✅ Users can't abuse your API keys

### **For Users:**
- ✅ Zero setup - works immediately
- ✅ No need to get API keys
- ✅ Free tier included
- ✅ Still option for own keys as backup

---

## 🔧 Next Steps

1. **Deploy the proxy API** using Vercel (easiest)
2. **Update the CLI tool** to use your proxy URL
3. **Test everything** works end-to-end
4. **Publish to npm** with confidence!

Your users get a seamless experience while you maintain full control! 🎯✨