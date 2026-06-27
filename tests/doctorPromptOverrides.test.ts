import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { runDoctor } from "../src/diagnostics/doctor";
import { useTempProject } from "./helpers";

describe("producer doctor prompt override diagnostics", () => {
  useTempProject();

  it("passes configured local prompt overrides", async () => {
    await writeFile("prompts/local/planner.md", "Local planner prompt.\n", "utf8");
    await writePromptOverrideConfig({
      ideas: "prompts/local/planner.md",
    });

    const report = await runDoctor();

    expect(report.passed).toBe(true);
    expect(report.checks.find((check) => check.name === "prompt overrides")).toMatchObject({
      status: "pass",
      message: "Local prompt overrides ready: ideas: prompts/local/planner.md.",
    });
  });

  it("blocks missing or unsafe local prompt overrides before generation", async () => {
    await writePromptOverrideConfig({
      ideas: "prompts/defaults/planner-task.md",
      script: "prompts/local/missing-script.md",
    });

    const report = await runDoctor();

    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.name === "prompt overrides")).toMatchObject({
      status: "block",
      message: expect.stringContaining(
        "ideas: override must be a Markdown file under prompts/local",
      ),
      nextAction: expect.stringContaining("prompts/local"),
    });
    expect(report.checks.find((check) => check.name === "prompt overrides")?.message).toContain(
      "script: prompts/local/missing-script.md is missing.",
    );
  });
});

async function writePromptOverrideConfig(overrides: {
  ideas?: string;
  script?: string;
}): Promise<void> {
  await writeFile(
    "producer.config.json",
    `${JSON.stringify({ ...defaultConfig, prompts: { overrides } }, null, 2)}\n`,
    "utf8",
  );
}
