import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { defaultConfig } from "../src/config/config";
import { sha256 } from "../src/utils/hash";
import { readJsonFile } from "../src/utils/json";
import { pathExists } from "../src/utils/fs";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { renderIdeasPrompt } from "../src/prompts/templates";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { renderScriptSectionPrompt, scriptSectionPlans } from "../src/stages/scriptSections";
import { useTempProject } from "./helpers";

describe("runtime prompt defaults", () => {
  useTempProject();

  it("keeps the planner prompt anchored to a distinct reviewable idea slate", async () => {
    const plannerTemplate = await defaultPrompt("planner-task.md");

    expect(plannerTemplate).toContain("Return exactly 8 ideas.");
    expect(plannerTemplate).toContain("Use eight different topic lanes");
    expect(plannerTemplate).toContain("Do not reuse the same protagonist");
    expect(plannerTemplate).toContain(
      "Do not use `Uyku`, `Yıldız`, `Karanlık`, `Mesaj`, or `Gezegen`",
    );
  });

  it("keeps script section prompts anchored to exact Turkish production labels", () => {
    const prompt = renderScriptSectionPrompt(
      "SCRIPT_MARKDOWN\n\n## Approved Idea\n{}",
      scriptSectionPlans[0],
    );

    expect(prompt).toContain("Spell production labels exactly as `Anlatıcı:` and `Görsel:`");
    expect(prompt).toContain("Forbidden label variants");
    expect(prompt).toContain("`Anlatyıcı:`");
    expect(prompt).toContain("`Gorsel:`");
    expect(prompt).toContain("`Sahne:`");
    expect(prompt).toContain("Do not append compliance checklists");
  });

  it("keeps the scriptwriter prompt anchored to anti-repetition constraints", async () => {
    const scriptTemplate = await defaultPrompt("scriptwriter-task.md");

    expect(scriptTemplate).toContain("sentence skeleton");
    expect(scriptTemplate).toContain("genuinely new beat");
    expect(scriptTemplate).toContain("Do not append compliance checklists");
  });

  it("uses product runtime prompt defaults without requiring .ai files", async () => {
    expect(await pathExists(".ai")).toBe(false);

    const plannerTemplate = await defaultPrompt("planner-task.md");
    const scriptTemplate = await defaultPrompt("scriptwriter-task.md");
    const packageTemplate = await defaultPrompt("production-package-task.md");

    const { runId, ideas } = await runIdeas();
    const ideasArtifact = await readJsonFile<{
      prompt: { hash: string; source: string };
    }>(artifactPath(runId, "ideas.json"));
    expect(ideasArtifact.prompt).toEqual({
      key: "ideas",
      hash: sha256(["IDEAS_JSON", plannerTemplate].join("\n\n")),
      artifact: "ideas.json",
      source: "prompts/defaults/planner-task.md",
    });

    await approveIdea(runId, ideas[0].id);
    const scriptMeta = await generateScript(runId);
    const baseScriptPrompt = [
      "SCRIPT_MARKDOWN",
      scriptTemplate,
      "## Approved Idea",
      JSON.stringify(ideas[0]),
    ].join("\n\n");
    const oldDraftOnlyHash = sha256(
      scriptSectionPlans
        .map((section) => renderScriptSectionPrompt(baseScriptPrompt, section))
        .join("\n\n---\n\n"),
    );
    expect(scriptMeta.prompt).toMatchObject({
      key: "script",
      artifact: "script.md",
      source: "prompts/defaults/scriptwriter-task.md",
    });
    expect(scriptMeta.prompt.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(scriptMeta.prompt.hash).not.toBe(oldDraftOnlyHash);

    await reviewScript(runId);
    await approveScript(runId, { acknowledgeWarnings: true });
    await generateProductionPackage(runId);
    const script = await readFile(artifactPath(runId, "script.md"), "utf8");
    const packageMeta = await readJsonFile<{
      prompt: { hash: string; source: string };
    }>(artifactPath(runId, "production/production_package.meta.json"));
    expect(packageMeta.prompt).toEqual({
      key: "production-package",
      hash: sha256(
        ["PRODUCTION_PACKAGE_JSON", packageTemplate, "## Approved Script", script.trim()].join(
          "\n\n",
        ),
      ),
      artifact: "production/production_package.md",
      source: "prompts/defaults/production-package-task.md",
    });
  });

  it("uses explicit ignored local prompt overrides without requiring .ai files", async () => {
    const localPrompt = "Return exactly 8 sharply distinct local override ideas.";
    await writeFile("prompts/local/planner.md", `${localPrompt}\n`, "utf8");
    await writeConfig({
      ...defaultConfig,
      prompts: { overrides: { ideas: "prompts/local/planner.md" } },
    });

    expect(await pathExists(".ai")).toBe(false);
    const rendered = await renderIdeasPrompt();
    expect(rendered).toEqual({
      key: "ideas",
      source: "prompts/local/planner.md",
      text: ["IDEAS_JSON", localPrompt].join("\n\n"),
    });

    const { runId } = await runIdeas();
    const ideasArtifact = await readJsonFile<{
      prompt: { hash: string; source: string };
    }>(artifactPath(runId, "ideas.json"));
    expect(ideasArtifact.prompt).toEqual({
      key: "ideas",
      hash: sha256(["IDEAS_JSON", localPrompt].join("\n\n")),
      artifact: "ideas.json",
      source: "prompts/local/planner.md",
    });
  });

  it("rejects prompt override paths outside ignored local prompt storage", async () => {
    await writeConfig({
      ...defaultConfig,
      prompts: { overrides: { ideas: "prompts/defaults/planner-task.md" } },
    });

    await expect(renderIdeasPrompt()).rejects.toThrow(/prompts\/local/i);
  });
});

async function defaultPrompt(filename: string): Promise<string> {
  return (
    await readFile(new URL(`../prompts/defaults/${filename}`, import.meta.url), "utf8")
  ).trim();
}

async function writeConfig(config: typeof defaultConfig): Promise<void> {
  await writeFile("producer.config.json", `${JSON.stringify(config, null, 2)}\n`, "utf8");
}
