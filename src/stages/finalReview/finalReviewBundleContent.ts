import { productionPackageManifestPath } from "../production/productionPackageIntegrity.js";
import { soundtrackManifestPath, type SoundtrackManifest } from "../soundtrack/soundtrackManifest.js";
import { voiceForwardMasteringProfile } from "../render/audioMastering.js";
import type { DraftRenderManifest } from "../render/renderEvidenceContracts.js";
import type {
  CurrentFinalReviewBundle,
  FinalReviewBundle,
} from "./finalReviewBundleContracts.js";
import { acceptedFinalReviewNextSafeAction } from "./finalReviewBundleValidation.js";

type FinalReviewArtifact = FinalReviewBundle["artifacts"][number];
type FinalReviewArtifactSpec = readonly [
  label: string,
  path: string,
  reviewPhase: string,
  operatorAction: string,
];

const finalReviewArtifactSpecs = [
  [
    "Script",
    "script.md",
    "Script",
    "Review the final script text and scientific caution before channel use.",
  ],
  [
    "Production package",
    "production/production_package.md",
    "Package",
    "Review voiceover text, subtitles, scene plan, popup cards, and YouTube metadata.",
  ],
  [
    "Production manifest",
    productionPackageManifestPath,
    "Package",
    "Use as integrity evidence for package artifacts.",
  ],
  [
    "Render plan",
    "production/render_plan.json",
    "Render plan",
    "Confirm scene-to-asset mapping and timing before trusting the draft render.",
  ],
  [
    "Storyboard contact sheet",
    "production/storyboard_contact_sheet.md",
    "Render plan",
    "Review visual rhythm, background reuse, and popup placement.",
  ],
  [
    "Asset provenance",
    "production/asset_provenance.json",
    "Render plan",
    "Confirm tracked local assets used by the draft render.",
  ],
  [
    "Voiceover review",
    "production/audio/voiceover_review.md",
    "Voiceover",
    "Listen locally before using the draft as anything beyond a timing review.",
  ],
  [
    "Draft render MP4",
    "production/render/draft.mp4",
    "Draft render",
    "Watch the full local draft before recording or trusting a decision.",
  ],
  [
    "Draft render review",
    "production/render/draft_review.md",
    "Draft render",
    "Review FFmpeg proof, timestamped map, ffprobe evidence, overlays, and blocked upload/publish actions.",
  ],
  [
    "Render manifest",
    "production/render/render_manifest.json",
    "Draft render",
    "Use as machine-readable proof for the local render inputs and output.",
  ],
  [
    "YouTube chapter draft",
    "production/render/youtube_chapters.md",
    "Draft render",
    "Review and revise the local chapter copy before any future upload workflow.",
  ],
  [
    "YouTube chapter JSON",
    "production/render/youtube_chapters.json",
    "Draft render",
    "Use as machine-readable chapter-prep evidence bound by the render manifest.",
  ],
  [
    "Evidence bundle",
    "evidence_bundle.md",
    "Evidence",
    "Review current blockers and next safe action.",
  ],
  [
    "Readiness diagnostics",
    "diagnostics/readiness.md",
    "Evidence",
    "Confirm readiness checks and remediation commands.",
  ],
] as const satisfies readonly FinalReviewArtifactSpec[];

export function finalReviewStatus(
  decision: FinalReviewBundle["renderDecision"],
): FinalReviewBundle["status"] {
  if (decision.kind === "missing") {
    return "decision-pending";
  }
  return decision.decision;
}

export function finalReviewSummary(decision: FinalReviewBundle["renderDecision"]): string {
  if (decision.kind === "missing") {
    return "The local draft render is ready for operator review. A durable render decision has not been recorded yet.";
  }
  if (decision.decision === "accepted-for-local-review") {
    return "The local draft render has been accepted for manual channel review. This is not upload or publish approval.";
  }
  if (decision.decision === "needs-revision") {
    return "The local draft render needs revision before it can be used for channel review.";
  }
  return "The local draft render was rejected and should not be used for channel review.";
}

export function finalReviewNextSafeAction(
  runId: string,
  decision: FinalReviewBundle["renderDecision"],
): string {
  if (decision.kind === "missing") {
    return decision.nextAction;
  }
  if (decision.decision === "accepted-for-local-review") {
    return acceptedFinalReviewNextSafeAction(runId);
  }
  return decision.nextSafeAction;
}

export function finalReviewBlockedActions(decision: FinalReviewBundle["renderDecision"]): string[] {
  const blockers = [
    "Private upload remains disabled until a separate future upload approval and configuration exist.",
    "Scheduled/public publish remains disabled and requires a separate future risk review.",
  ];
  if (decision.kind === "missing") {
    return [
      "Record one durable local render decision before treating this bundle as reviewed.",
      ...blockers,
    ];
  }
  if (decision.decision !== "accepted-for-local-review") {
    return [
      "Do not use this draft for channel review until a revised local draft is rendered and reviewed.",
      ...blockers,
    ];
  }
  return blockers;
}

export function finalReviewArtifacts(
  decision: FinalReviewBundle["renderDecision"],
): FinalReviewBundle["artifacts"] {
  const artifacts = finalReviewArtifactSpecs.map((spec) =>
    artifact(spec[0], spec[1], spec[2], spec[3]),
  );
  if (decision.kind === "present") {
    artifacts.push(
      artifact(
        "Render decision",
        "production/render/render_decision.md",
        "Decision",
        "Treat as local review evidence only; it is not upload or publish approval.",
      ),
    );
  }
  return artifacts;
}

/**
 * Projects validated v11 render evidence into the non-sensitive media-review summary.
 * Source manifest paths remain relative; operator identities and free-form provenance text stay out.
 */
export function finalReviewMediaSummary(
  manifest: Extract<DraftRenderManifest, { schemaVersion: 11 }>,
  soundtrack: SoundtrackManifest,
): CurrentFinalReviewBundle["media"] {
  const rightsBases = new Map<
    CurrentFinalReviewBundle["media"]["rightsProvenance"]["rightsBases"][number]["basis"],
    number
  >();
  for (const asset of soundtrack.assets) {
    const basis = asset.provenance.rights.basis;
    rightsBases.set(basis, (rightsBases.get(basis) ?? 0) + 1);
  }
  const decision = soundtrack.decision;
  if (decision?.status !== "approved") {
    throw new Error("Validated v11 render manifest requires an approved soundtrack decision.");
  }
  return {
    soundtrack: {
      manifestPath: soundtrackManifestPath,
      manifestDigest: manifest.soundtrack.manifestDigest,
      mode: soundtrack.mode,
      revision: soundtrack.revision,
      decision: { status: decision.status, decidedAt: decision.decidedAt },
    },
    rightsProvenance: {
      assetCount: soundtrack.assets.length,
      musicAssetCount: soundtrack.assets.filter((asset) => asset.role === "music").length,
      sfxAssetCount: soundtrack.assets.filter((asset) => asset.role === "sfx").length,
      rightsBases: [...rightsBases.entries()].map(([basis, assetCount]) => ({ basis, assetCount })),
    },
    mastering: {
      evidencePath: manifest.mastering.path,
      evidenceSha256: manifest.mastering.sha256,
      target: {
        integratedLufs: voiceForwardMasteringProfile.integratedLufs,
        toleranceLufs: voiceForwardMasteringProfile.toleranceLufs,
        normalizationTruePeakDbtp: voiceForwardMasteringProfile.normalizationTruePeakDbtp,
        maxOutputTruePeakDbtp: voiceForwardMasteringProfile.maxOutputTruePeakDbtp,
        loudnessRangeLufs: voiceForwardMasteringProfile.loudnessRangeLufs,
      },
      output: {
        integratedLufs: manifest.mastering.outputMeasurement.integratedLufs,
        truePeakDbtp: manifest.mastering.outputMeasurement.truePeakDbtp,
        loudnessRangeLufs: manifest.mastering.outputMeasurement.loudnessRangeLufs,
      },
      passed: manifest.mastering.passed,
    },
    encoding: manifest.encoding,
    renderApproval: manifest.renderApproval,
  };
}

function artifact(
  label: string,
  path: string,
  reviewPhase: string,
  operatorAction: string,
): FinalReviewArtifact {
  return { label, operatorAction, path, reviewPhase };
}
