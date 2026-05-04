# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]


### Fixed

- `src/formatter.ts` — Fixed string escape handling: count consecutive backslashes before quote to properly detect escaped vs unescaped quotes (Bug 1).
- `src/formatter.ts` — Fixed tab preservation inside strings: tabs are now preserved as-is, not converted to spaces (Bug 2).
- `src/formatter.ts` — Added missing comparison operators (<, >) to BINARY_OPS set for proper operator spacing.
- `src/formatter.ts` — Fixed space handling after closing parenthesis to properly space before following identifiers.
- `src/formatter.ts` — Fixed classifyToken to include all Pike keywords (gauge, catch, inline, optional, private, protected, public, static, final, nomask, variant, synchronized).
- `src/cli.ts` — Rewrote simpleDiff with LCS-based algorithm for proper diff alignment when files have different line counts.
- `tests/corpus/input/indent.pike` — Fixed foreach syntax to match tree-sitter-pike grammar (array first, then value).
- `tests/corpus/input/indent.expected.pike` — Updated to match grammar-corrected foreach syntax.

### Added

- `--operator-spacing` CLI flag to enable Phase 4 operator spacing normalization.
- Regression tests for string escape handling and tab preservation inside strings.
- `assertParses` tests added to all 13 corpus test groups.
- Proper operator-spacing corpus with spaced and unspaced test cases.
- `tests/corpus/input/edge.pike` populated with real edge cases (single-char lines, long lines, mixed quotes, tabs in strings, etc.).
- `tests/corpus/input/lambda.pike` and `.expected.pike` for lambda expression coverage.
- `tests/corpus/input/complex-types.pike` and `.expected.pike` for complex type coverage.
- New inline tests for operator spacing behavior with `operatorSpacing: true` option.
- Documented Phase 4 limitation: normalizeOperatorSpacing uses line-by-line parsing; multi-line constructs are preserved unchanged rather than producing incorrect output.

### Changed

- `src/diff.ts` — Updated comment to reflect Phase 1-3 scope (indentation-only).
- `tests/formatter.test.ts` — Reorganized operator spacing tests into dedicated describe block.


## [0.6.0] — 2026-05-02

### Fixed

- `ci.yml` — Removed broken `markdown-links` job (subshell pipe bug caused it to always exit 0 regardless of link check results). Link checking is now handled exclusively by the `audit` job.
- `AGENTS.md` — Fixed CI/CD table: added missing leading pipe on `branch-cleanup.yml` row and blank line after table.
- `AGENTS.md` — Qualified permissions statement (branch-cleanup needs `contents: write`, not all workflows use read-only).
- `AGENTS.md` — Removed extra blank line between Changelog and Template Version sections.

### Changed

- `docs/ci.md` — Added `branch-cleanup.yml` to overview table, trigger model section with YAML example, permissions docs explaining write access, adoption checklist updated to include branch-cleanup.
- `docs/agent-files-guide.md` — Fixed misleading link text (`docs/architecture.md` → `architecture.md spec`) to accurately reflect its external spec URL.

### Added

- `cut-release` skill scripts for automated release workflow.


## [0.7.0] — 2026-05-04

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
- `package.json` version bumped to `0.7.0`.

### Technical

- Phase 1 scope: indentation normalization only. Brace position preserved from input. Closing braces on their own line keep tree-assigned indent.
- Phase 3 scope: indentation + whitespace normalization.
- Phase 4 scope: indentation + whitespace + operator spacing normalization (experimental, disabled by default).



## [0.5.0] — 2026-05-02

### Added

- `.omp/rules/no-placeholders.md` — TTSR rule to catch HTML comment placeholders in template files
- `.omp/rules/changelog-required.md` — Scope-based rule reminding agents to update CHANGELOG.md for user-facing changes
- `.omp/rules/conventional-commits.md` — TTSR rule enforcing conventional commit message format
- `.omp/hooks/pre/protect-main.ts` — Pre-hook blocking direct commits/pushes to protected branches (main, master)
- `.omp/hooks/post/template-compliance-hint.ts` — Post-hook logging audit hints after template-critical file changes
- `.omp/tools/template-audit/index.ts` — Custom tool wrapping audit.sh with structured output for agent consumption
- `.omp/skills/setup/SKILL.md` — Interactive setup skill with multi-step feature selection workflow
- `docs/omp-extensions-guide.md` — Decision guide covering all 6 OMP extension types with examples from this repo

### Changed

- `docs/agent-files-guide.md` — Added Section F: OMP Extensions cross-reference guide
- `docs/agent-files-guide.md` — Renumbered References to Section G
- Internal link paths fixed in documentation files (relative paths corrected)

## [0.4.0] — 2026-05-02

### Added

- `cut-release` skill (`.omp/skills/cut-release/SKILL.md`) — automated release workflow: determine version, update version manifest, validate, commit, create PR, merge, publish GitHub release

## [0.3.0] — 2026-05-02

### Added

- `merge-to-main` skill (`.omp/skills/merge-to-main/SKILL.md`) — automates PR lifecycle: create, monitor CI, fix failures, update checkboxes, merge
- `branch-cleanup.yml` workflow — auto-deletes feature branches after PR is merged

### Changed

- Rewrite `README.md` with template-specific content (replaces empty placeholders)
- Add "Use this template" badge
- `README.md` and `AGENTS.md` updated to mention `merge-to-main` skill

### Fixed

- `branch-cleanup.yml` — requires `contents: write` permission to delete branches via Git refs API

## [0.2.0] — 2026-05-01

### Added

- Split CI into separate workflow files (`ci.yml`, `commit-lint.yml`, `changelog-check.yml`, `blob-size-policy.yml`)
- `docs/ci.md` — CI architecture guide
- Agent exploration section in `ADOPTING.md`
- Template versioning via `.template-version`
- `permissions` and `concurrency` declarations on all workflows
- `docs/agent-files-guide.md` — Practical guide for writing AGENTS.md, ARCHITECTURE.md, and SKILL.md with concrete examples
- Tiger Style reference in AGENTS.md and cross-references in SETUP_GUIDE.md, ADOPTING.md, docs/architecture.md

### Changed

- Updated ADOPTING.md with Tiger Style incorporation requirement for AGENTS.md adaptation
- Updated checkout action to `@v6` in all workflows

### Fixed

- Fetch full history in `blob-size-policy.yml` so `origin/main` resolves
- Fix `stat` command order (Linux before macOS)
- Remove duplicate description field in `feature_request.yml`
- Remove `.omp/agents/.gitkeep` (replaced by example agents)

## [0.1.0] — 2026-04-21

### Added

- `AGENTS.md` for cross-agent project context
- `README.md` with template instructions
- `CHANGELOG.md` (Keep a Changelog format)
- `CONTRIBUTING.md` with conventions and commit guidelines
- `LICENSE` (MIT)
- `.editorconfig` and `.gitignore` for AI/LLM projects
- `.omp/` directory structure (settings, example agents, hooks, tools)
- GitHub issue templates (bug report, feature request), PR template, SECURITY.md
- Placeholder CI workflow with conventional commit linting
- `docs/architecture.md` and root `ARCHITECTURE.md` templates
- Template extension: enhanced `AGENTS.md` (error handling, module size, agent behavior sections)
- Three example agents in `.omp/agents/` (code-reviewer, adr-writer, changelog-updater)
- `CODEOWNERS`, `dependabot.yml`, `.gitattributes`, enhanced PR template
- `.devcontainer/devcontainer.json`
- `docs/decisions/` with ADR template
- `SETUP_GUIDE.md` — LLM bootstrap guide
- `.architecture.yml` code quality thresholds
- `blob-size-policy.yml` GitHub Actions workflow