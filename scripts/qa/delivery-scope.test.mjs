import { deepStrictEqual, ok, strictEqual } from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyDeliveryFile,
  fullCiLanes,
  reviewableFileLimit,
  summarizeDeliveryScope,
} from "./delivery-scope.mjs";

test("generated tool catalogs do not consume the reviewable file budget", () => {
  const generated = Array.from(
    { length: reviewableFileLimit + 50 },
    (_, index) => `.claude/commands/generated-${index}.md`,
  );
  const summary = summarizeDeliveryScope([...generated, "CLAUDE.md", "skills-lock.json"]);

  strictEqual(summary.rawChangedCount, reviewableFileLimit + 52);
  strictEqual(summary.reviewableChangedCount, 1);
  strictEqual(summary.withinReviewableLimit, true);
  deepStrictEqual(summary.requiredLanes, ["delivery-policy"]);
});

test("project policy remains reviewable while unknown paths fail closed to product", () => {
  strictEqual(classifyDeliveryFile(".ai/capabilities.instructions.md"), "policy");
  strictEqual(classifyDeliveryFile("CLAUDE.md"), "policy");
  strictEqual(classifyDeliveryFile("CONTEXT.md"), "policy");
  strictEqual(classifyDeliveryFile("DESIGN.md"), "policy");
  strictEqual(classifyDeliveryFile(".nvmrc"), "ci");
  strictEqual(classifyDeliveryFile("scripts/security/secret-scan.mjs"), "ci");
  strictEqual(classifyDeliveryFile("src/core/runState.ts"), "product");
  strictEqual(classifyDeliveryFile("unexpected/new-surface.txt"), "product");
});

test("product changes require the full CI DAG", () => {
  const summary = summarizeDeliveryScope(["src/core/runState.ts", ".claude/helpers/router.js"]);

  deepStrictEqual(summary.requiredLanes, fullCiLanes);
  strictEqual(summary.reviewableChangedCount, 1);
});

test("CI changes require the full CI DAG", () => {
  const summary = summarizeDeliveryScope([".circleci/config.yml"]);

  deepStrictEqual(summary.requiredLanes, fullCiLanes);
});

test("reviewable files retain the 100-file limit", () => {
  const files = Array.from(
    { length: reviewableFileLimit + 1 },
    (_, index) => `src/generated-for-test/file-${index}.ts`,
  );
  const summary = summarizeDeliveryScope(files);

  strictEqual(summary.withinReviewableLimit, false);
  strictEqual(summary.reviewableChangedCount, reviewableFileLimit + 1);
});

test("manual API pipelines can force the complete product lane", () => {
  const summary = summarizeDeliveryScope(["docs/ci.md"], { forceProduct: true });

  ok(summary.requiredLanes.includes("static-quality"));
  ok(summary.requiredLanes.includes("unit-results"));
  ok(summary.requiredLanes.includes("studio-browser"));
});

test("local agent runtime state stays ignored by repository policy", () => {
  const ignorePatterns = new Set(
    readFileSync(".gitignore", "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const expectedPattern of [".claude-flow/", ".omx/", ".ruflo/", ".swarm/"]) {
    ok(ignorePatterns.has(expectedPattern), `${expectedPattern} must remain ignored`);
  }
});
