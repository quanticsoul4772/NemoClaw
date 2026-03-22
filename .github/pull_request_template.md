## Description

<!-- Provide a clear and concise description of what this PR does -->

### What changed?

<!-- Describe the changes made in this PR -->

### Why?

<!-- Explain the motivation and context for these changes -->
<!-- Link to related issues: Fixes #123, Relates to #456 -->

---

## Type of Change

<!-- Check all that apply -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📝 Documentation update
- [ ] 🔧 Configuration change (CI, build, deps, etc.)
- [ ] ♻️ Refactoring (no functional changes)
- [ ] ⚡ Performance improvement
- [ ] 🧪 Test additions or updates
- [ ] 🔒 Security fix

---

## Component(s) Affected

<!-- Check all that apply -->

- [ ] TypeScript Plugin (`nemoclaw/`)
- [ ] Python Blueprint (`nemoclaw-blueprint/`)
- [ ] CLI Scripts (`bin/`)
- [ ] Tests (`test/`)
- [ ] Documentation (`docs/`, README, AGENTS.md)
- [ ] CI/CD (`.github/workflows/`)
- [ ] Build System (Makefile, package.json)
- [ ] Other: _____________

---

## Testing Done

<!-- Describe the testing you've performed to verify your changes -->

### Manual Testing

<!-- Example: Ran `nemoclaw onboard` and verified... -->

```bash
# Commands you ran to test this change

```

### Automated Tests

- [ ] All existing tests pass (`npm test`)
- [ ] Added new tests for this change
- [ ] No tests needed (documentation/config only)

### Linting and Type Checking

- [ ] TypeScript: `cd nemoclaw && npm run check` passes
- [ ] Python: `cd nemoclaw-blueprint && make check` passes
- [ ] Pre-commit hooks: `pre-commit run --all-files` passes

---

## Security Considerations

<!-- Critical: Have you checked for security implications? -->

- [ ] **This PR does NOT expose secrets, API keys, or credentials**
- [ ] **I have reviewed the diff for sensitive data before submitting**
- [ ] Changes to security-sensitive files (policies, secrets, auth) reviewed by security team
- [ ] No new security vulnerabilities introduced
- [ ] N/A - This PR has no security implications

### Sensitive Files Changed

<!-- If you modified any of these, explain why and get security review -->

- [ ] `.env.example` or environment variable handling
- [ ] `nemoclaw-blueprint/policies/` (sandbox policies)
- [ ] `bin/lib/credentials.js` (credential storage)
- [ ] `.gitignore` or `.secrets.baseline`
- [ ] None of the above

---

## Breaking Changes

<!-- If this is a breaking change, describe the impact and migration path -->

**Is this a breaking change?** <!-- Yes/No -->

<!-- If yes, answer: -->
- **What breaks?**
- **Migration path for users:**
- **Deprecation timeline (if applicable):**

---

## Dependencies

<!-- Have dependencies changed? -->

- [ ] Added new npm dependencies (list below)
- [ ] Added new Python dependencies (list below)
- [ ] Updated existing dependencies
- [ ] Removed dependencies
- [ ] No dependency changes

### New Dependencies Added

<!-- If you added dependencies, justify each one -->

| Package | Purpose | Why this package? |
|---------|---------|-------------------|
| example-pkg | Example purpose | Why we chose this over alternatives |

---

## Documentation Updates

<!-- Have you updated the docs? -->

- [ ] Updated README.md
- [ ] Updated AGENTS.md
- [ ] Updated CONTRIBUTING.md
- [ ] Updated Sphinx docs (`docs/`)
- [ ] Added/updated code comments
- [ ] No documentation changes needed

---

## Screenshots / Logs

<!-- If applicable, add screenshots or relevant log output -->

<details>
<summary>Click to expand logs/screenshots</summary>

```
Paste relevant output here
```

</details>

---

## Pre-Submission Checklist

<!-- Verify you've completed these steps -->

### Code Quality

- [ ] Code follows the project's style guidelines (enforced by ESLint/Ruff)
- [ ] I have performed a self-review of my own code
- [ ] I have commented my code where necessary (complex logic only)
- [ ] My changes generate no new warnings or errors
- [ ] No debugging code (console.log, print statements) left in production code

### Git Hygiene

- [ ] Commits are signed off (`git commit -s`)
- [ ] Commit messages are descriptive and follow conventional commits format
- [ ] Branch is up to date with `main`
- [ ] No merge conflicts

### Agent Readiness

- [ ] This PR is understandable by autonomous agents (clear description, context provided)
- [ ] Changes are well-documented for future AI/human contributors
- [ ] No magic numbers or unexplained configurations

---

## Additional Context

<!-- Add any other context, concerns, or notes for reviewers -->

---

## Reviewer Guidance

<!-- Optional: Help reviewers by pointing out areas that need special attention -->

**Areas needing extra scrutiny:**
- 

**Questions for reviewers:**
- 

---

<!-- 
For Autonomous Agents:
- Ensure all checkboxes are marked appropriately
- Provide detailed testing evidence (commands + output)
- Link to related issues/PRs for context
- Redact ALL sensitive information from logs/screenshots
- If uncertain about security implications, flag for human review
-->
