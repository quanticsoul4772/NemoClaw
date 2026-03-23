# NemoClaw Runbooks

This document contains incident response playbooks for NemoClaw operations. Use these runbooks to diagnose and resolve common production issues.

## Table of Contents

- [General Troubleshooting](#general-troubleshooting)
- [Sandbox Incidents](#sandbox-incidents)
- [Inference Incidents](#inference-incidents)
- [Deployment Incidents](#deployment-incidents)
- [Performance Incidents](#performance-incidents)
- [Security Incidents](#security-incidents)
- [Escalation Procedures](#escalation-procedures)

---

## General Troubleshooting

### Before You Start

**1. Check monitoring dashboards:**
- Error rate: Is it elevated?
- Latency: Are commands slow?
- Throughput: Has it dropped significantly?

**2. Check recent deployments:**
- Was there a recent deploy? (Check dashboard deployment markers)
- New errors in Sentry since deployment?

**3. Gather context:**
```bash
# Check recent errors
nemoclaw <command> 2>&1 | jq 'select(.level >= 50)' | jq -s 'length'

# Check command duration
nemoclaw <command> 2>&1 | jq -s '[.[] | select(.metric_name == "nemoclaw.command.duration") | .metric_value] | add / length'

# Get trace ID for failed operation
nemoclaw <command> 2>&1 | jq -s 'first(.[] | select(.level >= 50)) | .traceId'
```

**4. Collect logs:**
```bash
# Enable verbose logging
export NEMOCLAW_VERBOSE=1

# Reproduce the issue and save logs
nemoclaw <command> 2>&1 > /tmp/nemoclaw-debug.log

# Filter to specific trace ID
cat /tmp/nemoclaw-debug.log | jq 'select(.traceId == "TRACE_ID_HERE")'
```

### Common Commands

**Check system status:**
```bash
nemoclaw status                    # Show sandbox and service status
nemoclaw list                      # List all sandboxes
docker ps                          # Check running containers
```

**View logs:**
```bash
nemoclaw <sandbox> logs            # View sandbox logs
nemoclaw <sandbox> logs --follow   # Tail sandbox logs in real-time
```

**Health checks:**
```bash
# Test inference endpoint
curl -X POST http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "nemotron", "prompt": "test", "max_tokens": 10}'

# Check OpenShell gateway
curl http://localhost:18789/health
```

---

## Sandbox Incidents

### Incident: Sandbox Creation Fails

**Symptoms:**
- `nemoclaw onboard` fails during sandbox creation
- Error: "Failed to create sandbox"
- Sentry shows sandbox creation errors

**Diagnosis:**

1. **Check Docker availability:**
```bash
docker ps
docker info

# If Docker is not running
sudo systemctl start docker  # Linux
# or restart Docker Desktop on macOS/Windows
```

2. **Check disk space:**
```bash
df -h
# Ensure at least 5GB free space
```

3. **Check OpenShell CLI:**
```bash
which openshell
openshell --version

# If not found, reinstall
curl -fsSL https://install.openshell.ai | bash
```

4. **Check logs:**
```bash
export NEMOCLAW_VERBOSE=1
nemoclaw onboard 2>&1 | tee /tmp/onboard.log
```

**Resolution:**

**If Docker is not running:**
```bash
# Linux
sudo systemctl start docker
sudo systemctl enable docker

# macOS
open -a Docker

# Windows
Start-Service docker
```

**If disk space is low:**
```bash
# Clean up Docker
docker system prune -af

# Clean up old images
docker image prune -a
```

**If OpenShell is not installed:**
```bash
# Reinstall OpenShell
curl -fsSL https://install.openshell.ai | bash
source ~/.bashrc
openshell --version
```

**If still failing:**
```bash
# Try manual sandbox creation
openshell sandbox create test-sandbox
openshell sandbox list

# If successful, retry nemoclaw onboard
```

**Rollback:**
- No rollback needed for creation failures

**Post-Incident:**
- Update monitoring alerts for Docker availability
- Document any new failure modes

### Incident: Sandbox Won't Start

**Symptoms:**
- Sandbox exists but won't start
- `nemoclaw <sandbox> connect` fails
- Error: "Sandbox not running"

**Diagnosis:**

1. **Check sandbox status:**
```bash
nemoclaw <sandbox> status
openshell sandbox list
```

2. **Check container status:**
```bash
docker ps -a | grep <sandbox>
docker logs <sandbox-container-id>
```

3. **Check port conflicts:**
```bash
# Check if port 18789 is in use
lsof -i :18789  # Linux/macOS
netstat -ano | findstr :18789  # Windows
```

**Resolution:**

**If container stopped:**
```bash
# Restart the sandbox
openshell sandbox start <sandbox>
nemoclaw <sandbox> connect
```

**If port conflict:**
```bash
# Kill process using the port
kill -9 <PID>  # Linux/macOS
taskkill /PID <PID> /F  # Windows

# Or use different port
openshell forward start --background 18790 <sandbox>
```

**If container is corrupted:**
```bash
# Destroy and recreate
nemoclaw <sandbox> destroy
nemoclaw onboard  # Create fresh sandbox
```

**Rollback:**
- N/A (sandbox-specific issue)

**Post-Incident:**
- Check for resource leaks
- Add monitoring for sandbox health

### Incident: Inference Requests Failing

**Symptoms:**
- Inference requests return errors
- Timeout errors in logs
- Sentry shows inference failures

**Diagnosis:**

1. **Check API key:**
```bash
# Verify API key is set
echo $NVIDIA_API_KEY | head -c 10

# Test API key directly
curl https://api.nvidia.com/v1/health \
  -H "Authorization: Bearer $NVIDIA_API_KEY"
```

2. **Check network connectivity:**
```bash
# Test NVIDIA API
curl -I https://api.nvidia.com

# Check firewall rules
iptables -L  # Linux
```

3. **Check rate limits:**
```bash
# Look for rate limit errors in logs
nemoclaw <command> 2>&1 | jq 'select(.err.message | contains("rate limit"))'
```

**Resolution:**

**If API key is invalid:**
```bash
# Get new API key from https://build.nvidia.com/settings/api-keys
# Update credentials
nemoclaw credentials set-api-key

# Or update .env
nano .env
# NVIDIA_API_KEY=nvapi-...
```

**If network is blocked:**
```bash
# Check proxy settings
echo $HTTP_PROXY
echo $HTTPS_PROXY

# Test without proxy
unset HTTP_PROXY HTTPS_PROXY
curl https://api.nvidia.com
```

**If rate limited:**
```bash
# Wait for rate limit reset (usually 1 minute)
sleep 60

# Reduce request frequency
# Or upgrade API tier at https://build.nvidia.com
```

**Rollback:**
- Revert to working API key if changed

**Post-Incident:**
- Monitor API rate limits
- Set up alerts for API failures

---

## Inference Incidents

### Incident: Slow Inference Performance

**Symptoms:**
- Inference latency >5s (normally <2s)
- Dashboard shows p95 latency spike
- Users reporting slow responses

**Diagnosis:**

1. **Check current latency:**
```bash
# Get recent inference latencies
nemoclaw <command> 2>&1 | \
  jq -s '[.[] | select(.metric_name == "nemoclaw.inference.latency") | .metric_value] | add / length'
```

2. **Check NVIDIA API status:**
```bash
# Check API status page
curl https://status.nvidia.com/api/v2/status.json
```

3. **Check model availability:**
```bash
# List available models
curl https://api.nvidia.com/v1/models \
  -H "Authorization: Bearer $NVIDIA_API_KEY"
```

**Resolution:**

**If NVIDIA API is slow:**
- Wait for API recovery
- Check https://status.nvidia.com for updates
- Consider using cached responses if applicable

**If specific model is slow:**
```bash
# Switch to alternative model
nemoclaw onboard  # Select different model
```

**If network latency:**
```bash
# Check latency to NVIDIA
ping api.nvidia.com
traceroute api.nvidia.com

# Consider regional endpoint if available
```

**Rollback:**
- Revert to previous model if changed

**Post-Incident:**
- Add latency alerting
- Document alternative models

### Incident: Model Returns Invalid Responses

**Symptoms:**
- Model returns empty or malformed responses
- Parsing errors in application
- Sentry shows validation errors

**Diagnosis:**

1. **Check request format:**
```bash
# Enable verbose logging to see requests
export NEMOCLAW_VERBOSE=1
nemoclaw <command>
```

2. **Test with minimal request:**
```bash
curl -X POST https://api.nvidia.com/v1/completions \
  -H "Authorization: Bearer $NVIDIA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "nvidia/nemotron-3-super-120b-a12b",
    "prompt": "Hello",
    "max_tokens": 10
  }'
```

**Resolution:**

**If request format is wrong:**
- Check API documentation: https://docs.nvidia.com/inference
- Validate request payload against schema
- Update request format

**If model behavior changed:**
- Check NVIDIA changelog for API updates
- Adjust prompt formatting
- Update model parameters

**Rollback:**
- Revert to previous API version if breaking change

**Post-Incident:**
- Pin API version in requests
- Add response validation tests

---

## Deployment Incidents

### Incident: Deployment Caused Error Spike

**Symptoms:**
- Error rate increased 2x+ after deployment
- Sentry shows new error types
- Users reporting issues

**Diagnosis:**

1. **Check deployment time:**
```bash
# Get deployment time from logs or CI/CD
DEPLOY_TIME="2026-03-22T12:00:00"
```

2. **Compare errors before/after:**
```bash
# Errors before deployment (15 min window)
nemoclaw <command> 2>&1 | \
  jq -s '[.[] | select(.level >= 50 and .time < "'$DEPLOY_TIME'")] | length'

# Errors after deployment
nemoclaw <command> 2>&1 | \
  jq -s '[.[] | select(.level >= 50 and .time > "'$DEPLOY_TIME'")] | length'
```

3. **Check Sentry for new errors:**
```bash
# New errors since deployment
curl "https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/" \
  -H "Authorization: Bearer ${SENTRY_AUTH_TOKEN}" \
  -G --data-urlencode "query=firstSeen:>${DEPLOY_TIME}"
```

**Resolution:**

**If error rate >2x baseline:**

```bash
# ROLLBACK IMMEDIATELY
git log --oneline -5  # Find previous version
git checkout <previous-commit>

# Redeploy
npm install
npm run build

# Notify team
curl -X POST "$SLACK_WEBHOOK_URL" \
  -d '{"text": "⚠️ Rolled back NemoClaw due to error spike"}'
```

**If specific feature causing errors:**
```bash
# Disable feature flag
export NEMOCLAW_EXPERIMENTAL=0

# Or revert specific change
git revert <commit-hash>
git push
```

**Rollback:**
- Deploy previous version immediately
- Disable problematic feature flags
- Notify on-call team

**Post-Incident:**
- Conduct post-mortem
- Add pre-deploy testing
- Improve staging environment

### Incident: Deployment Failed

**Symptoms:**
- CI/CD pipeline failed
- New version not deployed
- Old version still running

**Diagnosis:**

1. **Check CI/CD logs:**
```bash
# GitHub Actions
gh run view <run-id>

# Or check web UI
open https://github.com/NVIDIA/NemoClaw/actions
```

2. **Check build errors:**
```bash
# Try building locally
npm install
npm run build
npm test
```

**Resolution:**

**If tests failed:**
```bash
# Run tests locally
npm test

# Fix failing tests
# Commit and push fix
git add .
git commit -m "fix: Fix failing tests"
git push
```

**If build failed:**
```bash
# Check build errors
npm run build

# Common fixes:
# - Update dependencies: npm install
# - Clear cache: npm run clean
# - Fix TypeScript errors
```

**If deployment step failed:**
- Check deployment credentials
- Verify deployment target is accessible
- Review deployment logs

**Rollback:**
- N/A (old version still running)

**Post-Incident:**
- Fix root cause
- Add build validation to PR checks

---

## Performance Incidents

### Incident: High Memory Usage

**Symptoms:**
- Out of memory errors
- Docker containers being killed
- System slowness

**Diagnosis:**

1. **Check container memory:**
```bash
docker stats <sandbox-container>

# Check specific sandbox memory
docker inspect <sandbox-container> | jq '.[].HostConfig.Memory'
```

2. **Check system memory:**
```bash
free -h  # Linux
vm_stat  # macOS
```

3. **Check for memory leaks:**
```bash
# Monitor over time
watch -n 1 'docker stats --no-stream'
```

**Resolution:**

**If container out of memory:**
```bash
# Increase container memory limit
docker update --memory 4g <sandbox-container>

# Or restart with higher limit
openshell sandbox stop <sandbox>
# Edit sandbox config to increase memory
openshell sandbox start <sandbox>
```

**If system out of memory:**
```bash
# Restart Docker to free memory
sudo systemctl restart docker

# Or increase system swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**Rollback:**
- Restart containers with default settings

**Post-Incident:**
- Monitor memory usage trends
- Add memory alerts
- Investigate memory leaks

### Incident: High CPU Usage

**Symptoms:**
- CPU at 100%
- Slow command execution
- Container throttling

**Diagnosis:**

1. **Check CPU usage:**
```bash
docker stats <sandbox-container>
top  # or htop
```

2. **Check running processes:**
```bash
docker exec <sandbox-container> ps aux
```

**Resolution:**

**If inference causing high CPU:**
- This is normal for large models
- Consider scaling horizontally (more containers)
- Or use GPU acceleration if available

**If runaway process:**
```bash
# Kill process
docker exec <sandbox-container> kill -9 <PID>

# Or restart container
docker restart <sandbox-container>
```

**Rollback:**
- Restart container

**Post-Incident:**
- Add CPU monitoring
- Consider resource limits

---

## Security Incidents

### Incident: Suspected API Key Leak

**Symptoms:**
- Unusual API usage patterns
- API key appears in public repository
- Rate limit errors

**Diagnosis:**

1. **Check API usage:**
```bash
# Check NVIDIA API dashboard
open https://build.nvidia.com/usage
```

2. **Search for leaked keys:**
```bash
# Check git history
git log -S "nvapi-" --all

# Check public repositories
# Use GitHub search or specialized tools
```

**Resolution:**

**IMMEDIATE ACTIONS:**

1. **Revoke compromised key:**
```bash
# Go to https://build.nvidia.com/settings/api-keys
# Click "Revoke" on compromised key
```

2. **Generate new key:**
```bash
# Generate new key at https://build.nvidia.com/settings/api-keys
# Update .env file
echo "NVIDIA_API_KEY=nvapi-NEW_KEY" >> .env

# Update in production secrets
# (AWS Secrets Manager, GitHub Secrets, etc.)
```

3. **Rotate all credentials:**
```bash
# Update all environments
# - Production
# - Staging
# - Development
# - CI/CD
```

4. **Notify team:**
```bash
curl -X POST "$SLACK_WEBHOOK_URL" \
  -d '{"text": "🚨 API key compromised and rotated. Update local .env files."}'
```

**If key in git history:**
```bash
# Remove from history (if not pushed to public repo)
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all

# Force push (DANGEROUS - coordinate with team)
git push origin --force --all
```

**Rollback:**
- Cannot rollback compromised keys
- Must generate new keys

**Post-Incident:**
- Audit all secrets
- Enable secret scanning
- Review .gitignore
- Conduct security training

### Incident: Unauthorized Access Attempt

**Symptoms:**
- Failed authentication in logs
- Unusual API requests
- Sentry shows authentication errors

**Diagnosis:**

1. **Check access logs:**
```bash
# Filter authentication failures
nemoclaw <command> 2>&1 | jq 'select(.msg | contains("unauthorized"))'
```

2. **Check IP addresses:**
```bash
# Look for unusual IPs
nemoclaw <command> 2>&1 | jq '.ip' | sort | uniq -c
```

**Resolution:**

1. **Block malicious IPs:**
```bash
# Add firewall rule
sudo iptables -A INPUT -s <malicious-ip> -j DROP

# Or use cloud provider firewall
```

2. **Rotate credentials:**
- Follow API Key Leak procedure above

3. **Enable additional security:**
```bash
# Enable IP allowlisting if available
# Review authentication logs regularly
```

**Rollback:**
- Remove IP blocks if false positive

**Post-Incident:**
- Review security policies
- Enable logging for all access attempts
- Set up alerting for failed auth

---

## Escalation Procedures

### When to Escalate

**Escalate IMMEDIATELY if:**
- Production is down for >15 minutes
- Data loss or corruption suspected
- Security incident detected
- Unable to resolve within 30 minutes

### Escalation Contacts

**Level 1: On-Call Engineer**
- Slack: #nemoclaw-oncall
- PagerDuty: https://your-org.pagerduty.com/services/[nemoclaw-service-id]
- Email: nemoclaw-oncall@example.com

**Level 2: Team Lead**
- Slack: @team-lead
- Phone: +1-xxx-xxx-xxxx
- Email: team-lead@example.com

**Level 3: Engineering Manager**
- Slack: @engineering-manager
- Phone: +1-xxx-xxx-xxxx
- Email: eng-manager@example.com

### Incident Communication Template

**Initial notification:**
```
🚨 Incident: [Brief Description]

Status: Investigating
Impact: [Users affected / Services down]
Started: [Timestamp]
Current Action: [What you're doing now]

Dashboard: [Link to monitoring dashboard]
Sentry: [Link to error]
```

**Update template:**
```
📊 Update: [Incident Name]

Status: [Investigating / Identified / Monitoring / Resolved]
Progress: [What changed since last update]
ETA: [Estimated time to resolution]
Next Steps: [What's happening next]
```

**Resolution template:**
```
✅ Resolved: [Incident Name]

Root Cause: [What caused it]
Resolution: [How it was fixed]
Duration: [Total incident time]
Impact: [Final impact assessment]

Post-Mortem: [Link to post-mortem doc]
Action Items: [Follow-up tasks]
```

---

## Post-Incident Procedures

**After resolving ANY incident:**

1. **Document the incident:**
```markdown
# Incident Report: [Date] - [Title]

**Incident ID:** INC-YYYY-MM-DD-NNN
**Severity:** [Critical / High / Medium / Low]
**Duration:** [Start time] to [End time]

## Summary
[Brief description]

## Timeline
- [Timestamp]: Incident detected
- [Timestamp]: On-call notified
- [Timestamp]: Root cause identified
- [Timestamp]: Fix deployed
- [Timestamp]: Incident resolved

## Impact
- Users affected: [Number / Percentage]
- Services affected: [List]
- Revenue impact: [If applicable]

## Root Cause
[Detailed explanation]

## Resolution
[What was done to fix it]

## Prevention
- [Action item 1]
- [Action item 2]
```

2. **Update runbooks:**
- Add new scenarios encountered
- Update resolution steps that worked
- Document what didn't work

3. **Schedule post-mortem:**
- Within 24 hours for critical incidents
- Within 1 week for others
- Invite all stakeholders

4. **Create follow-up tasks:**
- Preventive measures
- Monitoring improvements
- Documentation updates

---

## Additional Resources

**Internal Documentation:**
- Monitoring Dashboards: [Add your dashboard links]
- Error Tracking: [Sentry project URL]
- Deployment Logs: [CI/CD URL]

**External Resources:**
- NVIDIA API Documentation: https://docs.nvidia.com/inference
- OpenShell Documentation: https://docs.openshell.ai
- Docker Documentation: https://docs.docker.com

**Support Channels:**
- Slack: #nemoclaw-support
- Email: nemoclaw-support@example.com
- On-Call: PagerDuty rotation

---

**Last Updated**: 2026-03-22  
**Maintained By**: NemoClaw Team  
**For Questions**: See AGENTS.md or contact #nemoclaw-support
