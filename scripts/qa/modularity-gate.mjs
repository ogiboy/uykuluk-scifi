#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const failOnFindings = process.argv.includes("--fail-on-findings");
const scanRoots = ["src", "tests", "scripts", "apps/studio/src", ".ai"];
const ignoredSegments = new Set(["node_modules", ".next", "dist", "build", "coverage"]);
const ignoredPrefixes = [".ai/qa/artifacts/"];
const textExtensions = new Set([".ts", ".tsx", ".mjs", ".js", ".md", ".yml", ".yaml", ".json"]);

const limits = {
  ".ts": 260,
  ".tsx": 220,
  ".mjs": 360,
  ".js": 260,
  ".md": 480,
  ".yml": 260,
  ".yaml": 260,
  ".json": 260,
};

function toRelative(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join("/");
}

function shouldSkip(filePath) {
  const relativePath = toRelative(filePath);
  if (ignoredPrefixes.some((prefix) => relativePath.startsWith(prefix))) {
    return true;
  }
  return relativePath.split("/").some((segment) => ignoredSegments.has(segment));
}

function* walk(entry) {
  const absolute = path.join(repoRoot, entry);
  if (shouldSkip(absolute)) {
    return;
  }
  let stat;
  try {
    stat = statSync(absolute);
  } catch {
    return;
  }
  if (stat.isDirectory()) {
    for (const child of readdirSync(absolute)) {
      yield* walk(path.join(entry, child));
    }
    return;
  }
  if (stat.isFile() && textExtensions.has(path.extname(absolute))) {
    yield absolute;
  }
}

const findings = [];
let scannedFiles = 0;

for (const root of scanRoots) {
  for (const filePath of walk(root)) {
    scannedFiles += 1;
    const relativePath = toRelative(filePath);
    const extension = path.extname(filePath);
    const lineCount = readFileSync(filePath, "utf8").split(/\r?\n/).length;
    const maxLines = limits[extension] ?? 260;
    if (lineCount > maxLines) {
      findings.push(`${relativePath}: ${lineCount} lines exceeds ${maxLines}`);
    }
  }
}

const report = { scannedFiles, findings, thresholds: limits };

console.log(JSON.stringify(report, null, 2));

if (failOnFindings && findings.length > 0) {
  process.exit(1);
}
