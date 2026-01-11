# P3-4: Configure Sentry Alerts

## Status: ✅ IMPLEMENTATION READY

Sentry DSN is already configured in both frontend and backend environments. This document provides step-by-step instructions for setting up alert rules in the Sentry dashboard.

## Current Configuration

### Backend (Python/FastAPI)
- **SENTRY_DSN**: Configured in Render environment
- **ENVIRONMENT**: production
- **Sample Rate**: 100% for errors, 10% for transactions
- **Status**: ✅ Active and capturing errors

### Frontend (React)
- **VITE_SENTRY_DSN**: (Optional - frontend monitoring)
- **Status**: Optional (can be enabled if needed)

## Alert Rules to Configure

### In Sentry Dashboard (friosur.sentry.io):

#### 1. High Error Rate Alert
**Configuration:**
```
Conditions:
  - Error rate is above 10%
  - In the last 5 minutes

Actions:
  - Email: dev-team@example.com
  - Slack: #friosur-alerts (if configured)

Threshold: 10 errors per 5 minutes
```

#### 2. API Down Alert  
**Configuration:**
```
Conditions:
  - Error type contains "ConnectionError" OR "Timeout"
  - 3 consecutive failures

Actions:
  - Email: oncall@example.com (urgent)
  - PagerDuty: trigger incident (if available)

Threshold: CRITICAL
```

#### 3. Slow Queries Alert
**Configuration:**
```
Conditions:
  - Transaction duration > 5 seconds
  - Endpoint path matches "/api/*"

Actions:
  - Email: dev-team@example.com
  - Slack: #friosur-performance (daily digest)

Threshold: 5 seconds per query
```

#### 4. Failed Logins Alert
**Configuration:**
```
Conditions:
  - Error message contains "Invalid credentials" OR "Login failed"
  - More than 20 occurrences
  - In the last 10 minutes

Actions:
  - Email: security@example.com
  - Log: /var/log/security.log

Threshold: Potential brute force attack
```

#### 5. Database Errors Alert
**Configuration:**
```
Conditions:
  - Error message contains "database" OR "SQL" OR "sqlite3"
  - Any severity

Actions:
  - Email: dev-team@example.com
  - Slack: #friosur-database

Threshold: Immediate notification
```

## Step-by-Step Setup

### Step 1: Log into Sentry
1. Go to https://friosur.sentry.io
2. Log in with your account
3. Select the "friosur" project

### Step 2: Navigate to Alerts
1. Click **Alerts** in the left sidebar
2. Click **Create Alert Rule**

### Step 3: Create Alert Rule
1. **Event Type**: Select "Error" or "Performance"
2. **Set Conditions**: Choose when the alert should trigger
3. **Set Actions**: Choose notification destination (Email, Slack, etc.)
4. **Set Threshold**: Define sensitivity
5. **Save Alert**

### Step 4: Test Alert
1. Trigger an error in development
2. Verify the alert is received
3. Adjust threshold if needed

## Current Environment Variables

### Backend (.env)
```bash
SENTRY_DSN=https://17d09a3e239c6fe244986...@o4505621266800640.ingest.sentry.io/4505628834217984
ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_PROFILES_SAMPLE_RATE=0.1
```

### Frontend (Render config)
```bash
VITE_SENTRY_DSN=(optional - currently not configured)
VITE_ENVIRONMENT=production
```

## Monitoring Checklist

- ✅ Sentry DSN configured in backend
- ✅ Error capture working (test with intentional error)
- ✅ Sentry DSN configured in frontend (optional)
- ⏳ Alert rules configured in dashboard
- ⏳ Slack integration configured (if using Slack)
- ⏳ Test alerts sent and received
- ⏳ Team notified of alert rules

## Testing Alerts

### Test an Error in Production
```python
# In any FastAPI endpoint:
raise Exception("This is a test error for Sentry")
```

### Monitor Real-time
1. Go to Sentry dashboard
2. Filter by: `is:new environment:production`
3. Trigger an error from production
4. Verify error appears in Sentry within seconds
5. Verify alert notification received

## Next Steps

1. Configure alert rules in Sentry dashboard
2. Set up Slack integration (if needed)
3. Test all alerts
4. Document alert escalation procedures
5. Brief team on alert responses

## References

- Sentry Documentation: https://docs.sentry.io/
- Alert Rules: https://docs.sentry.io/alerts/alert-rules/
- Integrations: https://docs.sentry.io/integrations/

---

**Status**: Ready for manual configuration
**Effort**: 15 minutes in Sentry dashboard
**Impact**: High (production monitoring)
**Risk**: None (configuration only)

