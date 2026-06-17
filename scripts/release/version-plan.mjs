#!/usr/bin/env node
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

console.log(
  JSON.stringify(
    {
      package: pkg.name,
      version: pkg.version,
      branchPolicy:
        "Initial commit may land on main; subsequent feature work should use module-scoped branches.",
      changelog: "CHANGELOG.md is prepared with a semantic-release-compatible marker.",
      commitStyle: "Conventional Commits",
      releasePhase: "0.1.x CLI MVP, Studio foundation, and first repository bootstrap",
    },
    null,
    2,
  ),
);
