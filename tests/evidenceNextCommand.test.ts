import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { approveIdea } from "../src/stages/approveIdea";
import { evidenceNextCommand } from "../src/stages/evidenceNextCommand";
import { generateEvidenceBundle } from "../src/stages/evidence";
import { runIdeas } from "../src/stages/ideas";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

describe("evidence next command", () => {
  useTempProject();

  it("recommends explicit warning acknowledgement for reviewed scripts with warnings", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await writeFile(
      artifactPath(runId, "script.md"),
      [
        "# Uyarılı Script",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
      "utf8",
    );
    await reviewScript(runId);

    const evidence = (await generateEvidenceBundle(runId)) as {
      warnings: string[];
      nextRecommendedCommand: string;
    };

    expect(evidence.warnings).toEqual(expect.arrayContaining([expect.stringMatching(/short/i)]));
    expect(evidence.nextRecommendedCommand).toBe(
      `pnpm producer approve script --run ${runId} --acknowledge-warnings`,
    );
  });

  it("does not recommend script approval while review blockers remain", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        scriptReview: {
          scriptReviewBlockerCount: 1,
          scriptReviewWarningCount: 1,
        },
        state: "SCRIPT_REVIEWED",
      }),
    ).not.toContain("approve script");
  });

  it("routes reference voiceover audio through read-only review before render approval", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        state: "READY_FOR_MANUAL_PRODUCTION",
        ttsEnabled: true,
        voiceoverAudio: {
          productionVoiceCandidate: false,
          status: "pass",
        },
      }),
    ).toBe("pnpm producer review voice --run <run_id>");
  });

  it("routes production voice candidates through read-only review before render approval", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        state: "READY_FOR_MANUAL_PRODUCTION",
        ttsEnabled: true,
        voiceoverAudio: {
          productionVoiceCandidate: true,
          status: "pass",
        },
      }),
    ).toBe("pnpm producer review voice --run <run_id>");
  });

  it("recommends TTS configuration when voiceover evidence is blocked and TTS is disabled", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        state: "READY_FOR_MANUAL_PRODUCTION",
        ttsEnabled: false,
        voiceoverAudio: {
          status: "block",
        },
      }),
    ).toBe("Enable local TTS in producer.config.json, then pnpm producer voice --run <run_id>");
  });

  it("recommends voiceover regeneration when voiceover evidence is blocked and TTS is enabled", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        state: "READY_FOR_MANUAL_PRODUCTION",
        ttsEnabled: true,
        voiceoverAudio: {
          status: "block",
        },
      }),
    ).toBe("pnpm producer voice --run <run_id>");
  });

  it("blocks render approval when passing voiceover evidence lacks production candidate proof", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        hasUnresolvedCostReservation: false,
        state: "READY_FOR_MANUAL_PRODUCTION",
        ttsEnabled: true,
        voiceoverAudio: {
          status: "pass",
        },
      }),
    ).toBe("Regenerate voiceover evidence before render approval.");
  });

  it("keeps blocked rendered evidence tied to the evidence refresh command", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        draftRender: {
          status: "block",
        },
        hasUnresolvedCostReservation: false,
        state: "RENDERED",
      }),
    ).toBe(
      "Regenerate evidence with pnpm producer evidence --run <run_id>; if draft artifacts remain blocked, revise upstream artifacts before a new render approval.",
    );
  });

  it("keeps missing rendered evidence tied to the evidence refresh command", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        draftRender: {
          status: "missing",
        },
        hasUnresolvedCostReservation: false,
        state: "RENDERED",
      }),
    ).toBe(
      "pnpm producer evidence --run <run_id> (draft render artifacts are missing or evidence is stale)",
    );
  });

  it("keeps rendered timing drafts separate from final production review", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        draftRender: {
          status: "pass",
          voiceoverProductionVoiceCandidate: false,
        },
        hasUnresolvedCostReservation: false,
        state: "RENDERED",
      }),
    ).toBe("pnpm producer review render --run <run_id>");
  });

  it("recommends the read-only draft render review command for production voice drafts", () => {
    expect(
      evidenceNextCommand({
        costQuote: null,
        draftRender: {
          status: "pass",
          voiceoverProductionVoiceCandidate: true,
        },
        hasUnresolvedCostReservation: false,
        state: "RENDERED",
      }),
    ).toBe("pnpm producer review render --run <run_id>");
  });
});
