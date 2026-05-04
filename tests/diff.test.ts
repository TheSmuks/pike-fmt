/**
 * Diff utility tests — computeIndentEdits and wouldChange.
 */

import { describe, test, expect } from "bun:test";
import { computeIndentEdits, wouldChange } from "../src/diff";

// ---------------------------------------------------------------------------
// computeIndentEdits
// ---------------------------------------------------------------------------

describe("computeIndentEdits", () => {
  test("no changes when indentation matches", () => {
    const original = `int main() {
  write("hello");
}`;
    const formatted = original;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(0);
  });

  test("single line indent change", () => {
    const original = `int main() {
  write("hello");
}`;
    const formatted = `int main() {
    write("hello");
}`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      startLine: 1,
      startChar: 0,
      endLine: 1,
      endChar: 2,
      newText: "    ",
    });
  });

  test("multiple line indent changes", () => {
    const original = `class Foo {
int x;
int y;
}`;
    const formatted = `class Foo {
  int x;
  int y;
}`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(2);
    expect(edits[0]).toMatchObject({ startLine: 1, newText: "  " });
    expect(edits[1]).toMatchObject({ startLine: 2, newText: "  " });
  });

  test("trailing newline insertion", () => {
    const original = `int x;`;
    const formatted = `int x;\n`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      startLine: 0,
      startChar: 6,
      endLine: 0,
      endChar: 6,
      newText: "\n",
    });
  });

  test("mixed tabs-to-spaces conversion", () => {
    const original = `int main() {\n\twrite("hello");\n}`;
    const formatted = `int main() {\n  write("hello");\n}`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0].newText).toBe("  ");
  });

  test("empty lines are not touched", () => {
    const original = `int main() {

  write("hello");
}`;
    const formatted = `int main() {

    write("hello");
}`;
    const edits = computeIndentEdits(original, formatted);
    // Only the non-empty line should have an edit
    expect(edits).toHaveLength(1);
    expect(edits[0].startLine).toBe(2);
  });

  test("tab indent to spaces", () => {
    const original = `class Foo {\n\tint x;\n}`;
    const formatted = `class Foo {\n  int x;\n}`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ startLine: 1, newText: "  " });
  });

  test("spaces to tabs", () => {
    const original = `class Foo {\n  int x;\n}`;
    const formatted = `class Foo {\n\tint x;\n}`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({ startLine: 1, newText: "\t" });
  });

  test("line count mismatch (newline removal)", () => {
    const original = `int x;\n`;
    const formatted = `int x;`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(0);
  });

  test("line count mismatch (newline addition)", () => {
    const original = `int x;`;
    const formatted = `int x;\n`;
    const edits = computeIndentEdits(original, formatted);
    expect(edits).toHaveLength(1);
    expect(edits[0]).toMatchObject({
      startLine: 0,
      startChar: 6,
      endLine: 0,
      endChar: 6,
      newText: "\n",
    });
  });
});

// ---------------------------------------------------------------------------
// wouldChange
// ---------------------------------------------------------------------------

describe("wouldChange", () => {
  test("returns false for identical strings", () => {
    const source = `int main() {\n  write("hello");\n}`;
    expect(wouldChange(source, source)).toBe(false);
  });

  test("returns true when different", () => {
    const original = `int main() {\n  write("hello");\n}`;
    const formatted = `int main() {\n    write("hello");\n}`;
    expect(wouldChange(original, formatted)).toBe(true);
  });

  test("whitespace-only changes count", () => {
    const original = `int x;`;
    const formatted = `int x; `;
    expect(wouldChange(original, formatted)).toBe(true);
  });

  test("no change on trailing whitespace in content", () => {
    // Note: formatter preserves content (not just leading whitespace)
    // so this is here for clarity
    const original = `int x;  `;
    const formatted = `int x;  `; // No change
    expect(wouldChange(original, formatted)).toBe(false);
  });
});
