import { SafeExitError } from "../../../core/errors.js";
import { estimateElevenLabsTtsUsd } from "../../../costs/elevenLabsPricing.js";
import { usdToMicrosCeil } from "../../../costs/money.js";
import type { ReservedProviderAdapter } from "../../../costs/reservedProviderExecution.js";
import { splitElevenLabsText } from "../elevenLabsTextChunks.js";
import { createOfficialElevenLabsTimingClient } from "./elevenLabsTimingClient.js";
import {
  wavOutputFormatSchema,
  type ElevenLabsTimingClient,
  type ElevenLabsTtsProviderConfig,
} from "./elevenLabsTtsContracts.js";
import { executeElevenLabsReservedSynthesis } from "./elevenLabsTtsExecution.js";
import type { ReservedTtsProvider, TtsSynthesisInput, TtsSynthesisResult } from "./ttsProvider.js";

export type {
  ElevenLabsTtsProviderConfig,
  ElevenLabsWavOutputFormat,
} from "./elevenLabsTtsContracts.js";

type ElevenLabsTtsProviderOptions = {
  readApiKey?: () => string | undefined;
  createClient?: (apiKey: string) => ElevenLabsTimingClient;
};

/** Approval-reserved ElevenLabs adapter. It never exposes or persists the API key. */
export class ElevenLabsTtsProvider implements ReservedTtsProvider {
  readonly mode = "elevenlabs" as const;
  readonly executionPolicy = "reserved-paid" as const;

  private readonly readApiKey: () => string | undefined;
  private readonly createClient: (apiKey: string) => ElevenLabsTimingClient;

  constructor(
    private readonly config: ElevenLabsTtsProviderConfig,
    options: ElevenLabsTtsProviderOptions = {},
  ) {
    this.readApiKey = options.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY);
    this.createClient = options.createClient ?? createOfficialElevenLabsTimingClient;
  }

  /** Fails before cost reservation when credentials or provider configuration are unsafe. */
  assertReady(): void {
    if (!/^[a-f0-9]{64}$/.test(this.config.bindingDigest)) {
      throw new SafeExitError("ElevenLabs TTS requires an exact execution binding digest.");
    }
    if (!this.config.voiceId.trim()) {
      throw new SafeExitError("ElevenLabs TTS requires a configured voice id.");
    }
    if (!this.config.modelId.trim()) {
      throw new SafeExitError("ElevenLabs TTS requires a configured model id.");
    }
    if (
      this.config.modelId === "eleven_v3" &&
      this.config.voiceSettings?.useSpeakerBoost !== undefined
    ) {
      throw new SafeExitError("Eleven v3 does not support Speaker Boost.");
    }
    if (this.config.maxRetries !== 0) {
      throw new SafeExitError(
        "ElevenLabs TTS retries must remain disabled because the API has no idempotency key.",
      );
    }
    wavOutputFormatSchema.parse(this.config.outputFormat);
    splitElevenLabsText("configuration-check", this.config.maxCharactersPerRequest);
    if (!this.readApiKey()?.trim()) {
      throw new SafeExitError(
        "ElevenLabs TTS requires ELEVENLABS_API_KEY in the server environment.",
      );
    }
  }

  estimateUsd(text: string): number {
    return estimateElevenLabsTtsUsd(text, this.config.maximumUsdPerThousandCharacters);
  }

  createReservedAdapter(input: TtsSynthesisInput): ReservedProviderAdapter<TtsSynthesisResult> {
    const estimatedUsdMicros = usdToMicrosCeil(this.estimateUsd(input.text));
    return {
      provider: "elevenlabs",
      model: this.config.modelId,
      bindingDigest: this.config.bindingDigest,
      execute: async (context) => {
        const apiKey = this.readApiKey()?.trim();
        if (
          !apiKey ||
          estimatedUsdMicros > context.maxUsdMicros ||
          context.bindingDigest !== this.config.bindingDigest
        ) {
          return { kind: "definitely-not-sent", reason: "adapter-validation" };
        }
        return executeElevenLabsReservedSynthesis({
          apiKey,
          config: this.config,
          context,
          createClient: this.createClient,
          synthesisInput: input,
        });
      },
    };
  }
}
