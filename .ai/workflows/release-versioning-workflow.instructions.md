# Release And Versioning Workflow

Use before changing package metadata, release notes, branch publishing, or PR metadata.

## Sequence

1. Identify whether the change is docs/tooling only or product-impacting.
2. For product-impacting changes, decide whether `package.json` version should move.
3. Update release notes or PR body with changed surfaces:
   - CLI/runtime;
   - safeguards;
   - dashboard/frontend;
   - assets;
   - QA;
   - docs/.ai;
   - tooling.
4. Run the appropriate gates.
5. Keep PR title Conventional Commit compatible.

## Current State

No release automation exists yet. Do not invent one in a feature branch without an explicit task.
