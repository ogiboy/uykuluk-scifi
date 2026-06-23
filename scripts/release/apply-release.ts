#!/usr/bin/env tsx
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { updateChangelog } from "./releasePolicy.js";
import {
  buildCurrentReleasePlan,
  exitWithInvalidCommits,
  todayIsoDate,
  writePackageVersion,
} from "./releaseState.js";

const dryRun = process.argv.includes("--dry-run");
const plan = buildCurrentReleasePlan();
exitWithInvalidCommits(plan);

if (!plan.releaseNeeded || !plan.nextVersion) {
  console.log("No releaseable commits found; release files unchanged.");
  process.exit(0);
}

const currentChangelog = readFileSync("CHANGELOG.md", "utf8");
const nextChangelog = updateChangelog(
  currentChangelog,
  plan.nextVersion,
  todayIsoDate(),
  plan.commits,
);

if (dryRun) {
  console.log(
    JSON.stringify(
      {
        dryRun: true,
        nextVersion: plan.nextVersion,
        releaseRange: plan.releaseRange,
        releaseCommitCount: plan.commits.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

writePackageVersion(plan.nextVersion);
writeFileSync("CHANGELOG.md", nextChangelog);
console.log(`Prepared release v${plan.nextVersion} from ${plan.releaseRange}.`);
