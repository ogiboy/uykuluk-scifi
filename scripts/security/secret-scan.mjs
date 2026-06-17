#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const textExtensions = new Set([
  ".cjs",
  ".env",
  ".example",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

const excludedPrefixes = [
  ".ai/qa/artifacts/",
  ".scannerwork/",
  "assets/source-docs/",
  "node_modules/",
  "runs/",
];

const patterns = [
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9_]{36,}\b/g],
  ["OpenAI API key", /\bsk-[A-Za-z0-9]{32,}\b/g],
  ["JWT", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g],
  ["private key block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["Sonar token literal", /\bsonar[a-zA-Z0-9_-]{20,}\b/g],
];

function trackedFiles() {
  const output = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
    encoding: "utf8",
  });
  return output
    .split("\n")
    .filter(Boolean)
    .filter((file) => !excludedPrefixes.some((prefix) => file.startsWith(prefix)))
    .filter((file) => {
      const extension = path.extname(file);
      return textExtensions.has(extension) || file.endsWith(".env.example");
    });
}

const findings = [];

for (const file of trackedFiles()) {
  try {
    if (!statSync(file).isFile()) {
      continue;
    }
  } catch {
    continue;
  }
  const text = readFileSync(file, "utf8");
  for (const [label, pattern] of patterns) {
    for (const match of text.matchAll(pattern)) {
      const lineNumber = text.slice(0, match.index).split(/\r?\n/).length;
      findings.push(`${file}:${lineNumber}: ${label}`);
    }
  }
}

if (findings.length > 0) {
  console.error(`High-confidence secret findings detected: ${findings.length}`);
  for (const finding of findings) {
    console.error(finding);
  }
  process.exit(1);
}

console.log("No high-confidence tracked-source secrets found.");
