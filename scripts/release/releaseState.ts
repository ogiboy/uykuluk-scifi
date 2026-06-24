import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";
import { buildReleasePlan, type GitCommit, type ReleasePlan } from "./releasePolicy.js";

const stableTagPattern = /^v\d+\.\d+\.\d+$/;
const gitExecutable = "/usr/bin/git";

export function readGitCommits(range: string): GitCommit[] {
  const output = execFileSync(gitExecutable, ["log", "--format=%H%x1f%P%x1f%s", range], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  }).trim();

  if (!output) {
    return [];
  }

  return output.split("\n").map((line) => {
    const [hash, parents, subject] = line.split("\x1f");
    return { hash, parents: parents ? parents.split(" ").filter(Boolean) : [], subject };
  });
}

export function latestStableTag(): string | null {
  let output: string;
  try {
    output = execFileSync(gitExecutable, ["tag", "--merged", "HEAD", "--sort=-v:refname"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }

  return output.split("\n").find((tag) => stableTagPattern.test(tag)) ?? null;
}

export function currentPackageVersion(): string {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as { version?: unknown };
  if (typeof pkg.version !== "string") {
    throw new TypeError("package.json must contain a string version.");
  }
  return pkg.version;
}

export function writePackageVersion(version: string): void {
  const pkg = JSON.parse(readFileSync("package.json", "utf8")) as Record<string, unknown>;
  pkg.version = version;
  writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
}

export function buildCurrentReleasePlan(): ReleasePlan {
  const tag = latestStableTag();
  return buildReleasePlan({
    commits: readGitCommits(tag ? `${tag}..HEAD` : "HEAD"),
    currentVersion: currentPackageVersion(),
    latestTag: tag,
  });
}

export function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function exitWithInvalidCommits(plan: ReleasePlan): void {
  if (plan.invalidCommits.length === 0) {
    return;
  }

  console.error(`Release commits in ${plan.releaseRange} must use conventional commit subjects.`);
  console.error("Use feat:, fix:, docs:, chore:, ci:, build:, perf:, refactor:, test:, or style:.");
  for (const commit of plan.invalidCommits) {
    console.error(`- ${commit.hash.slice(0, 7)} ${commit.subject}`);
  }
  process.exit(1);
}
