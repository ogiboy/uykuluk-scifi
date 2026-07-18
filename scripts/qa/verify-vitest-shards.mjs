#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const blobDirectory = process.env.VITEST_BLOB_DIRECTORY ?? ".ai/qa/artifacts/vitest";
const fileListPath = process.env.VITEST_FILE_LIST ?? ".ai/qa/artifacts/junit/vitest-files.txt";
const junitPath = process.env.VITEST_JUNIT_PATH ?? ".ai/qa/artifacts/junit/vitest.xml";
const lcovPath = process.env.VITEST_LCOV_PATH ?? ".ai/qa/artifacts/sonar/coverage/lcov.info";
const expectedShardCount = Number.parseInt(process.env.VITEST_SHARD_COUNT ?? "2", 10);

function fail(message) {
  console.error(`Vitest shard verification failed: ${message}`);
  process.exit(1);
}

const blobFiles = readdirSync(blobDirectory)
  .filter((file) => /^blob-\d+\.json$/.test(file))
  .sort((left, right) => left.localeCompare(right, "en"));

if (blobFiles.length !== expectedShardCount) {
  fail(`expected ${expectedShardCount} blob reports, found ${blobFiles.length}`);
}

const discoveredFiles = new Set(readFileSync(fileListPath, "utf8").split("\n").filter(Boolean));
const junit = readFileSync(junitPath, "utf8");
const suiteFiles = new Set(
  [...junit.matchAll(/<testsuite name="([^"]+)"/g)].map((match) => match[1]),
);
const missingFiles = [...discoveredFiles].filter((file) => !suiteFiles.has(file));
const unexpectedFiles = [...suiteFiles].filter((file) => !discoveredFiles.has(file));

if (missingFiles.length > 0 || unexpectedFiles.length > 0) {
  fail(
    `discovery/JUnit mismatch; missing=${missingFiles.join(",") || "none"}; ` +
      `unexpected=${unexpectedFiles.join(",") || "none"}`,
  );
}

const totals = junit.match(
  /<testsuites\b[^>]*\btests="(\d+)"[^>]*\bfailures="(\d+)"[^>]*\berrors="(\d+)"/,
);
if (!totals) {
  fail("JUnit totals are missing");
}

const [, tests, failures, errors] = totals.map(Number);
if (tests <= 0 || failures !== 0 || errors !== 0) {
  fail(`invalid JUnit totals: tests=${tests}, failures=${failures}, errors=${errors}`);
}

if (statSync(lcovPath).size === 0) {
  fail(`LCOV output is empty: ${path.resolve(lcovPath)}`);
}

console.log(
  `Vitest shards verified: ${blobFiles.length} blobs, ${suiteFiles.size} files, ${tests} tests.`,
);
