import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { readLedger } from "../src/core/ledger";
import { loadRun, saveRun } from "../src/core/runStore";
import { revisePackageArtifact } from "../src/revisions/packageArtifactRevision";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { estimateCost } from "../src/stages/estimate";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { verifyProductionPackage } from "../src/stages/productionPackageIntegrity";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { pathExists } from "../src/utils/fs";
import { readJsonFile } from "../src/utils/json";
import { useTempProject } from "./helpers";

describe("package artifact revisions", () => {
  useTempProject();

  it("records an attributed package artifact edit and refreshes manifest integrity", async () => {
    const runId = await packagedRun();
    let run = await loadRun(runId);
    run = await writeRunText(run, "test", "production/render_plan.json", "{}");
    run = await writeRunText(run, "test", "production/storyboard_contact_sheet.md", "old sheet");
    run = await writeRunText(run, "test", "production/asset_provenance.json", "{}");
    run = await writeRunText(run, "test", "evidence_bundle.json", "{}");
    run = await writeRunText(run, "test", "diagnostics/readiness.json", "{}");
    await saveRun(run);
    const before = await readFile(artifactPath(runId, "production/subtitles.srt"), "utf8");
    const revisedSubtitles = "1\n00:00:00,000 --> 00:00:03,000\nRevize altyazı.\n";

    const revision = await revisePackageArtifact({
      runId,
      artifactKey: "subtitles",
      content: revisedSubtitles,
      reason: "Altyazı okunurluğunu artır",
      editor: "ogiboy",
    });

    const updated = await loadRun(runId);
    expect(updated.state).toBe("PRODUCTION_PACKAGE_GENERATED");
    expect(revision).toMatchObject({
      runId,
      artifactKey: "subtitles",
      artifactPath: "production/subtitles.srt",
      editor: "ogiboy",
      reason: "Altyazı okunurluğunu artır",
      previousState: "PRODUCTION_PACKAGE_GENERATED",
    });
    expect(revision.beforeHash).not.toBe(revision.afterHash);
    expect(revision.previousManifestDigest).not.toBe(revision.nextManifestDigest);
    expect(revision.invalidatedArtifacts).toEqual(
      expect.arrayContaining([
        "production/render_plan.json",
        "production/storyboard_contact_sheet.md",
        "production/asset_provenance.json",
        "evidence_bundle.json",
        "diagnostics/readiness.json",
      ]),
    );
    const revisionDir = `revisions/package/${revision.revisionId}`;
    expect(await readFile(artifactPath(runId, `${revisionDir}/before/subtitles.srt`), "utf8")).toBe(
      before,
    );
    expect(await readFile(artifactPath(runId, `${revisionDir}/after/subtitles.srt`), "utf8")).toBe(
      revisedSubtitles,
    );
    expect(await readJsonFile(artifactPath(runId, `${revisionDir}/revision.json`))).toEqual(
      revision,
    );
    expect(await readFile(artifactPath(runId, "production/subtitles.srt"), "utf8")).toBe(
      revisedSubtitles,
    );
    await expect(verifyProductionPackage(updated)).resolves.toMatchObject({ manifest: { runId } });
    expect(await pathExists(artifactPath(runId, "production/render_plan.json"))).toBe(false);
    expect(
      (await readLedger(runId)).some(
        (event) =>
          event.type === "ARTIFACT_REVISED" &&
          event.stage === "revise-package-artifact" &&
          (event.data as { revisionId?: string }).revisionId === revision.revisionId,
      ),
    ).toBe(true);

    const evidence = (await generateEvidenceBundle(runId)) as { revisions: string[] };
    expect(evidence.revisions).toContain(`revisions/package/${revision.revisionId}/revision.json`);
  });

  it("validates structured package artifact edits before writing them", async () => {
    const runId = await packagedRun();

    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "unknown",
        content: "ignored",
        reason: "Bad target",
        editor: "operator",
      }),
    ).rejects.toThrow(/Unknown package artifact revision target/i);
    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "scenes",
        content: JSON.stringify({ scenes: [] }),
        reason: "Bad scenes",
        editor: "operator",
      }),
    ).rejects.toThrow(/Invalid scenes revision content/i);
    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "youtube-metadata",
        content: JSON.stringify({ title: "Eksik" }),
        reason: "Bad metadata",
        editor: "operator",
      }),
    ).rejects.toThrow(/Invalid youtube-metadata revision content/i);
    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "subtitles",
        content: "No timing markers here.",
        reason: "Bad subtitles",
        editor: "operator",
      }),
    ).rejects.toThrow(/SRT timing marker/i);
    expect(
      (await readLedger(runId)).filter(
        (event) => event.type === "GUARD_BLOCKED" && event.stage === "revise-package-artifact",
      ).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("blocks revisions after cost estimation starts", async () => {
    const runId = await packagedRun();
    await estimateCost(runId);

    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "popup-cards",
        content: "# Production Package\n\n## Popup Cards\n\n- Revize kart\n",
        reason: "Too late",
        editor: "operator",
      }),
    ).rejects.toThrow(/PRODUCTION_PACKAGE_GENERATED/);
  });

  it("records popup-card package markdown revisions before downstream work", async () => {
    const runId = await packagedRun();
    const before = await readFile(artifactPath(runId, "production/production_package.md"), "utf8");
    const after = `${before.trim()}\n\n## Operator Popup Notes\n\n- Popup Cards bölümü korundu; kart vurgusu revize edildi.\n`;

    const revision = await revisePackageArtifact({
      runId,
      artifactKey: "popup-cards",
      content: after,
      reason: "Popup kart vurgusunu güçlendir",
      editor: "operator",
    });

    expect(revision).toMatchObject({
      artifactKey: "popup-cards",
      artifactPath: "production/production_package.md",
    });
    expect(await readFile(artifactPath(runId, "production/production_package.md"), "utf8")).toBe(
      after,
    );
  });

  it("blocks unchanged edits and missing attribution", async () => {
    const runId = await packagedRun();
    const current = await readFile(artifactPath(runId, "production/subtitles.srt"), "utf8");

    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "subtitles",
        content: current,
        reason: "No change",
        editor: "operator",
      }),
    ).rejects.toThrow(/different/i);
    await expect(
      revisePackageArtifact({
        runId,
        artifactKey: "subtitles",
        content: `${current.trim()}\n`,
        reason: " ",
        editor: "operator",
      }),
    ).rejects.toThrow(/reason and editor/i);
  });
});

async function packagedRun(): Promise<string> {
  const { runId, ideas } = await runIdeas();
  await approveIdea(runId, ideas[0].id);
  await generateScript(runId);
  await reviewScript(runId);
  await approveScript(runId, { acknowledgeWarnings: true });
  await generateProductionPackage(runId);
  return runId;
}
