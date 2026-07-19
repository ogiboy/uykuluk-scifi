#!/usr/bin/env node
import process from "node:process";

const processedConfig = await readStandardInput();
const requiredFragments = [
  "delivery-policy:",
  "static-quality:",
  "unit-tests:",
  "unit-results:",
  "python-contract:",
  "studio-browser:",
  "sonar-cloud:",
  "quality-gate:",
  "restore_cache:",
  "save_cache:",
];
const missingFragments = requiredFragments.filter(
  (fragment) => !processedConfig.includes(fragment),
);

if (missingFragments.length > 0) {
  console.error(
    JSON.stringify({ schemaVersion: 1, validationStatus: "incomplete", missingFragments }),
  );
  process.exitCode = 1;
} else {
  console.log(
    JSON.stringify({ schemaVersion: 1, validationStatus: "complete", missingFragments: [] }),
  );
}

async function readStandardInput() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}
