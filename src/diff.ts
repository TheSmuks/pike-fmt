/**
 * Compute minimal TextEdit[] for LSP integration.
 *
 * Given original and formatted text, compute the smallest set of
 * replacements that transform one into the other.
 *
 * Phase 1-3: only handles indentation changes (leading whitespace per line) (leading whitespace per line).
 */
export interface TextEdit {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
  newText: string;
}

export function computeIndentEdits(
  original: string,
  formatted: string,
): TextEdit[] {
  const origLines = original.split("\n");
  const fmtLines = formatted.split("\n");
  const edits: TextEdit[] = [];

  const maxLen = Math.max(origLines.length, fmtLines.length);
  for (let i = 0; i < maxLen; i++) {
    const origLine = origLines[i] ?? "";
    const fmtLine = fmtLines[i] ?? "";

    const origIndent = origLine.match(/^\s*/)?.[0] ?? "";
    const fmtIndent = fmtLine.match(/^\s*/)?.[0] ?? "";

    if (origIndent !== fmtIndent) {
      edits.push({
        startLine: i,
        startChar: 0,
        endLine: i,
        endChar: origIndent.length,
        newText: fmtIndent,
      });
    }
  }

  // Handle trailing newline difference
  const origHasNewline = original.endsWith("\n");
  const fmtHasNewline = formatted.endsWith("\n");
  if (!origHasNewline && fmtHasNewline) {
    const lastLine = origLines.length > 0 ? origLines.length - 1 : 0;
    edits.push({
      startLine: lastLine,
      startChar: (origLines[lastLine] ?? "").length,
      endLine: lastLine,
      endChar: (origLines[lastLine] ?? "").length,
      newText: "\n",
    });
  }

  return edits;
}

/**
 * Check if formatting would change the source.
 * Used to determine if we should exit(0) or exit(1) per LSP protocol.
 */
export function wouldChange(original: string, formatted: string): boolean {
  return original !== formatted;
}
