/** Known safe diagnostic artifacts summarized in CLI and Studio status surfaces. */
export const diagnosticSummaryArtifactPaths = [
  "diagnostics/ideas_generation_failure.json",
  "diagnostics/script_generation_failure.json",
] as const;

export type RunDiagnosticSummary = {
  createdAt: string | null;
  failureKind: string | null;
  message: string;
  model: string | null;
  nextAction: string | null;
  path: string;
  providerMode: string | null;
  requiredWordCount: number | null;
  stage: string;
  thinkingMode: string | null;
  wordCount: number | null;
};

type DiagnosticSnapshot = {
  createdAt?: unknown;
  failureKind?: unknown;
  message?: unknown;
  model?: unknown;
  nextAction?: unknown;
  providerMode?: unknown;
  requiredWordCount?: unknown;
  stage?: unknown;
  thinkingMode?: unknown;
  wordCount?: unknown;
};

export function summarizeRunDiagnosticArtifact(
  relativePath: string,
  snapshot: DiagnosticSnapshot,
): RunDiagnosticSummary | null {
  const message = normalizeDiagnosticText(snapshot.message);
  if (!message) {
    return null;
  }
  return {
    createdAt: normalizeDiagnosticText(snapshot.createdAt),
    failureKind: normalizeDiagnosticText(snapshot.failureKind),
    message,
    model: normalizeDiagnosticText(snapshot.model),
    nextAction: normalizeDiagnosticText(snapshot.nextAction),
    path: relativePath,
    providerMode: normalizeDiagnosticText(snapshot.providerMode),
    requiredWordCount: normalizeDiagnosticNumber(snapshot.requiredWordCount),
    stage: normalizeDiagnosticText(snapshot.stage) ?? "unknown",
    thinkingMode: normalizeDiagnosticText(snapshot.thinkingMode),
    wordCount: normalizeDiagnosticNumber(snapshot.wordCount),
  };
}

function normalizeDiagnosticText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDiagnosticNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
