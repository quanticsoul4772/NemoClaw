# Product Analytics for NemoClaw

This document explains how to instrument product analytics in NemoClaw to measure feature usage and understand user behavior.

## Why Product Analytics?

**For teams building on NemoClaw:**
- **Feature adoption**: See which commands and features users actually use
- **Impact measurement**: Understand if your changes improve user workflows
- **Data-driven decisions**: Prioritize development based on actual usage patterns
- **User understanding**: Learn how developers use NemoClaw in practice

**For autonomous agents:**
- Measure if new features are adopted by users
- Validate that changes improve actual workflows
- Understand which features to optimize or deprecate

---

## Recommended Platform: PostHog

[PostHog](https://posthog.com/) is recommended for NemoClaw because:
- **Open source**: Can be self-hosted for privacy
- **Developer-friendly**: Built for product-led growth and developer tools
- **Privacy-focused**: GDPR compliant with data residency options
- **Feature-rich**: Event tracking, feature flags, session recording, A/B testing
- **CLI-friendly**: Good APIs for tracking command-line tool usage

**Alternatives:**
- **Mixpanel**: Excellent analytics but cloud-only
- **Amplitude**: Great for mobile/web but less CLI-friendly
- **Heap**: Auto-capture everything but expensive
- **Google Analytics 4**: Free but less developer-focused

---

## Setup Instructions

### 1. Create PostHog Project

**Cloud (Recommended for most teams):**
1. Sign up at https://app.posthog.com/signup
2. Create a new project: "NemoClaw Production"
3. Copy your Project API Key from Settings → Project → API Keys
4. Note your PostHog Host: `https://app.posthog.com` (US) or `https://eu.posthog.com` (EU)

**Self-Hosted (For privacy-sensitive organizations):**
1. Deploy PostHog: https://posthog.com/docs/self-host
2. Create a project in your instance
3. Use your instance URL as POSTHOG_HOST

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# PostHog Configuration
POSTHOG_API_KEY=phc_your_api_key_here
POSTHOG_HOST=https://app.posthog.com  # or your self-hosted URL

# Optional: Disable telemetry
# NEMOCLAW_TELEMETRY=0
```

### 3. Install PostHog Library (Optional)

For teams wanting to implement analytics:

```bash
npm install --save posthog-node
```

---

## What to Track

### Recommended Events

**1. Command Execution**
```javascript
// Event: command_executed
{
  command: "onboard",
  args: ["--profile", "vllm"],
  duration_ms: 5234,
  status: "success",
  user_id: "anonymous_user_123"
}
```

**2. Feature Usage**
```javascript
// Event: feature_used
{
  feature: "local_inference",
  enabled_via: "feature_flag",
  user_id: "anonymous_user_123"
}
```

**3. Sandbox Operations**
```javascript
// Event: sandbox_operation
{
  operation: "create",
  sandbox_name: "my-sandbox",
  model: "nvidia/nemotron-3-super-120b-a12b",
  gpu_enabled: true,
  duration_ms: 8432,
  user_id: "anonymous_user_123"
}
```

**4. Inference Requests**
```javascript
// Event: inference_request
{
  model: "nvidia/nemotron-3-super-120b-a12b",
  tokens: 150,
  latency_ms: 420,
  cached: false,
  user_id: "anonymous_user_123"
}
```

**5. Errors**
```javascript
// Event: error_occurred
{
  error_type: "ConnectionError",
  operation: "sandbox_create",
  fatal: false,
  user_id: "anonymous_user_123"
}
```

### User Identification

**Anonymous by default:**
```javascript
// Use hashed username or machine ID
const userId = crypto.createHash('sha256')
  .update(os.userInfo().username + os.hostname())
  .digest('hex')
  .slice(0, 16);
```

**Optional user properties:**
```javascript
{
  os: "linux",
  node_version: "v20.11.0",
  nemoclaw_version: "0.2.0",
  install_method: "npm",  // or "curl", "git"
  first_seen: "2026-03-22",
  timezone: "America/Los_Angeles"
}
```

---

## Implementation Guide

### PostHog Integration Module

Create `bin/lib/analytics.js`:

```javascript
const { PostHog } = require('posthog-node');
const os = require('os');
const crypto = require('crypto');

let posthog = null;
let enabled = false;
let userId = null;

/**
 * Initialize PostHog analytics
 * Only enabled if POSTHOG_API_KEY is set and NEMOCLAW_TELEMETRY !== "0"
 */
function initAnalytics() {
  const apiKey = process.env.POSTHOG_API_KEY;
  const telemetryDisabled = process.env.NEMOCLAW_TELEMETRY === "0";

  if (!apiKey || telemetryDisabled) {
    return; // Analytics disabled
  }

  enabled = true;

  posthog = new PostHog(apiKey, {
    host: process.env.POSTHOG_HOST || 'https://app.posthog.com',
    flushAt: 10,  // Send events in batches of 10
    flushInterval: 5000,  // Or every 5 seconds
  });

  // Generate anonymous user ID
  userId = crypto.createHash('sha256')
    .update(os.userInfo().username + os.hostname())
    .digest('hex')
    .slice(0, 16);

  // Identify user with properties
  posthog.identify({
    distinctId: userId,
    properties: {
      os: os.platform(),
      os_version: os.release(),
      node_version: process.version,
      nemoclaw_version: require('../../package.json').version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });
}

/**
 * Track an event
 * @param {string} event - Event name
 * @param {Object} properties - Event properties
 */
function trackEvent(event, properties = {}) {
  if (!enabled || !posthog) return;

  posthog.capture({
    distinctId: userId,
    event,
    properties,
  });
}

/**
 * Track command execution
 */
function trackCommand(command, duration, status, args = {}) {
  trackEvent('command_executed', {
    command,
    duration_ms: duration,
    status,
    ...args,
  });
}

/**
 * Track feature usage
 */
function trackFeature(feature, context = {}) {
  trackEvent('feature_used', {
    feature,
    ...context,
  });
}

/**
 * Flush events before exit
 */
async function flushAnalytics() {
  if (!enabled || !posthog) return;

  await posthog.shutdown();
}

module.exports = {
  initAnalytics,
  trackEvent,
  trackCommand,
  trackFeature,
  flushAnalytics,
  isEnabled: () => enabled,
};
```

### Integration with NemoClaw

**In `bin/nemoclaw.js`:**

```javascript
const { initAnalytics, trackCommand, flushAnalytics } = require('./lib/analytics');

// Initialize analytics at startup
initAnalytics();

// Track command execution
const startTime = Date.now();
try {
  await runCommand(cmd, args);
  const duration = Date.now() - startTime;
  trackCommand(cmd, duration, 'success', { args });
} catch (error) {
  const duration = Date.now() - startTime;
  trackCommand(cmd, duration, 'error', { error: error.message });
  throw error;
}

// Flush before exit
process.on('beforeExit', async () => {
  await flushAnalytics();
});
```

---

## Privacy Considerations

### User Consent

**Opt-out by default (recommended):**
```bash
# Disable telemetry
export NEMOCLAW_TELEMETRY=0
```

**First-run notification:**
```
NemoClaw collects anonymous usage data to improve the product.
This helps us understand which features are used and prioritize development.

Data collected: command usage, feature adoption, error rates
Data NOT collected: code, API keys, sandbox names, personal data

Disable: export NEMOCLAW_TELEMETRY=0
Learn more: https://docs.example.com/privacy
```

### What NOT to Track

**Never track:**
- API keys or credentials
- User code or prompts
- Sandbox names (unless anonymized)
- File paths or directory structures
- Personal identifiable information (PII)
- IP addresses (PostHog can anonymize automatically)

### GDPR Compliance

**PostHog features for compliance:**
- Data residency (EU hosting available)
- Data retention policies (auto-delete after X days)
- User deletion (delete all data for a user)
- Cookie-less tracking (for web interfaces)
- GDPR-compliant by design

**Configuration:**
```javascript
// Enable GDPR-compliant settings
posthog.identify({
  distinctId: userId,
  properties: {
    // Only non-PII properties
    $geoip_disable: true,  // Disable IP geolocation
  },
});
```

---

## Analytics Dashboards

### Recommended Dashboards

**1. Command Usage Dashboard**
- Most popular commands (bar chart)
- Command usage over time (trend)
- Success vs error rate (%)
- Average command duration (ms)

**2. Feature Adoption Dashboard**
- Feature flag adoption (%)
- New feature usage by cohort
- Feature retention (D1, D7, D30)
- Deprecated feature usage (track for removal)

**3. User Journey Dashboard**
- First command executed (funnel)
- Onboarding completion rate
- Commands per session
- User retention (weekly/monthly active)

**4. Performance Dashboard**
- Command duration by percentile (p50, p95, p99)
- Inference latency trends
- Error rate by command
- Sandbox creation success rate

### Example PostHog Insights

**Query: Most used commands**
```sql
SELECT
  properties.command AS command,
  COUNT(*) AS count
FROM events
WHERE event = 'command_executed'
  AND timestamp >= NOW() - INTERVAL 30 DAY
GROUP BY command
ORDER BY count DESC
LIMIT 10
```

**Query: Feature adoption rate**
```sql
SELECT
  properties.feature AS feature,
  COUNT(DISTINCT person_id) AS unique_users,
  COUNT(*) AS total_uses
FROM events
WHERE event = 'feature_used'
  AND timestamp >= NOW() - INTERVAL 7 DAY
GROUP BY feature
ORDER BY unique_users DESC
```

---

## Measuring Feature Impact

### Before/After Analysis

**Example: Measuring impact of new "fast-onboard" command**

1. **Track feature flag activation:**
```javascript
trackFeature('fast_onboard', { enabled: true });
```

2. **Track onboarding duration:**
```javascript
trackCommand('onboard', duration, 'success', { method: 'fast' });
trackCommand('onboard', duration, 'success', { method: 'standard' });
```

3. **Analyze in PostHog:**
- Average onboarding time: standard vs fast
- Adoption rate: % users using fast-onboard
- Success rate: errors with new vs old method
- Retention: do fast-onboard users return more?

### A/B Testing with PostHog

**Enable A/B test:**
```javascript
const variant = posthog.getFeatureFlag('fast-onboard-test', userId);

if (variant === 'treatment') {
  // Use new fast onboarding
  trackFeature('fast_onboard', { variant: 'treatment' });
} else {
  // Use standard onboarding
  trackFeature('standard_onboard', { variant: 'control' });
}
```

**Measure results:**
- Conversion rate (completed onboarding)
- Time to completion
- Error rate
- User satisfaction (follow-up survey)

---

## Integration with Existing Observability

### Correlation with Metrics

**Link analytics events to metrics:**
```javascript
// Record both analytics event and metric
trackCommand('onboard', duration, 'success');
recordCommandExecution('onboard', duration, { status: 'success' });
```

**Benefits:**
- Analytics: Who uses the feature (user-level)
- Metrics: How the feature performs (system-level)
- Together: Full picture of feature health

### Correlation with Error Tracking

**Link analytics to Sentry:**
```javascript
// Set user context in Sentry
Sentry.setUser({ id: userId });

// Track in both systems
trackEvent('error_occurred', { error_type: error.name });
captureException(error);
```

---

## For Autonomous Agents

**When adding a new feature:**

1. **Add analytics tracking:**
```javascript
trackFeature('new_feature_name', {
  enabled_via: 'feature_flag',
  version: '0.3.0',
});
```

2. **Monitor adoption:**
- Check PostHog dashboard after 7 days
- Is feature being used? (>10% of users)
- Are users encountering errors? (<5% error rate)

3. **Make data-driven decisions:**
- High adoption + low errors = good feature, keep it
- Low adoption + high errors = need improvement or deprecate
- High adoption + high errors = fix urgently

**Example query for agents:**
```bash
# Get feature adoption rate from PostHog API
curl https://app.posthog.com/api/projects/$PROJECT_ID/insights/trend \
  -H "Authorization: Bearer $POSTHOG_API_KEY" \
  -d '{
    "events": [{"id": "feature_used", "properties": [{"key": "feature", "value": "new_feature_name"}]}],
    "date_from": "-7d"
  }'
```

---

## References

- [PostHog Documentation](https://posthog.com/docs)
- [PostHog Node.js SDK](https://posthog.com/docs/libraries/node)
- [Product Analytics Best Practices](https://posthog.com/blog/product-analytics-best-practices)
- [Privacy-First Analytics](https://posthog.com/blog/privacy-friendly-analytics)
- [GDPR Compliance](https://posthog.com/docs/privacy/gdpr-compliance)

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
