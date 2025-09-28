# MDSAAD Proxy API - Keep Alive Cron Jobs

## 1. UptimeRobot (Recommended - Free)

**Setup:**
1. Go to: https://uptimerobot.com/
2. Create free account
3. Add new monitor:
   - Type: HTTP(s)
   - URL: https://your-render-app-url.onrender.com/health
   - Interval: 5 minutes
   - Alert contacts: Your email

**Benefits:**
- ✅ Free forever (50 monitors)
- ✅ Email alerts if server is down
- ✅ Prevents cold starts
- ✅ Uptime statistics

## 2. Cron-job.org (Alternative)

**Setup:**
1. Go to: https://cron-job.org/
2. Create account
3. Add cron job:
   - URL: https://your-render-app-url.onrender.com/health
   - Schedule: */5 * * * * (every 5 minutes)
   - HTTP Method: GET

## 3. GitHub Actions (Free with repo)

Create `.github/workflows/keepalive.yml`:

```yaml
name: Keep API Alive
on:
  schedule:
    - cron: '*/5 * * * *'  # Every 5 minutes
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping API
        run: |
          curl -f https://your-render-app-url.onrender.com/health || exit 1
```

## 4. Internal Keep-Alive (Already Added)

The server now has built-in keep-alive that pings itself every 14 minutes.

## Recommendation

Use **UptimeRobot** - it's free, reliable, and gives you monitoring benefits too!