#!/usr/bin/env node
/**
 * CI guard for the 4-language setup: fails when a locale is missing keys that
 * NL has, has extra keys NL doesn't, or when a key used in the code is absent.
 *
 * Usage: node scripts/check-i18n.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const LOCALES = ["nl", "en", "fr", "de"];
const load = (l) => JSON.parse(readFileSync(`src/locales/${l}.json`, "utf8"));
const base = load("nl");
const baseKeys = new Set(Object.keys(base));
let failed = false;

for (const locale of LOCALES.filter((l) => l !== "nl")) {
  const keys = new Set(Object.keys(load(locale)));
  const missing = [...baseKeys].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !baseKeys.has(k));
  if (missing.length) {
    failed = true;
    console.error(`✖ ${locale}: ${missing.length} missing key(s):\n  ${missing.join("\n  ")}`);
  }
  if (extra.length) {
    failed = true;
    console.error(`✖ ${locale}: ${extra.length} unused/extra key(s):\n  ${extra.join("\n  ")}`);
  }
}

// Literal t("…") usages must resolve to a key (plural suffixes included).
const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
};
walk("src");

const used = new Set();
for (const file of files) {
  const source = readFileSync(file, "utf8");
  for (const match of source.matchAll(/\bt\(\s*["'`]([a-zA-Z0-9_.-]+)["'`]/g)) used.add(match[1]);
}

const resolvable = (key) =>
  baseKeys.has(key) || [...baseKeys].some((k) => k === `${key}_one` || k === `${key}_other`);

const unknown = [...used].filter((k) => k.includes(".") && !resolvable(k));
if (unknown.length) {
  failed = true;
  console.error(`✖ ${unknown.length} translation key(s) used in code but missing from src/locales:\n  ${unknown.join("\n  ")}`);
}

if (failed) process.exit(1);
console.log(`✓ i18n parity OK — ${baseKeys.size} keys × ${LOCALES.length} locales`);
