import type { RefinementCtx } from "zod";

type ProviderField =
  "service" | "modelId" | "voiceId" | "outputFormat" | "modelPath" | "modelSha256";

export type VoiceoverMetaRefinementInput = {
  mode: "deterministic-local" | "local-piper" | "elevenlabs";
  quality: "deterministic-local-reference" | "local-piper" | "elevenlabs";
  source: { preparation?: unknown };
  provider?: Partial<Record<ProviderField | "configPath" | "configSha256", string>>;
  paidExecution?: unknown;
  alignment?: unknown;
};

export function refineVoiceoverMeta(
  meta: VoiceoverMetaRefinementInput,
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  if (meta.mode === "elevenlabs") {
    refineElevenLabsMeta(meta, context);
    return;
  }
  requireAbsentPaidExecution(meta, context);
  if (meta.mode === "local-piper") {
    refineLocalPiperMeta(meta, context);
  }
}

function refineElevenLabsMeta(
  meta: VoiceoverMetaRefinementInput,
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  requireValue(
    meta.quality === "elevenlabs",
    "ElevenLabs voiceover metadata requires ElevenLabs quality.",
    ["quality"],
    context,
  );
  requireValue(
    Boolean(meta.alignment),
    "ElevenLabs voiceover metadata requires character alignment evidence.",
    ["alignment"],
    context,
  );
  requireValue(
    Boolean(meta.source.preparation),
    "ElevenLabs voiceover metadata requires prepared-text evidence.",
    ["source", "preparation"],
    context,
  );
  requireValue(
    Boolean(meta.paidExecution),
    "ElevenLabs voiceover metadata requires exact paid execution evidence.",
    ["paidExecution"],
    context,
  );
  requireProviderFields(
    meta,
    ["service", "modelId", "voiceId", "outputFormat"],
    "ElevenLabs",
    context,
  );
}

function refineLocalPiperMeta(
  meta: VoiceoverMetaRefinementInput,
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  if (!meta.provider) {
    context.addIssue({
      code: "custom",
      message: "Local Piper voiceover metadata requires provider provenance.",
      path: ["provider"],
    });
    return;
  }
  requireProviderFields(meta, ["modelPath", "modelSha256"], "Local Piper", context);
  if (meta.provider.configPath && !meta.provider.configSha256) {
    context.addIssue({
      code: "custom",
      message:
        "Local Piper voiceover metadata requires provider.configSha256 when configPath is present.",
      path: ["provider", "configSha256"],
    });
  }
}

function requireAbsentPaidExecution(
  meta: VoiceoverMetaRefinementInput,
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  if (meta.paidExecution) {
    context.addIssue({
      code: "custom",
      message: "Local voiceover metadata cannot claim paid execution evidence.",
      path: ["paidExecution"],
    });
  }
}

function requireProviderFields(
  meta: VoiceoverMetaRefinementInput,
  fields: readonly ProviderField[],
  providerName: string,
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  for (const field of fields) {
    if (!meta.provider?.[field]) {
      context.addIssue({
        code: "custom",
        message: `${providerName} voiceover metadata requires provider.${field}.`,
        path: ["provider", field],
      });
    }
  }
}

function requireValue(
  present: boolean,
  message: string,
  path: PropertyKey[],
  context: RefinementCtx<VoiceoverMetaRefinementInput>,
): void {
  if (!present) context.addIssue({ code: "custom", message, path });
}
