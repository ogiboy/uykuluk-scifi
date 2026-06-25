# Versioning And Release Notes

The project uses `package.json` as the version source and a main-branch release workflow to update
`package.json`, `CHANGELOG.md`, and the stable `vX.Y.Z` git tag from Conventional Commits.

## Version Intent

- `0.1.x` - CLI MVP hardening, docs, QA, asset inventory, tooling.
- `0.2.x` - read-only local Next.js Producer Studio routes and shared service contracts.
- `0.3.x` - dashboard approvals and prompt editor.
- `0.4.x` - real Ollama doctor/readiness and improved provider diagnostics.
- `0.5.x` - local TTS behind approval/cost gates.
- `0.6.x` - local render behind approval/cost gates.
- `0.7.x` - private upload behind explicit approval/config.
- `1.0.0` - stable local producer workflow with strong evidence and no public publish by default.

## Release Note Buckets

- Runtime/CLI.
- Safeguards.
- Frontend/dashboard.
- Assets.
- Tests/QA.
- Docs/.ai.
- Tooling/CI.

## Automation Contract

- Feature branches and PRs do not bump `package.json` manually.
- `pnpm version:plan` computes the next version from the latest stable tag. If no stable tag exists,
  it treats the current reachable history as the first releasable range. The JSON output also
  reports the pending release tag, whether the changelog will use curated `## Unreleased` notes or
  commit-derived notes, and that feature branches/PRs should not mutate release files.
- `pnpm release:check` validates non-merge, non-release commit subjects in the release range.
- `pnpm release:apply` updates `package.json` and moves `CHANGELOG.md` Unreleased notes into a
  versioned section; the GitHub release workflow owns the release commit and tag.
- The release workflow runs only on `main` pushes or manual dispatch and skips bot-authored release
  commits to avoid loops.
- Legacy non-conventional subjects may be allowlisted by exact SHA only when history cannot be
  safely rewritten.

## Do Not Release As Stable Until

- approval gates are covered by unit and usage tests;
- prompt revisions are attributable;
- evidence bundle reflects current state;
- dashboard and CLI agree;
- upload/public publish remain disabled by default unless deliberately scoped.
