import { execFileSync } from "node:child_process";
import fs from "node:fs";

const files = [
  "src/lib/ad-engine.mjs",
  "src/lib/storage.mjs",
  "src/server.mjs",
  "scripts/create-admin.mjs",
  "tests/verify-workflow.mjs"
];

for (const file of files) {
  if (!fs.existsSync(file)) throw new Error(`Missing required source file: ${file}`);
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}
console.log("Production build syntax and asset verification passed.");
