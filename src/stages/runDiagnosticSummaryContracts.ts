export const diagnosticSummaryArtifactPaths = [
  "diagnostics/script_generation_failure.json",
] as const;

export type RunDiagnosticSummary = {
  createdAt: string | null;
  message: string;
  model: string | null;
  path: string;
  providerMode: string | null;
  stage: string;
  thinkingMode: string | null;
};

type DiagnosticSnapshot = {
  createdAt?: unknown;
  message?: unknown;
  model?: unknown;
  providerMode?: unknown;
  stage?: unknown;
  thinkingMode?: unknown;
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
    message,
    model: normalizeDiagnosticText(snapshot.model),
    path: relativePath,
    providerMode: normalizeDiagnosticText(snapshot.providerMode),
    stage: normalizeDiagnosticText(snapshot.stage) ?? "unknown",
    thinkingMode: normalizeDiagnosticText(snapshot.thinkingMode),
  };
}

function normalizeDiagnosticText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.replaceAll(/\s+/g, " ").trim();
  return normalized.length > 0 ? normalized : null;
}
