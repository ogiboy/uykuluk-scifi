#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const reviewableFileLimit = 100;

const generatedToolingFiles = new Set(["skills-lock.json"]);
const generatedToolingPrefixes = [
  ".agents/",
  ".claude/",
  ".claude-flow/",
  ".omx/",
  ".ruflo/",
  ".swarm/",
];
const ciFiles = new Set([
  ".coderabbit.yaml",
  ".gitattributes",
  ".gitignore",
  ".prettierignore",
  "eslint.config.js",
  "sonar-project.properties",
]);
const ciPrefixes = [
  ".circleci/",
  ".github/codeql/",
  ".github/workflows/",
  "scripts/qa/",
  "scripts/security/",
];
const policyFiles = new Set([
  "AGENTS.md",
  "CHANGELOG.md",
  "CLAUDE.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "README.md",
  "ROADMAP.md",
  "SECURITY.md",
]);
const policyPrefixes = [".ai/", "docs/"];

function hasPrefix(file, prefixes) {
  return prefixes.some((prefix) => file.startsWith(prefix));
}

export function classifyDeliveryFile(file) {
  if (generatedToolingFiles.has(file) || hasPrefix(file, generatedToolingPrefixes)) {
    return "generated-tooling";
  }
  if (ciFiles.has(file) || hasPrefix(file, ciPrefixes)) {
    return "ci";
  }
  if (policyFiles.has(file) || hasPrefix(file, policyPrefixes)) {
    return "policy";
  }
  return "product";
}

export function summarizeDeliveryScope(changedFiles, options = {}) {
  const files = [...new Set(changedFiles.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const fileScopes = Object.fromEntries(files.map((file) => [file, classifyDeliveryFile(file)]));
  const scopes = [...new Set(Object.values(fileScopes))].sort((left, right) =>
    left.localeCompare(right, "en"),
  );
  const reviewableFiles = files.filter((file) => fileScopes[file] !== "generated-tooling");
  const productRequired = options.forceProduct === true || scopes.includes("product");
  const requiredLanes = productRequired
    ? ["delivery-policy", "quality-core", "sonar-cloud", "studio-browser"]
    : ["delivery-policy"];

  return {
    schemaVersion: 1,
    rawChangedCount: files.length,
    reviewableChangedCount: reviewableFiles.length,
    reviewableFileLimit,
    withinReviewableLimit: reviewableFiles.length <= reviewableFileLimit,
    scopes,
    requiredLanes,
    files: fileScopes,
  };
}

function readChangedFiles(baseRef, headRef) {
  const output = execFileSync("/usr/bin/git", ["diff", "--name-only", `${baseRef}...${headRef}`], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return output.split("\n").filter(Boolean);
}

function defaultBaseRef() {
  if (process.env.DELIVERY_SCOPE_BASE_REF) {
    return process.env.DELIVERY_SCOPE_BASE_REF;
  }
  return process.env.CIRCLE_BRANCH === "main" ? "HEAD^" : "origin/main";
}

export function runDeliveryScopeCli(options = {}) {
  const baseRef = process.env.PR_SIZE_BASE_REF ?? defaultBaseRef();
  const headRef = process.env.PR_SIZE_HEAD_REF ?? process.env.DELIVERY_SCOPE_HEAD_REF ?? "HEAD";
  const forceProduct = process.env.DELIVERY_SCOPE_TRIGGER === "api";
  const summary = summarizeDeliveryScope(readChangedFiles(baseRef, headRef), { forceProduct });

  console.log(
    `Delivery scope: ${summary.reviewableChangedCount}/${reviewableFileLimit} reviewable; ` +
      `${summary.rawChangedCount} raw (${baseRef}...${headRef}).`,
  );
  console.log(JSON.stringify(summary, null, 2));

  const outputPath = options.outputPath ?? process.env.DELIVERY_SCOPE_OUTPUT;
  if (outputPath) {
    mkdirSync(path.dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  }

  if (!summary.withinReviewableLimit) {
    console.error(
      `PR exceeds the ${reviewableFileLimit}-file reviewable limit by ` +
        `${summary.reviewableChangedCount - reviewableFileLimit} file(s).`,
    );
    process.exitCode = 1;
  }

  return summary;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  runDeliveryScopeCli();
}
