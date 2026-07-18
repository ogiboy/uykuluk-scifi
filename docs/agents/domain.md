# Domain Documentation

UykulukSciFi deliberately uses a single domain context. The pnpm workspace separates delivery
modules, but CLI/core and Studio still implement one Producer product language and workflow.

## Before Exploring

Read these files when they exist and are relevant:

- root `CONTEXT.md` for the shared glossary and context boundaries;
- root `docs/adr/` entries that affect the area being changed.

If either path is absent, proceed silently. Do not create empty placeholders. The selected
`domain-modeling`, `grill-with-docs`, or architecture workflow creates or updates them lazily when a
term or decision is actually resolved.

## Vocabulary

Use terms from `CONTEXT.md` in issue titles, specifications, tests, and code. If a needed term is
missing, first decide whether it is accidental synonym drift or a real domain gap. Record a genuine
gap through the domain-modeling route instead of inventing parallel terminology.

## Decision Conflicts

Surface any conflict with an existing ADR explicitly. Do not silently override a recorded decision;
name the ADR, explain why it may need reopening, and preserve the earlier rationale.
