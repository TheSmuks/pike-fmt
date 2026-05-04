# Architecture

## Overview

pike-fmt is a standalone Pike source code formatter built on web-tree-sitter and the
tree-sitter-pike grammar. It performs a depth-first tree walk of Pike source code,
producing normalized output that preserves program structure while standardizing
indentation and whitespace.

### Phases

| Phase | Scope |
|-------|-------|
| Phase 1 | Indentation normalization only. Brace position preserved from input. |
| Phase 3 | Indentation + trailing whitespace removal + blank line normalization. |
| Phase 4 (experimental) | Indentation + whitespace + operator spacing normalization. Disabled by default. |

### Data Flow

```
Pike source → tree-sitter parse → tree walk → normalized output
```

## Core Components

### `src/formatter.ts`

The canonical formatter module. Contains:
- `INDENT_NODES` — set of node types that affect indentation depth
- `format(source, options?)` — main entry point, returns formatted string
- `normalizeIndent(tree, source, options?)` — depth-first tree walk with same-line brace detection
- `normalizeOperatorSpacing(source)` — experimental operator spacing (Phase 4)

### `src/cli.ts`

CLI entry point. Handles argument parsing, file discovery, and I/O. Supports:
- Stdin input (single file or pipe)
- Directory recursion (finds all `.pike` files)
- `--check`, `--diff`, `--list`, `-w`/`--write`, `--operator-spacing` modes

### `src/diff.ts`

TextEdit computation for LSP integration:
- `computeIndentEdits(oldText, newText)` — converts two strings into a minimal array of `TextEdit` objects
- `wouldChange(oldText, newText)` — returns `true` if the two strings differ

### `tests/helpers.ts`

Test harness with tree-sitter-pike initialization:
- `initParser()` — loads WASM grammar and returns configured `Parser`
- `formatSource(parser, source, options?)` — wrapper for `format()` with parser context
- `assertFormat(input, expected, options?)` — asserts formatted output matches expected
- `assertIdempotent(parser, source, options?)` — asserts formatting twice produces identical output
- `assertParses(parser, source)` — asserts a source string parses to a valid tree

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

## Dependencies

- **web-tree-sitter** (`0.26.8`) — tree-sitter runtime for Node.js
- **tree-sitter-pike.wasm** (bundled in repo root) — WASM grammar compiled with tree-sitter-cli 0.26.8

The web-tree-sitter version must match the tree-sitter-cli version used to compile the WASM grammar.
Mismatched versions cause runtime failures.

## References

- [docs/agent-files-guide.md](./docs/agent-files-guide.md) — Practical guide for writing effective architecture documentation
- [docs/ci.md](./docs/ci.md) — CI/CD workflow documentation