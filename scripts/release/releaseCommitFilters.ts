import type { GitCommit } from "./releasePolicy.js";

const legacyNonConventionalSubjects = new Map([
  [
    "ec58978101438e9c02b548d92ac4d1a3e7aceadf",
    "📝 Add docstrings to `fix/core-script-approval-integrity`",
  ],
  [
    "88a2c3bb5744daaccdb46e115a2facc92bc14bbf",
    "📝 Add docstrings to `fix/core-production-package-integrity`",
  ],
]);
const documentationAutomationSubjectPattern = /^📝 Add docstrings to `[^`]+`$/;

export function isReleaseCommit(commit: GitCommit): boolean {
  return commit.subject.startsWith("chore(release):");
}

export function isLegacyAllowed(commit: GitCommit): boolean {
  return (
    legacyNonConventionalSubjects.get(commit.hash) === commit.subject ||
    documentationAutomationSubjectPattern.test(commit.subject)
  );
}
