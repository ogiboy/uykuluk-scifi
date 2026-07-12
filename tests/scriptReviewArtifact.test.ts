import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

describe("script review artifact", () => {
  useTempProject();

  it("shows the warning acknowledgement command when non-blocking warnings remain", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await writeFile(
      artifactPath(runId, "script.md"),
      [
        "# Uyarılı Senaryo",
        "",
        "Bazı uzak dünyalar vardır; bilimsel olasılıkları sakin ve ihtiyatlı biçimde düşünürüz.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
      "utf8",
    );

    await reviewScript(runId);

    const markdown = await readFile(artifactPath(runId, "reviews/script_review.md"), "utf8");
    expect(markdown).toContain(
      "pnpm producer approve script --run <run_id> --acknowledge-warnings",
    );
  });

  it("shows blocker remediation guidance instead of approval instructions", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await writeFile(
      artifactPath(runId, "script.md"),
      [
        "# Engelli Senaryo",
        "",
        "Narrator: This draft contains English production directions.",
        "",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
      "utf8",
    );

    await reviewScript(runId);

    const markdown = await readFile(artifactPath(runId, "reviews/script_review.md"), "utf8");
    expect(markdown).toContain("Resolve blocking review findings before script approval.");
    expect(markdown).not.toContain("pnpm producer approve script");
  });

  it("requires acknowledgement when script metadata identifies fact-check claims", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await writeFile(
      artifactPath(runId, "script.md"),
      [
        "# Europa Ölçümü",
        "",
        "Anlatıcı: Europa okyanusu hakkında bu gözlem kesin kanıt değildir.",
        "Görsel: Ham veri ve alternatif açıklamalar yan yana görünür.",
        "UykulukSciFi'de yeniden buluşalım.",
      ].join("\n"),
      "utf8",
    );

    const review = await reviewScript(runId);

    expect(review.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "claims_require_fact_check",
          details: { claimCount: "1" },
          severity: "warning",
        }),
      ]),
    );
  });
});
