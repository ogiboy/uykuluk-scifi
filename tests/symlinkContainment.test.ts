import { link, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { registeredArtifactRevisionAtProjectRoot } from "../src/core/artifactRevision";
import { artifactPath, writeRunText } from "../src/core/artifacts";
import { appendLedgerEvent, ledgerPath, readLedger } from "../src/core/ledger";
import { createRun, loadRun, runDir, saveRun, statePath } from "../src/core/runStore";
import { appendCostEvent, costLedgerPath } from "../src/costs/costLedger";
import { reservationLockPath, withCostReservationLock } from "../src/costs/costReservationLock";
import {
  appendCostReservationEvent,
  costReservationLedgerPath,
} from "../src/costs/costReservationStore";
import { pathExists } from "../src/utils/fs";
import { nowIso } from "../src/utils/time";
import { useTempProject } from "./helpers";

describe("run filesystem symlink containment", () => {
  useTempProject();

  it("rejects a symlinked runs root before creating a run", async () => {
    await mkdir("outside-runs");
    await rm("runs", { recursive: true });
    await symlink("outside-runs", "runs", "dir");

    await expect(createRun()).rejects.toThrow(/symbolic link|symlink/i);
    expect(await pathExists(path.join("outside-runs", "state.json"))).toBe(false);
  });

  it("rejects a symlinked run directory before loading state", async () => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-run");
    await mkdir(outside);
    await writeFile(
      path.join(outside, "state.json"),
      `${JSON.stringify({ ...run, state: "READY_FOR_MANUAL_PRODUCTION" }, null, 2)}\n`,
      "utf8",
    );
    const target = path.join(process.cwd(), "runs", run.runId);
    await rm(target, { recursive: true });
    await symlink(outside, target, "dir");

    await expect(loadRun(run.runId)).rejects.toThrow(/symbolic link|symlink/i);
  });

  it("rejects a symlinked state file before reading or saving", async () => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-state.json");
    await writeFile(outside, "sentinel\n", "utf8");
    const target = statePath(run.runId);
    await rm(target);
    await symlink(outside, target, "file");

    await expect(loadRun(run.runId)).rejects.toThrow(/symbolic link|symlink/i);
    await expect(saveRun(run)).rejects.toThrow(/symbolic link|symlink/i);
    expect(await readFile(outside, "utf8")).toBe("sentinel\n");
  });

  it("blocks writes through a symlinked artifact directory before ledger mutation", async () => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-production");
    await mkdir(outside);
    await symlink(outside, path.join(runDir(run.runId), "production"), "dir");

    await expect(writeRunText(run, "test", "production/escape.txt", "blocked")).rejects.toThrow(
      /symbolic link|symlink/i,
    );
    expect(await pathExists(path.join(outside, "escape.txt"))).toBe(false);
    expect(await readLedger(run.runId)).toHaveLength(1);
  });

  it("blocks writes through a symlinked final artifact before ledger mutation", async () => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-script.md");
    await writeFile(outside, "original\n", "utf8");
    await symlink(outside, path.join(runDir(run.runId), "script.md"), "file");

    await expect(writeRunText(run, "test", "script.md", "blocked")).rejects.toThrow(
      /symbolic link|symlink/i,
    );
    expect(await readFile(outside, "utf8")).toBe("original\n");
    expect(await readLedger(run.runId)).toHaveLength(1);
  });

  it("blocks root-aware Studio revisions through a symlinked artifact directory", async () => {
    const run = await createRun();
    const relativePath = "production/audio/voice-selections/selection.json";
    const targetDirectory = path.join(runDir(run.runId), "production", "audio", "voice-selections");
    const outsideDirectory = path.join(process.cwd(), "outside-voice-selections");
    await mkdir(targetDirectory, { recursive: true });
    await writeFile(artifactPath(run.runId, relativePath), "{}", "utf8");
    await mkdir(outsideDirectory);
    await writeFile(path.join(outsideDirectory, "selection.json"), "{}", "utf8");
    await rm(targetDirectory, { recursive: true });
    await symlink(outsideDirectory, targetDirectory, "dir");

    await expect(
      registeredArtifactRevisionAtProjectRoot(
        process.cwd(),
        { runId: run.runId, artifacts: [relativePath] },
        [relativePath],
      ),
    ).rejects.toThrow(/symbolic link|symlink/i);
  });

  it("rejects a symlinked core ledger before appending", async () => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-ledger.jsonl");
    await writeFile(outside, "sentinel\n", "utf8");
    const target = ledgerPath(run.runId);
    await rm(target);
    await symlink(outside, target, "file");

    await expect(
      appendLedgerEvent({ runId: run.runId, type: "WARNING", stage: "test", message: "blocked" }),
    ).rejects.toThrow(/symbolic link|symlink/i);
    expect(await readFile(outside, "utf8")).toBe("sentinel\n");
  });

  it.each([
    {
      name: "core",
      target: ledgerPath,
      append: async (runId: string) =>
        appendLedgerEvent({ runId, type: "WARNING", stage: "test", message: "blocked" }),
    },
    {
      name: "cost",
      target: costLedgerPath,
      append: async (runId: string) =>
        appendCostEvent({
          runId,
          stage: "test",
          provider: "test",
          estimatedUsd: 0,
          createdAt: nowIso(),
        }),
    },
    {
      name: "reservation",
      target: costReservationLedgerPath,
      append: async (runId: string) =>
        appendCostReservationEvent({
          eventId: "reservation_event_hard_link",
          reservationId: "reservation_hard_link",
          runId,
          type: "RESERVED",
          operationId: "operation_hard_link",
          approvalId: "approval_hard_link",
          quoteDigest: "a".repeat(64),
          stage: "tts",
          provider: "test",
          maxUsdMicros: 0,
          createdAt: nowIso(),
        }),
    },
  ])("rejects a hard-linked $name ledger before appending", async ({ target, append }) => {
    const run = await createRun();
    const outside = path.join(process.cwd(), "outside-hard-link.jsonl");
    await writeFile(outside, "sentinel\n", "utf8");
    const ledger = target(run.runId);
    await mkdir(path.dirname(ledger), { recursive: true });
    await rm(ledger, { force: true });
    await link(outside, ledger);

    await expect(append(run.runId)).rejects.toThrow(/hard[- ]link|multiple links/i);
    expect(await readFile(outside, "utf8")).toBe("sentinel\n");
  });

  it("rejects a symlinked reservation lock before acquisition", async () => {
    const outside = path.join(process.cwd(), "outside-lock");
    await mkdir(outside);
    const target = path.join(process.cwd(), "runs", ".cost-reservation.lock");
    await symlink(outside, target, "dir");

    expect(() => reservationLockPath()).toThrow(/symbolic link|symlink/i);
    await expect(
      withCostReservationLock(async () => "unreachable", { timeoutMs: 20, retryMs: 5 }),
    ).rejects.toThrow(/symbolic link|symlink/i);
  });

  it("still constructs normal artifact paths", async () => {
    const run = await createRun();

    expect(artifactPath(run.runId, "production/scenes.json")).toBe(
      path.join(runDir(run.runId), "production", "scenes.json"),
    );
  });
});
