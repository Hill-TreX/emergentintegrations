#!/usr/bin/env node
/**
 * Dual CJS + ESM build.
 * 1. tsc → dist/cjs (commonjs)
 * 2. tsc -p tsconfig.esm.json → dist/esm
 * 3. Rewrite ESM relative imports to include .js extensions
 * 4. Drop package.json type markers into each output dir
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("Building CJS...");
execSync("npx tsc", { stdio: "inherit" });

console.log("Building ESM...");
execSync("npx tsc -p tsconfig.esm.json", { stdio: "inherit" });

// Rewrite ESM relative imports: from "./chat" → from "./chat.js"
function fixEsmImports(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { fixEsmImports(full); continue; }
    if (!entry.name.endsWith(".js")) continue;
    let src = fs.readFileSync(full, "utf8");
    src = src.replace(/(from\s+["'])(\.\.?\/[^"']+?)(["'])/g, (m, pre, spec, post) => {
      if (spec.endsWith(".js") || spec.endsWith(".json")) return m;
      // directory import → /index.js, file import → .js
      const abs = path.resolve(path.dirname(full), spec);
      const isDir = fs.existsSync(abs) && fs.statSync(abs).isDirectory();
      return pre + spec + (isDir ? "/index.js" : ".js") + post;
    });
    fs.writeFileSync(full, src);
  }
}
fixEsmImports(path.join(__dirname, "..", "dist", "esm"));

// Type markers so Node treats each tree correctly
fs.writeFileSync(path.join(__dirname, "..", "dist", "cjs", "package.json"), JSON.stringify({ type: "commonjs" }));
fs.writeFileSync(path.join(__dirname, "..", "dist", "esm", "package.json"), JSON.stringify({ type: "module" }));

console.log("Build complete: dist/cjs + dist/esm");
