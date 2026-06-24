import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import { reviewScriptContent } from "../src/safeguards/contentGuard";
import {
  renderScriptSectionExpansionPrompt,
  renderScriptSectionPrompt,
  scriptSectionExpansionResponseFormat,
  scriptSectionExpansionChunks,
  scriptSectionPlans,
  scriptSectionResponseFormat,
  sectionExpansionTokenCap,
  sectionTokenCap,
  parseScriptSectionProviderPayload,
} from "../src/stages/scriptSections";
import { useTempProject } from "./helpers";

describe("sectional script generation", () => {
  useTempProject();

  it("persists section receipts and assembles the script from bounded provider calls", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);

    const meta = await generateScript(runId);

    const script = await readFile(artifactPath(runId, "script.md"), "utf8");
    const sections = JSON.parse(
      await readFile(artifactPath(runId, "script.sections.json"), "utf8"),
    ) as {
      sectionCount: number;
      providerCallCount: number;
      sections: Array<{
        id: string;
        pass: "draft" | "expansion";
        chunk?: number;
        heading: string;
        promptHash: string;
        contentHash: string;
        wordCount: number;
      }>;
    };
    expect(meta.sectionCount).toBe(4);
    expect(meta.wordCount).toBeGreaterThanOrEqual(1200);
    expect(sections.sectionCount).toBe(4);
    expect(sections.providerCallCount).toBe(16);
    expect(sections.sections).toHaveLength(16);
    expect(
      sections.sections
        .map((section) =>
          section.pass === "expansion"
            ? `${section.id}:${section.pass}:${section.chunk}`
            : `${section.id}:${section.pass}`,
        )
        .sort((left, right) => left.localeCompare(right)),
    ).toEqual([
      "context:draft",
      "context:expansion:1",
      "context:expansion:2",
      "context:expansion:3",
      "development:draft",
      "development:expansion:1",
      "development:expansion:2",
      "development:expansion:3",
      "hook:draft",
      "hook:expansion:1",
      "hook:expansion:2",
      "hook:expansion:3",
      "outro:draft",
      "outro:expansion:1",
      "outro:expansion:2",
      "outro:expansion:3",
    ]);
    expect(sections.sections.every((section) => section.wordCount > 0)).toBe(true);
    expect(sections.sections.every((section) => /^[a-f0-9]{64}$/.test(section.promptHash))).toBe(
      true,
    );
    expect(sections.sections.every((section) => /^[a-f0-9]{64}$/.test(section.contentHash))).toBe(
      true,
    );
    expect(script).toContain("## Açılış");
    expect(script).toContain("## Kapanış");
    expect(script).not.toContain("SECTION_DONE");
    expect(reviewScriptContent(script).map((warning) => warning.code)).not.toContain("too_short");
    expect((await loadRun(runId)).artifacts).toEqual(
      expect.arrayContaining(["script.md", "script.meta.json", "script.sections.json"]),
    );
  });

  it("keeps section prompts short enough for local models to finish", () => {
    const basePrompt = [
      "SCRIPT_MARKDOWN",
      "Target at least 20 minutes of estimated narration time.",
      "Prefer 1,600+ words for local model drafts.",
      "## Approved Idea",
      '{"title":"Deneme"}',
    ].join("\n\n");
    const prompt = renderScriptSectionPrompt(basePrompt, scriptSectionPlans[0]);
    const expansionPrompt = renderScriptSectionExpansionPrompt(
      basePrompt,
      scriptSectionPlans[0],
      "Anlatıcı: Tamamlanmış bölüm.",
    );

    expect(sectionTokenCap(3200)).toBe(500);
    expect(prompt).toContain("SCRIPT_SECTION_JSON");
    expect(prompt).toContain("## Approved Idea");
    expect(prompt).not.toContain("Target at least 20 minutes");
    expect(prompt).not.toContain("1,600+ words");
    expect(prompt).toContain("50-90 kelime");
    expect(prompt).toContain("Tek paragraf");
    expect(prompt).toContain('"text"');
    expect(expansionPrompt).toContain("Do not write the full script");
    expect(expansionPrompt).toContain("Expansion chunk: 1/3");
    expect(expansionPrompt).toContain("1100 characters");
    expect(expansionPrompt).not.toContain("Target at least 20 minutes");
    expect(scriptSectionResponseFormat.properties.text).toMatchObject({ maxLength: 750 });
    expect(scriptSectionExpansionChunks).toHaveLength(3);
    expect(sectionExpansionTokenCap(3200)).toBe(1000);
    expect(scriptSectionExpansionResponseFormat.properties.text).toMatchObject({
      maxLength: 1400,
    });
  });

  it("parses section JSON from noisy local model prose", () => {
    expect(
      parseScriptSectionProviderPayload(
        'Elbette:\n{"text":"Anlatıcı: Tamamlanmış bölüm."}\nNot: dış açıklama.',
      ),
    ).toBe("Anlatıcı: Tamamlanmış bölüm.");
    expect(() => parseScriptSectionProviderPayload('{"copy":"eksik"}')).toThrow(
      /Invalid script section provider response/,
    );
  });

  it("trims incomplete trailing section fragments before artifact assembly", () => {
    expect(
      parseScriptSectionProviderPayload(
        '{"text":"Anlatıcı: İlk cümle tamam. Görsel: İkinci cümle tamam. Anlatıcı: yarım"}',
      ),
    ).toBe("Anlatıcı: İlk cümle tamam. Görsel: İkinci cümle tamam.");
    expect(() => parseScriptSectionProviderPayload('{"text":"Anlatıcı: yarım"}')).toThrow(
      /complete sentence/i,
    );
  });
});
