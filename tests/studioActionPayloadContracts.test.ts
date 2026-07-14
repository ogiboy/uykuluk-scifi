import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";

describe("Studio mutation payload contracts", () => {
  it("parses action payloads without allowing path-shaped run ids or unknown fields", () => {
    expect(
      parseStudioMutationRequest("idea.approve", {
        ideaId: "idea_001",
        runId: "run_operator_review",
      }),
    ).toEqual({ ideaId: "idea_001", runId: "run_operator_review" });
    expect(
      parseStudioMutationRequest("script.approve", {
        acknowledgeWarnings: true,
        runId: "run_operator_review",
      }),
    ).toEqual({ acknowledgeWarnings: true, runId: "run_operator_review" });
    expect(parseStudioMutationRequest("script.approve", { runId: "run_operator_review" })).toEqual({
      acknowledgeWarnings: false,
      runId: "run_operator_review",
    });
    expect(
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "accepted-for-manual-channel-prep",
        notes: "Manual channel handoff is ready for operator-managed upload prep.",
        reviewedBy: "operator",
        runId: "run_operator_review",
        thumbnailCandidateId: "thumbnail-01-left",
      }),
    ).toEqual({
      decision: "accepted-for-manual-channel-prep",
      notes: "Manual channel handoff is ready for operator-managed upload prep.",
      reviewedBy: "operator",
      runId: "run_operator_review",
      thumbnailCandidateId: "thumbnail-01-left",
    });
    expect(
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "needs-revision",
        notes: "Revise thumbnail copy before upload prep.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toEqual({
      decision: "needs-revision",
      notes: "Revise thumbnail copy before upload prep.",
      reviewedBy: "operator",
      runId: "run_operator_review",
    });
    expect(() =>
      parseStudioMutationRequest("channel-handoff.decide", {
        decision: "accepted-for-manual-channel-prep",
        notes: "Accepted decisions need a selected thumbnail.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toThrow(/thumbnail candidate/);

    expect(
      parseStudioMutationRequest("render.decide", {
        decision: "needs-revision",
        notes: "Subtitle timing needs another pass.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toEqual({
      decision: "needs-revision",
      notes: "Subtitle timing needs another pass.",
      reviewedBy: "operator",
      runId: "run_operator_review",
    });
    expect(() =>
      parseStudioMutationRequest("render.decide", {
        decision: "accepted-for-local-review",
        notes: "",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toThrow();

    expect(() => parseStudioMutationRequest("render.approve", { runId: "../run_escape" })).toThrow(
      /Invalid run id/,
    );
    for (const runId of [
      path.join(path.sep, "tmp", "run_escape"),
      "run_escape/child",
      "run_escape child",
      "bad_operator_review",
      `run_${"a".repeat(125)}`,
    ]) {
      expect(() => parseStudioMutationRequest("cost.approve", { runId })).toThrow(/Invalid run id/);
      expect(() =>
        parseStudioMutationRequest("channel-handoff.decide", {
          decision: "needs-revision",
          notes: "Malformed run id should fail.",
          reviewedBy: "operator",
          runId,
        }),
      ).toThrow(/Invalid run id/);
    }
    expect(() =>
      parseStudioMutationRequest("cost.approve", { extra: true, runId: "run_operator_review" }),
    ).toThrow(/Unrecognized key/);
    expect(parseStudioMutationRequest("render-plan.run", { runId: "run_operator_review" })).toEqual(
      { runId: "run_operator_review" },
    );
    expect(parseStudioMutationRequest("render.revise", { runId: "run_operator_review" })).toEqual({
      runId: "run_operator_review",
    });
    expect(parseStudioMutationRequest("ideas.run", {})).toEqual({});
    expect(() => parseStudioMutationRequest("ideas.run", { runId: "run_operator_review" })).toThrow(
      /Unrecognized key/,
    );
    expect(parseStudioMutationRequest("doctor.run", {})).toEqual({});
    expect(() =>
      parseStudioMutationRequest("doctor.run", { runId: "run_operator_review" }),
    ).toThrow(/Unrecognized key/);
    expect(() =>
      parseStudioMutationRequest("voice.run", { extra: true, runId: "run_operator_review" }),
    ).toThrow(/Unrecognized key/);
    expect(parseStudioMutationRequest("voice.run", { runId: "run_operator_review" })).toEqual({
      runId: "run_operator_review",
    });
    expect(
      parseStudioMutationRequest("voice.run", {
        approvalId: "approval_voice_exact",
        bindingDigest: "a".repeat(64),
        confirmPaidOperation: true,
        executionMode: "hosted",
        quoteDigest: "b".repeat(64),
        runId: "run_operator_review",
      }),
    ).toEqual({
      approvalId: "approval_voice_exact",
      bindingDigest: "a".repeat(64),
      confirmPaidOperation: true,
      executionMode: "hosted",
      quoteDigest: "b".repeat(64),
      runId: "run_operator_review",
    });
    expect(() =>
      parseStudioMutationRequest("voice.run", {
        approvalId: "approval_voice_exact",
        bindingDigest: "a".repeat(64),
        executionMode: "hosted",
        quoteDigest: "b".repeat(64),
        runId: "run_operator_review",
      }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("voice.preview", {
        runId: "run_operator_review",
        voiceId: "../voice_escape",
      }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("voice.select", {
        notes: "Auditioned in Studio.",
        reviewedBy: "operator",
        runId: "run_operator_review",
        voiceId: "voice_catalog_test",
      }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("voice.reselect", {
        extra: true,
        reason: "Try a different voice before spend.",
        reviewedBy: "operator",
        runId: "run_operator_review",
      }),
    ).toThrow(/Unrecognized key/);
  });
});
