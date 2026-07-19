import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { URL } from "node:url";

const verifierPath = new URL("./verify-circleci-processed-config.mjs", import.meta.url);

test("reports a complete processed config as JSON", () => {
  const result = runVerifier(
    [
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
    ].join("\n"),
  );

  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), {
    schemaVersion: 1,
    validationStatus: "complete",
    missingFragments: [],
  });
});

test("reports missing fragments as JSON and fails", () => {
  const result = runVerifier("delivery-policy:\nstatic-quality:");

  assert.equal(result.status, 1);
  const diagnostic = JSON.parse(result.stderr);
  assert.equal(diagnostic.validationStatus, "incomplete");
  assert.ok(diagnostic.missingFragments.includes("quality-gate:"));
  assert.ok(diagnostic.missingFragments.includes("save_cache:"));
});

function runVerifier(input) {
  return spawnSync(process.execPath, [verifierPath.pathname], { input, encoding: "utf8" });
}
