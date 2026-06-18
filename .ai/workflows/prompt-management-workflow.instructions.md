# Prompt Management Workflow

Use before changing prompt files or implementing prompt editing.

## Current Contract

Tracked default prompts live in `.ai/prompts/` and are loaded by typed runtime templates for ideas,
scripts, and production packages.

Prompt changes are product changes because they can alter generated ideas, scripts, reviews,
production packages, and readiness behavior.

## Future Dashboard Requirements

- Show prompt key, description, current source, and last modified time.
- Provide preview with sample variables.
- Show diff before saving.
- Require an operator note for local override saves.
- Preserve the existing runtime prompt key/hash metadata when prompt templates become editable.
- Preserve the tracked source path alongside the rendered prompt hash.
- Provide rollback to tracked default or previous local version.

## Safety Rules

- Saving a prompt does not run generation.
- Editing a prompt does not approve any stage.
- Active run artifacts are not rewritten by prompt edits.
- Evidence bundle reports the prompt key/hash used for each generated artifact.
