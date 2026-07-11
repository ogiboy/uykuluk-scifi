import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { runReadiness } from "../src/stages/readiness";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("mock pipeline", () => {
  useTempProject();

  it("runs the full safe MVP path", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
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
      "production/production_package.meta.json",
      "costs/estimate.json",
      "costs/estimate.md",
      "evidence_bundle.md",
      "evidence_bundle.json",
      "diagnostics/readiness.json",
      "diagnostics/readiness.md",
    ]) {
      expect(await pathExists(artifactPath(runId, artifact))).toBe(true);
    }
    const evidence = await readJsonFile<{
      promptProvenance: Array<{ key: string; hash: string; artifact: string }>;
      revisions: string[];
      costReservations: unknown[];
      productionPackageIntegrity: {
        status: string;
        path: string;
        digest: string;
        artifactCount: number;
      };
    }>(artifactPath(runId, "evidence_bundle.json"));
    expect(evidence.revisions).toEqual([]);
    expect(evidence.costReservations).toEqual([]);
    expect(evidence.productionPackageIntegrity).toEqual({
      status: "pass",
      path: "production/production_package.meta.json",
      digest: expect.stringMatching(/^[a-f0-9]{64}$/),
      artifactCount: 5,
    });
    expect(evidence.promptProvenance).toEqual([
      {
        key: "ideas",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        artifact: "ideas.json",
        source: "prompts/defaults/planner-task.md",
      },
      {
        key: "script",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        artifact: "script.md",
        source: "prompts/defaults/scriptwriter-task.md",
      },
      {
        key: "production-package",
        hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        artifact: "production/production_package.md",
        source: "prompts/defaults/production-package-task.md",
      },
    ]);
  });
});
