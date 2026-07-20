#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import ts from "typescript";

const repoRoot = process.cwd();
const failOnFindings = process.argv.includes("--fail-on-findings");
const scanRoots = ["src", "tests", "scripts", "apps/studio/src", ".ai"];
const ignoredSegments = new Set(["node_modules", ".next", "dist", "build", "coverage"]);
const ignoredPrefixes = [".ai/qa/artifacts/"];
const textExtensions = new Set([".ts", ".tsx", ".mjs", ".js", ".md", ".yml", ".yaml", ".json"]);

const limits = {
  ".ts": 460,
  ".tsx": 420,
  ".mjs": 360,
  ".js": 260,
  ".md": 520,
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
    const source = readFileSync(filePath, "utf8");
    const physicalLines = source.split(/\r?\n/).length;
    const measuredLines = sourceLineCount(source, extension);
    const maxLines = limits[extension] ?? 260;
    if (measuredLines > maxLines) {
      findings.push(
        `${relativePath}: ${measuredLines} content lines (${physicalLines} physical) exceeds ${maxLines}`,
      );
    }
  }
}

const report = { findings, measurement: "content-lines", scannedFiles, thresholds: limits };

console.log(JSON.stringify(report, null, 2));

if (failOnFindings && findings.length > 0) {
  process.exit(1);
}

function sourceLineCount(source, extension) {
  if (![".js", ".mjs", ".ts", ".tsx"].includes(extension)) {
    return source.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
  }
  const variant = extension === ".tsx" ? ts.LanguageVariant.JSX : ts.LanguageVariant.Standard;
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, variant, source);
  const sourceFile = ts.createSourceFile("module.ts", source, ts.ScriptTarget.Latest);
  const occupiedLines = new Set();
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = sourceFile.getLineAndCharacterOfPosition(scanner.getTokenPos()).line;
    const end = sourceFile.getLineAndCharacterOfPosition(scanner.getTextPos()).line;
    for (let line = start; line <= end; line += 1) occupiedLines.add(line);
  }
  return occupiedLines.size;
}
