#!/usr/bin/env node

/**
 * emergentintegrations init
 * Copies AGENTS.md and .cursorrules to the current project root.
 * Run: npx emergentintegrations init
 */

const fs = require("fs");
const path = require("path");

const PKG_DIR = path.join(__dirname, "..");
const PROJECT_DIR = process.cwd();

const files = [
  { src: "AGENTS.md", desc: "AI agent rules" },
  { src: ".cursorrules", desc: "Cursor/Windsurf rules" },
];

console.log("\n🚀 emergentintegrations init\n");

let copied = 0;
let skipped = 0;

for (const file of files) {
  const src = path.join(PKG_DIR, file.src);
  const dest = path.join(PROJECT_DIR, file.src);

  if (!fs.existsSync(src)) {
    console.log(`  ⚠️  ${file.src} not found in package, skipping`);
    continue;
  }

  if (fs.existsSync(dest)) {
    console.log(`  ⏭️  ${file.src} already exists — skipped (${file.desc})`);
    skipped++;
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`  ✅ ${file.src} copied — ${file.desc}`);
  copied++;
}

console.log(`\n  Copied: ${copied} | Skipped: ${skipped}\n`);

if (copied > 0) {
  console.log("  Your AI agent will now follow emergentintegrations rules.");
  console.log("  Add these files to git so your whole team benefits.\n");
}

if (skipped > 0) {
  console.log("  Existing files were not overwritten.");
  console.log("  Delete them first if you want fresh copies.\n");
}
