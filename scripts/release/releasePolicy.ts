import {
  assertSingleMarker,
  normalizeUnreleasedNotes,
  splitUnreleasedSection,
} from "./changelogPolicy.js";

export { changelogMarker, changelogReleaseSource } from "./changelogPolicy.js";

export const releaseCommitTypes = [
  "build",
  "chore",
  "ci",
  "docs",
  "feat",
  "fix",
  "perf",
  "refactor",
  "style",
  "test",
] as const;

export type ReleaseCommitType = (typeof releaseCommitTypes)[number];

export type GitCommit = {
  hash: string;
  parents: string[];
  subject: string;
};

export type ParsedCommit = GitCommit & {
  breaking: boolean;
  description: string;
  scope: string | null;
  type: ReleaseCommitType;
};

export type ReleasePlan = {
  baseVersion: string;
  latestTag: string | null;
  nextVersion: string | null;
  releaseNeeded: boolean;
  releaseRange: string;
  bump: "major" | "minor" | "patch" | "none";
  commits: ParsedCommit[];
  ignoredCommits: GitCommit[];
  invalidCommits: GitCommit[];
};

type BuildReleasePlanInput = {
  commits: GitCommit[];
  currentVersion: string;
  latestTag: string | null;
};

const conventionalSubjectPattern = /^([a-z]+)(?:\(([^)]+)\))?(!)?:\s+(\S.+)$/;

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

const sectionByType: Record<ReleaseCommitType, string> = {
  build: "Build",
  chore: "Chores",
  ci: "CI",
  docs: "Documentation",
  feat: "Features",
  fix: "Fixes",
  perf: "Performance",
  refactor: "Refactoring",
  style: "Styles",
  test: "Tests",
};

export function parseConventionalSubject(commit: GitCommit): ParsedCommit | null {
  const match = conventionalSubjectPattern.exec(commit.subject);
  if (!match) {
    return null;
  }

  const [, type, scope, breaking, description] = match;
  if (!releaseCommitTypes.includes(type as ReleaseCommitType)) {
    return null;
  }

  return {
    ...commit,
    breaking: breaking === "!",
    description,
    scope: scope ?? null,
    type: type as ReleaseCommitType,
  };
}

export function isReleaseCommit(commit: GitCommit): boolean {
  return commit.subject.startsWith("chore(release):");
}
export function isLegacyAllowed(commit: GitCommit): boolean {
  return legacyNonConventionalSubjects.get(commit.hash) === commit.subject;
}

export function isMergeCommit(commit: GitCommit): boolean {
  const subject = commit.subject;
  return (
    commit.parents.length > 1 ||
    /^Merge pull request #\d+ from .+$/.test(subject) ||
    /^Merge branch .+$/.test(subject) ||
    /^Merge [0-9a-f]{40} into [0-9a-f]{40}$/.test(subject)
  );
}

export function buildReleasePlan(input: BuildReleasePlanInput): ReleasePlan {
  const parsed: ParsedCommit[] = [];
  const ignoredCommits: GitCommit[] = [];
  const invalidCommits: GitCommit[] = [];

  for (const commit of input.commits) {
    if (isMergeCommit(commit) || isReleaseCommit(commit) || isLegacyAllowed(commit)) {
      ignoredCommits.push(commit);
      continue;
    }

    const conventional = parseConventionalSubject(commit);
    if (!conventional) {
      invalidCommits.push(commit);
      continue;
    }
    parsed.push(conventional);
  }

  const bump = highestBump(parsed);
  const nextVersion = bump === "none" ? null : bumpVersion(input.currentVersion, bump);

  return {
    baseVersion: input.currentVersion,
    latestTag: input.latestTag,
    nextVersion,
    releaseNeeded: nextVersion !== null,
    releaseRange: input.latestTag ? `${input.latestTag}..HEAD` : "HEAD",
    bump,
    commits: parsed,
    ignoredCommits,
    invalidCommits,
  };
}

export function highestBump(commits: ParsedCommit[]): ReleasePlan["bump"] {
  let bump: ReleasePlan["bump"] = "none";
  for (const commit of commits) {
    if (commit.breaking) {
      return "major";
    }
    if (commit.type === "feat") {
      bump = bump === "none" || bump === "patch" ? "minor" : bump;
      continue;
    }
    if (bump === "none") {
      bump = "patch";
    }
  }
  return bump;
}

export function bumpVersion(version: string, bump: Exclude<ReleasePlan["bump"], "none">): string {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new Error(`package.json version must be SemVer MAJOR.MINOR.PATCH; received ${version}`);
  }

  let major = Number(match[1]);
  let minor = Number(match[2]);
  let patch = Number(match[3]);

  if (bump === "major") {
    if (major === 0) {
      minor += 1;
      patch = 0;
    } else {
      major += 1;
      minor = 0;
      patch = 0;
    }
  } else if (bump === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }

  return `${major}.${minor}.${patch}`;
}

export function renderCommitReleaseNotes(commits: ParsedCommit[]): string {
  const sections = new Map<string, ParsedCommit[]>();
  for (const commit of commits) {
    const section = sectionByType[commit.type];
    sections.set(section, [...(sections.get(section) ?? []), commit]);
  }

  return [...sections.entries()]
    .map(([section, entries]) => {
      const bullets = entries.map((entry) => `- ${entry.description} (${entry.hash.slice(0, 7)})`);
      return `### ${section}\n\n${bullets.join("\n")}`;
    })
    .join("\n\n");
}

export function updateChangelog(
  text: string,
  version: string,
  date: string,
  commits: ParsedCommit[],
): string {
  assertSingleMarker(text);
  const unreleased = splitUnreleasedSection(text);
  const notes = normalizeUnreleasedNotes(unreleased.content) || renderCommitReleaseNotes(commits);
  const nextUnreleased = "## Unreleased\n\n_No unreleased changes yet._";
  const releaseHeader = `## v${version} (${date})`;
  return `${unreleased.before}${nextUnreleased}\n\n${releaseHeader}\n\n${notes.trim()}\n\n${unreleased.after.trimStart()}`;
}
