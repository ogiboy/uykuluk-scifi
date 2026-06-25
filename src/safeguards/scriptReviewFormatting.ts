import type { ScriptReviewWarning } from "./contentGuard.js";

export function formatScriptReviewWarning(warning: ScriptReviewWarning): string {
  const details = formatWarningDetails(warning.details);
  return details ? `${warning.code}(${details})` : warning.code;
}

export function formatScriptReviewBlockers(warnings: readonly ScriptReviewWarning[]): string {
  return warnings.map(formatScriptReviewWarning).join(", ");
}

function formatWarningDetails(details: ScriptReviewWarning["details"]): string {
  if (!details) {
    return "";
  }
  return Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(";");
}
