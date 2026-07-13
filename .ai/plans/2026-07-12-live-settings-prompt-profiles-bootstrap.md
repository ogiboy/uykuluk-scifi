# Live Settings, Prompt Profiles, And Local Bootstrap

## Goal

Give the operator a guarded Studio surface for persistent safe settings and prompt profiles, with
one-command fresh-clone onboarding, without moving workflow authority out of CLI/core or changing
an in-flight operation beneath its approvals.

## Approved Behavior

The operator approved this contract on 2026-07-12:

- a successful save is visible in Studio immediately and is effective for the next command or new
  operation;
- a command or provider operation uses one immutable config/prompt snapshot from start to finish;
- Studio listener ports, `NEXT_PUBLIC_*`, Sentry source-map settings, and other process/build-time
  values require a controlled restart or rebuild;
- secrets stay server-side and env-owned; Studio reports only configured/missing status;
- prompt save, idea generation, approvals, and provider execution remain separate operations.

## Architecture

- `src/config/` is the canonical settings owner. It validates a versioned document, resolves the
  project config path consistently, captures immutable effective snapshots, writes revisions
  atomically, and produces redacted history/rollback evidence.
- CLI exposes bounded `config` and `prompt` commands. Studio uses the existing guarded mutation
  route/session/service-contract pattern and never writes JSON or prompt files directly.
- New projects use a versioned config envelope. Existing flat config remains readable as legacy v0;
  explicit migration creates a backup and the first v1 revision.
- Local prompt revisions are content-addressed files below ignored `prompts/local/`. The config
  points to the selected revision; a failed pointer update can leave only an inert orphan file.
- A run snapshots the exact effective config, prompt profile, rendered prompt, and optional idea
  brief before generation. Later global edits never rewrite the run.
- A dependency-free Node bootstrap owns pre-install checks and sequential progress. It delegates to
  existing pnpm/CLI commands and does not become workflow state.

## Tech Stack

Node 22, TypeScript, Zod, Commander, Next.js App Router, existing guarded Studio mutation helpers,
filesystem temp-file/rename utilities, Vitest, and Playwright. No new runtime dependency is planned.

## Baseline And Authority Refs

- `AGENTS.md`
- `.ai/architecture.instructions.md`
- `.ai/decisions.instructions.md`
- `.ai/workflows/prompt-management-workflow.instructions.md`
- `.ai/capabilities/security-skills.instructions.md`
- `src/config/config.ts` and `src/config/schema.ts`
- `src/prompts/definitions.ts`, `src/prompts/templates.ts`, and `src/prompts/provenance.ts`
- `src/studio/actionServiceContracts.ts` and `apps/studio/src/lib/mutations/`
- Next.js environment-variable and cache/revalidation documentation current on 2026-07-12

## Requirement Ready Check

- Requirement source: active Production Quality & Controlled Distribution goal and operator's
  2026-07-12 approval.
- Scenario: a local operator edits safe config or a creative prompt/profile in Studio while another
  command may be running, then starts the next operation without restarting the entire application.
- Acceptance: immediate refreshed UI projection, next-command effectiveness, in-flight snapshot
  immutability, persistent revision/rollback, secret redaction, stale paid-authority rejection, and
  honest restart labels.
- Open blocker questions: none for the approved V1 semantics.
- Decision: ready.

## Change Necessity

- A docs-only change cannot provide persistent guarded writes, immutable operation snapshots,
  optimistic concurrency, or fresh-clone onboarding.
- Direct Studio file editing would create a second settings owner and omit evidence.
- Minimum code boundary: config document/snapshot/mutation owners, prompt revision/profile owners,
  CLI commands, shared Studio contracts/routes/components, and one bootstrap script.
- Decision: code-change.

## Existence And Architecture Integrity

- Reuse `src/config/`, `src/prompts/`, current atomic JSON utilities, guarded Studio action routes,
  and current session/CSRF checks.
- Add focused owner files rather than expanding `src/config/config.ts`, prompt rendering, or route
  handlers into mixed-purpose managers.
- Reject direct Studio JSON writes, a settings daemon/file watcher, a database, Docker, secret
  editing, and arbitrary JSON/prompt paths.
- ADR action stays deferred until the first working slice makes the approved design current
  architecture; then add one decision-log entry and synchronize architecture/current-state docs.

## Compatibility Boundary

- Flat `producer.config.json` remains readable until explicitly migrated.
- `loadConfig()` remains available to existing callers while new command entrypoints use one
  `loadConfigSnapshot()` result and pass it down.
- Mock, deterministic-local, Piper, and current CLI workflows remain usable without credentials.
- Existing prompt defaults and safe local overrides remain valid inputs.
- Upload/public/scheduled publish remain disabled. Saving config never calls a provider.

## Config Document Contract

The v1 on-disk envelope is:

```json
{
  "schemaVersion": 1,
  "revision": 1,
  "updatedAt": "2026-07-12T00:00:00.000Z",
  "config": {}
}
```

The returned runtime snapshot contains the parsed inner config plus `schemaVersion`, `revision`,
canonical SHA-256, source path, loaded timestamp, and legacy status. It never contains env values.
All config objects and mutation payloads reject unknown fields and bound strings, arrays, URLs, and
numbers. `expectedRevision` conflicts fail without writes.

## Prompt And Idea Contract

- Tracked genre profiles have stable IDs; UykulukSciFi scientific sci-fi is the default profile.
- A saved local prompt revision requires prompt key, bounded UTF-8 content, operator note,
  `expectedCurrentHash`, and explicit confirmation.
- Studio shows current/default content and a server-derived diff before save.
- Rollback selects a tracked default or prior immutable revision and creates a new revision event.
- `ideas.run` accepts a stable profile ID and optional bounded run-scoped idea brief. The exact
  input is persisted before provider dispatch, including failed generation attempts.
- Direct operator-authored idea import is a later separate core contract; it must not be smuggled
  through the idea-brief field to bypass generation/originality/approval.

## Task 1 - Canonical Config Truth And Migration

Files:

- modify `src/config/config.ts`, `src/config/schema.ts`, `.env.example`,
  `apps/studio/.env.example`, `producer.config.example.json`, and `README.md`;
- create `src/config/configPath.ts` and `src/config/configDocument.ts`;
- add `tests/configDocument.test.ts`, `tests/configPath.test.ts`, and
  `tests/defaultConfigParity.test.ts`.

Steps:

1. Implement one absolute/relative path resolver used by CLI and Studio-facing readers.
2. Add strict legacy/v1 document parsing and canonical digest calculation; keep `loadConfig()` as a
   compatibility projection.
3. Make `producer init` write v1 and report the actual configured path; reject unsafe or unwritable
   parent paths visibly.
4. Make template and code defaults structurally identical and add a parity regression.
5. Remove unused Ollama env names, document JSON as canonical, and add actually supported advanced
   env names only where their runtime loader is proven.

Verification:

```bash
pnpm vitest run tests/configDocument.test.ts tests/configPath.test.ts tests/defaultConfigParity.test.ts tests/localEnvironment.test.ts tests/doctor.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm lint -- src/config tests/configDocument.test.ts tests/configPath.test.ts tests/defaultConfigParity.test.ts
```

Commit: `feat(config): establish versioned config snapshots`

## Task 2 - Atomic Config Revision, History, And Rollback

Files:

- create `src/config/configMutation.ts`, `src/config/configHistory.ts`, and
  `src/config/configSnapshot.ts`;
- modify CLI registration under `src/cli/`;
- add `tests/configMutation.test.ts`, `tests/configSnapshot.test.ts`, and
  `tests/configCli.test.ts`.

Steps:

1. Add `producer config show|validate|migrate|update|history|rollback` with strict file/input
   payloads; do not accept arbitrary property paths from the shell.
2. Serialize writers with a bounded exclusive lock, write temp+rename, and preserve a pre-migration
   backup plus ignored `diagnostics/settings/` revision evidence.
3. Require `{expectedRevision, patch, note, editedBy}` and reject stale/unknown/read-only fields.
4. Make rollback write a new monotonically increasing revision rather than copying old bytes over
   the current file.
5. Capture one deeply immutable snapshot at command entry and pass it into provider/prompt/stage
   owners; remove repeated config reads inside the same command path.
6. Before any paid dispatch, compare the current safety policy and the operation's pinned
   config/pricing/selection digests. Stricter current policy blocks; relaxed policy never silently
   expands an older approval.

Verification:

```bash
pnpm vitest run tests/configMutation.test.ts tests/configSnapshot.test.ts tests/configCli.test.ts tests/costApproval.test.ts tests/reservedProviderExecution.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm security:secrets
```

Commit: `feat(config): add guarded revisions and rollback`

## Task 3 - Prompt Profiles, Revisions, And Run Snapshots

Files:

- create `src/prompts/profiles.ts`, `src/prompts/revisions.ts`, and
  `src/prompts/promptSnapshot.ts`;
- modify `src/prompts/templates.ts`, `src/stages/ideas.ts`, and CLI generation commands;
- add tracked preset metadata under `prompts/defaults/` without moving parser markers into editable
  content;
- add `tests/promptRevisions.test.ts`, `tests/promptProfiles.test.ts`, and
  `tests/ideaGenerationInput.test.ts`.

Steps:

1. Add stable tracked profile IDs and the default scientific-sci-fi profile.
2. Add bounded content-addressed local save/history/rollback with operator attribution and expected
   current hash.
3. Snapshot selected prompt bytes, rendered prompt, profile, and optional idea brief before
   provider execution; preserve them when generation fails.
4. Extend CLI `ideas` input with strict `--profile` and `--brief-file` inputs; never place large
   prompt text or briefs in argv/history.
5. Keep structured-output markers/parser instructions server-owned and non-editable.

Verification:

```bash
pnpm vitest run tests/promptTemplates.test.ts tests/promptRevisions.test.ts tests/promptProfiles.test.ts tests/ideaGenerationInput.test.ts tests/ideaHistory.test.ts
pnpm typecheck
pnpm typecheck:compat
pnpm security:secrets
```

Commit: `feat(prompts): add durable profiles and run snapshots`

## Task 4 - Guarded Studio Settings And Prompt Editor

Files:

- extend `src/studio/actionServiceMetadata.ts` and `src/studio/actionServiceContracts.ts`;
- add settings/prompt data services and guarded mutation routes below `apps/studio/src/` using the
  current mutation/session/CLI bridge;
- extend `/prompts` and add `/settings` with existing design-system primitives;
- add contract, CLI-argument, route-security, and component tests plus Playwright coverage.

Steps:

1. Define strict bounded request and minimized response schemas; reject unknown fields and secret
   value properties.
2. Add read projections for revision/digest/effective value, configured/missing secret status, and
   `live-next-command` versus `restart-required` applicability.
3. Add config update/migrate/rollback and prompt save/rollback actions through canonical CLI
   commands, same-origin/session/action-header checks, and durable evidence.
4. Refresh the affected Server Component projection after success; surface revision conflicts and
   validation failures without optimistic fake success.
5. Add genre/profile select, editable prompt/brief textarea, explicit save-versus-use-once actions,
   and a generation button that submits only the typed profile/brief contract.
6. Verify keyboard use, labels, error focus, responsive density, and failure recovery in the real
   Studio.

Verification:

```bash
pnpm vitest run tests/studioMutationContracts.test.ts tests/studioActionRouteSecurity.test.ts tests/studioPromptInventory.test.ts tests/studioStartIdeasAction.test.ts
pnpm studio:typecheck
pnpm studio:typecheck:compat
pnpm studio:lint
pnpm studio:build
pnpm studio:test:e2e
pnpm security:secrets
```

Commit: `feat(studio): add guarded settings and prompt profiles`

## Task 5 - One-Command Local Bootstrap

Files:

- create `scripts/setup-local.mjs` and focused script tests/fixtures;
- modify `package.json`, `README.md`, `.ai/runbooks/local-dev.md`, and usage smoke.

Steps:

1. Provide a dependency-free `node scripts/setup-local.mjs` entry that checks Node >=22 and
   discovers the repository-declared pnpm/Corepack without installing global packages.
2. Run frozen install, build, idempotent `producer init`, and `producer doctor` sequentially with
   honest pass/fail progress; stop at the first failed prerequisite.
3. Start Studio only after all prerequisites pass. Support `--plain`, `--no-start`, and explicit
   port selection for the new process; never claim an already-running listener changed ports.
4. Verify from a temporary clean copy with no credentials and Docker unavailable.

Verification:

```bash
node --test scripts/setup-local.test.mjs
node scripts/setup-local.mjs --plain --no-start
pnpm qa:usage
pnpm build:smoke
```

Commit: `feat(onboarding): add one-command local setup`

## Verification And Review Gates

- Focused tests and TS7/TS6 checks run after each task; heavy build/browser commands stay
  sequential.
- Studio route work receives a defensive schema/route-security review and negative fixtures.
- Before PR-ready handoff run `pnpm check`, `pnpm qa:usage`, `pnpm qa:product`,
  `pnpm qa:browser`, `pnpm security:dependencies`, and `pnpm version:plan`; run Sonar when the local
  service is available.
- Exercise save, conflict, rollback, next-command reload, in-flight immutability, restart labels,
  prompt use-once/save distinction, and clean-copy bootstrap in the real app.

## Risks And Retirement

- Manual legacy config edits can race with guarded updates; revision/digest mismatch must fail
  closed and explain recovery.
- Cross-process file locks are advisory local coordination, not a distributed guarantee.
- Prompt/profile growth stays bounded and ignored; add pruning/export only after real use proves it
  necessary.
- Retire the legacy flat reader only after migration evidence from two real episodes and a release
  note. Do not add a daemon unless command-boundary reload proves insufficient in real operation.
- This plan does not authorize secret editing, provider calls on save, public upload/publish,
  Docker, a database, queues, or cloud settings storage.
