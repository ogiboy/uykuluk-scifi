import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { sha256 } from "../src/utils/hash";
import { readJsonFile } from "../src/utils/json";
import { approveIdea } from "../src/stages/approveIdea";
import { approveScript } from "../src/stages/approveScript";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { reviewScript } from "../src/stages/reviewScript";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

describe("tracked runtime prompt templates", () => {
  useTempProject();

  it("uses tracked operator prompts for every provider-backed artifact", async () => {
    const plannerTemplate = await trackedPrompt("planner-task.md");
    const scriptTemplate = await trackedPrompt("scriptwriter-task.md");
    const packageTemplate = await trackedPrompt("production-package-task.md");

    const { runId, ideas } = await runIdeas();
    const ideasArtifact = await readJsonFile<{
      prompt: { hash: string; source: string };
    }>(artifactPath(runId, "ideas.json"));
    expect(ideasArtifact.prompt).toEqual({
      key: "ideas",
      hash: sha256(["IDEAS_JSON", plannerTemplate].join("\n\n")),
      artifact: "ideas.json",
      source: ".ai/prompts/planner-task.md",
    });

    await approveIdea(runId, ideas[0].id);
    const scriptMeta = await generateScript(runId);
    expect(scriptMeta.prompt).toEqual({
      key: "script",
      hash: sha256(
        ["SCRIPT_MARKDOWN", scriptTemplate, "## Approved Idea", JSON.stringify(ideas[0])].join(
          "\n\n",
        ),
      ),
      artifact: "script.md",
      source: ".ai/prompts/scriptwriter-task.md",
    });

    await reviewScript(runId);
    await approveScript(runId);
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
      source: ".ai/prompts/production-package-task.md",
    });
  });
});

async function trackedPrompt(filename: string): Promise<string> {
  return (await readFile(new URL(`../.ai/prompts/${filename}`, import.meta.url), "utf8")).trim();
}
