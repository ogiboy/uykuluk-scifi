import { spawnSync } from "node:child_process";

const git = (args) => {
  const result = spawnSync("/usr/bin/git", args, { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.split("\n").filter(Boolean);
};

const branchFiles = (() => {
  try {
    return git(["diff", "--name-only", "--diff-filter=ACMR", "origin/main...HEAD"]);
  } catch {
    return [];
  }
})();

const changedFiles = [
  ...branchFiles,
  ...git(["diff", "--name-only", "--diff-filter=ACMR", "HEAD"]),
  ...git(["ls-files", "--others", "--exclude-standard"]),
];
const uniqueFiles = [...new Set(changedFiles)];
const sourceFiles = uniqueFiles.filter((file) => /\.(?:[cm]?js|tsx?)$/.test(file));
const studioFiles = sourceFiles.filter((file) => file.startsWith("apps/studio/"));
const rootFiles = sourceFiles.filter((file) => !file.startsWith("apps/studio/"));
const formatFiles = uniqueFiles.filter((file) =>
  /\.(?:[cm]?js|tsx?|json|md|ya?ml|css)$/.test(file),
);

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, { stdio: "inherit", ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

if (rootFiles.length > 0) {
  run("node_modules/.bin/eslint", rootFiles);
}

if (studioFiles.length > 0) {
  run("node_modules/.bin/eslint", studioFiles, {
    env: { ...process.env, ESLINT_USE_FLAT_CONFIG: "true" },
  });
}

if (formatFiles.length > 0) {
  run("node_modules/.bin/prettier", ["--check", ...formatFiles]);
}

if (uniqueFiles.length === 0) {
  console.log("quick-local: no changed files to validate.");
}
