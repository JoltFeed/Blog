#!/usr/bin/env node
import { readState, writeState, hashPassword } from "../src/lib/storage.mjs";

const email = process.argv[2] || process.env.ADMIN_EMAIL || "admin@joltfeed.com";
const password = process.argv[3] || process.env.ADMIN_PASSWORD || "JoltFeedAdmin2026!";

const state = readState();
const existing = state.users.find((u) => u.email === email);
if (existing) {
  existing.passwordHash = hashPassword(password);
  console.log(`Updated password for existing administrator: ${email}`);
} else {
  state.users.push({
    id: "admin-" + Date.now(),
    email,
    passwordHash: hashPassword(password),
    role: "admin"
  });
  console.log(`Created administrator account: ${email}`);
}
writeState(state);
