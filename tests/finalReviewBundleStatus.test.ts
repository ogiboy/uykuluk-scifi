import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun, saveRun } from "../src/core/runStore";
import { readFinalReviewBundleStatus } from "../src/stages/finalReview/finalReviewBundleStatus";
import {
  createFinalReviewBundle,
  finalReviewBundleJsonPath,
} from "../src/stages/finalReviewBundle";
import { recordRenderDecision, renderDecisionArtifactPaths } from "../src/stages/renderDecision";
import { useTempProject } from "./helpers";
import { renderLocalDraft } from "./renderPipelineHelpers";

describe("final review bundle status", () => {
  useTempProject();

  it("keeps final review bundle status actionable for pending and revision outcomes", async () => {
    const pendingRunId = await renderLocalDraft("final-review-status-pending");
    const pendingBundle = await createFinalReviewBundle(pendingRunId);

    const pendingStatus = await readFinalReviewBundleStatus(await loadRun(pendingRunId));

    expect(pendingBundle.status).toBe("decision-pending");
    expect(pendingStatus).toMatchObject({
      kind: "present",
      nextAction: expect.stringContaining(`pnpm producer decide render --run ${pendingRunId}`),
    });

    const revisionRunId = await renderLocalDraft("final-review-status-revision");
    await recordRenderDecision({
      decision: "needs-revision",
      notes: "Subtitle timing needs another pass.",
      reviewedBy: "operator",
      runId: revisionRunId,
    });
    const revisionBundle = await createFinalReviewBundle(revisionRunId);

    const revisionStatus = await readFinalReviewBundleStatus(await loadRun(revisionRunId));

    expect(revisionBundle.status).toBe("needs-revision");
    expect(revisionStatus).toMatchObject({
      kind: "present",
      nextAction: revisionBundle.nextSafeAction,
    });
  });

  it("marks tampered final review bundles invalid or stale instead of trusting file existence", async () => {
    const malformedRunId = await renderLocalDraft("final-review-status-invalid");
    await createFinalReviewBundle(malformedRunId);
    await writeFile(artifactPath(malformedRunId, finalReviewBundleJsonPath), "{", "utf8");

    await expect(readFinalReviewBundleStatus(await loadRun(malformedRunId))).resolves.toMatchObject(
      {
        kind: "invalid",
        message: expect.stringContaining("Final review bundle could not be trusted:"),
      },
    );

    const otherRunId = await renderLocalDraft("final-review-status-other-run");
    const otherBundle = await createFinalReviewBundle(otherRunId);
    await writeFile(
      artifactPath(otherRunId, finalReviewBundleJsonPath),
      JSON.stringify({ ...otherBundle, runId: "run_202606280001_other" }),
      "utf8",
    );

    await expect(readFinalReviewBundleStatus(await loadRun(otherRunId))).resolves.toMatchObject({
      kind: "stale",
      message: "Final review bundle belongs to a different run.",
    });

    const archivedRunId = await renderLocalDraft("final-review-status-archived");
    await createFinalReviewBundle(archivedRunId);
    const archivedRun = await loadRun(archivedRunId);
    await saveRun({ ...archivedRun, state: "ARCHIVED" });

    await expect(readFinalReviewBundleStatus(await loadRun(archivedRunId))).resolves.toMatchObject({
      kind: "stale",
      message: "Final review bundle was created, but the run is ARCHIVED.",
    });
  });

  it("marks final review bundles stale when the draft render digest changes", async () => {
    const digestRunId = await renderLocalDraft("final-review-status-digest");
    const digestBundle = await createFinalReviewBundle(digestRunId);
    await writeFile(
      artifactPath(digestRunId, finalReviewBundleJsonPath),
      JSON.stringify({
        ...digestBundle,
        draftRender: { ...digestBundle.draftRender, sha256: "f".repeat(64) },
      }),
      "utf8",
    );

    await expect(readFinalReviewBundleStatus(await loadRun(digestRunId))).resolves.toMatchObject({
      kind: "stale",
      message: "Final review bundle was created for a different draft render digest.",
    });
  });

  it("marks final review bundles stale when the recorded render decision is missing", async () => {
    const missingDecisionRunId = await renderLocalDraft("final-review-status-missing-decision");
    await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable.",
      reviewedBy: "operator",
      runId: missingDecisionRunId,
    });
    const missingDecisionBundle = await createFinalReviewBundle(missingDecisionRunId);
    await writeFile(
      artifactPath(missingDecisionRunId, finalReviewBundleJsonPath),
      JSON.stringify({
        ...missingDecisionBundle,
        renderDecision: {
          commandTemplates: [],
          kind: "missing",
          nextAction: `pnpm producer decide render --run ${missingDecisionRunId}`,
        },
      }),
      "utf8",
    );

    await expect(
      readFinalReviewBundleStatus(await loadRun(missingDecisionRunId)),
    ).resolves.toMatchObject({
      kind: "stale",
      message: "Final review bundle is missing the recorded render decision.",
    });
  });

  it("marks final review bundles stale when the render decision outcome changes", async () => {
    const changedDecisionRunId = await renderLocalDraft("final-review-status-changed-decision");
    const originalDecision = await recordRenderDecision({
      decision: "accepted-for-local-review",
      notes: "Draft is acceptable.",
      reviewedBy: "operator",
      runId: changedDecisionRunId,
    });
    await createFinalReviewBundle(changedDecisionRunId);
    await writeFile(
      renderDecisionArtifactPaths(changedDecisionRunId).json,
      JSON.stringify({ ...originalDecision, decision: "needs-revision" }),
      "utf8",
    );

    await expect(
      readFinalReviewBundleStatus(await loadRun(changedDecisionRunId)),
    ).resolves.toMatchObject({
      kind: "stale",
      message: "Final review bundle was created for a different render decision outcome.",
    });
  });
});
