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
      "pnpm producer approve script --run <run_id> --acknowledge-warnings",
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

  it("keeps reference voiceover audio explicit before render approval", () => {
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
    ).toBe(
      "Review deterministic reference audio; approve render only for a local timing draft with pnpm producer approve render --run <run_id>",
    );
  });
});
