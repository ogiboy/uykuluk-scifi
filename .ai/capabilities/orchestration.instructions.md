# Orchestration And Context Discipline

## Default

Use one primary agent for small, sequential, or tightly coupled work. Multi-agent execution is a
tool for independent uncertainty or disjoint ownership, not a default ceremony.

For this project, ordinary implementation should stay lightweight:

- use Aegis/Superpowers for the current slice only;
- use GSD only for explicit phase/milestone/UAT governance;
- use Ruflo or Claude Flow only for a documented orchestration need;
- keep `.ai/` and any `.planning/` artifacts development-only, never runtime inputs.

Native one-shot subagents are the preferred delegation mechanism when the active user request or
goal authorizes delegated work. Ruflo or Claude Flow are for persistent team state, swarm topology,
shared task queues, consensus, or cross-turn orchestration; they are not needed for an ordinary
planner/reviewer/tester split.

## When To Use A Swarm

Use 2-4 agents when at least two workstreams can proceed independently, for example:

- architecture, security, QA, and product review of a broad plan;
- technical research, product/UX research, and market/data research;
- disjoint implementation modules with clear write ownership;
- implementation plus independent verification.

Do not spawn one agent per skill or plugin.

For this repo, useful native roles are usually:

- `explorer` for a focused codebase question;
- `worker` for a bounded implementation module with explicit file ownership;
- `gsd-code-reviewer`, `gsd-verifier`, or `gsd-security-auditor` for independent review of a broad
  candidate;
- `gsd-planner`/`gsd-roadmapper` only for a phase-level plan;
- `gsd-doc-writer`/`gsd-doc-verifier` only for large documentation sets.

Do not use GSD roles merely because GSD is installed. Prefer single-agent work for small fixes,
Sonar cleanups, docs-only updates, and sequential file edits.

## Topology

- Research: mesh-like parallel explorers with separate questions and a single synthesizer.
- Implementation: hierarchical coordinator with workers owning disjoint files/modules.
- Review: independent reviewer, QA, and security lenses after an integrated candidate exists.
- Long-horizon persisted orchestration: consider Ruflo goals/swarm only after a health check and
  only if native agents plus repository checkpoints are insufficient.

Use one orchestration framework per task. Do not layer native multi-agent, Ruflo, and Claude Flow
over the same work unless the plan explicitly proves the need.

## Subagent Context Contract

- Start subagents without inherited full thread context by default.
- Pass a narrow task, authoritative repository path, relevant files, constraints, and expected
  output format.
- Keep briefs near 500 words and responses near 800 words or 12 findings unless implementation
  evidence requires more.
- Require concise findings or direct edits in disjoint write scopes.
- Do not ask subagents to enumerate the complete capability catalog.
- Do not duplicate delegated analysis in the coordinator.
- Close completed agents promptly.
- Do not let subagents write `.planning/`, `.ai/qa`, generated run artifacts, or runtime config
  unless the parent task explicitly owns those files.

## Resource Safety

- Default maximum: three concurrent subagents.
- Heavy pnpm, Next.js, Vitest, Playwright, Sonar, or browser processes run sequentially unless the
  task explicitly proves safe parallelism.
- Use one browser automation backend at a time.
- Cancel stale agents and background processes before starting replacements.
- Persist useful evidence; discard noisy raw logs from the main context.

## Long Goal Continuity

For goals spanning multiple slices or likely context resets:

1. Create `.ai/checkpoints/<workstream>.md` from the checkpoint template.
2. Keep the full objective and completion criteria unchanged.
3. After each coherent slice, update:
   - completed commits/files;
   - verification evidence;
   - dirty/external changes;
   - remaining work and next action;
   - blockers and decisions.
4. Before a context reset, ensure the checkpoint and live Git state agree.
5. Resume from repository state and checkpoint, not from conversational memory alone.

Do not wait until the context window is nearly full. Rotate to a fresh, non-forked thread at a
stable milestone when tool schemas and history leave insufficient compaction headroom.

## Context Guardrails

- Never fork a very large thread merely to continue a long goal; use a checkpoint and fresh thread.
- Avoid copying prior tool outputs into new prompts.
- Keep commentary concise and do not repeat unchanged plans.
- Prefer targeted command output and bounded logs.
- At each milestone, summarize current truth in project files before continuing.
- If auto-compaction fails or context is already near the limit, stop adding tools, save the
  checkpoint, and resume from a clean thread.
- Do not rescan the full skill/plugin/MCP catalog every turn. Refresh the capability inventory only
  when the user asks, a selected route is missing, or a new project phase needs a capability family
  that is not already covered.

Use `.ai/checklists/context-budget.md`, `.ai/templates/agent-brief.md`, and
`.ai/templates/agent-handoff.md` for repeatable execution.

## Synthesis Contract

The coordinator should return:

- one decision or integrated plan;
- conflicts and how they were resolved;
- evidence and confidence;
- work not accepted;
- next concrete action.

Raw subagent transcripts are not project documentation.
