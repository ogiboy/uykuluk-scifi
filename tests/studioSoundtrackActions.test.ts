import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { POST as soundtrackAnalyzeRoute } from "../apps/studio/src/app/actions/soundtrack-analyze/route";
import { cliArgsForAction } from "../apps/studio/src/lib/mutations/studioCliMutationArgs";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";
import { studioJsonMutationRequest } from "./studioMutationRouteTestHelpers";

const runId = "run_studio_soundtrack";
const expectation = { expectedManifestDigest: "a".repeat(64), expectedRevision: 2 };
const provenance = {
  importedAt: "2026-07-20T10:00:00.000Z",
  importedBy: "operator",
  originalFileName: "ambient-bed.wav",
  rights: {
    attestedAt: "2026-07-20T10:00:00.000Z",
    attestedBy: "operator",
    basis: "licensed" as const,
    evidence: "License held in production records.",
  },
};

describe("Studio soundtrack mutation actions", () => {
  it("requires exact manifest digest and revision for every existing-manifest mutation", () => {
    const analyze = { ...expectation, runId };
    const configure = { ...expectation, music: undefined, runId, sfx: [] };
    const decide = {
      ...expectation,
      notes: "Measured output is acceptable.",
      reviewedBy: "operator",
      runId,
      status: "approved" as const,
    };
    const imported = {
      ...expectation,
      assetId: "ambient_bed",
      contentBase64: "aGVsbG8=",
      provenance,
      role: "music" as const,
      runId,
      sourceFileName: "ambient-bed.wav",
    };
    expect(parseStudioMutationRequest("soundtrack.prepare", { runId })).toEqual({ runId });
    for (const [actionId, payload] of [
      ["soundtrack.analyze", analyze],
      ["soundtrack.configure", configure],
      ["soundtrack.decide", decide],
      ["soundtrack.import", imported],
    ] as const) {
      expect(parseStudioMutationRequest(actionId, payload)).toEqual(payload);
      const { expectedManifestDigest: _digest, ...withoutDigest } = payload;
      expect(() => parseStudioMutationRequest(actionId, withoutDigest)).toThrow();
      const { expectedRevision: _revision, ...withoutRevision } = payload;
      expect(() => parseStudioMutationRequest(actionId, withoutRevision)).toThrow();
    }
    expect(() =>
      parseStudioMutationRequest("soundtrack.import", {
        ...imported,
        sourceFileName: "../escape.wav",
      }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("soundtrack.analyze", { ...analyze, extra: true }),
    ).toThrow(/Unrecognized key/);
  });

  it("writes binary audio and JSON inputs to guarded temporary files before invoking the CLI", async () => {
    const payload = {
      ...expectation,
      assetId: "ambient_bed",
      contentBase64: "aGVsbG8=",
      provenance,
      role: "music" as const,
      runId,
      sourceFileName: "ambient-bed.wav",
    };
    const prepared = await cliArgsForAction("soundtrack.import", payload);
    try {
      expect(prepared.args).toEqual([
        "soundtrack",
        "import",
        "--run",
        runId,
        "--asset",
        "ambient_bed",
        "--role",
        "music",
        "--file",
        expect.any(String),
        "--provenance-file",
        expect.any(String),
        "--expected-manifest-digest",
        expectation.expectedManifestDigest,
        "--expected-revision",
        "2",
        "--json",
      ]);
      await expect(readFile(prepared.args[9]!, "utf8")).resolves.toBe("hello");
      await expect(
        readFile(prepared.args[11]!, "utf8").then((value) => JSON.parse(value) as unknown),
      ).resolves.toEqual(provenance);
    } finally {
      await prepared.cleanup();
    }
  });

  it("rejects a wrong action header before local FFmpeg analysis can start", async () => {
    const response = await soundtrackAnalyzeRoute(
      studioJsonMutationRequest(
        "/actions/soundtrack-analyze",
        "soundtrack.analyze",
        { ...expectation, runId },
        { actionHeader: "soundtrack.decide" },
      ),
    );
    expect(response.status).toBe(403);
  });
});
