---
name: structured-thinking
description: Use mcp-reasoning tools to think step-by-step before acting. Activate when facing complex decisions, multi-step tasks, debugging, or any situation where you might make mistakes by rushing. This skill transforms impulsive tool-calling into deliberate, structured reasoning.
---

# Structured Thinking

You have access to mcp-reasoning tools that externalize your thinking into structured, verifiable steps. **Use them instead of trying to reason in your head** — this prevents the errors that come from rushing.

## When to Use This Skill

**Always use structured thinking when:**
- You're about to make a decision with multiple options
- You're debugging something and aren't sure of the root cause
- You're planning a multi-step task (more than 3 steps)
- You're about to modify a file or run a destructive command
- You got an error and need to figure out why
- The user asked you to think, analyze, or plan

**Skip structured thinking for:**
- Simple factual questions
- Single-command operations you're confident about
- Reading files or listing directories

## Core Protocol: Think → Plan → Act → Verify

### Step 1: Think (use reasoning_auto)

Before any complex action, call `reasoning_auto` with a description of what you're trying to do. It will select the best reasoning mode for you.

```
Tool: reasoning_auto
Content: "I need to [describe what you're trying to do and why]"
```

### Step 2: Plan (use the suggested reasoning tool)

Follow the suggestion from reasoning_auto. Common patterns:

**For decisions** → `reasoning_decision`
```
Tool: reasoning_decision
Question: "Which approach should I take?"
Options: ["option A description", "option B description", "option C description"]
Type: "weighted"
```

**For debugging** → `reasoning_tree`
```
Tool: reasoning_tree
Operation: "create"
Content: "Bug: [describe symptom]. Possible causes: [list hypotheses]"
Num_branches: 3
```
Then focus on the most promising branch:
```
Tool: reasoning_tree
Operation: "focus"
Branch_id: "[id from previous result]"
Content: "Testing hypothesis: [describe what you're checking]"
```

**For step-by-step tasks** → `reasoning_linear`
```
Tool: reasoning_linear
Content: "Step 1: [what to do first]. Step 2: [what to do next]. ..."
```

**For catching your own mistakes** → `reasoning_detect`
```
Tool: reasoning_detect
Content: "[paste your reasoning or plan here]"
```

**For evaluating evidence** → `reasoning_evidence`
```
Tool: reasoning_evidence
Content: "Claim: [what you believe]. Evidence for: [list]. Evidence against: [list]."
```

### Step 3: Act

Execute the plan from Step 2. Run one command at a time. Check each result before proceeding.

### Step 4: Verify

After acting, verify the result:
- Did the command succeed? (check exit code)
- Did it produce the expected output?
- Are there any unexpected side effects?

If verification fails, go back to Step 1 with the new information.

## Reasoning Tool Quick Reference

| Tool | Use When | Example |
|------|----------|---------|
| `reasoning_auto` | Not sure which tool to use | Start here for any complex task |
| `reasoning_linear` | Step-by-step sequential work | Writing a script, following a procedure |
| `reasoning_tree` | Multiple possible causes/paths | Debugging, exploring options |
| `reasoning_decision` | Choosing between options | Architecture decisions, tool selection |
| `reasoning_detect` | Checking for mistakes | Review your own plan before executing |
| `reasoning_evidence` | Evaluating claims | Is this the right fix? What's the evidence? |
| `reasoning_reflection` | Improving your reasoning | After a mistake, reflect on what went wrong |
| `reasoning_divergent` | Need creative alternatives | Stuck on a problem, need fresh ideas |
| `reasoning_counterfactual` | What-if analysis | What would happen if we did X instead? |
| `reasoning_checkpoint` | Save progress | Before risky operations, save reasoning state |

## Common Patterns

### Pattern: Debug a Problem

```
1. reasoning_auto: "Debug: [describe the error]"
2. reasoning_tree: Create branches for each possible cause
3. For each branch: run a diagnostic command to test the hypothesis
4. reasoning_tree: Focus on the branch that matched
5. Fix the issue
6. Verify the fix
```

### Pattern: Make a Decision

```
1. reasoning_auto: "Decide: [describe the choice]"
2. reasoning_decision: List options with weighted criteria
3. Follow the top recommendation
4. reasoning_detect: Check your reasoning for biases
```

### Pattern: Plan a Complex Task

```
1. reasoning_auto: "Plan: [describe what you need to build]"
2. reasoning_linear: Break into numbered steps
3. For each step: execute and verify
4. reasoning_reflection: Review what worked and what didn't
```

### Pattern: Recover from an Error

```
1. reasoning_auto: "Error occurred: [paste error message]"
2. reasoning_tree: Create hypotheses for root cause
3. Test each hypothesis with a diagnostic command
4. reasoning_evidence: Evaluate which cause is most likely
5. Apply the fix
6. reasoning_checkpoint: Save the solution for next time
```

## Rules

1. **Never skip Step 1** for complex tasks. The 10 seconds of thinking saves 10 minutes of mistakes.
2. **One command at a time.** Don't chain commands with `&&` when debugging.
3. **Read before writing.** Always read a file before modifying it.
4. **Verify after acting.** Don't assume a command worked — check.
5. **When stuck, use reasoning_divergent** to generate fresh approaches.
6. **When you made a mistake, use reasoning_reflection** to understand why.
7. **Save state with reasoning_checkpoint** before risky operations.
