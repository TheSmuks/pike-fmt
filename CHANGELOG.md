# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

## [0.1.9] — 2026-07-07

### Performance

- **Formatting is now linear time.** Large files were formatted in quadratic time — a ~17k-line file took ~6.6s. The dominant cost was re-splitting the entire source into lines on every node visited during the recursive indent walk (86.8% of runtime by profile). The source is now split once and the line array threaded through the walk. The same file now formats in ~335ms (≈20× faster), and time scales linearly with input size. Output is byte-identical.
- **Shared indent accumulator.** The indent walk allocated a fresh `Map` per node and copied every descendant's entries upward through each nesting level (O(lines × depth)). Nodes now write directly into a single shared map.
- **Skip the redundant stabilization pass.** `format` ran a second full re-parse pass on every input to confirm idempotency. Because the only single-pass non-idempotency is an `else` merged onto a preceding block's closing `}`, that confirmation pass is now skipped whenever no such merge occurred — roughly halving the common-path cost while preserving the `format(format(x)) === format(x)` guarantee.

## [0.1.8] — 2026-07-07

### Fixed

- **`--operator-spacing` CLI flag.** The flag was parsed but discarded (`toFormatOpts` hardcoded `operatorSpacing: false`), so operator spacing never ran from the CLI. It is now wired through.
- **Operator spacing preserved indentation.** Operator-bearing lines were rebuilt from tree-sitter tokens, which carry no leading whitespace, so their indentation was lost. The line's indent is now captured and reapplied.
- **Inline case bodies.** `case 1: write("a"); break;` no longer over-indents the label — a case/default label leads its line and keeps its own indent even with inline statements following it.
- **Inline `else` bodies.** `else c();` on one line no longer receives an extra indent level; the line is led by `else` and stays aligned with its `if`.
- **Comment contents preserved.** Internal whitespace inside `//` and `/* */` comments is no longer collapsed. Previously `//  x` became `// x`, and comments containing quotes produced non-idempotent output.
- **Block-comment alignment.** Continuation lines of `*`-styled block comments realign one space under the opening `/*` instead of being flattened to the base indent; other comment/string interiors are preserved verbatim.
- **Multi-line string literals preserved.** String contents (whitespace, tabs) are no longer altered; continuation rows of multi-line strings are emitted verbatim.
- **Multi-line `#define` macros.** The head line's alignment before a trailing `\` is preserved instead of being collapsed.
- **Idempotency with tabs.** Runs of tabs (or mixed tabs/spaces) outside strings now collapse to a single space in one pass. Previously `"x"\t\t: y` became two spaces on the first pass and one on the second (non-idempotent).
- **Idempotency for nested brace-optional `if/else`.** `format` now runs its pass to a fixed point, so output is always idempotent (`format(format(x)) === format(x)`). A few deeply nested forms — where a block-closing `}` is merged onto an outer statement's `else` — previously needed a manual second pass to settle. Verified across 460 Pike stdlib files (0 non-idempotent, down from 25).
- **Parse tree memory leak.** Each formatting pass now frees its web-tree-sitter parse tree (and the per-line trees used for operator spacing). Previously trees leaked WASM memory, which could exhaust the heap in the long-running LSP or when formatting many files in one process.

### Changed

- **README conventions.** Corrected the "Formatting Conventions" section, which listed a "space after `//`" rule that was never implemented and a "no space before `(`" rule that only applies to calls under `--operator-spacing`.
- **Removed dead code.** Dropped the unused `NO_SPACE_AFTER` constant.

### Notes

- The fixed-point loop is a pragmatic guard around the current line-based indent model; the principled fix (as in rustfmt/gofmt/prettier) is to emit formatted text directly from the parse tree. Formatting the largest stdlib file (~3400 lines) takes ~0.8 s — acceptable interactively, but the underlying pass has a known `O(n²)` hot spot (`source.split("\n")` inside the indent recursion) worth addressing separately.

## [0.1.7] — 2026-06-05

### Fixed

- **Nested switch indentation.** `case` and `default` bodies now indent one level deeper than their labels, including nested switches and case blocks moved or pasted without indentation.
- **Split control-flow continuation indentation.** Multi-line `if` conditions now keep continuation lines indented instead of resetting `b) {` to the header indent.
- **Same-line else normalization.** A block-closing `}` followed by `else` on the next line is normalized to `} else {`.

## [0.1.6] — 2026-05-29

### Fixed

- **Bare-body control flow indentation.** `if`/`else`, `for`, `while`, `do`/`while`, `foreach` without curly braces now correctly indent their body statement one level deeper than the keyword. Previously the body was at the same indent as the keyword.
- **`else if` chain indentation.** `else if(...)` stays at the same level as the parent `else`, while its body indents correctly.
- **Preprocessor fixture.** Corrected `preprocessor.expected.pike` which had a spurious 2-space indent on the closing brace.

### Added

- **Switch-case test coverage.** Added dedicated `switch case` describe block to test suite (was previously only covered by idempotency sweep).
- **Bare-body control flow corpus.** Added `bare-body.pike` fixture covering if/else without braces.

## [0.1.4] — 2026-05-08

### Fixed

- **tree-sitter-pike.wasm now included in npm package.** Fixed `.npmignore` to prevent gitignore patterns from filtering `dist/tree-sitter-pike.wasm`.

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
