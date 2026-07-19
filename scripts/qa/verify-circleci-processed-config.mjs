#!/usr/bin/env node
import process from "node:process";

const processedConfig = await readStandardInput();
const requiredFragments = [
  "delivery-policy:",
  "static-quality:",
  "unit-tests:",
  "unit-results:",
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
    `Processed CircleCI config is incomplete; missing: ${missingFragments.join(", ")}.`,
  );
  process.exitCode = 1;
} else {
  console.log("Processed CircleCI config contains the complete quality DAG and cache steps.");
}

async function readStandardInput() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  return input;
}
