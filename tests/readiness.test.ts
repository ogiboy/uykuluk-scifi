import { describe, expect, it } from "vitest";
import { uploadPrivatePlaceholder, publishSchedulePlaceholder } from "../src/stages/disabled";
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

describe("readiness and disabled public actions", () => {
  useTempProject();

  it("warns when brand assets are missing but passes core MVP", async () => {
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
    expect(readiness.checks.find((check) => check.name === "brand assets present")?.status).toBe(
      "warn",
    );
    expect(
      readiness.checks.find(
        (check) => check.name === "public upload disabled without explicit config",
      )?.status,
    ).toBe("pass");
  });

  it("blocks upload and publish by default", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    await approveScript(runId);
    await generateProductionPackage(runId);
    await estimateCost(runId);
    await generateEvidenceBundle(runId);
    await runReadiness(runId);

    await expect(uploadPrivatePlaceholder(runId)).rejects.toThrow(
      /requires explicit upload approval|Upload is disabled/,
    );
    await expect(publishSchedulePlaceholder(runId)).rejects.toThrow(
      /requires explicit publish approval|Publish is disabled/,
    );
  });
});
