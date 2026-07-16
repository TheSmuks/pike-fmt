/**
 * Packaging regression tests for the bundled CLI.
 *
 * These pin two defects that only appear in the *built* artifact, so no
 * source-level test can catch them:
 *
 * 1. `bun build --target node` substitutes `__dirname` with a string literal of
 *    the build machine's source directory. Asset lookups relative to it then
 *    pointed at a path that exists only on the CI runner, so an installed CLI
 *    could never find tree-sitter-pike.wasm.
 * 2. web-tree-sitter.wasm is loaded at runtime from alongside dist/cli.js and
 *    must therefore be copied into dist/ by the build and published with it.
 *
 * The CLI is run from an unrelated working directory with no PIKE_FMT_WASM and
 * no --wasm-path: that is the path a plain `npm i -g pike-fmt` user takes.
 */

import { describe, test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const cliPath = join(repoRoot, "dist", "cli.js");
const distBuilt = existsSync(cliPath);

/** Run the built CLI from a directory that contains no wasm of its own. */
function runCli(args: string[], input: string) {
  const env = { ...process.env };
  delete env.PIKE_FMT_WASM;
  return spawnSync("node", [cliPath, ...args], {
    input,
    encoding: "utf-8",
    cwd: tmpdir(),
    env,
  });
}

describe.skipIf(!distBuilt)("packaged CLI: asset resolution", () => {
  test("ships web-tree-sitter.wasm next to the bundled cli.js", () => {
    expect(existsSync(join(repoRoot, "dist", "web-tree-sitter.wasm"))).toBe(true);
  });

  test("bundle does not bake in an absolute build-machine __dirname", async () => {
    const bundle = await Bun.file(cliPath).text();
    // A literal assignment such as `var __dirname = "/home/runner/work/..."`
    // means asset lookups are frozen to wherever the package was built.
    expect(bundle).not.toMatch(/var __dirname = "\/(home|Users)\//);
  });

  test("formats from an unrelated cwd with no wasm flag or env var", () => {
    const result = runCli(["--tab-size", "2"], "int main(){\n      int x  =  1;\n}\n");

    expect(result.stderr).not.toContain("tree-sitter-pike.wasm not found");
    expect(result.status).toBe(0);
    // Indentation and operator spacing are normalized; brace style is left as authored.
    expect(result.stdout).toBe("int main(){\n  int x = 1;\n}\n");
  });

  test("reports its real package version", () => {
    const result = runCli(["--help"], "");
    const pkg = require(join(repoRoot, "package.json"));

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(`pike-fmt ${pkg.version}`);
  });
});
