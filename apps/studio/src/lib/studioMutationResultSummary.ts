export type StudioMutationRecordSummary = Readonly<{
  facts: readonly string[];
  runId: string | null;
}>;

const stringFields = [
  ["Run", "runId"],
  ["Artifact", "artifact"],
  ["Approval", "approvalId"],
  ["Revision", "revisionId"],
  ["Decision", "decision"],
  ["Reviewed by", "reviewedBy"],
  ["Target", "target"],
  ["Format", "format"],
  ["Dataset", "outputPath"],
  ["Report", "reportPath"],
  ["Run link template", "runLinkTemplatePath"],
] as const;

const numberFields = [["Records", "recordCount"]] as const;

/**
 * Builds a compact operator-facing summary from a producer CLI JSON record.
 *
 * @param record - The untrusted route payload returned by the local producer CLI.
 * @returns Bounded display facts, or `null` when the record has no useful primitive fields.
 */
export function summarizeStudioMutationRecord(record: unknown): StudioMutationRecordSummary | null {
  if (!isRecord(record)) {
    return null;
  }
  const facts = [
    stateTransitionFact(record),
    ...stringFields.map(([label, field]) => stringFact(label, record[field])),
    ...numberFields.map(([label, field]) => numberFact(label, record[field])),
    countFact("Artifacts", record.artifacts),
    countFact("Invalidated", record.invalidatedArtifacts),
    actionFact(record),
  ].filter(isString);

  return facts.length > 0 ? { facts, runId: stringValue(record.runId) } : null;
}

function stateTransitionFact(record: Record<string, unknown>): string | null {
  const previousState = stringValue(record.previousState);
  const nextState = stringValue(record.nextState);
  if (previousState && nextState) {
    return `State: ${previousState} → ${nextState}`;
  }
  if (nextState) {
    return `State: ${nextState}`;
  }
  return null;
}

function actionFact(record: Record<string, unknown>): string | null {
  return stringFact("Next action", record.nextSafeAction ?? record.nextAction);
}

function stringFact(label: string, value: unknown): string | null {
  const text = stringValue(value);
  return text ? `${label}: ${text}` : null;
}

function countFact(label: string, value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  return `${label}: ${value.length}`;
}

function numberFact(label: string, value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) ? `${label}: ${value}` : null;
}

function stringValue(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: string | null): value is string {
  return value !== null;
}
