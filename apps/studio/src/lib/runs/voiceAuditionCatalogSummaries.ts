import {
  isVoicePreviewEvidenceArtifactPath,
  isVoicePreviewFailureArtifactPath,
} from "../../../../../src/stages/voice/catalog/voiceAuditionContracts";
import {
  isVoiceCandidatesArtifactPath,
  isVoiceCatalogFailureArtifactPath,
  type VoiceCandidate,
  type VoiceCandidates,
} from "../../../../../src/stages/voice/catalog/voiceCatalogContracts";
import {
  maximumVoiceCatalogAgeMs,
  readCurrentVoicePreviewMediaAtProjectRoot,
  readVoiceCandidatesWithPathAtProjectRoot,
} from "../../../../../src/stages/voice/catalog/voiceCatalogStore";
import { studioMediaArtifactUrl } from "../artifacts/studioMediaArtifacts";
import { errorMessage } from "./voiceAuditionArtifactReads";
import type {
  CatalogReadResult,
  StudioVoiceCandidateSummary,
  StudioVoicePreviewSummary,
  VoiceAuditionRun,
} from "./voiceAuditionSummaryTypes";

export async function readVoiceCatalog(
  root: string,
  run: VoiceAuditionRun,
  nowMs: number,
): Promise<CatalogReadResult> {
  const latestAuditionPath = findLastArtifact(
    run.artifacts,
    (artifact) =>
      isVoiceCandidatesArtifactPath(artifact) || isVoiceCatalogFailureArtifactPath(artifact),
  );
  if (!latestAuditionPath) {
    return {
      catalog: null,
      diagnostics: [],
      kind: "missing",
      message:
        "No persisted voice catalog yet. Fetch candidates only when the operator requests it.",
    };
  }
  if (isVoiceCatalogFailureArtifactPath(latestAuditionPath)) {
    return {
      catalog: null,
      diagnostics: [`Latest catalog refresh failed: ${latestAuditionPath}`],
      kind: "invalid",
      message: "The latest catalog refresh failed safely. Review diagnostics before retrying.",
      path: latestAuditionPath,
    };
  }
  try {
    const record = await readVoiceCandidatesWithPathAtProjectRoot(root, run);
    if (record.path !== latestAuditionPath)
      throw new Error("latest catalog identity does not match");
    const catalog = record.catalog;
    const fetchedAtMs = Date.parse(catalog.fetchedAt);
    if (!Number.isFinite(fetchedAtMs) || fetchedAtMs > nowMs + 60_000) {
      throw new Error("catalog timestamp is invalid");
    }
    const stale = nowMs - fetchedAtMs > maximumVoiceCatalogAgeMs;
    return {
      catalog,
      diagnostics: stale ? ["Voice catalog metadata is stale; refresh before selection."] : [],
      kind: stale ? "stale" : "ready",
      message: stale
        ? "Persisted candidates remain visible, but selection requires a fresh catalog."
        : `${catalog.candidates.length} persisted candidate(s) are ready for local audition.`,
      path: latestAuditionPath,
    };
  } catch (error) {
    return {
      catalog: null,
      diagnostics: [`Voice catalog could not be validated: ${errorMessage(error)}`],
      kind: "invalid",
      message: "Persisted voice catalog evidence is invalid. Studio will not infer candidates.",
      path: latestAuditionPath,
    };
  }
}

export async function readVoiceCandidatePreviews(
  root: string,
  run: VoiceAuditionRun,
  catalog: VoiceCandidates | null,
  nowMs: number = Date.now(),
): Promise<{ diagnostics: string[]; previews: Map<string, StudioVoicePreviewSummary> }> {
  const diagnostics: string[] = [];
  const previews = new Map<string, StudioVoicePreviewSummary>();
  if (!catalog) return { diagnostics, previews };
  await Promise.all(
    catalog.candidates.slice(0, 24).map(async (candidate) => {
      const preview = await readCandidatePreview(root, run, catalog, candidate, nowMs);
      previews.set(candidate.voiceId, preview.summary);
      diagnostics.push(...preview.diagnostics);
    }),
  );
  return { diagnostics, previews };
}

export function summarizeVoiceCandidate(
  candidate: VoiceCandidate,
  catalog: VoiceCandidates,
  catalogKind: CatalogReadResult["kind"],
  preview: StudioVoicePreviewSummary,
  isSelected: boolean,
): StudioVoiceCandidateSummary {
  const turkishVerified = candidate.verifiedLanguages.some(
    (language) => language.language === "tr" && language.modelId === catalog.model.modelId,
  );
  return {
    category: candidate.category,
    description: candidate.description,
    eligibility: candidate.productionEligibility,
    isSelected,
    metadataFreshness: catalogKind === "ready" ? "fresh" : "stale",
    name: candidate.name,
    preview,
    productionRightsLabel:
      catalog.subscription.productionUseStatus === "blocked-free-tier"
        ? "Free tier: production use blocked"
        : "Operator production-rights confirmation required",
    tiers: candidate.availableForTiers,
    turkishSuitability: turkishVerified ? "verified" : "unverified",
    voiceId: candidate.voiceId,
  };
}

export function summarizeVoiceQuota(catalog: VoiceCandidates) {
  return {
    limit: catalog.subscription.characterLimit,
    remaining: Math.max(
      0,
      catalog.subscription.characterLimit - catalog.subscription.characterCount,
    ),
    tier: catalog.subscription.tier,
    used: catalog.subscription.characterCount,
  };
}

export function missingVoicePreview(): StudioVoicePreviewSummary {
  return { kind: "missing", mediaUrl: null, message: "No persisted local preview yet." };
}

async function readCandidatePreview(
  root: string,
  run: VoiceAuditionRun,
  catalog: VoiceCandidates,
  candidate: VoiceCandidate,
  nowMs: number,
): Promise<{ diagnostics: string[]; summary: StudioVoicePreviewSummary }> {
  const latestPath = findLastArtifact(
    run.artifacts,
    (artifact) =>
      isVoicePreviewEvidenceArtifactPath(artifact, candidate.voiceId) ||
      isVoicePreviewFailureArtifactPath(artifact, candidate.voiceId),
  );
  if (!latestPath) return { diagnostics: [], summary: missingVoicePreview() };
  if (isVoicePreviewFailureArtifactPath(latestPath, candidate.voiceId)) {
    return {
      diagnostics: [`Latest preview refresh failed for ${candidate.voiceId}: ${latestPath}`],
      summary: {
        artifactPath: latestPath,
        kind: "failed",
        mediaUrl: null,
        message: "Latest preview attempt failed safely.",
      },
    };
  }
  try {
    const preview = await readCurrentVoicePreviewMediaAtProjectRoot({
      catalog,
      nowMs,
      projectRoot: root,
      run,
      voiceId: candidate.voiceId,
    });
    const evidence = preview.evidence;
    if (preview.path !== latestPath) throw new Error("latest preview identity does not match");
    const mediaUrl = studioMediaArtifactUrl(run.runId, evidence.output.path);
    if (!mediaUrl) throw new Error("preview audio path is not locally streamable");
    return {
      diagnostics: [],
      summary: {
        artifactPath: latestPath,
        audioPath: evidence.output.path,
        digest: evidence.previewDigest,
        kind: "ready",
        mediaUrl,
        message: "Persisted local preview is ready.",
      },
    };
  } catch (error) {
    return {
      diagnostics: [`Preview ${candidate.voiceId} could not be validated: ${errorMessage(error)}`],
      summary: {
        artifactPath: latestPath,
        kind: "invalid",
        mediaUrl: null,
        message: "Persisted preview evidence is invalid.",
      },
    };
  }
}

function findLastArtifact(
  artifacts: readonly string[],
  predicate: (artifact: string) => boolean,
): string | undefined {
  for (let index = artifacts.length - 1; index >= 0; index -= 1) {
    const artifact = artifacts[index];
    if (artifact && predicate(artifact)) return artifact;
  }
  return undefined;
}
