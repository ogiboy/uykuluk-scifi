#!/usr/bin/env tsx
import { readFileSync } from "node:fs";
import { changelogReleaseSource } from "./releasePolicy.js";
import { buildCurrentReleasePlan, exitWithInvalidCommits } from "./releaseState.js";

const plan = buildCurrentReleasePlan();
exitWithInvalidCommits(plan);

const changelogSource = changelogReleaseSource(
  readFileSync("CHANGELOG.md", "utf8"),
  plan.releaseNeeded,
);

const output = {
  package: "uykuluk-scifi",
  baseVersion: plan.baseVersion,
  latestTag: plan.latestTag,
  releaseRange: plan.releaseRange,
  releaseNeeded: plan.releaseNeeded,
  bump: plan.bump,
  nextVersion: plan.nextVersion,
  pendingReleaseTag: plan.nextVersion ? `v${plan.nextVersion}` : null,
  releaseCommitCount: plan.commits.length,
  ignoredCommitCount: plan.ignoredCommits.length,
  changelog: {
    marker: "<!-- version list -->",
    source: changelogSource,
    stagingSection: "## Unreleased",
  },
  commitStyle: "Conventional Commits",
  automation: {
    branchPolicy:
      "Feature branches and PRs do not bump package.json; main pushes own release file mutation.",
    trigger: "push to main or workflow_dispatch",
    releaseFiles: ["package.json", "CHANGELOG.md", "git tag vX.Y.Z"],
  },
};

console.log(JSON.stringify(output, null, 2));
