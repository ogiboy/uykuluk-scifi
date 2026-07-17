import { readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { artifactPath } from "../src/core/artifacts";
import { requireSettledHostedVisualSpool } from "../src/stages/visuals/hostedVisualSpoolEvidence";
import { canonicalVisualGenerationDigest } from "../src/stages/visuals/visualGenerationDigest";
import {
  loadHostedVisualGenerationSpool,
  loadHostedVisualGenerationSpoolForOperation,
  persistHostedVisualGenerationSpool,
} from "../src/stages/visuals/visualGenerationSpool";
import { hostedVisualGenerationSpoolSchema } from "../src/stages/visuals/visualGenerationSpoolContracts";
import { pathExists } from "../src/utils/fs";
import { useTempProject } from "./helpers";
import {
  batchResult,
  generationPlan,
  operationId,
  planArtifactDigest,
  settledReservation,
} from "./hostedVisualGenerationSpoolFixtures";

describe("hosted visual generation spool", () => {
  useTempProject();

  it("persists and reloads exact batch image evidence", async () => {
    const plan = generationPlan();
    const result = batchResult(plan);
    const planDigest = planArtifactDigest(plan);
    const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: operationId(plan.runId, planDigest, approvedQuote),
      plan,
      planDigest,
      approvedQuote,
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result,
    });

    expect(loaded.spool.images).toHaveLength(2);
    expect(loaded.images.map((image) => image.buffer.toString("utf8"))).toEqual([
      "image-1",
      "image-2",
    ]);
    expect(loaded.reference.digest).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects tampered image bytes after the spool is committed", async () => {
    const plan = generationPlan();
    const planDigest = planArtifactDigest(plan);
    const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: operationId(plan.runId, planDigest, approvedQuote),
      plan,
      planDigest,
      approvedQuote,
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result: batchResult(plan),
    });
    await writeFile(
      artifactPath(plan.runId, loaded.spool.images[0]!.asset.path),
      Buffer.from("tampered"),
    );

    await expect(loadHostedVisualGenerationSpool(plan.runId, loaded.reference)).rejects.toThrow(
      /spool image is invalid/i,
    );
  });

  it("requires an external digest when recovering an operation spool", async () => {
    const plan = generationPlan();
    const planDigest = planArtifactDigest(plan);
    const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
    const operation = operationId(plan.runId, planDigest, approvedQuote);
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: operation,
      plan,
      planDigest,
      approvedQuote,
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result: batchResult(plan),
    });
    const persisted = JSON.parse(
      await readFile(artifactPath(plan.runId, loaded.reference.path), "utf8"),
    ) as Record<string, unknown>;
    const { spoolDigest: _spoolDigest, ...digestInput } = persisted;
    const tampered = { ...digestInput, actualUsdMicros: 1 };
    await writeFile(
      artifactPath(plan.runId, loaded.reference.path),
      `${JSON.stringify({
        ...tampered,
        spoolDigest: canonicalVisualGenerationDigest(tampered),
      })}\n`,
      "utf8",
    );

    await expect(
      loadHostedVisualGenerationSpoolForOperation(plan.runId, operation, loaded.reference.digest),
    ).rejects.toThrow(/digest or identity is invalid/i);
  });

  it.each([
    ["operation", { operationId: `image_${"e".repeat(64)}` }],
    ["binding", { bindingDigest: "e".repeat(64) }],
    ["quote", { quoteDigest: "e".repeat(64) }],
    ["approval", { approvalId: "approval_other" }],
  ])("rejects a settled reservation with a mismatched %s identity", async (_label, patch) => {
    const plan = generationPlan();
    const planDigest = planArtifactDigest(plan);
    const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: operationId(plan.runId, planDigest, approvedQuote),
      plan,
      planDigest,
      approvedQuote,
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result: batchResult(plan),
    });
    const reservation = settledReservation(loaded, planDigest, approvedQuote);

    expect(() =>
      requireSettledHostedVisualSpool({
        spool: loaded,
        planDigest,
        approvedQuote,
        reservation: { ...reservation, ...patch },
      }),
    ).toThrow(/does not match its durable result spool/i);
  });

  it.each([
    ["foreign run", "run_other", undefined],
    ["foreign operation", "run_spool", `image_${"e".repeat(64)}`],
  ])(
    "rejects a %s binding before writing operation artifacts",
    async (_label, runId, rawOperation) => {
      const plan = generationPlan();
      const planDigest = planArtifactDigest(plan);
      const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
      const operation = rawOperation ?? operationId(runId, planDigest, approvedQuote);

      await expect(
        persistHostedVisualGenerationSpool({
          runId,
          operationId: operation,
          plan,
          planDigest,
          approvedQuote,
          reservationId: "reservation_visual",
          actualUsdMicros: 180_000,
          providerRequestId: "batch-provider-request",
          result: batchResult(plan),
        }),
      ).rejects.toThrow(/belongs to another run|operation binding is invalid/i);
      expect(
        await pathExists(artifactPath(runId, `operations/image-generation/${operation}`)),
      ).toBe(false);
    },
  );

  it("rejects a non-canonical run id in committed spool evidence", async () => {
    const plan = generationPlan();
    const planDigest = planArtifactDigest(plan);
    const approvedQuote = { approvalId: "approval_visual", quoteDigest: "d".repeat(64) };
    const loaded = await persistHostedVisualGenerationSpool({
      runId: plan.runId,
      operationId: operationId(plan.runId, planDigest, approvedQuote),
      plan,
      planDigest,
      approvedQuote,
      reservationId: "reservation_visual",
      actualUsdMicros: 180_000,
      providerRequestId: "batch-provider-request",
      result: batchResult(plan),
    });

    expect(() =>
      hostedVisualGenerationSpoolSchema.parse({ ...loaded.spool, runId: "../run_foreign" }),
    ).toThrow(/invalid run id/i);
  });
});
