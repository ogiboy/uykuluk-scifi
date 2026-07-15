import { writeFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { readCostEstimate } from "../src/costs/costEstimate";
import { archiveActiveCostEstimate } from "../src/costs/costEstimateHistory";
import { renderCostEstimateMarkdown } from "../src/costs/costEstimatePresentation";
import { readCostEstimateByDigestAtProjectRoot } from "../src/costs/costEstimateStore";
import { estimateCost } from "../src/stages/estimate";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import { preparePackagedVisualRun } from "./visualTestHelpers";

describe("cost estimate history", () => {
  useTempProject();

  it("resolves an exact archived quote and rejects tampered or unknown history", async () => {
    const runId = await preparePackagedVisualRun();
    await estimateCost(runId);
    const active = await readCostEstimate(runId);
    const archived = await archiveActiveCostEstimate({
      run: await loadRun(runId),
      stage: "test-cost-history",
    });
    await saveRun(archived.run);

    expect(await pathExists(artifactPath(runId, "costs/estimate.json"))).toBe(false);
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), await loadRun(runId), active.digest),
    ).resolves.toMatchObject({ digest: active.digest, estimate: { runId } });
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), await loadRun(runId), "f".repeat(64)),
    ).rejects.toThrow(/not available/i);

    await writeFile(artifactPath(runId, archived.archive.markdownPath), "tampered\n", "utf8");
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), await loadRun(runId), active.digest),
    ).rejects.toThrow(/markdown/i);

    const changedEstimate = {
      ...active.estimate,
      generatedAt: new Date(Date.parse(active.estimate.generatedAt) + 1_000).toISOString(),
    };
    await writeFile(
      artifactPath(runId, archived.archive.jsonPath),
      `${JSON.stringify(changedEstimate, null, 2)}\n`,
      "utf8",
    );
    await writeFile(
      artifactPath(runId, archived.archive.markdownPath),
      `${renderCostEstimateMarkdown(changedEstimate)}\n`,
      "utf8",
    );
    await expect(
      readCostEstimateByDigestAtProjectRoot(process.cwd(), await loadRun(runId), active.digest),
    ).rejects.toThrow(/canonical digest path/i);
  });
});
