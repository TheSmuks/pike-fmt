# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


zz|## [Unreleased]

### Fixed

- **Closing brace `}` indent regression in lambda/catch/gauge expressions.** The formatter incorrectly indented lines containing `};`, `})`, and `});` at the inner block level instead of the outer level. Fixed by extending the closing-brace detection pattern to handle these cases.
- **Closing brace `}` indent regression in computeLineIndents.** The structural line detection also used a strict `}` match that missed `};`. Fixed to use the same pattern.
- **Added corpus fixtures for `};` closing brace handling** (`closure.pike`, `nested-closure.pike`) and switch/case constructs (`switch-case.pike`).

### Changed

wc|- Replaced template boilerplate with pike-fmt project content: deleted template meta-files (SETUP_GUIDE.md, ADOPTING.md, UPGRADING.md, .template-version), rewrote README.md and ARCHITECTURE.md with pike-fmt content, cleaned up CHANGELOG.md to remove template version history, fixed devcontainer.json, CODEOWNERS, and PR template, removed duplicate description from AGENTS.md.


## [0.1.0] — 2026-05-04

### Fixed

- **Formatter was completely broken.** `web-tree-sitter` upgraded from `0.23.2` to `0.26.8` to match the ABI version of `tree-sitter-pike.wasm` (built with `tree-sitter-cli@0.26.8`).
- `src/formatter.ts` was dead code — `format()` returned source unchanged. Rewritten as the canonical formatter module.
- `src/cli.ts` contained duplicate formatting logic. CLI slimmed down to thin entry point.

### Added

- `tree-sitter-pike.wasm` bundled into repo root (was missing).
- `src/diff.ts` — `computeIndentEdits` and `wouldChange` extracted from dead code.
- `tests/helpers.ts` — Test harness with tree-sitter-pike initialization, `formatSource`, `assertFormat`, `assertIdempotent`, `assertParses`, `wouldChange`.
- `tests/diff.test.ts` — Unit tests for diff utilities.
- `tests/corpus/` — 12 input/expected fixture pairs covering classes, functions, blocks, control flow, enums, literals, operators, comments, preprocessor, indentation edge cases, and inherit/import.
- `tests/formatter.test.ts` rewritten with real formatter tests (71 tests, 0 skips).
- `--check` mode — exit non-zero if files need formatting.
- `--diff` mode — show unified diff of changes.
- `--list` mode — list files that would be changed.
- `-w`/`--write` mode — in-place file editing.
- Directory recursion — find all `.pike` files recursively.
- **Phase 3: Trailing whitespace removed** from every line of output.
- **Phase 3: Blank line normalization** — runs of 3+ blank lines within content collapsed to 1.
- **Phase 4 (experimental): Operator spacing** — `operatorSpacing: true` option enables spaces around binary operators, commas, and ternary expressions. Disabled by default.

### Changed

- `src/formatter.ts` restructured: single canonical `INDENT_NODES` set, depth-first tree walk, single-line class body detection, same-line brace detection, Phase 3 whitespace normalization.
- `src/cli.ts` imports `Parser` as named export (web-tree-sitter 0.26.8 breaking change).
- `package.json` version bumped to `0.1.0`.

### Technical

- Phase 1 scope: indentation normalization only. Brace position preserved from input. Closing braces on their own line keep tree-assigned indent.
- Phase 3 scope: indentation + whitespace normalization.
- Phase 4 scope: indentation + whitespace + operator spacing normalization (experimental, disabled by default).