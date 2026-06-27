import { mkdir, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { getStudioPromptInventory } from "../apps/studio/src/lib/promptInventory";
import { useTempProject } from "./helpers";

describe("Studio read-only prompt inventory", () => {
  useTempProject();

  it("shows tracked prompt defaults without requiring .ai runtime state", async () => {
    await writeDefaultPrompts();

    const inventory = await getStudioPromptInventory();

    expect(inventory).toMatchObject({
      configSource: "producer.config.json",
      configValid: true,
      passed: true,
      warnings: [],
    });
    expect(inventory.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          defaultPath: "prompts/defaults/planner-task.md",
          key: "ideas",
          mode: "default",
          selectedPath: "prompts/defaults/planner-task.md",
          status: "default-ready",
        }),
      ]),
    );
  });

  it("surfaces configured local prompt override status without enabling edits", async () => {
    await writeDefaultPrompts();
    await writeFile("prompts/local/planner.md", "Local planner override\n", "utf8");
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          prompts: { overrides: { ideas: "prompts/local/planner.md" } },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const inventory = await getStudioPromptInventory();

    expect(inventory.passed).toBe(true);
    expect(inventory.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "ideas",
          mode: "override",
          overridePath: "prompts/local/planner.md",
          selectedPath: "prompts/local/planner.md",
          status: "override-ready",
        }),
      ]),
    );
  });

  it("fails closed on unsafe or missing local prompt override paths", async () => {
    await writeDefaultPrompts();
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          prompts: {
            overrides: {
              ideas: "prompts/defaults/planner-task.md",
              script: "prompts/local/missing.md",
            },
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const inventory = await getStudioPromptInventory();

    expect(inventory.passed).toBe(false);
    expect(inventory.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining("prompts/local"),
        expect.stringContaining("prompts/local/missing.md"),
      ]),
    );
    expect(inventory.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "ideas", status: "override-invalid" }),
        expect.objectContaining({ key: "script", status: "override-missing" }),
      ]),
    );
  });

  it("surfaces invalid producer config as prompt inventory action", async () => {
    await writeDefaultPrompts();
    await writeFile("producer.config.json", "{ invalid json", "utf8");

    const inventory = await getStudioPromptInventory();

    expect(inventory).toMatchObject({
      configSource: "producer.config.json",
      configValid: false,
      passed: false,
    });
    expect(inventory.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Producer config is invalid")]),
    );
    expect(inventory.prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "ideas",
          nextAction: "pnpm producer doctor",
          status: "config-invalid",
        }),
      ]),
    );
  });
});

async function writeDefaultPrompts(): Promise<void> {
  await mkdir("prompts/defaults", { recursive: true });
  await writeFile("prompts/defaults/planner-task.md", "Planner default\n", "utf8");
  await writeFile("prompts/defaults/scriptwriter-task.md", "Script default\n", "utf8");
  await writeFile(
    "prompts/defaults/production-package-task.md",
    "Production package default\n",
    "utf8",
  );
}
