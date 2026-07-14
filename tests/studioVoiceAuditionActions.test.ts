import { describe, expect, it } from "vitest";
import { POST as voiceCandidates } from "../apps/studio/src/app/actions/voice-candidates/route";
import { POST as voicePreview } from "../apps/studio/src/app/actions/voice-preview/route";
import { POST as voiceReselect } from "../apps/studio/src/app/actions/voice-reselect/route";
import { POST as voiceSelect } from "../apps/studio/src/app/actions/voice-select/route";
import { cliArgsForAction } from "../apps/studio/src/lib/mutations/studioCliMutationArgs";
import { parseStudioMutationRequest } from "../src/studio/actionServiceContracts";
import { studioJsonMutationRequest } from "./studioMutationRouteTestHelpers";

describe("Studio voice audition actions", () => {
  it("maps strict action payloads to the existing producer voice commands", async () => {
    const candidates = { runId: "run_voice_audition" };
    const preview = { runId: "run_voice_audition", voiceId: "voice_catalog_test" };
    const selection = {
      confirmProductionRights: true,
      notes: "Auditioned against the current catalog and preview.",
      reviewedBy: "operator",
      runId: "run_voice_audition",
      voiceId: "voice_catalog_test",
    };
    const reselection = {
      reason: "Try a different voice before any production spend.",
      reviewedBy: "operator",
      runId: "run_voice_audition",
    };

    expect(parseStudioMutationRequest("voice.candidates", candidates)).toEqual(candidates);
    expect(parseStudioMutationRequest("voice.preview", preview)).toEqual(preview);
    expect(parseStudioMutationRequest("voice.select", selection)).toEqual(selection);
    expect(parseStudioMutationRequest("voice.reselect", reselection)).toEqual(reselection);

    await expectCliArgs("voice.candidates", candidates, [
      "voice-candidates",
      "--run",
      "run_voice_audition",
      "--json",
    ]);
    await expectCliArgs("voice.preview", preview, [
      "voice-preview",
      "--run",
      "run_voice_audition",
      "--voice",
      "voice_catalog_test",
      "--json",
    ]);
    await expectCliArgs("voice.select", selection, [
      "voice-select",
      "--run",
      "run_voice_audition",
      "--voice",
      "voice_catalog_test",
      "--reviewed-by",
      "operator",
      "--notes",
      "Auditioned against the current catalog and preview.",
      "--confirm-production-rights",
      "--json",
    ]);
    await expectCliArgs("voice.reselect", reselection, [
      "voice-reselect",
      "--run",
      "run_voice_audition",
      "--reviewed-by",
      "operator",
      "--reason",
      "Try a different voice before any production spend.",
      "--json",
    ]);
    await expectCliArgs("voice.run", { runId: "run_voice_audition" }, [
      "voice",
      "--run",
      "run_voice_audition",
      "--json",
    ]);
    await expectCliArgs(
      "voice.run",
      {
        approvalId: "approval_voice_exact",
        bindingDigest: "a".repeat(64),
        confirmPaidOperation: true,
        executionMode: "hosted",
        quoteDigest: "b".repeat(64),
        runId: "run_voice_audition",
      },
      [
        "voice",
        "--run",
        "run_voice_audition",
        "--binding-digest",
        "a".repeat(64),
        "--quote-digest",
        "b".repeat(64),
        "--approval-id",
        "approval_voice_exact",
        "--confirm-paid-operation",
        "--json",
      ],
    );
  });

  it("keeps production-rights confirmation explicit and rejects unsafe fields", async () => {
    expect(() =>
      parseStudioMutationRequest("voice.select", {
        notes: "Auditioned in Studio.",
        reviewedBy: "operator",
        runId: "run_voice_audition",
        voiceId: "voice_catalog_test",
      }),
    ).toThrow();
    expect(() =>
      parseStudioMutationRequest("voice.preview", {
        providerUrl: "https://provider.example/preview.mp3",
        runId: "run_voice_audition",
        voiceId: "voice_catalog_test",
      }),
    ).toThrow(/Unrecognized key/);
    expect(() =>
      parseStudioMutationRequest("voice.reselect", {
        reason: "unsafe\u009b31m reason",
        reviewedBy: "operator",
        runId: "run_voice_audition",
      }),
    ).toThrow(/unsafe controls/);

    await expectCliArgs(
      "voice.select",
      {
        confirmProductionRights: false,
        notes: "Preview-only selection while rights remain unconfirmed.",
        reviewedBy: "operator",
        runId: "run_voice_audition",
        voiceId: "voice_catalog_test",
      },
      [
        "voice-select",
        "--run",
        "run_voice_audition",
        "--voice",
        "voice_catalog_test",
        "--reviewed-by",
        "operator",
        "--notes",
        "Preview-only selection while rights remain unconfirmed.",
        "--json",
      ],
    );
  });

  it("rejects wrong action headers, missing sessions, cross-origin calls, and invalid payloads", async () => {
    await expectRouteStatus(
      voiceCandidates(
        studioJsonMutationRequest(
          "/actions/voice-candidates",
          "voice.candidates",
          { runId: "run_voice_audition" },
          { actionHeader: "voice.preview" },
        ),
      ),
      403,
    );
    await expectRouteStatus(
      voicePreview(
        studioJsonMutationRequest(
          "/actions/voice-preview",
          "voice.preview",
          { runId: "run_voice_audition", voiceId: "voice_catalog_test" },
          { cookieToken: null, sessionToken: null },
        ),
      ),
      401,
    );
    await expectRouteStatus(
      voiceSelect(
        studioJsonMutationRequest(
          "/actions/voice-select",
          "voice.select",
          {
            confirmProductionRights: true,
            notes: "Auditioned in Studio.",
            reviewedBy: "operator",
            runId: "run_voice_audition",
            voiceId: "voice_catalog_test",
          },
          { origin: "https://attacker.example" },
        ),
      ),
      403,
    );
    await expectRouteStatus(
      voiceReselect(
        studioJsonMutationRequest("/actions/voice-reselect", "voice.reselect", {
          extra: true,
          reason: "Try another voice.",
          reviewedBy: "operator",
          runId: "run_voice_audition",
        }),
      ),
      400,
    );
  });
});

async function expectCliArgs(
  actionId: Parameters<typeof cliArgsForAction>[0],
  payload: unknown,
  expected: readonly string[],
): Promise<void> {
  const prepared = await cliArgsForAction(actionId, payload);
  try {
    expect(prepared.args).toEqual(expected);
  } finally {
    await prepared.cleanup();
  }
}

async function expectRouteStatus(
  responsePromise: Promise<Response>,
  status: number,
): Promise<void> {
  const response = await responsePromise;
  expect(response.status).toBe(status);
  expect(response.headers.get("cache-control")).toBe("no-store");
  await expect(response.json()).resolves.toMatchObject({ status: "error" });
}
