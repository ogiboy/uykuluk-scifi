#!/usr/bin/env tsx
import { buildCurrentReleasePlan, exitWithInvalidCommits } from "./releaseState.js";

const plan = buildCurrentReleasePlan();
exitWithInvalidCommits(plan);

const output = {
  package: "uykuluk-scifi",
  baseVersion: plan.baseVersion,
  latestTag: plan.latestTag,
  releaseRange: plan.releaseRange,
  releaseNeeded: plan.releaseNeeded,
  bump: plan.bump,
  nextVersion: plan.nextVersion,
  releaseCommitCount: plan.commits.length,
  ignoredCommitCount: plan.ignoredCommits.length,
  changelog: "CHANGELOG.md uses the <!-- version list --> marker and ## Unreleased staging area.",
  commitStyle: "Conventional Commits",
};

console.log(JSON.stringify(output, null, 2));
