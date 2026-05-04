# pike-fmt

Standalone Pike source code formatter using tree-sitter-pike. Normalizes indentation,
whitespace, and optionally operator spacing.

## Installation

```bash
bun install
```

## Build

```bash
bun run build
```

## Usage

Format a file and print to stdout:

```bash
bun run src/cli.ts < file.pike
```

Format multiple files in-place (recursive):

```bash
bun run src/cli.ts -w .
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--check` | Exit non-zero if any file needs formatting |
| `--diff` | Show unified diff of changes |
| `--list` | List files that would be changed |
| `-w`, `--write` | Write formatted output in-place |
| `--operator-spacing` | Enable operator spacing normalization (experimental) |

## Formatting Conventions

These conventions define the expected output:

- **2-space indentation** (Pike stdlib convention)
- **Opening brace on same line** as declaration (`class Foo {`, `void create() {`)
- **No space before `(`** in function declarations/calls
- **Space after `//` and `//!`** in comments
- Pike literals `({`, `([`, `(<` are treated as opening brackets

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck
```

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for commit conventions, branch naming, and PR process.

## License

MIT License. See [LICENSE](./LICENSE).