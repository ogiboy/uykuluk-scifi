import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyDeliveryFile,
  reviewableFileLimit,
  summarizeDeliveryScope,
} from "./delivery-scope.mjs";

test("generated tool catalogs do not consume the reviewable file budget", () => {
  const generated = Array.from(
    { length: reviewableFileLimit + 50 },
    (_, index) => `.claude/commands/generated-${index}.md`,
  );
  const summary = summarizeDeliveryScope([...generated, "CLAUDE.md", "skills-lock.json"]);

  assert.equal(summary.rawChangedCount, reviewableFileLimit + 52);
  assert.equal(summary.reviewableChangedCount, 1);
  assert.equal(summary.withinReviewableLimit, true);
  assert.deepEqual(summary.requiredLanes, ["delivery-policy"]);
});

test("project policy remains reviewable while unknown paths fail closed to product", () => {
  assert.equal(classifyDeliveryFile(".ai/capabilities.instructions.md"), "policy");
  assert.equal(classifyDeliveryFile("CLAUDE.md"), "policy");
  assert.equal(classifyDeliveryFile("scripts/security/secret-scan.mjs"), "ci");
  assert.equal(classifyDeliveryFile("src/core/runState.ts"), "product");
  assert.equal(classifyDeliveryFile("unexpected/new-surface.txt"), "product");
});

test("product changes require all current quality lanes", () => {
  const summary = summarizeDeliveryScope(["src/core/runState.ts", ".claude/helpers/router.js"]);

  assert.deepEqual(summary.requiredLanes, [
    "delivery-policy",
    "quality-core",
    "sonar-cloud",
    "studio-browser",
  ]);
  assert.equal(summary.reviewableChangedCount, 1);
});

test("reviewable files retain the 100-file limit", () => {
  const files = Array.from(
    { length: reviewableFileLimit + 1 },
    (_, index) => `src/generated-for-test/file-${index}.ts`,
  );
  const summary = summarizeDeliveryScope(files);

  assert.equal(summary.withinReviewableLimit, false);
  assert.equal(summary.reviewableChangedCount, reviewableFileLimit + 1);
});

test("manual API pipelines can force the complete product lane", () => {
  const summary = summarizeDeliveryScope(["docs/ci.md"], { forceProduct: true });

  assert.ok(summary.requiredLanes.includes("quality-core"));
  assert.ok(summary.requiredLanes.includes("studio-browser"));
});
