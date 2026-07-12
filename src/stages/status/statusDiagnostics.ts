import type { RunDiagnosticSummary } from "../diagnostics/runDiagnosticSummaryContracts.js";

/**
 * Renders a diagnostics section for a run.
 *
 * @param diagnostics - Diagnostic entries to include
 * @returns Formatted lines for the diagnostics section, or an empty array when there are no diagnostics
 */
export function formatDiagnostics(diagnostics: readonly RunDiagnosticSummary[]): string[] {
  if (diagnostics.length === 0) {
    return [];
  }
  return ["", "Diagnostics:", ...diagnostics.flatMap(formatDiagnostic)];
}

function formatDiagnostic(diagnostic: RunDiagnosticSummary): string[] {
  const metadata = formatDiagnosticMetadata(diagnostic);
  const line = `- ${diagnostic.path} [${diagnostic.stage}]: ${diagnostic.message}${metadata}`;
  return diagnostic.nextAction ? [line, `  Next action: ${diagnostic.nextAction}`] : [line];
}

function formatDiagnosticMetadata(diagnostic: RunDiagnosticSummary): string {
  if (!diagnostic.failureKind) {
    return "";
  }
  if (diagnostic.wordCount !== null && diagnostic.requiredWordCount !== null) {
    return ` (${diagnostic.failureKind}: ${diagnostic.wordCount}/${diagnostic.requiredWordCount} words)`;
  }
  return ` (${diagnostic.failureKind})`;
}
