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
// Control flow node types whose bare (non-block) bodies need extra indent
// ---------------------------------------------------------------------------

/**
 * Node types where the body is a direct named child (not wrapped in block).
 * When the body is an expression_statement or similar non-block child on a
 * different line from the keyword, it needs baseIndent + tabSize.
 */
const CONTROL_FLOW_WITH_BODY = new Set([
  "if_statement",
  "for_statement",
  "while_statement",
  "do_while_statement",
  "foreach_statement",
]);

/**
 * Named child types that constitute a "bare body" — not wrapped in a block.
 * These need indent = parent baseIndent + tabSize when on a different line.
 */
const BARE_BODY_TYPES = new Set([
  "expression_statement",
  "break_statement",
  "continue_statement",
  "return_statement",
  "if_statement",
  "for_statement",
  "while_statement",
  "do_while_statement",
  "foreach_statement",
  "switch_statement",
]);

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

/**
 * Layout for the continuation rows of multi-line leaf tokens (only leaf tokens
 * span multiple lines: block comments and multi-line string/heredoc literals).
 * Their continuation lines must not be re-indented like normal code — doing so
 * destroys block-comment alignment and corrupts string contents.
 *
 * - `starAlign` maps a `*`-prefixed block-comment continuation row to its target
 *   indent, so `/* … *\/` comments realign one space under the opening `/*`.
 * - `verbatim` holds every other continuation row (string interiors, free-form
 *   comment text), emitted exactly as written.
 *
 * The token's first row is excluded; it is positioned like normal code.
 */
interface CommentLayout {
  starAlign: Map<number, number>;
  verbatim: Set<number>;
}

function collectCommentLayout(
  node: Node,
  indents: Map<number, number>,
  source: string,
): CommentLayout {
  const starAlign = new Map<number, number>();
  const verbatim = new Set<number>();
  const lines = source.split("\n");

  const walk = (n: Node): void => {
    if (n.childCount === 0) {
      if (n.endPosition.row > n.startPosition.row) {
        // A block comment is `*`-styled only when its first continuation line
        // opens with `*` (`/*\n * text\n */`). Free-form comments — including
        // ones whose closing `*/` happens to start with `*` — are left verbatim
        // so their layout is preserved.
        const starStyled =
          n.text.startsWith("/*") &&
          (lines[n.startPosition.row + 1]?.trim().startsWith("*") ?? false);
        const base = indents.get(n.startPosition.row) ?? 0;
        for (let r = n.startPosition.row + 1; r <= n.endPosition.row; r++) {
          if (starStyled && (lines[r]?.trim().startsWith("*") ?? false)) {
            starAlign.set(r, base + 1);
          } else {
            verbatim.add(r);
          }
        }
      }
      return;
    }
    for (const child of n.children) walk(child);
  };
  walk(node);
  return { starAlign, verbatim };
}

// ---------------------------------------------------------------------------
// Format
// ---------------------------------------------------------------------------

/**
 * Upper bound on extra formatting passes used to reach a stable (idempotent)
 * result. A single pass settles almost everything; a few brace-optional nested
 * if/else layouts — where a block-closing `}` is merged onto an outer
 * statement's `else` — need one more pass. The bound caps the work and prevents
 * a hang on any hypothetical input that never converges.
 */
const STABILIZE_MAX_PASSES = 4;

/**
 * Format Pike source code using tree-sitter-pike.
 *
 * Runs {@link formatOnce} repeatedly until the output stops changing, so the
 * result is idempotent: `format(format(x)) === format(x)`. The underlying pass
 * is a line-based indent model rather than an AST pretty-printer, so a handful
 * of deeply nested brace-optional if/else forms only settle on a second pass;
 * iterating to a fixed point hides that seam from callers.
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

  let result = formatOnce(source, options, parser);
  for (let pass = 0; pass < STABILIZE_MAX_PASSES; pass++) {
    const next = formatOnce(result, options, parser);
    if (next === result) break;
    result = next;
  }
  return result;
}

/**
 * A single formatting pass: indentation + whitespace normalization, same-line
 * `else` joining, and optional operator spacing.
 */
function formatOnce(
  source: string,
  options: FormatOptions,
  parser: Parser,
): string {
  const tree = parser.parse(source);
  if (!tree) {
    throw new Error("Parse failed: tree is null");
  }

  // Build maps: line -> indent (in spaces) and line -> base indent
  const { indents, baseIndents } = computeLineIndents(tree.rootNode, options, 0, source);

  // Layout for continuation rows of multi-line comments/strings.
  const { starAlign, verbatim } = collectCommentLayout(tree.rootNode, indents, source);

  // Free the parse tree now that the line maps are built. web-tree-sitter trees
  // hold WASM memory that is not garbage-collected; leaking one per pass (and
  // format() runs several) exhausts the heap over a long-lived process or batch.
  tree.delete();

  // Collect lines and apply indentation
  const originalLines = source.split("\n");
  const formattedLines: string[] = [];

  for (let i = 0; i < originalLines.length; i++) {
    const originalLine = originalLines[i];

    // `*`-aligned block-comment continuation: realign under the opening `/*`.
    const starIndent = starAlign.get(i);
    if (starIndent !== undefined) {
      formattedLines.push(" ".repeat(starIndent) + originalLine.trim());
      continue;
    }

    // Other continuation rows of a multi-line comment/string literal are
    // preserved verbatim — no indent, trim, or whitespace normalization.
    if (verbatim.has(i)) {
      formattedLines.push(originalLine);
      continue;
    }

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
    const isContinuation = isContinuationLine(originalLines, i);

    if (isContinuation) {
      indent = continuationIndent(originalLines, indents, options, i);
    }

    // Pike convention: opening brace `{` stays on same line as the statement
    // header. Continuation lines such as `b) {` keep continuation indent.
    if (!isContinuation && indent > 0 && content.trimEnd().endsWith("{")) {
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
    // Preprocessor directives that continue onto the next line (`#define … \`)
    // keep their internal whitespace: the trailing alignment before `\` is
    // intentional, and later macro rows are already preserved verbatim.
    const isMacroHead = content.trimStart().startsWith("#") && trimmedContent2.endsWith("\\");
    // Normalize internal whitespace: tabs → spaces, collapse multiple spaces.
    // String literals and comments are preserved.
    const normalizedContent = isMacroHead
      ? trimmedContent2
      : normalizeInternalWhitespace(trimmedContent2);
    formattedLines.push(newIndent + normalizedContent);
  }

  // Normalize blank lines and same-line else placement after indentation.
  const resultLines = joinElseLines(collapseBlankLines(formattedLines));

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

    // Tree-sitter tokens carry no leading whitespace, so capture the line's
    // indentation and re-apply it to the normalized result. Without this the
    // rebuilt line would lose its indent (operator-bearing lines only).
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const body = line.slice(indent.length);

    // Try to parse the line and normalize spacing
    const tokens = tryGetTokens(body, parser);
    if (tokens) {
      const normalized = applyTokenSpacing(tokens);
      resultLines.push(indent + normalized);
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
  let tree;
  try {
    tree = parser.parse(line);
    if (!tree || tree.rootNode.hasError) return null;
    return collectTokens(tree.rootNode);
  } catch {
    return null;
  } finally {
    // Free the per-line parse tree (operator spacing parses every line).
    tree?.delete();
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
 * Locate the start of a `//` or `/*` comment that is not inside a string or
 * char literal. Returns -1 if the line has no such comment. Backtick is not a
 * string delimiter in Pike (it prefixes operator identifiers such as `` `+ ``),
 * so only `"` and `'` open literals here.
 */
function findCommentStart(line: string): number {
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inString) {
      if (ch === "\\") { i++; continue; }
      if (ch === stringChar) inString = false;
      continue;
    }
    if (ch === '"' || ch === "'") { inString = true; stringChar = ch; continue; }
    if (ch === "/" && (line[i + 1] === "/" || line[i + 1] === "*")) return i;
  }
  return -1;
}

/**
 * Normalize internal whitespace in a line of code.
 * - Tabs become spaces
 * - Multiple consecutive spaces become single space
 * - Content inside string literals and comments is left untouched
 */
function normalizeInternalWhitespace(line: string): string {
  // Preserve comment bodies verbatim: collapsing whitespace inside a comment
  // corrupts alignment (e.g. `//   x`) and is not idempotent when the comment
  // contains quotes. Normalize only the code portion before the comment.
  const commentIdx = findCommentStart(line);
  if (commentIdx >= 0) {
    return normalizeCode(line.slice(0, commentIdx)) + line.slice(commentIdx);
  }
  return normalizeCode(line);
}

/**
 * Normalize whitespace in a fragment that contains code only (no line comment),
 * preserving the contents of string/char literals.
 */
function normalizeCode(fragment: string): string {
  if (/["']/.test(fragment)) {
    return normalizeTabsAndCollapseSpaces(fragment);
  }
  return fragment.replace(/\t/g, " ").replace(/  +/g, " ");
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
      // Inside a string/char literal: preserve contents exactly. Whitespace is
      // significant and must not be collapsed or tab-converted.
      result += ch;
      i++;
      continue;
    }

    // Outside string: collapse any run of whitespace (tabs and/or spaces) to a
    // single space. Skipping only following spaces (not tabs) left `\t\t` as two
    // spaces, which a second pass then collapsed — a non-idempotency.
    if (ch === "\t" || ch === " ") {
      result += " ";
      while (i + 1 < line.length && (line[i + 1] === " " || line[i + 1] === "\t")) i++;
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

/** Join `else` back to a preceding closing block for consistent Pike style. */
function joinElseLines(lines: string[]): string[] {
  const result: string[] = [];
  let line = 0;

  while (line < lines.length) {
    const current = lines[line] ?? "";
    const next = lines[line + 1] ?? "";
    if (current.trim() === "}" && /^\s*else\b/.test(next)) {
      result.push(`${current} ${next.trimStart()}`);
      line += 2;
      continue;
    }
    result.push(current);
    line++;
  }

  return result;
}

/** Detect a line that continues an unmatched parenthesized/bracketed header. */
function isContinuationLine(lines: string[], line: number): boolean {
  if (line === 0) return false;
  const current = (lines[line] ?? "").trimStart();
  if (current === "" || /^[}\])]/.test(current)) return false;

  let balance = 0;
  for (let i = line - 1; i >= 0; i--) {
    const text = stripStringsAndComments(lines[i] ?? "");
    if (i === line - 1 && text.trimEnd().endsWith("{")) return false;
    balance += countChars(text, "(") + countChars(text, "[");
    balance -= countChars(text, ")") + countChars(text, "]");
    if (balance > 0) return true;
    if (balance < 0) return false;
    if (text.trim() === "") return false;
  }
  return false;
}

/** Compute continuation indent from the first unterminated previous line. */
function continuationIndent(
  lines: string[],
  indents: Map<number, number>,
  opts: FormatOptions,
  line: number,
): number {
  for (let i = line - 1; i >= 0; i--) {
    const text = stripStringsAndComments(lines[i] ?? "");
    if (countChars(text, "(") + countChars(text, "[") > countChars(text, ")") + countChars(text, "]")) {
      return (indents.get(i) ?? 0) + opts.tabSize * 2;
    }
  }
  return indents.get(line) ?? 0;
}

function countChars(text: string, char: string): number {
  let count = 0;
  for (const c of text) {
    if (c === char) count++;
  }
  return count;
}

function stripStringsAndComments(line: string): string {
  const commentStart = line.indexOf("//");
  const code = commentStart >= 0 ? line.slice(0, commentStart) : line;
  return code.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`/g, "");
}

// ---------------------------------------------------------------------------
// Indent computation
// ---------------------------------------------------------------------------

/**
 * Check if a node has a previous unnamed sibling with the given text.
 * Used to detect "else if" chains — the inner if_statement is preceded by
 * an "else" token, so it should not be treated as a bare body.
 */
function hasPrevUnnamedSibling(node: Node, text: string): boolean {
  // Walk backwards past any named siblings to find the unnamed token before
  // this child. For "else if(y)", the inner if_statement's previous unnamed
  // sibling is "else".
  let sib = node.previousSibling;
  while (sib) {
    if (!sib.isNamed && sib.text === text) return true;
    if (sib.isNamed) { sib = sib.previousSibling; continue; }
    break;
  }
  return false;
}

/**
 * Detect a bare body that sits on the same line as its introducing `else`
 * keyword (`else write("c");`). Such a line is led by `else` — which aligns
 * with the `if` at base indent — so the body must not receive the extra
 * bare-body indent. The own-line form (`else` then body on the next line) is
 * unaffected because the body's start row differs from the `else` token's row.
 */
function isInlineElseBody(node: Node): boolean {
  const sib = node.previousSibling;
  return (
    sib !== null &&
    !sib.isNamed &&
    sib.text === "else" &&
    sib.startPosition.row === node.startPosition.row
  );
}

function parentType(node: Node): string | null {
  const parent = (node as Node & { parent?: Node }).parent;
  return parent?.type ?? null;
}

function isSwitchBodyBlock(node: Node): boolean {
  return node.type === "block" && parentType(node) === "switch_statement";
}

function mergeIndentMaps(
  target: { indents: Map<number, number>; baseIndents: Map<number, number> },
  source: { indents: Map<number, number>; baseIndents: Map<number, number> },
): void {
  for (const [line, indent] of source.indents) {
    target.indents.set(line, indent);
  }
  for (const [line, base] of source.baseIndents) {
    target.baseIndents.set(line, base);
  }
}

function computeSwitchBodyIndents(
  node: Node,
  opts: FormatOptions,
  baseIndent: number,
  source: string,
): { indents: Map<number, number>; baseIndents: Map<number, number> } {
  const result = { indents: new Map<number, number>(), baseIndents: new Map<number, number>() };
  const labelIndent = baseIndent + opts.tabSize;
  const bodyIndent = labelIndent + opts.tabSize;
  let afterLabel = false;
  // Rows where a case/default label begins. The label is the leftmost token on
  // its line, so its indent must win even when inline statements
  // (`case 1: write(); break;`) sit on the same row and get processed later.
  const labelRows: number[] = [];

  for (const child of node.namedChildren) {
    const isLabel = child.type === "case_clause" || child.type === "default_clause";
    if (isLabel) {
      labelRows.push(child.startPosition.row);
      mergeIndentMaps(result, computeCaseLabelIndents(child, opts, labelIndent, source));
      afterLabel = true;
      continue;
    }

    const previous = child.previousNamedSibling;
    const continuesLabel = child.type === "block"
      && previous !== null
      && (previous.type === "case_clause" || previous.type === "default_clause")
      && previous.startPosition.row === child.startPosition.row;
    const childIndent = continuesLabel ? labelIndent : afterLabel ? bodyIndent : labelIndent;
    mergeIndentMaps(result, computeLineIndents(child, opts, childIndent, source));
    if (continuesLabel) {
      result.indents.set(child.startPosition.row, labelIndent);
      result.baseIndents.set(child.startPosition.row, labelIndent);
    }
    afterLabel = true;
  }

  // Reassert label indentation: a label leads its line, so inline body children
  // processed afterwards must not override the label row's indent.
  for (const row of labelRows) {
    result.indents.set(row, labelIndent);
    result.baseIndents.set(row, labelIndent);
  }

  const lines = source.split("\n");
  for (let line = node.startPosition.row; line <= node.endPosition.row; line++) {
    if (result.indents.has(line)) continue;
    const trimmed = lines[line]?.trim() ?? "";
    const structural = line === node.startPosition.row || line === node.endPosition.row || trimmed === "{" || trimmed === "}";
    result.indents.set(line, structural ? baseIndent : bodyIndent);
    result.baseIndents.set(line, baseIndent);
  }

  return result;
}

function computeCaseLabelIndents(
  node: Node,
  opts: FormatOptions,
  labelIndent: number,
  source: string,
): { indents: Map<number, number>; baseIndents: Map<number, number> } {
  const result = { indents: new Map<number, number>(), baseIndents: new Map<number, number>() };
  result.indents.set(node.startPosition.row, labelIndent);
  result.baseIndents.set(node.startPosition.row, labelIndent);

  for (const child of node.namedChildren) {
    if (child.type !== "block") continue;
    mergeIndentMaps(result, computeLineIndents(child, opts, labelIndent, source));
    result.indents.set(node.startPosition.row, labelIndent);
    result.baseIndents.set(node.startPosition.row, labelIndent);
  }

  return result;
}

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
    if (isSwitchBodyBlock(node)) {
      return computeSwitchBodyIndents(node, opts, baseIndent, source);
    }

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
        // The last line of an INDENT_NODE is always a closing delimiter
        // at outer indent level.
        const isLastLine = line === endLine;
        const sourceLine = source.split("\n")[line] ?? "";
        const trimmed = sourceLine.trim();
        const isStructural =
          isLastLine ||
          trimmed === "{" ||
          /^(class|enum|void|int|string|float|mapping|array|multiset|object|mixed|function|program)\b/.test(trimmed);

        indents.set(line, isStructural ? baseIndent : newIndent);
        baseIndents.set(line, baseIndent);
      }
    }
  } else {
    // Control flow statements (if, for, while, do, foreach) whose body is a
    // bare statement (not wrapped in block) need the body indented one level.
    // Tree-sitter puts the body as a direct named child — e.g. if_statement
    // has expression_statement as a child, not a block.
    const isControlFlow = CONTROL_FLOW_WITH_BODY.has(node.type);
    const bodyIndent = isControlFlow ? baseIndent + opts.tabSize : baseIndent;

    for (const child of node.namedChildren) {
      // Detect bare body children: they sit on a different line from the
      // keyword and need the extra indent level. Block children are already
      // handled as INDENT_NODES above — they don't need special treatment.
      // Exception: in "else if" chains, the inner if_statement is the else
      // branch, which stays at the same indent as the else keyword. We detect
      // this by checking if the child is a control flow node preceded by "else".
      // Simple statement bodies (expression, break, etc.) after "else" still
      // need the extra indent — only nested control flow stays at baseIndent.
      const isElseBranchControlFlow = isControlFlow
        && CONTROL_FLOW_WITH_BODY.has(child.type)
        && hasPrevUnnamedSibling(child, "else");
      const isBareBody = isControlFlow
        && BARE_BODY_TYPES.has(child.type)
        && child.startPosition.row !== node.startPosition.row
        && !isElseBranchControlFlow
        && !isInlineElseBody(child);

      const childIndent = isBareBody ? bodyIndent : baseIndent;
      const childResult = computeLineIndents(child, opts, childIndent, source);
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