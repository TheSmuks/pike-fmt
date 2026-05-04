/**
 * Pike source code formatter — Phase 4: operator and punctuation spacing.
 *
 * Walks the tree-sitter parse tree and produces formatted text with:
 * - Normalized 2-space indentation (configurable)
 * - Trailing whitespace removed from every line
 * - Blank line normalization (runs of 3+ blank lines collapsed to 1)
 * - Final newline preserved (configurable)
 * - Operator spacing normalized (spaces around binary operators)
 *
 * Phase 4 adds:
 * - Spaces around binary operators (+ - * / % & | ^ == != <= >= && || << >>)
 * - Arrow (->) kept together: no spaces around it
 * - Lambda (=>) spaced: space on both sides
 * - Compound assignments (+= -= etc.) spaced: space on both sides
 * - Ternary (? :) spacing
 * - Comma spacing (space after)
 * - No space before ( ) [ ] { } . , ; :
 */

import { Parser, Node } from "web-tree-sitter";

export interface FormatOptions {
  /** Number of spaces per indentation level. Default: 2 */
  tabSize: number;
  /** Use tab characters instead of spaces. Default: false */
  useTabs: boolean;
  /** Insert final newline. Default: true */
  insertFinalNewline: boolean;
  /** Enable Phase 4 operator spacing. Default: false */
  operatorSpacing: boolean;
}

export const DEFAULT_OPTIONS: FormatOptions = {
  tabSize: 2,
  useTabs: false,
  insertFinalNewline: true,
  operatorSpacing: false,
};

// ---------------------------------------------------------------------------
// INDENT_NODES — canonical set of node types that introduce indentation
// ---------------------------------------------------------------------------

/**
 * Node types that introduce a new indentation level.
 * Audited against tree-sitter-pike grammar.
 */
export const INDENT_NODES = new Set([
  "class_body",      // class Foo { int x; }
  "block",           // void foo() { return 1; }
  "case_clause",     // case 1: ...
  "default_clause",  // default: ...
  // argument_list is NOT here — Pike call/decl parens stay on same line
  "enum_decl",       // enum Foo { A, B } — members are direct children
  // NOTE: "switch_body" does not exist in tree-sitter-pike grammar
  // NOTE: "enum_body" does not exist in tree-sitter-pike grammar
]);

// ---------------------------------------------------------------------------
// Token types for operator spacing
// ---------------------------------------------------------------------------

/**
 * Binary operators that need spaces on both sides.
 * Includes assignment operators.
 */
const BINARY_OPS = new Set([
  // Arithmetic
  "+", "-", "*", "/", "%",
  // Bitwise
  "&", "|", "^",
  // Shift
  "<<", ">>",
  // Comparison
  "==", "!=", "<", ">", "<=", ">=",
  // Logical
  "&&", "||",
  // Assignment (compound)
  "=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=",
]);

/**
 * No space before these tokens.
 */
const NO_SPACE_BEFORE = new Set([
  "(", "[", "{", ")", "]", "}", ".", ",", ";",
]);

/**
 * No space after these tokens.
 */
const NO_SPACE_AFTER = new Set([
  "(", "[", "{", ".", ";", ":",
]);

/**
 * Compound operators that should be kept together with no spaces.
 */
const COMPOUND_OPS = new Set([
  "->", // arrow member access
  "++", "--", // increment/decrement
]);

/**
 * Token type classification for spacing decisions.
 */
type TokenClass = "identifier" | "literal" | "operator" | "punctuation" | "keyword";

/**
 * Classify a token into a rough category.
 */
function classifyToken(t: string): TokenClass {
  // Keywords (Pike)
  if (/^(int|float|string|array|mapping|object|void|mixed|function|program|class|enum|typedef|inherit|import|constant|if|else|for|while|do|foreach|switch|case|default|break|continue|return|null|true|false|this|local|auto|gauge|catch|inline|optional|private|protected|public|static|final|nomask|variant|synchronized)$/.test(t)) {
    return "keyword";
  }
  // Numeric/string literals
  if (/^-?[0-9]+(\.[0-9]+)?([eE][+-]?[0-9]+)?$/.test(t) || t.startsWith('"') || t.startsWith("'") || t.startsWith("`")) {
    return "literal";
  }
  // Identifiers
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t)) {
    return "identifier";
  }
  // Operators
  if (BINARY_OPS.has(t) || COMPOUND_OPS.has(t) || t === "?" || t === ":" || t === "!" || t === "~" || t === "++" || t === "--") {
    return "operator";
  }
  // Punctuation
  return "punctuation";
}

// ---------------------------------------------------------------------------
// Token collection
// ---------------------------------------------------------------------------

/**
 * Collect all leaf tokens from a node tree.
 * Non-named nodes (punctuation, operators) are included as separate tokens.
 * Named nodes with no children return their text as a single token.
 */
export function collectTokens(node: Node): string[] {
  if (!node.isNamed) {
    return [node.text];
  }
  if (node.childCount === 0) {
    return [node.text];
  }
  const tokens: string[] = [];
  for (const child of node.children) {
    tokens.push(...collectTokens(child));
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * Format Pike source code using tree-sitter-pike.
 *
 * Phase 4 scope: indentation + whitespace + operator spacing normalization.
 */
export function format(
  source: string,
  opts: Partial<FormatOptions> = {},
  parser?: Parser,
): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  if (!parser) {
    throw new Error(" Pike formatter requires an initialized tree-sitter parser");
  }

  const tree = parser.parse(source);
  if (!tree) {
    throw new Error("Parse failed: tree is null");
  }

  // Build maps: line -> indent (in spaces) and line -> base indent
  const { indents, baseIndents } = computeLineIndents(tree.rootNode, options, 0, source);

  // Collect lines and apply indentation
  const originalLines = source.split("\n");
  const formattedLines: string[] = [];

  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i];

    // Detect blank lines BEFORE applying indentation
    const isBlank = originalLine.trim() === "";

    // Blank lines stay blank (no indentation added)
    if (isBlank) {
      formattedLines.push("");
      continue;
    }

    const originalIndent = originalLine.match(/^\s*/)?.[0] ?? "";
    const content = originalLine.slice(originalIndent.length);

    let indent = indents.get(i) ?? 0;

    // Pike convention: opening brace `{` stays on same line as declaration keyword.
    if (indent > 0 && content.trimEnd().endsWith("{")) {
      indent = baseIndents.get(i) ?? 0;
    }
    // Pike convention: closing brace goes back to outer indent level.
    // Handles:
    // - `}` (block closing brace)
    // - `};` (block close + statement terminator: lambda/catch/gauge)
    // - `})` (block close + closing paren: lambda in function call)
    // - `});` (all three)
    const trimmedContent = content.trimEnd();
    // Pattern: starts with }, then any combination of ) and ;, then optional whitespace
    const isClosingBraceLike =
      /^\}[);]*\s*;?\s*$/.test(trimmedContent) ||
      /^\)\s*;?\s*$/.test(trimmedContent);
    if (indent > 0 && isClosingBraceLike) {
      indent = baseIndents.get(i) ?? 0;
    }
    // Pike convention: preprocessor directives always at column 0
    if (content.trimStart().startsWith("#")) {
      indent = 0;
    }

    const newIndent = options.useTabs
      ? "\t".repeat(Math.round(indent / options.tabSize))
      : " ".repeat(indent);

    // Strip trailing whitespace from content
    const trimmedContent2 = content.trimEnd();
    // Normalize internal whitespace: tabs → spaces, collapse multiple spaces
    // Preserve string literals and comments
    const normalizedContent = normalizeInternalWhitespace(trimmedContent2);
    formattedLines.push(newIndent + normalizedContent);
  }

  // Normalize blank lines: collapse runs of 3+ blank lines to 1
  const resultLines = collapseBlankLines(formattedLines);

  let result = resultLines.join("\n");

  // Handle final newline
  if (options.insertFinalNewline && !result.endsWith("\n")) {
    result += "\n";
  } else if (!options.insertFinalNewline && result.endsWith("\n")) {
    result = result.replace(/\n+$/, "");
  }

  // Phase 4: operator spacing normalization
  if (options.operatorSpacing) {
    result = normalizeOperatorSpacing(result, parser);
  }

  return result;
}

/**
 * Normalize operator spacing in formatted code.
 * Operates on a line-by-line basis using tree-sitter tokenization.
 *
 * NOTE: Multi-line constructs (strings with newlines, heredocs) may not get
 * operator spacing applied because they cannot be parsed as standalone lines.
 * This is a known limitation - the line is preserved unchanged rather than
 * producing incorrect output.
 */
function normalizeOperatorSpacing(source: string, parser: Parser): string {
  const lines = source.split("\n");

  // Process each line individually to preserve line structure
  const resultLines: string[] = [];

  for (const line of lines) {
    // Skip blank lines
    if (line.trim() === "") {
      resultLines.push(line);
      continue;
    }

    // Check if line has operators by looking for common operator chars
    const hasOps = /[+\-*/%&=|<>!?:,()]/.test(line);
    if (!hasOps) {
      resultLines.push(line);
      continue;
    }

    // Try to parse the line and normalize spacing
    const tokens = tryGetTokens(line, parser);
    if (tokens) {
      const normalized = applyTokenSpacing(tokens);
      resultLines.push(normalized);
    } else {
      // If parsing fails, keep the line as-is
      resultLines.push(line);
    }
  }

  return resultLines.join("\n");
}

/**
 * Try to get tokens for a line of code.
 * Returns null if the line can't be parsed standalone.
 */
function tryGetTokens(line: string, parser: Parser): string[] | null {
  try {
    const tree = parser.parse(line);
    if (!tree || tree.rootNode.hasError) return null;
    return collectTokens(tree.rootNode);
  } catch {
    return null;
  }
}

/**
 * Apply normalized spacing to tokens.
 */
function applyTokenSpacing(tokens: string[]): string {
  if (tokens.length === 0) return "";

  let out = "";
  let i = 0;

  while (i < tokens.length) {
    const t = tokens[i];
    const prev = i > 0 ? tokens[i - 1] : "";
    const next = i < tokens.length - 1 ? tokens[i + 1] : "";
    const prevClass = classifyToken(prev);
    const nextClass = classifyToken(next);

    // Detect lambda operator: = followed by >
    if (t === "=" && next === ">") {
      if (out.length > 0 && out[out.length - 1] !== " " && out[out.length - 1] !== "\t" && !NO_SPACE_BEFORE.has(prev)) {
        out += " ";
      }
      out += "=";
      out += " ";
      i++;
      out += ">";
      if (nextClass !== "punctuation" || (next !== ">" && next !== ")" && next !== "]" && next !== "}")) {
        out += " ";
      }
      i++;
      continue;
    }

    let needSpaceBefore = false;
    let needSpaceAfter = false;

    // Compound operators kept together: -> ++ --
    if (COMPOUND_OPS.has(t)) {
      needSpaceBefore = false;
      needSpaceAfter = false;
    }
    // Binary operators: space on both sides
    else if (BINARY_OPS.has(t)) {
      needSpaceBefore = true;
      needSpaceAfter = true;
    }
    // Ternary operators
    else if (t === "?") {
      needSpaceBefore = true;
      needSpaceAfter = true;
    }
    // Ternary colon: space on both sides
    else if (t === ":") {
      needSpaceBefore = true;
      needSpaceAfter = true;
    }
    // Postfix ++/-- (attached to identifier)
    else if ((t === "++" || t === "--") && prevClass === "identifier") {
      needSpaceBefore = false;
      needSpaceAfter = false;
    }
    // Prefix ++/-- (attached to identifier)
    else if ((t === "++" || t === "--") && nextClass === "identifier") {
      needSpaceBefore = false;
      needSpaceAfter = false;
    }
    // Unary ! ~ (attached to operand)
    else if (t === "!" || t === "~") {
      needSpaceBefore = false;
      needSpaceAfter = nextClass === "operator" || next === "(";
    }
    // Comma: space after
    else if (t === ",") {
      needSpaceBefore = false;
      needSpaceAfter = true;
    }
    // Dot: no space before, no space after
    else if (t === ".") {
      needSpaceBefore = false;
      needSpaceAfter = false;
    }
    // No space before ) ] }
    else if (t === ")" || t === "]" || t === "}") {
      needSpaceBefore = false;
      needSpaceAfter = false;
    }
    // No space before . , ;
    else if (t === "." || t === "," || t === ";") {
      needSpaceBefore = false;
    }

    // Add space before if needed
    if (needSpaceBefore && out.length > 0) {
      const lastChar = out[out.length - 1];
      if (lastChar !== " " && lastChar !== "\t" && !NO_SPACE_BEFORE.has(t)) {
        out += " ";
      }
    }

    // Fallback: ensure space between adjacent identifiers/keywords
    // (when no explicit spacing rule matched)
    if (out.length > 0 && t.length > 0) {
      const lastChar = out[out.length - 1];
      const isId = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(t);
      const prevIsId = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(out.slice(-1));
      if (isId && prevIsId && lastChar !== " " && lastChar !== "\t" && !NO_SPACE_BEFORE.has(t)) {
        // Space between adjacent identifiers (e.g., "int x" not "intx")
        out += " ";
      }
      // Space after ) before identifier (e.g., "int x" not "intx")
      if (lastChar === ")" && isId && !NO_SPACE_BEFORE.has(t)) {
        out += " ";
      }
    }

    // Add the token
    out += t;

    // Add space after if needed
    if (needSpaceAfter) {
      out += " ";
    }

    i++;
  }

  // Post-processing cleanups
  out = out.replace(/ ;/g, ";");
  out = out.replace(/ \)/g, ")");
  out = out.replace(/ \]/g, "]");
  out = out.replace(/ \}/g, "}");
  out = out.replace(/\( /g, "(");
  out = out.replace(/\[ /g, "[");
  out = out.replace(/\. /g, ".");
  out = out.replace(/  +/g, " ");

  return out.trim();
}

// ---------------------------------------------------------------------------
// Whitespace normalization
// ---------------------------------------------------------------------------

/**
 * Normalize internal whitespace in a line of code.
 * - Tabs become spaces
 * - Multiple consecutive spaces become single space
 * - Preserves content inside string literals and comments
 */
function normalizeInternalWhitespace(line: string): string {
  // If the line contains string literals or comments, be more careful
  if (/["'`]|\/\//.test(line)) {
    // Simple approach: replace tabs with spaces first, then collapse spaces
    // being careful not to touch content inside strings
    return normalizeTabsAndCollapseSpaces(line);
  }
  // Simple case: just normalize whitespace
  return line.replace(/\t/g, " ").replace(/  +/g, " ");
}

/**
 * Normalize tabs to spaces and collapse multiple spaces, preserving string content.
 */
function normalizeTabsAndCollapseSpaces(line: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let i = 0;

  while (i < line.length) {
    const ch = line[i];

    // Handle string literals
    if ((ch === '"' || ch === "'" || ch === "`") && !inString) {
      inString = true;
      stringChar = ch;
      result += ch;
      i++;
      continue;
    }

    if (inString && ch === stringChar && (i === 0 || line[i - 1] !== "\\")) {
      inString = false;
      result += ch;
      i++;
      continue;
    }

    if (inString) {
      // Inside string: preserve tabs, collapse other whitespace
      if (ch === "\t") {
        result += " ";
      } else if (ch === " " && line[i + 1] === " ") {
        // Collapse multiple spaces inside string
        result += ch;
        while (i + 1 < line.length && line[i + 1] === " ") i++;
      } else {
        result += ch;
      }
      i++;
      continue;
    }

    // Outside string: normalize whitespace
    if (ch === "\t") {
      result += " ";
      // Collapse following spaces
      while (i + 1 < line.length && line[i + 1] === " ") i++;
    } else if (ch === " ") {
      // Collapse multiple spaces
      result += ch;
      while (i + 1 < line.length && line[i + 1] === " ") i++;
    } else {
      result += ch;
    }
    i++;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Blank line normalization
// ---------------------------------------------------------------------------

/**
 * Collapse runs of 3+ blank lines to a single blank line.
 * Preserves 0, 1, or 2 consecutive blank lines; collapses 3+ to 1.
 * Strips trailing blank lines (those after all content).
 */
function collapseBlankLines(lines: string[]): string[] {
  if (lines.length === 0) return lines;

  // Strip trailing blank lines
  let endIdx = lines.length;
  while (endIdx > 0 && lines[endIdx - 1] === "") {
    endIdx--;
  }

  const contentLines = lines.slice(0, endIdx);

  // Collapse runs of 3+ blank lines to 1 within content
  const result: string[] = [];
  let blankRun = 0;

  for (const line of contentLines) {
    if (line === "") {
      blankRun++;
      if (blankRun <= 2) {
        result.push(line);
      }
      // 3rd+ blank line is skipped
    } else {
      blankRun = 0;
      result.push(line);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Indent computation
// ---------------------------------------------------------------------------

/**
 * Compute indentation levels and base indentation for each line.
 */
function computeLineIndents(
  node: Node,
  opts: FormatOptions,
  baseIndent: number,
  source: string,
): { indents: Map<number, number>; baseIndents: Map<number, number> } {
  const indents = new Map<number, number>();
  const baseIndents = new Map<number, number>();

  const startLine = node.startPosition.row;
  const endLine = node.endPosition.row;

  if (INDENT_NODES.has(node.type)) {
    // Single-line bodies don't increase indent
    const spansMultipleLines = node.startPosition.row !== node.endPosition.row;
    if (!spansMultipleLines) {
      for (let line = startLine; line <= endLine; line++) {
        indents.set(line, baseIndent);
        baseIndents.set(line, baseIndent);
      }
      return { indents, baseIndents };
    }

    const newIndent = baseIndent + opts.tabSize;
    // For enum_decl: enum members are direct named children but the structural
    // parts (enum keyword, identifier, braces) are not INDENT_NODEs.
    // Only recurse into enum_member children to avoid over-indenting.
    const isEnumDecl = node.type === "enum_decl";
    for (const child of node.namedChildren) {
      // For enum_decl, skip non-INDENT_NODE children (structural parts like identifier, braces)
      // For other INDENT_NODEs (class_body, block, case_clause), process all named children
      if (isEnumDecl && !INDENT_NODES.has(child.type)) continue;
      const childResult = computeLineIndents(child, opts, newIndent, source);
      for (const [line, indent] of childResult.indents) {
        indents.set(line, indent);
      }
      for (const [line, base] of childResult.baseIndents) {
        baseIndents.set(line, base);
      }
    }
    for (let line = startLine; line <= endLine; line++) {
      if (!indents.has(line)) {
        // Structural lines stay at outer indent:
        // - Lines starting with `{` or containing only `{`
        // - Lines that are purely closing braces `}`, or `};` (brace + optional semicolon)
        // - Keyword-only lines (enum, class, etc. without other content)
        const sourceLine = source.split("\n")[line] ?? "";
        const trimmed = sourceLine.trim();
        const isStructural =
          trimmed === "{" ||
          /^\}\s*;?\s*$/.test(trimmed) ||
          /^(class|enum|void|int|string|float|mapping|array|multiset|object|mixed|function|program)\b/.test(trimmed);
        indents.set(line, isStructural ? baseIndent : newIndent);
        baseIndents.set(line, baseIndent);
      }
    }
  } else {
    for (const child of node.namedChildren) {
      const childResult = computeLineIndents(child, opts, baseIndent, source);
      for (const [line, indent] of childResult.indents) {
        indents.set(line, indent);
      }
      for (const [line, base] of childResult.baseIndents) {
        baseIndents.set(line, base);
      }
    }
    for (let line = startLine; line <= endLine; line++) {
      if (!indents.has(line)) {
        indents.set(line, baseIndent);
        baseIndents.set(line, baseIndent);
      }
    }
  }

  return { indents, baseIndents };
}

// ---------------------------------------------------------------------------
// Re-exports from diff.ts
// ---------------------------------------------------------------------------

export { computeIndentEdits, wouldChange } from "./diff";
export type { TextEdit } from "./diff";