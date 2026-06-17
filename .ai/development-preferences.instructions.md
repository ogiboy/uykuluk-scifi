# Development Preferences

## Codebase Shape

- Keep the core workflow modular.
- Stage files own stage behavior.
- Safeguard files own guard behavior.
- Services should become the shared CLI/web boundary before a web UI mutates state.
- Shared helpers must earn their scope through real cross-module use.
- Avoid anonymous global string bags.

## Commit And Push

- Use Conventional Commit subjects.
- Do not put the assistant name in commit titles.
- Prefer coherent slices:
  - docs/tooling policy;
  - core contract;
  - stage behavior;
  - tests/QA;
  - frontend read-only surface;
  - frontend mutation surface.
- Push only after the touched surface is reviewable unless the user asks for a checkpoint.
- Keep PR title/body aligned with the final branch head.

## Versioning

- Product-impacting behavior changes should update version metadata when a release flow exists.
- Until release automation exists, record versioning expectations in `ROADMAP.md` and PR notes.
- Future version surface should include `package.json`, changelog/release notes, and any generated
  app metadata.

## Checks

Normal source changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Operator workflow changes:

```bash
pnpm qa:usage
```

Formatting/tooling changes:

```bash
pnpm format:check
```

Future frontend changes:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm qa:usage
```

Add frontend build/browser checks once a Next.js app exists.
