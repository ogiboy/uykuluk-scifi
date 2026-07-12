import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun } from "../src/core/runStore";
import { canTransition } from "../src/core/transitions";
import { reviseScript } from "../src/revisions/scriptRevision";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("script revisions", () => {
  useTempProject();

  it("snapshots an approved script, invalidates stale review/approval, and supports re-review", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await reviewScript(runId);
    const approval = await approveScript(runId, { acknowledgeWarnings: true });
    const before = await readFile(artifactPath(runId, "script.md"), "utf8");
    const revised = `${before.trim()}\n\nOperator tarafından eklenen doğrulanabilir bölüm.\n`;

    const revision = await reviseScript({
      runId,
      content: revised,
      reason: "Bilimsel bağlamı netleştir",
      editor: "ogiboy",
    });

    const run = await loadRun(runId);
    const refreshedMeta = await readJsonFile<{
      estimatedDuration: string;
      narrationWordCount: number;
      wordCount: number;
    }>(artifactPath(runId, "script.meta.json"));
    expect(run.state).toBe("SCRIPT_GENERATED");
    expect(run.approvals.some((item) => item.target === "script")).toBe(false);
    expect(run.artifacts.some((item) => item.startsWith("reviews/"))).toBe(false);
    expect(run.warnings).toEqual([]);
    expect(revision).toMatchObject({
      runId,
      artifact: "script.md",
      editor: "ogiboy",
      reason: "Bilimsel bağlamı netleştir",
      previousState: "SCRIPT_APPROVED",
      nextState: "SCRIPT_GENERATED",
      invalidatedApprovalIds: [approval.approvalId],
      refreshedArtifacts: ["script.meta.json"],
    });
    expect(revision.beforeHash).not.toBe(revision.afterHash);

    const revisionDir = `revisions/script/${revision.revisionId}`;
    expect(await readFile(artifactPath(runId, `${revisionDir}/before.md`), "utf8")).toBe(before);
    expect(await readFile(artifactPath(runId, `${revisionDir}/after.md`), "utf8")).toBe(revised);
    expect(await pathExists(artifactPath(runId, `${revisionDir}/before.meta.json`))).toBe(true);
    expect(await pathExists(artifactPath(runId, `${revisionDir}/after.meta.json`))).toBe(true);
    expect(await readJsonFile(artifactPath(runId, `${revisionDir}/revision.json`))).toEqual(
      revision,
    );
    expect(await readFile(artifactPath(runId, "script.md"), "utf8")).toBe(revised);
    expect(refreshedMeta.wordCount).toBe(revised.trim().split(/\s+/u).filter(Boolean).length);
    expect(refreshedMeta.narrationWordCount).toBeGreaterThan(0);
    expect(refreshedMeta.narrationWordCount).toBeLessThanOrEqual(refreshedMeta.wordCount);
    expect(refreshedMeta.estimatedDuration).toMatch(/^\d+-\d+ dakika$/u);
    expect(
      (await readLedger(runId)).some(
        (event) =>
          event.type === "ARTIFACT_REVISED" &&
          event.stage === "revise-script" &&
          (event.data as { revisionId?: string }).revisionId === revision.revisionId,
      ),
    ).toBe(true);

    await reviewScript(runId);
    await expect(approveScript(runId, { acknowledgeWarnings: true })).resolves.toMatchObject({
      target: "script",
    });
  });

  it("includes revision metadata in the evidence bundle", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    const before = await readFile(artifactPath(runId, "script.md"), "utf8");
    const revision = await reviseScript({
      runId,
      content: `${before.trim()}\n\nYeni son.\n`,
      reason: "Son bölümü güçlendir",
      editor: "operator",
    });

    const evidence = (await generateEvidenceBundle(runId)) as { revisions: string[] };

    expect(evidence.revisions).toEqual([`revisions/script/${revision.revisionId}/revision.json`]);
  });

  it("blocks unchanged, empty, and post-package revisions", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    const current = await readFile(artifactPath(runId, "script.md"), "utf8");

    await expect(
      reviseScript({ runId, content: current, reason: "No change", editor: "operator" }),
    ).rejects.toThrow(/different/i);
    await expect(
      reviseScript({ runId, content: "   ", reason: "Empty", editor: "operator" }),
    ).rejects.toThrow(/empty/i);

    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);
    await expect(
      reviseScript({
        runId,
        content: `${current}\nBlocked late edit.`,
        reason: "Too late",
        editor: "operator",
      }),
    ).rejects.toThrow(/SCRIPT_GENERATED|SCRIPT_REVIEWED|SCRIPT_APPROVED/);
    expect(await pathExists(artifactPath(runId, "production/production_package.md"))).toBe(true);
  });

  it("declares the safe revision state transitions", () => {
    expect(canTransition("SCRIPT_REVIEWED", "SCRIPT_GENERATED")).toBe(true);
    expect(canTransition("SCRIPT_APPROVED", "SCRIPT_GENERATED")).toBe(true);
    expect(canTransition("PRODUCTION_PACKAGE_GENERATED", "SCRIPT_GENERATED")).toBe(false);
  });
});
