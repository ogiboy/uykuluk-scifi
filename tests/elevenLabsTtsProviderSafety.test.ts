import { describe, expect, it, vi } from "vitest";
import { ElevenLabsTtsProvider } from "../src/stages/voice/providers/elevenLabsTtsProvider";
import {
  baseElevenLabsTtsConfig,
  executeElevenLabsAdapter,
  fixtureWav,
} from "./elevenLabsTtsProviderTestHelpers";

describe("ElevenLabs TTS provider safety outcomes", () => {
  it("marks a sent generation indeterminate when provider cost headers are missing", async () => {
    const provider = providerForResponse({
      audioBase64: fixtureWav().toString("base64"),
      requestId: "request_without_cost",
      alignment: alignment(),
    });

    await expect(executeElevenLabsAdapter(provider, "a", 1_000)).resolves.toEqual({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_without_cost",
    });
  });

  it("does not settle success when provider character cost exceeds the approved cap", async () => {
    const provider = providerForResponse({
      audioBase64: fixtureWav().toString("base64"),
      characterCost: 2,
      requestId: "request_over_cap",
      alignment: alignment(),
    });

    await expect(executeElevenLabsAdapter(provider, "a", 100)).resolves.toEqual({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_over_cap",
    });
  });

  it("keeps the last provider request id when a later chunk fails", async () => {
    const convertWithTimestamps = vi
      .fn()
      .mockResolvedValueOnce({
        audioBase64: fixtureWav().toString("base64"),
        characterCost: 4_500,
        requestId: "request_first_chunk",
        alignment: alignment(),
      })
      .mockRejectedValueOnce(new Error("provider unavailable"));
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });

    await expect(executeElevenLabsAdapter(provider, "a".repeat(4_501), 450_100)).resolves.toEqual({
      kind: "unknown",
      reason: "provider-error",
      providerRequestId: "request_first_chunk",
    });
  });

  it("rejects Speaker Boost before reservation for Eleven v3", () => {
    const provider = new ElevenLabsTtsProvider(
      { ...baseElevenLabsTtsConfig, voiceSettings: { useSpeakerBoost: true } },
      { readApiKey: () => "secret-test-key" },
    );

    expect(() => provider.assertReady()).toThrow(/Speaker Boost/);
  });

  it("does not send when the exact reservation is below the estimated call cost", async () => {
    const convertWithTimestamps = vi.fn();
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });

    const outcome = await executeElevenLabsAdapter(provider, "a".repeat(1_000), 99_999);

    expect(outcome).toEqual({ kind: "definitely-not-sent", reason: "adapter-validation" });
    expect(convertWithTimestamps).not.toHaveBeenCalled();
  });
});

function providerForResponse(response: {
  audioBase64: string;
  characterCost?: number;
  requestId: string;
  alignment: ReturnType<typeof alignment>;
}): ElevenLabsTtsProvider {
  return new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
    readApiKey: () => "secret-test-key",
    createClient: () => ({ convertWithTimestamps: vi.fn(async () => response) }),
  });
}

function alignment() {
  return { characters: ["a"], characterStartTimesSeconds: [0], characterEndTimesSeconds: [0.1] };
}
