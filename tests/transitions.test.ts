import { chmod, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadRun, runDir } from "../src/core/runStore";
import { approveIdea } from "../src/stages/approveIdea";
import { runIdeas } from "../src/stages/ideas";
import { generateProductionPackage } from "../src/stages/productionPackage";
import { generateScript } from "../src/stages/script";
import { useTempProject } from "./helpers";

describe("stage transition gates", () => {
  useTempProject();

  it("cannot generate script before idea approval", async () => {
    const { runId } = await runIdeas();
    await expect(generateScript(runId)).rejects.toThrow(/requires state IDEA_APPROVED/);
    expect((await loadRun(runId)).state).toBe("IDEAS_GENERATED");
  });

  it("cannot package before script approval", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await generateScript(runId);
    await expect(generateProductionPackage(runId)).rejects.toThrow(
      /requires state SCRIPT_APPROVED/,
    );
    expect((await loadRun(runId)).state).toBe("SCRIPT_GENERATED");
  });

  it("leaves state unchanged and records ERROR after artifact write failure", async () => {
    const { runId, ideas } = await runIdeas();
    await approveIdea(runId, ideas[0].id);
    await chmod(runDir(runId), 0o500);
    try {
      await expect(generateScript(runId)).rejects.toThrow();
    } finally {
      await chmod(runDir(runId), 0o700);
    }
    expect((await loadRun(runId)).state).toBe("IDEA_APPROVED");
    const ledger = await readFile(path.join(runDir(runId), "ledger.jsonl"), "utf8");
    expect(ledger).toContain('"type":"ERROR"');
  });
});
