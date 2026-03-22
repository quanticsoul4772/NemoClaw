# Error to Insight Pipeline

This document explains how to set up the error-to-insight pipeline that automatically converts production errors into actionable GitHub issues.

## Overview

The error-to-insight pipeline creates a feedback loop from production errors to development work:

**Flow:**
```
Production Error → Sentry → GitHub Issue → Developer Action → Fix → Deploy
```

**Benefits:**
- **Automatic issue creation**: No manual copying of error details
- **Rich context**: Full stack traces, breadcrumbs, and user context in GitHub
- **Deduplication**: Sentry groups similar errors, creates one issue
- **Prioritization**: Error frequency and user impact visible in issue
- **Workflow integration**: Issues appear in your normal development workflow

---

## Setup: Sentry-GitHub Integration

### 1. Install Sentry GitHub Integration

**In Sentry:**
1. Go to https://sentry.io/settings/[org]/integrations/
2. Find "GitHub" and click "Install"
3. Authorize Sentry to access your GitHub organization
4. Select repositories to integrate (select `NVIDIA/NemoClaw`)

**Permissions required:**
- Read access to code and metadata
- Read and write access to issues
- Read access to members (for assigning issues)

### 2. Configure Issue Creation Rules

**In Sentry Project Settings:**
1. Go to https://sentry.io/settings/[org]/projects/nemoclaw/
2. Click "Integrations" → "GitHub"
3. Click "Configure" next to your repository

**Issue Linking Configuration:**
```yaml
Repository: NVIDIA/NemoClaw
Issue Creation: Automatic
```

**Alert Rules for Issue Creation:**
1. Go to "Alerts" → "Create Alert Rule"
2. Configure:
   - **Trigger**: "First seen" (create issue for new errors)
   - **Action**: "Create a GitHub issue"
   - **Repository**: NVIDIA/NemoClaw
   - **Issue Title**: `[Sentry] {{ error.type }}: {{ error.message }}`
   - **Assignees**: Auto-assign based on code owners (optional)
   - **Labels**: `bug`, `sentry`, `production`

### 3. Configure Environment Variables

Add to `.env` file:

```bash
# Sentry-GitHub Integration
SENTRY_ORG=your-organization-slug
SENTRY_PROJECT=nemoclaw
```

These are used for API integrations and linking errors to code.

---

## Automatic Issue Creation

### Default Behavior

**Sentry creates GitHub issues for:**
- **New error types** (first seen)
- **Regression errors** (errors that were marked resolved but reappeared)
- **High-volume errors** (configurable threshold, e.g., >100 events/hour)

**Issue includes:**
- Error title and message
- Stack trace with source file links
- First and last seen timestamps
- Number of users affected
- Event frequency chart
- Breadcrumbs (actions leading to error)
- User context (anonymous ID, OS, browser)
- Link to full error in Sentry

### Example GitHub Issue

**Title:**
```
[Sentry] ConnectionError: Failed to connect to inference API
```

**Body:**
```markdown
## Error Details

**Type:** ConnectionError  
**First Seen:** 2026-03-22 12:34:56 UTC  
**Last Seen:** 2026-03-22 14:22:10 UTC  
**Events:** 42  
**Users Affected:** 12  

## Stack Trace

```
File "bin/lib/nim.js", line 128, in connectToInference
    await fetch(inferenceUrl);
ConnectionError: Failed to connect to inference API
```

## Breadcrumbs

1. CLI command executed: `nemoclaw onboard`
2. Sandbox created: `my-sandbox`
3. Connecting to inference API
4. **Error:** Connection timeout after 30s

## Environment

- **Release:** nemoclaw@v0.2.3
- **Platform:** linux
- **Node Version:** v20.11.0

## Sentry Link

[View full error in Sentry →](https://sentry.io/organizations/[org]/issues/123456/)

---
**Labels:** `bug`, `sentry`, `production`  
**Created by:** Sentry Error Tracking
```

---

## Alert Rules Configuration

### Recommended Alert Rules

**1. New Errors (Create Issue)**
```yaml
name: New Production Errors
trigger: First seen in environment:production
filter: All events
action: Create GitHub issue
  repository: NVIDIA/NemoClaw
  title: "[Sentry] {{ error.type }}: {{ error.message }}"
  labels: ["bug", "sentry", "new-error"]
  assignees: Auto (based on CODEOWNERS)
```

**2. High-Volume Errors (Create Issue)**
```yaml
name: High Volume Errors
trigger: Number of events > 100 in 1 hour
filter: environment:production
action: Create GitHub issue
  repository: NVIDIA/NemoClaw
  title: "[Sentry] High Volume: {{ error.type }}"
  labels: ["bug", "sentry", "high-volume", "urgent"]
  priority: high
```

**3. Regression Errors (Create Issue)**
```yaml
name: Error Regressions
trigger: Issue state changes from resolved to unresolved
filter: environment:production
action: Create GitHub issue
  repository: NVIDIA/NemoClaw
  title: "[Sentry] Regression: {{ error.type }}"
  labels: ["bug", "sentry", "regression"]
```

**4. User Impact Errors (Notify + Issue)**
```yaml
name: High User Impact
trigger: > 50 users affected in 1 hour
filter: environment:production
action:
  - Create GitHub issue
  - Send Slack notification to #nemoclaw-critical
  - Page on-call via PagerDuty
```

### Configure via Sentry UI

**Steps:**
1. Go to https://sentry.io/organizations/[org]/alerts/rules/
2. Click "Create Alert Rule"
3. Select trigger condition (First seen, High volume, etc.)
4. Add action: "Create a GitHub issue"
5. Configure issue template
6. Save rule

### Configure via Sentry API

**Create alert rule via API:**
```bash
curl -X POST \
  https://sentry.io/api/0/projects/[org]/[project]/rules/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "New Production Errors",
    "environment": "production",
    "actionMatch": "all",
    "frequency": 30,
    "conditions": [
      {
        "id": "sentry.rules.conditions.first_seen_event.FirstSeenEventCondition"
      }
    ],
    "actions": [
      {
        "id": "sentry.integrations.github.actions.GitHubCreateIssueAction",
        "repo": "NVIDIA/NemoClaw",
        "title": "[Sentry] {{ error.type }}: {{ error.message }}",
        "labels": ["bug", "sentry", "production"]
      }
    ]
  }'
```

---

## Issue Management Workflow

### Issue Lifecycle

**1. Error Occurs → Issue Created**
- Sentry detects new error type
- GitHub issue created automatically
- Issue linked to Sentry error group

**2. Developer Triages**
- Review issue in GitHub
- Click Sentry link for full details
- Assign to team member
- Add priority label

**3. Developer Fixes**
- Create branch: `fix/sentry-123-connection-error`
- Fix the bug
- Commit with issue reference: `Fixes #456`
- Open PR

**4. PR Merged → Issue Closed**
- PR merged to main
- Issue auto-closed with "Fixes #456" reference
- Deploy to production

**5. Sentry Verifies**
- New release deployed
- Sentry marks error as "Resolved in next release"
- If error recurs → Issue reopened (regression)

### Issue Templates

**Custom template for Sentry issues:**

Create `.github/ISSUE_TEMPLATE/sentry-error.md`:

```markdown
---
name: Sentry Error Report
about: Automatically created by Sentry for production errors
labels: bug, sentry, production
assignees: ''
---

**This issue was automatically created by Sentry**

## Error Summary
<!-- Sentry will fill this in -->

## Reproduction
<!-- Add steps to reproduce if known -->

## Fix Checklist
- [ ] Root cause identified
- [ ] Fix implemented
- [ ] Tests added to prevent regression
- [ ] Deployed to production
- [ ] Verified error resolved in Sentry
```

### Automatic Issue Closure

**Link commits to issues:**
```bash
# In commit message
git commit -m "Fix inference connection timeout

Fixes #456 (Sentry issue)

- Increase connection timeout to 60s
- Add retry logic with exponential backoff
- Add better error messaging"
```

**Sentry will:**
- Detect the commit referencing the issue
- Mark error as "Resolved in next release"
- Add comment to GitHub issue with release info

---

## PagerDuty/OpsGenie Integration

### Escalate Critical Errors

**Sentry → PagerDuty:**
1. Install PagerDuty integration in Sentry
2. Configure alert rule:
```yaml
trigger: > 100 errors in 5 minutes
action:
  - Create PagerDuty incident
  - Create GitHub issue
  - Send Slack notification
```

**Sentry → OpsGenie:**
1. Install OpsGenie integration in Sentry
2. Configure priority mapping:
   - P1: > 100 users affected
   - P2: > 50 errors/hour
   - P3: New error types

**Flow:**
```
Critical Error → Sentry → PagerDuty Page → GitHub Issue
```

---

## Error Grouping and Deduplication

### How Sentry Groups Errors

Sentry groups similar errors by:
- Error type (e.g., `ConnectionError`)
- Error message
- Stack trace similarity

**Benefits:**
- One GitHub issue per error group (not one per occurrence)
- Issue shows total count and affected users
- Prevents GitHub spam from repeated errors

### Configure Grouping

**Custom grouping rules:**
```yaml
# In Sentry project settings
fingerprinting:
  - error.type
  - error.message
  - error.stacktrace[0].filename
  - error.stacktrace[0].function
```

**Merge duplicate issues:**
- Sentry automatically merges similar errors
- GitHub issues linked to merged groups
- Comments added when errors are merged

---

## Metrics and Reporting

### Track Error-to-Fix Time

**Key metrics:**
- **Time to triage**: Error detected → Issue assigned
- **Time to fix**: Issue created → PR merged
- **Time to resolve**: PR merged → Error resolved in production
- **Regression rate**: % of errors that recur after fix

**Query via Sentry API:**
```bash
# Get all issues created this week
curl https://sentry.io/api/0/projects/[org]/[project]/issues/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -G \
  --data-urlencode "query=firstSeen:>=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%S)"
```

**Dashboard:**
- Error volume by day
- Top errors by user impact
- Mean time to resolution
- Regression rate

### Integration with GitHub Insights

**Query GitHub API:**
```bash
# Get Sentry issues created this week
gh issue list \
  --label sentry \
  --state all \
  --limit 100 \
  --json number,title,createdAt,closedAt,labels

# Calculate time to resolution
# (closedAt - createdAt for closed issues)
```

---

## Best Practices

### 1. Configure Appropriate Thresholds

**Don't create issues for:**
- Low-priority errors (<5 occurrences)
- Development/staging errors
- Expected errors (e.g., 404s from bots)

**Do create issues for:**
- New error types in production
- Errors affecting >10 users
- High-volume errors (>50/hour)
- Regression errors

### 2. Use Labels for Triage

**Recommended labels:**
- `sentry` - Automatically created by Sentry
- `bug` - It's a bug
- `production` - Occurring in production
- `high-priority` - Affects many users
- `regression` - Previously fixed error recurred
- `performance` - Performance issue
- `needs-triage` - Needs team review

### 3. Link Releases

**Configure release tracking:**
```javascript
// In Sentry initialization
Sentry.init({
  release: "nemoclaw@" + require('./package.json').version,
});
```

**Benefits:**
- Sentry knows which errors are fixed in which release
- Can mark errors as "Resolved in next release"
- Track regression rate by release

### 4. Add Context to Issues

**Sentry issue templates:**
- Include reproduction steps section
- Add "Related Errors" section
- Link to runbook for common errors
- Add priority assessment checklist

---

## For Autonomous Agents

### Detecting Errors

**Query Sentry API for recent errors:**
```bash
curl https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/ \
  -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
  -G \
  --data-urlencode "query=firstSeen:>=$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
  --data-urlencode "query=is:unresolved"
```

**Parse response:**
```json
{
  "id": "123456",
  "title": "ConnectionError: Failed to connect to inference API",
  "culprit": "bin/lib/nim.js in connectToInference",
  "count": "42",
  "userCount": 12,
  "firstSeen": "2026-03-22T12:34:56Z",
  "lastSeen": "2026-03-22T14:22:10Z",
  "permalink": "https://sentry.io/organizations/[org]/issues/123456/"
}
```

### Creating Fixes

**Agent workflow:**
1. Query Sentry for unresolved errors
2. Prioritize by user impact (userCount)
3. Analyze stack trace and breadcrumbs
4. Implement fix
5. Commit with `Fixes #[issue-number]`
6. Verify error resolved after deployment

**Example:**
```bash
# 1. Get errors
curl https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/issues/ \
  | jq '.[] | {id, title, userCount, permalink}' \
  | jq -s 'sort_by(.userCount) | reverse'

# 2. Analyze top error
# 3. Implement fix
# 4. Commit
git commit -m "Fix inference connection timeout

Fixes #456

- Increase timeout to 60s
- Add retry logic
- Improves error messaging"

# 5. After deploy, verify in Sentry
```

---

## Troubleshooting

### Issue Not Created

**Check:**
1. Sentry GitHub integration installed? (Settings → Integrations)
2. Alert rule configured? (Alerts → Rules)
3. Error matches trigger conditions? (Check filters)
4. GitHub rate limits? (Sentry UI shows warnings)

### Duplicate Issues

**Fix:**
- Adjust Sentry fingerprinting rules
- Merge duplicate GitHub issues manually
- Improve error grouping configuration

### Missing Context

**Improve:**
- Add more breadcrumbs in code
- Set user context in Sentry
- Include environment variables in error reports
- Add custom tags for filtering

---

## References

- [Sentry GitHub Integration](https://docs.sentry.io/product/integrations/source-code-mgmt/github/)
- [Sentry Alert Rules](https://docs.sentry.io/product/alerts/create-alerts/)
- [Sentry API](https://docs.sentry.io/api/)
- [GitHub Issue Templates](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/about-issue-and-pull-request-templates)

---

**Last Updated**: 2026-03-22  
**For Questions**: See AGENTS.md or open a GitHub issue
