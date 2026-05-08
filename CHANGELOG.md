# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [0.1.4] — 2026-05-08

### Added

- **`.pmod` file extension support.** `findPikeFiles()` and `isPikeFile()` now discover and format `.pmod` files alongside `.pike` and `.lpc` (#17).
- **`--wasm-path` flag and `PIKE_FMT_WASM` env var.** Allows users to override the tree-sitter-pike.wasm search path from the CLI or environment (#16).


## [0.1.2] — 2026-05-05

### Added

- **`.github/workflows/publish.yml`** — automated npm publish on GitHub release via CI.


## [0.1.1] — 2026-05-05

### Fixed

- **Closing brace indentation now uses AST-driven approach.** Replaced regex-based closing-brace detection in both `format()` and `computeLineIndents()` with structural knowledge: the last line of any INDENT_NODE is at the outer indent level. This naturally handles `}`, `};`, `})`, `});`, and future compound closing patterns without needing regex updates.


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
