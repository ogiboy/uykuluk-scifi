import { loadConfigAtProjectRoot } from "../../config/config.js";
import { SafeExitError } from "../../core/errors.js";
import { sha256 } from "../../utils/hash.js";
import type {
  CatalogModel,
  CatalogSubscription,
  ElevenLabsCatalogClient,
} from "./catalog/voiceCatalogProvider.js";
import { createOfficialElevenLabsCatalogClient } from "./providers/elevenLabsCatalogClient.js";

export type ElevenLabsTtsConfig = Awaited<
  ReturnType<typeof loadConfigAtProjectRoot>
>["providers"]["tts"]["elevenLabs"];

export type DiagnosticPreflightDependencies = {
  createCatalogClient?: (apiKey: string) => ElevenLabsCatalogClient;
  readApiKey?: () => string | undefined;
};

export type DiagnosticPreflight = Readonly<{
  apiKey: string;
  elevenLabsConfig: ElevenLabsTtsConfig;
  preflightBase: Record<string, unknown>;
  entitlement: ReturnType<typeof requireDiagnosticEntitlement>;
}>;

export type DiagnosticPreflightResult =
  | Readonly<{ kind: "ready"; value: DiagnosticPreflight }>
  | Readonly<{
      kind: "blocked";
      reason: "configuration" | "entitlement" | "provider-rejected";
      message: string;
      base: Record<string, unknown>;
    }>;

export async function resolveDiagnosticPreflight(
  projectRoot: string,
  characterCount: number,
  dependencies: DiagnosticPreflightDependencies,
  base: Record<string, unknown>,
): Promise<DiagnosticPreflightResult> {
  const config = await loadConfigAtProjectRoot(projectRoot);
  const elevenLabsConfig = config.providers.tts.elevenLabs;
  if (elevenLabsConfig.modelId !== "eleven_v3") {
    return blocked(base, "configuration", "Diagnostic smoke requires Eleven v3.");
  }
  const apiKey = (dependencies.readApiKey ?? (() => process.env.ELEVENLABS_API_KEY))()?.trim();
  if (!apiKey) {
    return blocked(base, "configuration", "ElevenLabs diagnostic requires a server-side API key.");
  }
  const catalogClient = (dependencies.createCatalogClient ?? createOfficialElevenLabsCatalogClient)(
    apiKey,
  );
  const preflight = await readDiagnosticPreflight(catalogClient);
  if (!preflight) {
    return blocked(base, "provider-rejected", "ElevenLabs subscription preflight failed safely.");
  }
  const subscriptionRequestIdHash = preflight.subscription.requestId
    ? sha256(preflight.subscription.requestId)
    : undefined;
  const baseWithRequestId = {
    ...base,
    ...(subscriptionRequestIdHash ? { subscriptionRequestIdHash } : {}),
  };
  try {
    const entitlement = requireDiagnosticEntitlement(
      preflight.subscription.data,
      preflight.models.data,
      characterCount,
    );
    return {
      kind: "ready",
      value: {
        apiKey,
        elevenLabsConfig,
        entitlement,
        preflightBase: { ...baseWithRequestId, entitlement },
      },
    };
  } catch {
    return blocked(
      baseWithRequestId,
      "entitlement",
      "ElevenLabs diagnostic is blocked because included-credit entitlement could not be proven without overage.",
    );
  }
}

async function readDiagnosticPreflight(
  catalogClient: ElevenLabsCatalogClient,
): Promise<
  | {
      subscription: Awaited<ReturnType<ElevenLabsCatalogClient["getSubscription"]>>;
      models: Awaited<ReturnType<ElevenLabsCatalogClient["listModels"]>>;
    }
  | undefined
> {
  try {
    const [subscription, models] = await Promise.all([
      catalogClient.getSubscription(),
      catalogClient.listModels(),
    ]);
    return { subscription, models };
  } catch {
    return undefined;
  }
}

function requireDiagnosticEntitlement(
  subscription: CatalogSubscription,
  models: readonly CatalogModel[],
  characterCount: number,
) {
  const model = models.find((candidate) => candidate.modelId === "eleven_v3");
  const multiplier = model?.modelRates?.characterCostMultiplier;
  const discount = model?.modelRates?.costDiscountMultiplier ?? 1;
  const expectedCredits = Math.ceil(
    characterCount * requirePositive(multiplier) * requirePositive(discount),
  );
  const remainingCredits = Math.max(0, subscription.characterLimit - subscription.characterCount);
  const extension = subscription.maxCreditLimitExtension;
  const overageAmount = subscription.currentOverage?.amount;
  const requestLimit = model?.maxCharactersRequestFreeUser ?? model?.maximumTextLengthPerRequest;
  if (
    !["active", "trialing", "free"].includes(subscription.status.toLowerCase()) ||
    model?.canDoTextToSpeech !== true ||
    !(model.languages ?? []).some((language) => language.languageId === "tr") ||
    typeof requestLimit !== "number" ||
    requestLimit < characterCount ||
    extension !== 0 ||
    subscription.canExtendCharacterLimit !== false ||
    overageAmount === undefined ||
    !Number.isFinite(Number(overageAmount)) ||
    Number(overageAmount) !== 0 ||
    subscription.currentOverage?.currency === undefined ||
    subscription.hasOpenInvoices !== false ||
    remainingCredits < expectedCredits
  ) {
    throw new SafeExitError(
      "ElevenLabs diagnostic is blocked because included-credit entitlement could not be proven without overage.",
    );
  }
  return {
    tier: subscription.tier,
    status: subscription.status,
    usedCredits: subscription.characterCount,
    creditLimit: subscription.characterLimit,
    remainingCredits,
    expectedCredits,
    maxCreditLimitExtension: extension,
    canExtendCreditLimit: subscription.canExtendCharacterLimit,
    currentOverageAmount: overageAmount,
    currentOverageCurrency: subscription.currentOverage.currency,
    hasOpenInvoices: subscription.hasOpenInvoices,
    ...(subscription.nextCharacterCountResetUnix !== undefined
      ? { nextCreditResetUnix: subscription.nextCharacterCountResetUnix }
      : {}),
  };
}

function requirePositive(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new SafeExitError("ElevenLabs diagnostic model pricing metadata is unavailable.");
  }
  return value;
}

function blocked(
  base: Record<string, unknown>,
  reason: "configuration" | "entitlement" | "provider-rejected",
  message: string,
): DiagnosticPreflightResult {
  return { kind: "blocked", reason, message, base };
}
