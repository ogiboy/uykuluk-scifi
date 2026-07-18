import { execFileSync } from "node:child_process";

const limit = 120;
const baseRef = process.env.PR_SIZE_BASE_REF ?? "origin/main";
const headRef = process.env.PR_SIZE_HEAD_REF ?? "HEAD";

const output = execFileSync("/usr/bin/git", ["diff", "--name-only", `${baseRef}...${headRef}`], {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "inherit"],
});
const changedFiles = output.split("\n").filter(Boolean);

console.log(`PR size: ${changedFiles.length}/${limit} changed files (${baseRef}...${headRef}).`);

if (changedFiles.length > limit) {
  console.error(`PR exceeds the ${limit}-file limit by ${changedFiles.length - limit} file(s).`);
  process.exitCode = 1;
}
