#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import process from "node:process";

const allowedTypes = new Set([
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "style",
  "test",
]);

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();
}

let commits = [];
try {
  const rootCommit = git(["rev-parse", "--verify", "HEAD"]);
  commits = git(["log", "--format=%s", `${rootCommit}..HEAD`])
    .split("\n")
    .filter(Boolean);
} catch {
  console.log("No commits exist yet; conventional commit range check skipped.");
  process.exit(0);
}

const invalid = commits.filter((subject) => {
  const match = subject.match(/^([a-z]+)(\([a-z0-9-]+\))?!?: .+/);
  return !match || !allowedTypes.has(match[1]);
});

if (invalid.length > 0) {
  console.error("Non-conventional commit subjects detected:");
  for (const subject of invalid) {
    console.error(`- ${subject}`);
  }
  process.exit(1);
}

console.log("Conventional commit check passed.");
