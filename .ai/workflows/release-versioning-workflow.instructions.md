# Release And Versioning Workflow

Use before changing package metadata, release notes, branch publishing, or PR metadata.

## Sequence

1. Identify whether the change is docs/tooling only or product-impacting.
2. Keep branch commits and PR titles Conventional Commit compatible.
3. Update `CHANGELOG.md` Unreleased notes or PR body with changed surfaces:
   - CLI/runtime;
   - safeguards;
   - dashboard/frontend;
   - assets;
   - QA;
   - docs/.ai;
   - tooling.
4. Run the appropriate gates, including `pnpm release:check` and `pnpm version:plan` when release
   metadata or workflow behavior changes.
5. Do not manually bump `package.json` on feature branches. The main-branch release workflow owns
   release file mutation, release commit creation, and stable tag creation.

## Current State

Main pushes run `.github/workflows/release.yml`. If releaseable commits exist after the latest
stable tag, the workflow validates the project, applies `pnpm release:apply`, commits
`chore(release): vX.Y.Z`, and tags `vX.Y.Z`.
