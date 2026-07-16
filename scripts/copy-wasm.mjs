/**
 * Copy web-tree-sitter.wasm into dist/ after bundling.
 *
 * The bundler inlines web-tree-sitter's JS runtime but not its .wasm, which the
 * runtime loads at execution time via `new URL("web-tree-sitter.wasm",
 * import.meta.url)` — i.e. from alongside dist/cli.js. Without this copy the
 * file is absent from the published package and the CLI aborts on startup.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);

// Resolve through the package itself so the path holds wherever it is installed.
const source = join(dirname(require.resolve("web-tree-sitter")), "web-tree-sitter.wasm");
const dest = join(repoRoot, "dist", "web-tree-sitter.wasm");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(source, dest);
console.log(`[build] copied web-tree-sitter.wasm -> ${dest}`);
