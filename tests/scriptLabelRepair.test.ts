import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { artifactPath } from "../src/core/artifacts";
import { reviewScriptContent } from "../src/safeguards/contentGuard";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateScript } from "../src/stages/script";
import { parseScriptSectionProviderPayloadWithRepair } from "../src/stages/scriptSections";
import { useTempProject } from "./helpers";

describe("script label repair", () => {
  useTempProject();

  it("repairs bounded local-model production label variants with evidence", () => {
    const result = parseScriptSectionProviderPayloadWithRepair(
      JSON.stringify({
        text: [
          "Anlatici: Ekip ölçümü kesin kanıt saymadan önce yeniden dener.",
          "Gorsel: Ekranda ham veri, cihaz hatası ve doğal süreç kartları görünür.",
          "Anlatyıcı: Böylece sahne aceleci bir keşif değil, dikkatli bir soru olarak kalır.",
        ].join(" "),
      }),
    );

    expect(result.text).toBe(
      [
        "Anlatıcı: Ekip ölçümü kesin kanıt saymadan önce yeniden dener.",
        "Görsel: Ekranda ham veri, cihaz hatası ve doğal süreç kartları görünür.",
        "Anlatıcı: Böylece sahne aceleci bir keşif değil, dikkatli bir soru olarak kalır.",
      ].join(" "),
    );
    expect(result.labelRepair).toEqual({
      count: 3,
      variants: ["Anlatici:", "Anlatyıcı:", "Gorsel:"],
    });
  });

  it("persists label repair evidence without raw provider output", async () => {
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            llm: { ...defaultConfig.providers.llm, model: "mock-unaccented-script-labels" },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);

    await generateScript(runId);

    const script = await readFile(artifactPath(runId, "script.md"), "utf8");
    const sections = JSON.parse(
      await readFile(artifactPath(runId, "script.sections.json"), "utf8"),
    ) as { sections: Array<{ labelRepair?: { count: number; variants: string[] } }> };
    const repairedReceipts = sections.sections.filter((section) => section.labelRepair);

    expect(script).not.toContain("Anlatici:");
    expect(script).not.toContain("Gorsel:");
    expect(script).not.toContain("Anlatyıcı:");
    expect(reviewScriptContent(script).map((warning) => warning.code)).not.toContain(
      "malformed_production_label",
    );
    expect(repairedReceipts.length).toBeGreaterThan(0);
    expect(repairedReceipts[0]?.labelRepair).toEqual({
      count: expect.any(Number),
      variants: expect.arrayContaining(["Anlatici:", "Gorsel:"]),
    });
  });
});
