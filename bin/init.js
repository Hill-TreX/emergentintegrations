#!/usr/bin/env node

/**
 * emergentintegrations init
 * Copies agent rule files to the current project root.
 * Run: npx emergentintegrations init
 */

const fs = require("fs");
const path = require("path");

const PKG_DIR = path.join(__dirname, "..");
const PROJECT_DIR = process.cwd();

const files = [
  { src: "CLAUDE.md",     desc: "Claude Code rules (Claude Code, claude.ai)" },
  { src: "AGENTS.md",     desc: "Agent rules (Codex, general agents)" },
  { src: ".cursorrules",  desc: "Cursor / Windsurf / Zed rules" },
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
    console.log(`  ⏭️  ${file.src} already exists — skipped`);
    skipped++;
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`  ✅ ${file.src} — ${file.desc}`);
  copied++;
}

console.log(`\n  Copied: ${copied} | Skipped: ${skipped}\n`);

if (copied > 0) {
  console.log("  AI agents will now follow emergentintegrations rules.");
  console.log("  Commit these files so your whole team benefits.\n");
  console.log("  Files cover:");
  console.log("    CLAUDE.md    → Claude Code, claude.ai");
  console.log("    AGENTS.md    → Codex, general agents");
  console.log("    .cursorrules → Cursor, Windsurf, Zed\n");
}

if (skipped > 0) {
  console.log("  Existing files were not overwritten.");
  console.log("  Delete them first if you want fresh copies.\n");
}
