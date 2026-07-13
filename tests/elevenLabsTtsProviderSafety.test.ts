import { describe, expect, it, vi } from "vitest";
import { ElevenLabsTtsProvider } from "../src/stages/voice/providers/elevenLabsTtsProvider";
import { sha256 } from "../src/utils/hash";
import {
  baseElevenLabsTtsConfig,
  executeElevenLabsAdapter,
  fixtureWav,
} from "./elevenLabsTtsProviderTestHelpers";

describe("ElevenLabs TTS provider safety outcomes", () => {
  it("requires an exact execution binding before the paid adapter is ready", () => {
    const provider = new ElevenLabsTtsProvider(
      { ...baseElevenLabsTtsConfig, bindingDigest: "invalid" },
      { readApiKey: () => "secret-test-key" },
    );

    expect(() => provider.assertReady()).toThrow(/execution binding|binding digest/i);
  });

  it("marks a sent generation indeterminate when provider cost headers are missing", async () => {
    const provider = providerForResponse({
      audioBase64: fixtureWav().toString("base64"),
      requestId: "request_without_cost",
      alignment: alignment(),
    });

    await expect(executeElevenLabsAdapter(provider, "a", 1_000)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_without_cost",
      requestEvidence: [
        {
          requestIndex: 0,
          inputDigest: sha256("a"),
          requestIdHash: sha256("request_without_cost"),
        },
      ],
    });
  });

  it("does not settle success when provider character cost exceeds the approved cap", async () => {
    const provider = providerForResponse({
      audioBase64: fixtureWav().toString("base64"),
      characterCost: 2,
      requestId: "request_over_cap",
      alignment: alignment(),
    });

    await expect(executeElevenLabsAdapter(provider, "a", 100)).resolves.toMatchObject({
      kind: "unknown",
      reason: "indeterminate",
      providerRequestId: "request_over_cap",
      requestEvidence: [
        expect.objectContaining({
          requestIndex: 0,
          inputDigest: sha256("a"),
          requestIdHash: sha256("request_over_cap"),
          reportedUnits: 2,
        }),
      ],
    });
  });

  it("settles provider-billed credits at the base rate without reapplying model multipliers", async () => {
    const config = {
      ...baseElevenLabsTtsConfig,
      maximumUsdPerThousandCharacters: 0.2,
      billedCreditUsdPerThousandCharacters: 0.1,
    };
    const provider = new ElevenLabsTtsProvider(config, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({
        convertWithTimestamps: vi.fn(async () => ({
          audioBase64: fixtureWav().toString("base64"),
          characterCost: 2,
          requestId: "request_billed_credits",
          alignment: alignmentFor("aa"),
        })),
      }),
    });

    await expect(executeElevenLabsAdapter(provider, "aa", 1_000)).resolves.toMatchObject({
      kind: "success",
      actualUsdMicros: 200,
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

    const outcome = await executeElevenLabsAdapter(provider, "a".repeat(4_501), 450_100);
    expect(outcome).toMatchObject({
      kind: "unknown",
      reason: "provider-error",
      providerRequestId: "request_first_chunk",
      requestEvidence: [
        {
          requestIndex: 0,
          inputDigest: sha256("a".repeat(4_500)),
          requestIdHash: sha256("request_first_chunk"),
          reportedUnits: 4_500,
        },
      ],
    });
    if (outcome.kind !== "unknown") throw new Error("Expected uncertain provider outcome.");
    expect(JSON.stringify(outcome.requestEvidence)).not.toContain("request_first_chunk");
  });

  it("omits unsupported request-stitching fields from Eleven v3 chunks", async () => {
    const convertWithTimestamps = vi.fn(async (input: { text: string }) => ({
      audioBase64: fixtureWav().toString("base64"),
      characterCost: input.text.length,
      requestId: `request_${input.text.length}`,
      alignment: alignmentFor(input.text),
    }));
    const provider = new ElevenLabsTtsProvider(baseElevenLabsTtsConfig, {
      readApiKey: () => "secret-test-key",
      createClient: () => ({ convertWithTimestamps }),
    });

    await expect(
      executeElevenLabsAdapter(provider, "a".repeat(4_501), 1_000_000),
    ).resolves.toMatchObject({ kind: "success" });
    expect(convertWithTimestamps).toHaveBeenCalledTimes(2);
    for (const [request] of convertWithTimestamps.mock.calls) {
      expect(request).not.toHaveProperty("previousRequestIds");
      expect(request).not.toHaveProperty("previousText");
      expect(request).not.toHaveProperty("nextText");
    }
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

function alignmentFor(text: string) {
  const characters = Array.from(text);
  return {
    characters,
    characterStartTimesSeconds: characters.map((_, index) => index / characters.length),
    characterEndTimesSeconds: characters.map((_, index) => (index + 1) / characters.length),
  };
}
