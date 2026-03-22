# Branch Protection Configuration

This document describes the branch protection rules configured for the NemoClaw repository.

## Protected Branches

- **main** - Primary branch with full protection

## Protection Rules (main branch)

### Pull Request Requirements

✅ **Require pull request before merging**
- **Required approving reviews**: 1
- **Dismiss stale pull request approvals when new commits are pushed**: Enabled
- **Require review from Code Owners**: Enabled
- **Require approval of the most recent reviewable push**: Disabled (allows incremental fixes)

### Additional Protections

✅ **Require conversation resolution before merging**: Enabled
- All review comments must be resolved before merge
- Prevents accidental merges with unaddressed feedback

❌ **Require status checks to pass before merging**: Disabled
- No required status checks configured yet
- Can be enabled once CI workflows stabilize

❌ **Require branches to be up to date before merging**: Disabled
- Allows merging without rebasing
- Reduces friction for small changes

❌ **Require linear history**: Disabled
- Allows merge commits
- More flexible for various workflows

### Security Protections

✅ **Do not allow force pushes**: Enabled
- Protects against accidental history rewrites
- Prevents `git push --force` to main

✅ **Do not allow deletions**: Enabled
- Prevents accidental branch deletion
- Protects main branch from removal

❌ **Require signed commits**: Disabled
- Not enforced currently
- Can be enabled for stricter security

### Administrative Settings

❌ **Enforce all configured restrictions for administrators**: Disabled
- Allows repository admins to bypass protections in emergencies
- Useful for urgent hotfixes or repository maintenance

❌ **Lock branch**: Disabled
- Branch remains writable (via PRs)
- Allows normal development workflow

## Why These Rules?

### Required Pull Request Reviews
- **Prevents direct commits**: All changes must go through PR review
- **Code quality**: At least one other person reviews every change
- **Knowledge sharing**: Team members stay aware of changes
- **CODEOWNERS integration**: Ensures right people review their areas

### Conversation Resolution
- **Complete reviews**: All feedback must be addressed
- **No loose ends**: Prevents merging with unresolved discussions
- **Quality gate**: Ensures reviewer concerns are handled

### Force Push Protection
- **History integrity**: Prevents rewriting published history
- **Collaboration safety**: Protects other contributors from broken references
- **Audit trail**: Maintains complete change history

### Deletion Protection
- **Accident prevention**: Can't accidentally delete main branch
- **Recovery insurance**: Branch always exists for recovery
- **Stability**: Core branch is permanent

## Updating Protection Rules

### Via GitHub UI

1. Navigate to **Settings** → **Branches**
2. Click **Edit** next to main branch rule
3. Modify settings as needed
4. Click **Save changes**

### Via GitHub API

```bash
# Update branch protection using the configuration file
gh api -X PUT repos/quanticsoul4772/NemoClaw/branches/main/protection \
  --input .github/branch-protection.json
```

### Via GitHub CLI (alternative)

```bash
# View current protection
gh api repos/quanticsoul4772/NemoClaw/branches/main/protection

# Update specific settings (example: require 2 reviews)
gh api -X PATCH repos/quanticsoul4772/NemoClaw/branches/main/protection/required_pull_request_reviews \
  -f required_approving_review_count=2
```

## Configuration File

The current branch protection configuration is stored in:
- `.github/branch-protection.json`

This file can be used to:
- Document protection settings
- Quickly restore settings if changed
- Apply same rules to other branches
- Version control security policies

## Testing Branch Protection

### Verify protection is active:

```bash
# Check protection status
gh api repos/quanticsoul4772/NemoClaw/branches/main/protection

# Try direct push (should fail)
git push origin main
# Expected error: "required status checks" or "pull request required"
```

### Create a pull request instead:

```bash
# Create feature branch
git checkout -b feature/test-protection

# Make changes and commit
git add .
git commit -m "test: verify branch protection"

# Push feature branch
git push origin feature/test-protection

# Create pull request
gh pr create --title "Test branch protection" --body "Verifying PR workflow"

# Merge via GitHub UI after approval
```

## Future Enhancements

### Recommended additions as repository matures:

1. **Required Status Checks**
   - Add once CI workflows are stable
   - Require tests, linting, and docs validation to pass
   - Prevents merging broken code

2. **Require Up-to-Date Branches**
   - Enable once team is comfortable with rebasing
   - Prevents integration conflicts
   - Ensures tests run against latest code

3. **Signed Commits**
   - Enable for stricter security requirements
   - Verifies commit authenticity
   - Prevents impersonation

4. **Automated Security Updates**
   - Enable Dependabot security updates to bypass protection
   - Allows automatic security patches
   - Maintains security without manual intervention

## Troubleshooting

### "Push declined due to repository rule violations"

**Cause**: Direct push to protected branch

**Solution**: Create a pull request instead
```bash
git checkout -b my-feature
# ... make changes ...
git push origin my-feature
gh pr create
```

### "Required review not satisfied"

**Cause**: PR needs at least 1 approval

**Solution**: Request review from team member
```bash
gh pr create --reviewer username
# Or in GitHub UI: Request review from sidebar
```

### "All conversations must be resolved"

**Cause**: Unresolved review comments

**Solution**: Address all comments, then resolve
- Reply to each comment
- Make requested changes
- Click "Resolve conversation" in GitHub UI

### Emergency Override (Admins Only)

If urgent changes are needed and protection must be bypassed:

1. Temporarily disable protection (admins only):
   ```bash
   gh api -X DELETE repos/quanticsoul4772/NemoClaw/branches/main/protection
   ```

2. Make emergency changes directly

3. **Re-enable protection immediately**:
   ```bash
   gh api -X PUT repos/quanticsoul4772/NemoClaw/branches/main/protection \
     --input .github/branch-protection.json
   ```

⚠️ **Warning**: Only use in genuine emergencies. Document why override was necessary.

## Benefits for Agent Readiness

Branch protection directly improves agent readiness by:

1. **Quality Gate**: Ensures agent-generated code is reviewed before merging
2. **Safety Net**: Prevents agents from accidentally force-pushing or deleting branches
3. **Collaboration**: Forces agents to use PR workflow, maintaining visibility
4. **Code Review**: Human oversight of autonomous agent changes
5. **History Integrity**: Prevents agents from rewriting repository history

## References

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub API - Branch Protection](https://docs.github.com/en/rest/branches/branch-protection)
- [CODEOWNERS Documentation](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

---

**Last Updated**: 2026-03-22
**Configuration**: `.github/branch-protection.json`
**Status**: ✅ Active on main branch
