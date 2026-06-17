import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { pathExists } from "../src/utils/fs";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { estimateCost } from "../src/stages/estimate";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

describe("mock pipeline", () => {
  useTempProject();

  it("runs the full safe MVP path", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId);
    await generateProductionPackage(runId);
    await estimateCost(runId);
    await generateEvidenceBundle(runId);
    const readiness = await runReadiness(runId);

    expect(readiness.passed).toBe(true);
    expect((await loadRun(runId)).state).toBe("READY_FOR_MANUAL_PRODUCTION");
    for (const artifact of [
      "ideas.json",
      "ideas.md",
      "script.md",
      "script.meta.json",
      "reviews/script_review.json",
      "reviews/script_review.md",
      "production/voiceover.txt",
      "production/subtitles.srt",
      "production/scenes.json",
      "production/youtube_metadata.json",
      "production/production_package.md",
      "costs/estimate.json",
      "costs/estimate.md",
      "evidence_bundle.md",
      "evidence_bundle.json",
      "diagnostics/readiness.json",
      "diagnostics/readiness.md",
    ]) {
      expect(await pathExists(artifactPath(runId, artifact))).toBe(true);
    }
  });
});
