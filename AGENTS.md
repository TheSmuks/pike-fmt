# Project Context

This file is auto-discovered by AI coding agents. It provides project-level context that guides agent behavior.

## Project Overview

- **Name**: pike-fmt
ct|- **Description**: Standalone Pike source code formatter using tree-sitter-pike. Normalizes indentation, whitespace, and optionally operator spacing. Phase 3: indentation + whitespace. Phase 4 (experimental): operator spacing.
- **Description**: Standalone Pike source code formatter using tree-sitter-pike. Normalizes indentation and whitespace without structural changes. Phase 1: indentation-only.
- **Primary Language**: TypeScript 5.x, Node.js 22+

## Build & Run

```bash
# Install dependencies
bun install

# Build
bun run build

# Run
bun run src/cli.ts < file.pike

# Run tests
bun test

# Type check
bun run typecheck
```

## Code Style

Follow the existing patterns in the codebase. Write descriptive commit messages (see CONTRIBUTING.md). Keep functions small and focused. Add tests for new behavior. Update CHANGELOG.md for user-facing changes.

Follow [Tiger Style](./docs/agent-files-guide.md#e-tiger-style-reference) principles: assertions, bounded operations, zero tech debt. See the guide for details.

### Module and File Size Guidelines

| Metric | Guideline | Action if exceeded |
|--------|-----------|-------------------|
| File length | 300 lines | Split into focused modules |
| Function/method length | 40 lines | Extract helpers |
| Module exports | 15 public symbols | Re-evaluate module boundary |
| Nesting depth | 4 levels | Flatten with early returns or extract |

### Pike Formatting Conventions

These conventions define expected output for the formatter:

- **2-space indentation** (Pike stdlib convention)
- **Opening brace on same line** as declaration (`class Foo {`, `void create() {`)
- **No space before `(`** in function declarations/calls
- **Space after `//` and `//!`** in comments
- Pike literals `({`, `([`, `(<` are treated as opening brackets

## Project Structure

```
src/
  formatter.ts       # Tree-walking formatter using tree-sitter-pike
  cli.ts             # CLI entry point (args, file I/O, modes)
  diff.ts            # TextEdit[] computation for LSP integration
tests/
  formatter.test.ts  # Integration tests against corpus fixtures
  diff.test.ts       # Unit tests for diff utilities
  helpers.ts         # Test harness with tree-sitter-pike init
  corpus/            # Input/expected fixture pairs (.pike files)
dist/                # Compiled JavaScript (gitignore)
tree-sitter-pike.wasm
```

## Testing

- All new features must include tests
- Bug fixes must include a regression test
- Run the full test suite before submitting a PR
- Tests should be deterministic: no reliance on external services, wall-clock time, or random state
- **Idempotency verification**: Formatting twice must produce identical output
- **Parse correctness**: Formatted output must produce valid tree-sitter parse trees

## Error Handling

- **Do not suppress errors.** Catching an exception and continuing silently is a bug.
- **Exit code 0**: formatted (or already formatted), no changes needed
- **Exit code 1**: error (parse failure, I/O error, or pike-fmt not found)
- **Exit code 2**: invalid arguments
- **stderr is reserved for diagnostic output** when exit code is non-zero

## CI/CD

CI uses separate workflow files, one concern per file. See [docs/ci.md](./docs/ci.md) for the full guide.

| Workflow | Purpose |
|----------|---------|
| `ci.yml` | Lint, typecheck, test |
| `commit-lint.yml` | Conventional commit enforcement |
| `changelog-check.yml` | Changelog update enforcement (PRs only) |
| `blob-size-policy.yml` | Rejects oversized files (PRs only) |

## Agent Behavior

Agents can invoke the `template-guide` skill (`.omp/skills/template-guide/SKILL.md`) to look up conventions, audit compliance, or get upgrade guidance. Agents can also invoke the `merge-to-main` skill (`.omp/skills/merge-to-main/SKILL.md`) to automate the PR lifecycle after completing feature work, and the `cut-release` skill (`.omp/skills/cut-release/SKILL.md`) to cut a new release with proper version bumping and GitHub release creation.

When an AI agent is working in this repository:

1. **Always create PRs for changes.** Do not push directly to `main`.
2. **Run available validation before requesting review.** Execute lint, type-check, and test commands before declaring work complete.
3. **Read before editing.** Read the full file or section before making changes.
4. **One concern per change.** A PR should address one issue or feature.
5. **Update documentation in the same change.** If code behavior changes, update comments and docs in the same commit.
6. **Preserve invariants.** Follow existing patterns.
7. **Clean up after yourself.** Remove unused imports, dead code.

## Conventions

### Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### Branches

Follow [Conventional Branch](https://github.com/nickshanks347/conventional-branch) naming:

```
<type>/<short-description>
```

Examples: `feature/add-embeddings`, `fix/token-overflow`

### Changelog

Follow [Keep a Changelog](https://keepachangelog.com/). Update `CHANGELOG.md` under `[Unreleased]` for every user-facing change.

## Template Version

This project was generated from `ai-project-template` version **0.6.0**. See [`.template-version`](./.template-version) for the current release.