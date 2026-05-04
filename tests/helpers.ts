/**
 * Test harness for pike-fmt formatter tests.
 *
 * Loads tree-sitter-pike once and provides a `formatTest(input, expected)`
 * helper that runs the real formatter and asserts correct output.
 */

import { Parser, Language } from "web-tree-sitter";
import { format, FormatOptions } from "../src/formatter";

let parser: Parser;
let initialized = false;

const WASM_PATHS = [
  "/tank/appdata/pike-dev/projects/pike-fmt/tree-sitter-pike.wasm",
  "/tank/appdata/pike-dev/projects/tree-sitter-pike/tree-sitter-pike.wasm",
];

async function getParser(): Promise<Parser> {
  if (initialized) return parser;

  await Parser.init();
  parser = new Parser();

  for (const wasmPath of WASM_PATHS) {
    try {
      const lang = await Language.load(wasmPath);
      parser.setLanguage(lang);
      initialized = true;
      return parser;
    } catch {
      // Try next path
    }
  }

  throw new Error(
    `tree-sitter-pike.wasm not found in any of: ${WASM_PATHS.join(", ")}`
  );
}

/**
 * Format source code using the real formatter and return the result.
 */
export async function formatSource(
  source: string,
  opts: Partial<FormatOptions> = {}
): Promise<string> {
  const p = await getParser();
  return format(source, opts, p);
}

/**
 * Assert that formatting `input` produces exactly `expected`.
 * Throws on mismatch with a descriptive error.
 */
export async function assertFormat(
  input: string,
  expected: string,
  opts: Partial<FormatOptions> = {}
): Promise<void> {
  const result = await formatSource(input, opts);

  if (result !== expected) {
    const inputLines = input.split("\n");
    const expectedLines = expected.split("\n");
    const resultLines = result.split("\n");

    const maxLen = Math.max(inputLines.length, expectedLines.length, resultLines.length);
    let msg = `Format mismatch:\n`;

    for (let i = 0; i < maxLen; i++) {
      const inLine = JSON.stringify(inputLines[i] ?? "");
      const expLine = JSON.stringify(expectedLines[i] ?? "");
      const resLine = JSON.stringify(resultLines[i] ?? "");

      if (expLine !== resLine) {
        msg += `  Line ${i}: input=${inLine}\n`;
        msg += `          expected=${expLine}\n`;
        msg += `          got=${resLine}\n`;
      }
    }

    throw new Error(msg);
  }
}

/**
 * Assert that formatting `input` is idempotent (formatting the result
 * produces the same output).
 */
export async function assertIdempotent(
  source: string,
  opts: Partial<FormatOptions> = {}
): Promise<void> {
  const first = await formatSource(source, opts);
  const second = await formatSource(first, opts);

  if (first !== second) {
    throw new Error(
      `Idempotency failure:\n  First format:\n${first}\n  Second format:\n${second}`
    );
  }
}

/**
 * Assert that formatting `input` produces output that parses without errors.
 */
export async function assertParses(
  source: string,
  opts: Partial<FormatOptions> = {}
): Promise<void> {
  const p = await getParser();
  const formatted = await formatSource(source, opts);
  const tree = p.parse(formatted);

  if (tree.rootNode.hasError) {
    throw new Error(
      `Formatted output has parse errors:\n${formatted}\n\nParse tree:\n${tree.rootNode.toString()}`
    );
  }
}

/**
 * Format with check mode: returns true if formatting would change the source.
 */
export async function wouldChange(
  source: string,
  opts: Partial<FormatOptions> = {}
): Promise<boolean> {
  const result = await formatSource(source, opts);
  return source !== result;
}
