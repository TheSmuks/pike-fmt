/**
 * pike-fmt CLI — Standalone Pike source code formatter.
 *
 * Usage:
 *   pike-fmt [options] [file]
 *   cat file.pike | pike-fmt [options]
 *
 * Options:
 *   --tab-size <n>       Number of spaces per indent level (default: 2)
 *   --use-tabs           Use tab characters instead of spaces
 *   --no-final-newline   Do not ensure file ends with newline
 *   --check              Check if file needs formatting, exit non-zero if so
 *   --diff               Show unified diff of changes
 *   --list               List files that would be changed
 *   --operator-spacing   Enable operator spacing normalization
 *   -w, --write          Write formatted output back to file (in-place)
 *   --wasm-path <path>   Path to tree-sitter-pike.wasm (or set PIKE_FMT_WASM env var)
 *   --help               Show this help message
 *
 * Exit codes:
 *   0  Success (formatted output written, or already formatted with --check)
 *   1  Error (parse failure, I/O error)
 *   2  Invalid arguments
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { Parser } from "web-tree-sitter";
import { format, FormatOptions, DEFAULT_OPTIONS } from "./formatter";

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface CliOpts {
  tabSize: number;
  useTabs: boolean;
  insertFinalNewline: boolean;
  check: boolean;
  diff: boolean;
  list: boolean;
  write: boolean;
  inputPaths: string[];
  operatorSpacing: boolean;
  wasmPath?: string;
}

function parseArgs(argv: string[]): CliOpts {
  const opts: CliOpts = {
    tabSize: DEFAULT_OPTIONS.tabSize,
    useTabs: DEFAULT_OPTIONS.useTabs,
    insertFinalNewline: DEFAULT_OPTIONS.insertFinalNewline,
    check: false,
    diff: false,
    list: false,
    write: false,
    inputPaths: [],
    operatorSpacing: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--tab-size": {
        const num = parseInt(argv[++i], 10);
        if (isNaN(num) || num < 1 || num > 16) {
          console.error("error: --tab-size must be 1-16");
          process.exit(2);
        }
        opts.tabSize = num;
        break;
      }
      case "--use-tabs":
        opts.useTabs = true;
        break;
      case "--no-final-newline":
        opts.insertFinalNewline = false;
        break;
      case "--check":
        opts.check = true;
        break;
      case "--diff":
        opts.diff = true;
        break;
      case "--list":
        opts.list = true;
        break;
      case "-w":
      case "--write":
        opts.write = true;
        break;
      case "--operator-spacing":
        opts.operatorSpacing = true;
        break;
      case "--wasm-path":
        opts.wasmPath = argv[++i];
        break;
      case "--help":
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith("-")) {
          console.error(`error: unknown option: ${arg}`);
          process.exit(2);
        }
        opts.inputPaths.push(arg);
    }
  }

  if (opts.inputPaths.length === 0 && (opts.check || opts.diff || opts.list || opts.write)) {
    console.error("error: --check/--diff/--list/--write requires a file or directory argument");
    process.exit(2);
  }

  return opts;
}

function printHelp(): void {
  console.log(`pike-fmt ${getVersion()}
Standalone Pike source code formatter using tree-sitter-pike.

Usage: pike-fmt [options] [file]
       cat file.pike | pike-fmt [options]
       pike-fmt --check [file...]
       pike-fmt --diff [file...]
       pike-fmt -w [file...]

Options:
  --tab-size <n>       Number of spaces per indent level (default: 2)
  --use-tabs           Use tab characters instead of spaces
  --no-final-newline   Do not ensure file ends with newline
  --check              Check if file needs formatting, exit non-zero if so
  --diff               Show unified diff of changes
  --list               List files that would be changed
  -w, --write          Write formatted output back to file (in-place)
  --wasm-path <path>   Path to tree-sitter-pike.wasm (or set PIKE_FMT_WASM env var)
  --help               Show this help message

Exit codes:
  0  Success — formatted output written to stdout, or file is formatted (--check)
  1  Error — parse failure, I/O error, or formatting needed (with --check)
  2  Invalid arguments
Supported file extensions: .pike, .lpc, .pmod
`);
}

function getVersion(): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "../package.json"), "utf8"));
    return pkg.version;
  } catch {
    return "0.7.0";
  }
}

// ---------------------------------------------------------------------------
// Tree-sitter-pike initialization
// ---------------------------------------------------------------------------

let parser: Parser;
let initialized = false;

async function initParser(wasmPathOverride?: string): Promise<void> {
  if (initialized) return;
  await Parser.init();
  parser = new Parser();

  let wasmPath: string | undefined;

  // 1. Explicit --wasm-path flag
  if (wasmPathOverride) {
    wasmPath = wasmPathOverride;
  }

  // 2. PIKE_FMT_WASM environment variable
  if (!wasmPath && process.env.PIKE_FMT_WASM) {
    wasmPath = process.env.PIKE_FMT_WASM;
  }

  // 3. Search paths
  if (!wasmPath) {
    const searchPaths = [
      path.join(__dirname, "..", "tree-sitter-pike.wasm"),
      path.join(__dirname, "tree-sitter-pike.wasm"),
      path.join(__dirname, "..", "..", "tree-sitter-pike.wasm"),
      path.join(process.cwd(), "tree-sitter-pike.wasm"),
    ];

    for (const p of searchPaths) {
      try {
        fs.accessSync(p, fs.constants.R_OK);
        wasmPath = p;
        break;
      } catch {
        // Continue searching
      }
    }
  }

  if (!wasmPath) {
    console.error("error: tree-sitter-pike.wasm not found");
    process.exit(1);
  }

  try {
    const { Language } = await import("web-tree-sitter");
    const lang = await Language.load(wasmPath);
    parser.setLanguage(lang);
    initialized = true;
  } catch (err) {
    console.error(`error: failed to load tree-sitter-pike grammar: ${(err as Error).message}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function toFormatOpts(opts: CliOpts): FormatOptions {
  return {
    tabSize: opts.tabSize,
    useTabs: opts.useTabs,
    insertFinalNewline: opts.insertFinalNewline,
    operatorSpacing: opts.operatorSpacing,
  };
}

function formatSource(source: string, opts: CliOpts): string {
  return format(source, toFormatOpts(opts), parser);
}

// ---------------------------------------------------------------------------
// Diff rendering
// ---------------------------------------------------------------------------
/**
 * Compute LCS (Longest Common Subsequence) table for diff.
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  return dp;
}

/**
 * Render a unified-style diff between original and formatted source.
 * Uses LCS-based diff for proper alignment of added/removed lines.
 */
function simpleDiff(
  filePath: string,
  original: string,
  formatted: string,
): string {
  const origLines = original.split("\n");
  const fmtLines = formatted.split("\n");

  // Compute LCS table
  const lcs = computeLCS(origLines, fmtLines);

  // Backtrack to find the diff
  const changes: { type: "keep" | "delete" | "insert"; line: string }[] = [];
  let i = origLines.length;
  let j = fmtLines.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && origLines[i - 1] === fmtLines[j - 1]) {
      changes.unshift({ type: "keep", line: origLines[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      changes.unshift({ type: "insert", line: fmtLines[j - 1] });
      j--;
    } else if (i > 0) {
      changes.unshift({ type: "delete", line: origLines[i - 1] });
      i--;
    }
  }

  // Build the diff output
  const lines: string[] = [];
  lines.push(`--- ${filePath}`);
  lines.push(`+++ ${filePath}`);

  for (const change of changes) {
    if (change.type === "keep") {
      lines.push(` ${change.line}`);
    } else if (change.type === "delete") {
      lines.push(`-${change.line}`);
    } else if (change.type === "insert") {
      lines.push(`+${change.line}`);
    }
  }

  const result = lines.join("\n");
  // Don't emit empty diffs (only header)
  if (result === `--- ${filePath}\n+++ ${filePath}`) return "";
  return result + "\n";
}

// ---------------------------------------------------------------------------
// File processing
// ---------------------------------------------------------------------------

function isPikeFile(filePath: string): boolean {
  return filePath.endsWith(".pike") || filePath.endsWith(".lpc") || filePath.endsWith(".pmod");
}

function findPikeFiles(dirPath: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...findPikeFiles(full));
    } else if (entry.isFile() && isPikeFile(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

function processFile(filePath: string, opts: CliOpts): "changed" | "unchanged" | "error" {
  try {
    const original = fs.readFileSync(filePath, "utf8");
    const formatted = formatSource(original, opts);
    const changed = original !== formatted;

    if (opts.diff) {
      const diff = simpleDiff(filePath, original, formatted);
      if (diff) process.stdout.write(diff);
    }

    if (opts.list) {
      if (changed) process.stdout.write(filePath + "\n");
    } else if (opts.write) {
      if (changed) {
        const tmpPath = filePath + ".pike-fmt-tmp";
        fs.writeFileSync(tmpPath, formatted, "utf8");
        fs.renameSync(tmpPath, filePath);
      }
    } else if (!opts.check) {
      process.stdout.write(formatted);
    }

    return changed ? "changed" : "unchanged";
  } catch (err) {
    console.error(`error: ${filePath}: ${(err as Error).message}`);
    return "error";
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  await initParser(opts.wasmPath);

  // Stdin mode
  if (opts.inputPaths.length === 0) {
    const source = await new Promise<string>((resolve, reject) => {
      let data = "";
      process.stdin.setEncoding("utf8");
      process.stdin.on("data", (chunk) => { data += chunk; });
      process.stdin.on("end", () => resolve(data));
      process.stdin.on("error", reject);
    });

    try {
      const formatted = formatSource(source, opts);
      process.stdout.write(formatted);
      process.exit(0);
    } catch (err) {
      console.error(`error: parse failed: ${(err as Error).message}`);
      process.exit(1);
    }
  }

  // Expand paths
  const allFiles: string[] = [];
  for (const inputPath of opts.inputPaths) {
    const stat = fs.statSync(inputPath);
    if (stat.isDirectory()) {
      allFiles.push(...findPikeFiles(inputPath));
    } else if (stat.isFile() && isPikeFile(inputPath)) {
      allFiles.push(inputPath);
    }
  }

  if (allFiles.length === 0) {
    console.error("error: no Pike files found (.pike, .lpc, .pmod)");
    process.exit(1);
  }

  allFiles.sort();

  let anyChanged = false;
  let anyError = false;

  for (const file of allFiles) {
    const result = processFile(file, opts);
    if (result === "changed") anyChanged = true;
    if (result === "error") anyError = true;
  }

  if (opts.check) {
    process.exit(anyError ? 1 : anyChanged ? 1 : 0);
  } else {
    process.exit(anyError ? 1 : 0);
  }
}

main().catch((err) => {
  console.error(`error: ${(err as Error).message}`);
  process.exit(1);
});
