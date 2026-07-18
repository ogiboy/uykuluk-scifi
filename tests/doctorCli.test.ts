import { writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { defaultConfig } from "../src/config/config";
import { useTempProject } from "./helpers";
import { runProducerCliForTest } from "./producerCliTestHelper";

describe("producer doctor CLI", () => {
  useTempProject();

  it("prints JSON diagnostics for automation", () => {
    const result = runCli(["doctor", "--json"]);

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      passed: true,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "project config", status: "pass" }),
        expect.objectContaining({ name: "publish defaults", status: "pass" }),
      ]),
    });
  });

  it("keeps JSON diagnostics parseable when doctor blocks", async () => {
    await writeFile(
      "producer.config.json",
      `${JSON.stringify(
        {
          ...defaultConfig,
          providers: {
            ...defaultConfig.providers,
            youtube: { enabled: true, allowPrivateUpload: true, allowPublicPublish: true },
          },
          safeguards: {
            ...defaultConfig.safeguards,
            neverPublicPublishWithoutExplicitApproval: false,
          },
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    const result = runCli(["doctor", "--json"]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Doctor blocked.");
    expect(JSON.parse(result.stdout) as unknown).toMatchObject({
      passed: false,
      checks: expect.arrayContaining([
        expect.objectContaining({ name: "publish defaults", status: "block" }),
      ]),
    });
  });
});

function runCli(args: string[]): { status: number | null; stderr: string; stdout: string } {
  return runProducerCliForTest(args);
}
