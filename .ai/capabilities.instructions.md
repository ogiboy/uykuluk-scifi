# Project Capability Routing

Read this file before selecting skills, plugins, MCP servers, connectors, browser tools, or
subagents for UykulukSciFi Producer work.

## Purpose

The host has a very large capability surface. Re-enumerating or loading all of it in every thread
wastes context and can make automatic context compaction fail. This project keeps a curated routing
layer so agents can discover broadly once, then load narrowly per task.

## Required Selection Flow

1. Read the current task and the relevant project contract under `.ai/`.
2. Classify the task using `.ai/capabilities/routing.instructions.md`.
3. For security-sensitive work, load `.ai/capabilities/security-skills.instructions.md` and follow its limits before opening security tools.
4. Check availability and exclusions in `.ai/capabilities/inventory.instructions.md`.
5. Choose the smallest useful capability set:
   - one primary workflow or planning skill;
   - normally one specialist skill;
   - at most one frontend taste skill;
   - only the MCP/connector needed for the next concrete action.
6. For multi-step or delegated work, apply `.ai/capabilities/orchestration.instructions.md`.
7. Load the full `SKILL.md` body only for capabilities actually selected.
8. Record a durable checkpoint before a long task approaches a context reset.

## Context Budget

- Do not enumerate the complete installed skill, plugin, connector, or MCP catalog in a task thread.
- Do not load every skill in a plugin family.
- Default initial budget: at most two skill bodies per agent, one specialist MCP family, and one
  browser control surface.
- Use deferred tool discovery only for the current task family.
- Prefer project docs and repository evidence over repeatedly reading host-global metadata.
- If no route fits, inspect metadata for the missing category, update the catalog, then continue.

## Precedence

1. User instructions and explicit approval boundaries.
2. `AGENTS.md` and product safety truths.
3. Relevant `.ai/workflows/` contract.
4. This capability routing contract.
5. Selected skill/plugin instructions.

Capabilities never grant authority to spend money, publish content, upload media, deploy publicly,
change credentials, or mutate third-party systems without the user request and the product's
approval gates.

## Files

- `capabilities/inventory.instructions.md` - scan coverage, versions, availability, exclusions.
- `capabilities/routing.instructions.md` - task family to capability mapping.
- `capabilities/orchestration.instructions.md` - swarm, research, checkpoint, and context rules.
- `checkpoints/README.instructions.md` - long-task checkpoint format.
