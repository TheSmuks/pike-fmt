/**
 * Pike formatter integration tests.
 *
 * Tests the real formatter with tree-sitter-pike against corpus fixtures.
 */

import { describe, test, expect } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { formatSource, assertFormat, assertIdempotent, assertParses, wouldChange } from "./helpers";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CORPUS_DIR = path.join(__dirname, "corpus", "input");

interface CorpusCase {
  name: string;
  input: string;
  expected: string;
}

function loadCorpus(name: string): CorpusCase {
  const inputPath = path.join(CORPUS_DIR, `${name}.pike`);
  const expectedPath = path.join(CORPUS_DIR, `${name}.expected.pike`);

  return {
    name,
    input: fs.readFileSync(inputPath, "utf8"),
    expected: fs.readFileSync(expectedPath, "utf8"),
  };
}

function loadAllCorpus(): CorpusCase[] {
  const files = fs.readdirSync(CORPUS_DIR)
    .filter((f) => f.endsWith(".pike") && !f.includes(".expected."))
    .map((f) => f.replace(/\.pike$/, ""));

  return [...new Set(files)].sort().map(loadCorpus);
}

// ---------------------------------------------------------------------------
// Per-construct tests
// ---------------------------------------------------------------------------

describe("class declarations", () => {
  const c = loadCorpus("class");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });

  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("function declarations", () => {
  const c = loadCorpus("function");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("blocks", () => {
  const c = loadCorpus("block");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("control flow", () => {
  const c = loadCorpus("control");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("enums", () => {
  const c = loadCorpus("enum");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("Pike literals", () => {
  const c = loadCorpus("literal");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });

  test("array literal contents are not indented", async () => {
    await assertIdempotent(`array(int) x = ({1, 2, 3});`);
  });

  test("mapping literal contents are not indented", async () => {
    await assertIdempotent(`mapping m = ([ "a": 1, "b": 2 ]);`);
  });

  test("multiset literal contents are not indented", async () => {
    await assertIdempotent(`multiset ms = (<"a", "b", "c">);`);
  });
});

describe("operators", () => {
  const c = loadCorpus("operator");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});



describe("operator spacing", () => {
  test("unspaced operators get spaces with operatorSpacing enabled", async () => {
    const input = "int x=1+2;\n";
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe("int x = 1 + 2;\n");
  });

  test("compound assignment preserves spacing", async () => {
    const input = "int x=10;\nx+=5;\n";
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe("int x = 10;\nx += 5;\n");
  });

  test("comparison operators get spaced", async () => {
    const input = "bool x=a>0&&b<10;\n";
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe("bool x = a > 0 && b < 10;\n");
  });

  test("ternary operator gets spaced", async () => {
    const input = "int x=a>0?b:c;\n";
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe("int x = a > 0 ? b : c;\n");
  });

  test("comma gets space after", async () => {
    const input = "array(int) x=({1,2,3});\n";
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe("array(int) x = ({1, 2, 3});\n");
  });
});describe("comments", () => {
  const c = loadCorpus("comment");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("preprocessor", () => {
  const c = loadCorpus("preprocessor");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("switch case", () => {
  const c = loadCorpus("switch-case");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });

  test("output parses", async () => {
    await assertParses(c.input);
  });

  test("indents nested case bodies after line moves", async () => {
    const input = `int main() {\nswitch (x) {\ncase 1:\nif (a) {\ny();\n}\nbreak;\ndefault:\nz();\n}\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`int main() {\n  switch (x) {\n    case 1:\n      if (a) {\n        y();\n      }\n      break;\n    default:\n      z();\n  }\n}\n`);
  });

  test("keeps label indent when body is inline on the case line", async () => {
    const input = `void f(int x) {\nswitch (x) {\ncase 1: write("a"); break;\ndefault: write("d"); break;\n}\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`void f(int x) {\n  switch (x) {\n    case 1: write("a"); break;\n    default: write("d"); break;\n  }\n}\n`);
  });

  test("indents control flow nested inside a case body", async () => {
    const input = `void f(int x) {\nswitch (x) {\ncase 2:\nif (x) write("b");\nelse write("c");\nbreak;\n}\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`void f(int x) {\n  switch (x) {\n    case 2:\n      if (x) write("b");\n      else write("c");\n      break;\n  }\n}\n`);
  });
});

describe("split control-flow lines", () => {
  test("indents split if conditions as continuations", async () => {
    const input = `int main() {\nif (a &&\nb) {\nx();\n}\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`int main() {\n  if (a &&\n      b) {\n    x();\n  }\n}\n`);
  });

  test("normalizes else after closing block onto the same line", async () => {
    const input = `int main() {\nif (a) {\nx();\n}\nelse {\ny();\n}\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`int main() {\n  if (a) {\n    x();\n  } else {\n    y();\n  }\n}\n`);
  });

  test("keeps inline else body at the else's indent", async () => {
    const input = `void f(int x) {\nif (x) a();\nelse c();\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`void f(int x) {\n  if (x) a();\n  else c();\n}\n`);
  });

  test("keeps else-if chains with inline final else aligned", async () => {
    const input = `void f(int x) {\nif (x) a();\nelse if (y) b();\nelse c();\n}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`void f(int x) {\n  if (x) a();\n  else if (y) b();\n  else c();\n}\n`);
  });

  test("is idempotent for brace-optional nested if/else with `} else if`", async () => {
    // A `}` closing an inner else-block merged onto an outer if's `else if`:
    // the format pass settles this on a second pass, so format() must stabilize.
    await assertIdempotent(
      `void f() {\nif (a)\nif (b)\nx();\nelse\n{\ny();\n}\nelse if (c) {\nz();\n}\n}\n`,
    );
  });
});

describe("operator spacing", () => {
  test("adds spaces around binary operators", async () => {
    const result = await formatSource(`int x=1+2;\n`, { operatorSpacing: true });
    expect(result).toBe(`int x = 1 + 2;\n`);
  });

  test("preserves indentation on operator-bearing lines", async () => {
    const input = `void f() {\nint y = 1+2;\nreturn y;\n}\n`;
    const result = await formatSource(input, { operatorSpacing: true });
    expect(result).toBe(`void f() {\n  int y = 1 + 2;\n  return y;\n}\n`);
  });
});

describe("bare-body control flow", () => {
  const c = loadCorpus("bare-body");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });

  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("indent edge cases", () => {
  const c = loadCorpus("indent");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

describe("inherit/import", () => {
  const c = loadCorpus("inherit-import");

  test("formats correctly", async () => {
    await assertFormat(c.input, c.expected);
  });

  test("is idempotent", async () => {
    await assertIdempotent(c.input);
  });


  test("output parses", async () => {
    await assertParses(c.input);
  });
});

// ---------------------------------------------------------------------------
// Idempotency — all corpus files format to themselves
// ---------------------------------------------------------------------------

describe("idempotency for all corpus", () => {
  for (const c of loadAllCorpus()) {
    test(c.name, async () => {
      await assertIdempotent(c.expected);
    });
  }
});

// ---------------------------------------------------------------------------
// wouldChange
// ---------------------------------------------------------------------------

describe("wouldChange", () => {
  test("already-formatted source returns false", async () => {
    const c = loadCorpus("class");
    const result = await wouldChange(c.expected);
    expect(result).toBe(false);
  });

  test("unformatted source returns true", async () => {
    const c = loadCorpus("class");
    const result = await wouldChange(c.input);
    expect(result).toBe(true);
  });

  test("all expected corpus returns false", async () => {
    for (const c of loadAllCorpus()) {
      const result = await wouldChange(c.expected);
      expect(result, `${c.name}: expected output should not change`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

describe("tabSize option", () => {
  test("4-space indent", async () => {
    // Phase 3 normalizes leading whitespace per line.
    // Brace position is preserved — `{` and `}` lines keep their tree-assigned indent.
    const input = `class Foo {\nint x;\n}`;
    const result = await formatSource(input, { tabSize: 4 });
    expect(result).toBe(`class Foo {\n    int x;\n}\n`);
  });

  test("8-space indent", async () => {
    const input = `class Foo {\nint x;\n}`;
    const result = await formatSource(input, { tabSize: 8 });
    expect(result).toBe(`class Foo {\n        int x;\n}\n`);
  });

  test("nested 4-space indent", async () => {
    const input = `class Foo {\nclass Bar {\nint x;\n}\n}`;
    const result = await formatSource(input, { tabSize: 4 });
    expect(result).toBe(`class Foo {\n    class Bar {\n        int x;\n    }\n}\n`);
  });
});

describe("useTabs option", () => {
  test("tabs instead of spaces", async () => {
    const input = `class Foo {\nint x;\n}`;
    const result = await formatSource(input, { useTabs: true });
    // tabSize=2: indent 0 → "", indent 2 → "\t"
    expect(result).toBe(`class Foo {\n\tint x;\n}\n`);
  });

  test("tabs for nested indent", async () => {
    const input = `class Foo {\nclass Bar {\nint x;\n}\n}`;
    const result = await formatSource(input, { useTabs: true });
    expect(result).toBe(`class Foo {\n\tclass Bar {\n\t\tint x;\n\t}\n}\n`);
  });

  test("tabs at tabSize=4", async () => {
    const input = `class Foo {\nclass Bar {\nint x;\n}\n}`;
    const result = await formatSource(input, { useTabs: true, tabSize: 4 });
    // tabSize=4: indent 0 → "", indent 4 → "\t", indent 8 → "\t\t"
    expect(result).toBe(`class Foo {\n\tclass Bar {\n\t\tint x;\n\t}\n}\n`);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe("edge cases", () => {
  test("empty file is idempotent", async () => {
    await assertIdempotent("");
  });

  test("single line stays single line", async () => {
    await assertIdempotent("int x;");
  });

  test("single line class stays compact", async () => {
    await assertIdempotent("class Foo { int x; }");
  });

  test("trailing whitespace is stripped", async () => {
    // Phase 3: trailing whitespace is removed
    const input = `int x;   \n`;
    const result = await formatSource(input);
    expect(result).toBe(`int x;\n`);
  });

  test("no final newline gets one added", async () => {
    const result = await formatSource("int x;");
    expect(result).toBe(`int x;\n`);
  });

  test("--no-final-newline removes trailing newline", async () => {
    const result = await formatSource("int x;\n", { insertFinalNewline: false });
    expect(result).toBe("int x;");
  });

  test("braces on own line stay on own line (Phase 1 limitation)", async () => {
    // Phase 3 only normalizes per-line leading whitespace.
    // It cannot move braces between lines.
    const input = `class Foo {\nint x;\n}`;
    const result = await formatSource(input);
    expect(result).toBe(`class Foo {\n  int x;\n}\n`);
  });

  test("already formatted brace-on-own-line is idempotent", async () => {
    await assertIdempotent(`class Foo {\n  int x;\n}\n`);
  });

  test("tabs in input normalized to spaces", async () => {
    const input = `class Foo {\n\tint x;\n\t}\n`;
    const result = await formatSource(input);
    expect(result).toBe(`class Foo {\n  int x;\n}\n`);
  });

  test("mixed tabs/spaces normalized to spaces", async () => {
    const input = `class Foo {\n \t  int x;\n \t  }\n`;
    const result = await formatSource(input);
    expect(result).toBe(`class Foo {\n  int x;\n}\n`);
  });

  });
