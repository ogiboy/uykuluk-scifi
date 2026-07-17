import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readLedger } from "../src/core/ledger";
import { queueRunLedgerEvent, reconcileRunLedgerOutbox } from "../src/core/runLedgerOutbox";
import { createRun, loadRun, mutateRun, statePath } from "../src/core/runStore";
import { useTempProject } from "./helpers";

describe("run ledger outbox", () => {
  useTempProject();

  it("retains failed event intents and reconciles each identity exactly once", async () => {
    const run = await createRun();
    const mutation = await mutateRun(run.runId, async (current) => {
      const queued = queueRunLedgerEvent(current, {
        type: "ARTIFACT_REVISED",
        stage: "test-outbox",
        message: "Committed visual mutation evidence.",
        data: { revision: 2 },
      });
      return { run: queued, value: queued.pendingLedgerEvents![0]!.eventId };
    });
    const pendingEventId = mutation.value;
    expect(pendingEventId).toMatch(/^evt_\d{14}_[a-f\d]{16}$/);
    await expect(
      reconcileRunLedgerOutbox(run.runId, {
        afterAppend: async () => {
          throw new Error("injected after ledger append");
        },
      }),
    ).rejects.toThrow(/injected after ledger append/i);
    await expect(loadRun(run.runId)).resolves.toMatchObject({
      pendingLedgerEvents: [{ eventId: pendingEventId }],
    });
    expect(
      (await readLedger(run.runId)).filter((event) => event.eventId === pendingEventId),
    ).toHaveLength(1);

    await expect(reconcileRunLedgerOutbox(run.runId)).resolves.toBe(1);
    expect(
      (await readLedger(run.runId)).filter((event) => event.eventId === pendingEventId),
    ).toHaveLength(1);
    expect((await loadRun(run.runId)).pendingLedgerEvents).toBeUndefined();

    await expect(reconcileRunLedgerOutbox(run.runId)).resolves.toBe(0);
    expect(
      (await readLedger(run.runId)).filter((event) => event.eventId === pendingEventId),
    ).toHaveLength(1);
  });

  it("rejects a pending event whose identity points at a different run", async () => {
    const owner = await createRun();
    const foreign = await createRun();
    const state = JSON.parse(await readFile(statePath(owner.runId), "utf8")) as Record<
      string,
      unknown
    >;
    const eventId = "evt_foreign_outbox_test";
    await writeFile(
      statePath(owner.runId),
      `${JSON.stringify({
        ...state,
        pendingLedgerEvents: [
          {
            eventId,
            runId: foreign.runId,
            type: "ARTIFACT_REVISED",
            stage: "test-outbox",
            message: "Must not cross run boundaries.",
            createdAt: new Date().toISOString(),
          },
        ],
      })}\n`,
      "utf8",
    );

    await expect(reconcileRunLedgerOutbox(owner.runId)).rejects.toThrow(/identity/i);
    expect((await readLedger(foreign.runId)).some((event) => event.eventId === eventId)).toBe(
      false,
    );
    expect((await readLedger(owner.runId)).some((event) => event.eventId === eventId)).toBe(false);
  });
});
