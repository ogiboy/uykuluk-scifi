import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  isStudioHostedVoiceExecutionConfirmed,
  studioHostedVoiceExecutionIdentity,
} from "../apps/studio/src/lib/runs/voiceAuditionSummaryTypes";
import { getStudioRunDetail } from "../apps/studio/src/lib/runSummaries";
import { artifactPath } from "../src/core/artifacts";
import { createRun } from "../src/core/runStore";
import { reviseVoiceSelection } from "../src/revisions/voiceSelectionRevision";
import { generateVoiceCandidates } from "../src/stages/voiceCandidates";
import { generateVoicePreview } from "../src/stages/voicePreview";
import { selectVoice } from "../src/stages/voiceSelection";
import { prepareApprovedSelectedVoiceRun } from "./elevenLabsVoiceWorkflowFixtures";
import { useTempProject } from "./helpers";
import { prepareVoiceoverReadyRun } from "./renderPipelineHelpers";
import { candidateVoiceId, prepareVoiceCatalog } from "./voiceAuditionStageFixtures";
import {
  defaultCatalogVoice,
  successfulCatalogProvider,
  successfulPreviewProvider,
} from "./voiceCatalogStageFixtures";

describe("Studio voice audition read model", () => {
  useTempProject();

  it("reads at most 24 persisted candidates and never calls providers on page load", async () => {
    const { runId } = await prepareVoiceCatalog({
      subscription: {
        tier: "creator",
        status: "active",
        characterCount: 1_000,
        characterLimit: 100_000,
        hasOpenInvoices: false,
      },
    });
    const catalogProvider = successfulCatalogProvider({
      subscription: {
        tier: "creator",
        status: "active",
        characterCount: 1_000,
        characterLimit: 100_000,
        hasOpenInvoices: false,
      },
      voices: Array.from({ length: 30 }, (_, index) =>
        defaultCatalogVoice({
          voiceId: `voice_${String(index).padStart(2, "0")}`,
          name: `Turkish Voice ${index + 1}`,
        }),
      ),
    });
    const fetchCatalog = vi.fn(catalogProvider.fetchCatalog.bind(catalogProvider));
    const catalog = await generateVoiceCandidates(runId, {
      provider: { ...catalogProvider, fetchCatalog },
    });
    const voiceId = candidateVoiceId(catalog);
    const previewProvider = successfulPreviewProvider(catalog);
    const fetchPreview = vi.fn(previewProvider.fetchPreview.bind(previewProvider));
    await generateVoicePreview(runId, voiceId, { provider: { ...previewProvider, fetchPreview } });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "studio-operator",
      notes: "Türkçe tonlama ve ritim yerel önizlemede karşılaştırıldı.",
      confirmProductionRights: true,
    });
    fetchCatalog.mockClear();
    fetchPreview.mockClear();

    const detail = await getStudioRunDetail(runId);

    expect(fetchCatalog).not.toHaveBeenCalled();
    expect(fetchPreview).not.toHaveBeenCalled();
    expect(detail?.voiceAudition.catalog).toMatchObject({ kind: "ready", modelId: "eleven_v3" });
    expect(detail?.voiceAudition.candidates).toHaveLength(24);
    expect(detail?.voiceAudition.candidates[0]).toMatchObject({
      isSelected: true,
      metadataFreshness: "fresh",
      preview: {
        kind: "ready",
        mediaUrl: expect.stringMatching(
          new RegExp(`^/runs/${runId}/media/production/audio/voice-previews/`),
        ),
      },
      productionRightsLabel: "Operator production-rights confirmation required",
      turkishSuitability: "verified",
    });
    expect(detail?.voiceAudition.currentSelection).toMatchObject({
      reviewedBy: "studio-operator",
      status: "current",
      voiceId,
    });
    expect(detail?.voiceAudition.production.quota).toEqual({
      limit: 100_000,
      remaining: 99_000,
      tier: "creator",
      used: 1_000,
    });
    expect(Object.keys(detail?.voiceAudition.actions ?? {}).sort()).toEqual([
      "voice.candidates",
      "voice.preview",
      "voice.reselect",
      "voice.run",
      "voice.select",
    ]);
    expect(JSON.stringify(detail?.voiceAudition)).not.toContain("https://");
  });

  it("projects the exact approved hosted operation for explicit Studio confirmation", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();

    const detail = await getStudioRunDetail(runId);

    expect(detail?.voiceAudition.production.hostedExecution).toEqual({
      approvalId: expect.stringMatching(/^approval_/),
      bindingDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      quoteDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(detail?.voiceAudition.actions["voice.run"]).toEqual({
      actionId: "voice.run",
      routePath: "/actions/run-voice",
    });
  });

  it("suppresses hosted confirmation when the approved quote becomes stale", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const config = JSON.parse(await readFile("producer.config.json", "utf8")) as {
      providers: { tts: { elevenLabs: { timeoutMs: number } } };
    };
    config.providers.tts.elevenLabs.timeoutMs += 1_000;
    await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");

    const detail = await getStudioRunDetail(runId);

    expect(detail?.voiceAudition.production.quote.status).toBe("blocked");
    expect(detail?.voiceAudition.production.hostedExecution).toBeNull();
    expect(detail?.voiceAudition.advanced.diagnostics.join(" ")).toMatch(/quote is stale/i);
  });

  it("binds hosted confirmation to the combined current operation identity", () => {
    const current = {
      approvalId: "approval_current",
      bindingDigest: "b".repeat(64),
      quoteDigest: "q".repeat(64),
    };
    const confirmedIdentity = studioHostedVoiceExecutionIdentity(current);

    expect(isStudioHostedVoiceExecutionConfirmed(current, confirmedIdentity)).toBe(true);
    expect(
      isStudioHostedVoiceExecutionConfirmed(
        { ...current, approvalId: "approval_refreshed" },
        confirmedIdentity,
      ),
    ).toBe(false);
    expect(
      isStudioHostedVoiceExecutionConfirmed(
        { ...current, bindingDigest: "c".repeat(64) },
        confirmedIdentity,
      ),
    ).toBe(false);
    expect(
      isStudioHostedVoiceExecutionConfirmed(
        { ...current, quoteDigest: "d".repeat(64) },
        confirmedIdentity,
      ),
    ).toBe(false);
  });

  it("exposes only local voice generation when local TTS fallback is configured", async () => {
    const run = await createRun();

    const detail = await getStudioRunDetail(run.runId);

    expect(detail?.voiceAudition.executionMode).toBe("local");
    expect(detail?.voiceAudition.executionModeMessage).toContain("Local TTS fallback");
    expect(detail?.voiceAudition.actions).toEqual({
      "voice.candidates": null,
      "voice.preview": null,
      "voice.reselect": null,
      "voice.run": { actionId: "voice.run", routePath: "/actions/run-voice" },
      "voice.select": null,
    });
  });

  it("reports validated local fallback voice and subtitle evidence as ready", async () => {
    const runId = await prepareVoiceoverReadyRun();

    const detail = await getStudioRunDetail(runId);

    expect(detail?.voiceAudition.production.synthesis).toMatchObject({
      mode: "deterministic-local",
      status: "ready",
    });
    expect(detail?.voiceAudition.production.synthesis.detail).toContain("Local fallback");
    expect(detail?.voiceAudition.production.alignment).toMatchObject({
      detail: expect.stringContaining("local fallback"),
      status: "ready",
    });
  });

  it("keeps selection history attributable while technical values stay in Advanced", async () => {
    const { catalog, runId } = await prepareVoiceCatalog();
    const voiceId = candidateVoiceId(catalog);
    await generateVoicePreview(runId, voiceId, { provider: successfulPreviewProvider(catalog) });
    await selectVoice(runId, { voiceId, reviewedBy: "operator-a", notes: "First local audition." });
    await selectVoice(runId, {
      voiceId,
      reviewedBy: "operator-b",
      notes: "Second local audition after A/B comparison.",
    });

    const detail = await getStudioRunDetail(runId);

    expect(detail?.voiceAudition.history).toEqual([
      expect.objectContaining({ reviewedBy: "operator-b", status: "current" }),
      expect.objectContaining({ reviewedBy: "operator-a", status: "superseded" }),
    ]);
    expect(detail?.voiceAudition.advanced.facts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "Catalog digest" }),
        expect.objectContaining({ label: "Selection digest" }),
      ]),
    );
    expect(detail?.voiceAudition.advanced.paths).toEqual(
      expect.arrayContaining(["ledger.jsonl", "costs/reservations.jsonl"]),
    );
  });

  it("rejects reselection history whose canonical provenance was changed", async () => {
    const { runId } = await prepareApprovedSelectedVoiceRun();
    const revision = await reviseVoiceSelection({
      runId,
      reviewedBy: "studio-reviewer",
      reason: "Compare another voice before production spend.",
    });
    const revisionPath = `revisions/voice-selection/${revision.revisionId}/revision.json`;
    await writeFile(
      artifactPath(runId, revisionPath),
      `${JSON.stringify(
        {
          ...revision,
          previousSelection: { ...revision.previousSelection, digest: "f".repeat(64) },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const detail = await getStudioRunDetail(runId);

    expect(detail?.voiceAudition.history).toEqual([]);
    expect(detail?.voiceAudition.advanced.diagnostics.join(" ")).toMatch(
      /does not match revision provenance/i,
    );
  });
});
