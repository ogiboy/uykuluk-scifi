import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { loadRun } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import {
  renderScriptSectionPrompt,
  scriptSectionPlans,
  scriptSectionResponseFormat,
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
      sections: Array<{
        id: string;
        heading: string;
        promptHash: string;
        contentHash: string;
        wordCount: number;
      }>;
    };
    expect(meta.sectionCount).toBe(4);
    expect(sections.sectionCount).toBe(4);
    expect(sections.sections).toHaveLength(4);
    expect(sections.sections.map((section) => section.id)).toEqual([
      "hook",
      "context",
      "development",
      "outro",
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
    expect((await loadRun(runId)).artifacts).toEqual(
      expect.arrayContaining(["script.md", "script.meta.json", "script.sections.json"]),
    );
  });

  it("keeps section prompts short enough for local models to finish", () => {
    const prompt = renderScriptSectionPrompt("SCRIPT_MARKDOWN\nBase", scriptSectionPlans[0]);

    expect(sectionTokenCap(3200)).toBe(500);
    expect(prompt).toContain("SCRIPT_SECTION_JSON");
    expect(prompt).toContain("50-90 kelime");
    expect(prompt).toContain("Tek paragraf");
    expect(prompt).toContain('"text"');
    expect(scriptSectionResponseFormat.properties.text).toMatchObject({ maxLength: 750 });
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
