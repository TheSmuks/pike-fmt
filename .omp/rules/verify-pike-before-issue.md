---
name: verify-pike-before-issue
description: Prevents filing Pike-related issues on upstream repos without verifying code is valid Pike
type: scope
version: 1.0.0
---

# Verify Pike Before Filing Issue Rule

## Purpose

Prevents filing misleading issues on upstream Pike-related repositories (e.g., TheSmuks/tree-sitter-pike) claiming that Pike syntax is broken or missing, when the claimed syntax never existed in Pike. Agents must verify code samples are valid Pike using the Pike runtime before filing issues.

## When This Rule Applies

The rule activates whenever the agent interacts with GitHub issues on repositories related to Pike tooling:

```
scope:
  tool:mcp__github_issue_write(**)
  tool:mcp__github_add_issue_comment(**)
  tool:mcp__github_add_reply_to_pull_request_comment(**)
```

Additionally, when the agent encounters Pike syntax in any context, it should verify against the Pike runtime before claiming syntax is broken or missing.

## Core Requirements

### 1. Verify With the Pike Runtime

Before filing any issue that claims Pike syntax is broken or that tree-sitter-pike should parse something, the agent MUST verify the code sample is valid Pike by running:

```bash
# Inline expression
pike -e 'write("Hello\n");'

# Script file
cat > /tmp/test.pike << 'EOF'
int main() {
    return 0;
}
EOF
pike /tmp/test.pike
```

The Pike runtime (`pike`) is available at `/usr/local/bin/pike`. Version is **8.0.1116**.

### 2. Check Language Reference Before Claiming Missing Features

Before claiming Pike lacks a feature, consult:
- **Pike language reference** — `skill://pike-language-reference`
- **Pike stdlib API** — `skill://pike-stdlib-api`

Pike does **not** have:
- Arrow lambda syntax (`(type x) => expr`) — Pike uses `lambda(type x) { return expr; }`
- `function(type x) { ... }` anonymous function syntax — Pike uses `lambda(type x) { return x; }`

### 3. Known Non-Pike Syntax (Do Not File Issues For)

| Syntax | Pike Equivalent |
|--------|-----------------|
| `function(type x) { ... }` | `lambda(type x) { return x; }` |
| `(type x) => expr` | `lambda(type x) { return expr; }` |
| `async`/`await` keywords | Pike uses threading, not async/await |
| TypeScript-style `interface` | Pike uses `class` for interfaces |
| Decorator `@annotation` | Pike uses `__attribute__` or inline comments |

### 4. Required Verification Checklist

Before filing any issue about Pike syntax or parser behavior, confirm:

- [ ] The code sample runs successfully in `pike -e '...'` or `pike file.pike`
- [ ] The syntax is documented in the Pike language reference
- [ ] The syntax exists in Pike's BNF grammar
- [ ] The issue describes behavior of Pike itself, not assumed syntax from other languages

### 5. Correct Issue Framing

**WRONG** — Claims syntax exists that doesn't:
> "Pike should support `function(int x) { return x; }` anonymous functions"

**RIGHT** — Requests a feature that actually exists:
> "Pike's `lambda` syntax should be parseable by tree-sitter-pike"

## Why This Rule Exists

- Issues #13 and #14 on TheSmuks/tree-sitter-pike were filed for syntax that doesn't exist in Pike (arrow lambdas, function-type anonymous functions)
- Both were closed as not planned, wasting maintainer time
- Agents may assume syntax from other languages (JS, C#, TypeScript) without verifying against the Pike runtime
- Verifying against `pike` runtime before filing issues prevents noise and maintains credibility

## Implementation Notes

This is a **scope-based rule** — it activates whenever the agent writes to GitHub issues or comments on Pike-related repositories. It requires minimal context overhead and prevents the most common class of misleading Pike issues.

The rule does not prevent filing legitimate issues. It only requires that the agent verify code samples are actually valid Pike before claiming something is broken.