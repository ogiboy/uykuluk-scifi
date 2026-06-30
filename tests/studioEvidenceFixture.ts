/**
 * Builds a schema-current evidence fixture for Studio tests.
 *
 * @param runId - The run identifier.
 * @param currentState - The current run state.
 * @param evidence - Additional evidence fields to merge into the fixture.
 * @returns A persisted evidence bundle shape suitable for status validation.
 */
export function studioEvidenceFixture(
  runId: string,
  currentState: string,
  evidence: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    runId,
    generatedAt: "2026-06-27T00:00:00.000Z",
    currentState,
    approvedIdea: null,
    scriptPath: "script.md",
    reviews: [],
    approvals: [],
    costs: [],
    costReservations: [],
    costQuote: null,
    productionPackageIntegrity: null,
    renderPlan: {
      status: "missing",
      requiredArtifacts: [
        "production/render_plan.json",
        "production/storyboard_contact_sheet.md",
        "production/asset_provenance.json",
      ],
    },
    voiceoverAudio: {
      status: "missing",
      requiredArtifacts: [
        "production/audio/voiceover.wav",
        "production/audio/voiceover.meta.json",
        "production/audio/voiceover_review.md",
      ],
    },
    draftRender: {
      status: "missing",
      requiredArtifacts: [
        "production/render/draft.mp4",
        "production/render/render_manifest.json",
        "production/render/draft_review.md",
      ],
    },
    costEstimatePath: null,
    generatedArtifacts: [],
    warnings: [],
    promptProvenance: [],
    revisions: [],
    blockedActions: [],
    nextRecommendedCommand: `pnpm producer evidence --run ${runId}`,
    ledgerEventCount: 0,
  };
  return {
    ...base,
    ...evidence,
    runId,
    renderPlan: mergeObject(base.renderPlan, evidence.renderPlan),
    voiceoverAudio: mergeObject(base.voiceoverAudio, evidence.voiceoverAudio),
    draftRender: mergeObject(base.draftRender, evidence.draftRender),
  };
}

function mergeObject(base: Record<string, unknown>, override: unknown): Record<string, unknown> {
  return override && typeof override === "object" && !Array.isArray(override)
    ? { ...base, ...(override as Record<string, unknown>) }
    : base;
}
