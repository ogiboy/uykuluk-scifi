# Ruflo — Claude Code Configuration

## Project Precedence

Read `AGENTS.md` and the relevant contracts under `.ai/` before using this generated tool catalog.
Those files own product architecture, delivery boundaries, and capability routing. The material
below documents the optional Claude/Ruflo development surface and is never a runtime dependency. The
verified local CLI baseline is `ruflo 3.32.7` with `claude-flow 3.32.2`; use the installed commands
directly instead of floating `npx ...@latest` invocations.

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json`
  has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default
  commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under
  git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({
  prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher",
  name: "researcher",
  run_in_background: true,
});
Agent({
  prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect",
  name: "architect",
  run_in_background: true,
});
Agent({
  prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder",
  name: "coder",
  run_in_background: true,
});
Agent({
  prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester",
  name: "tester",
  run_in_background: true,
});
Agent({
  prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer",
  name: "reviewer",
  run_in_background: true,
});

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" });
```

### Patterns

| Pattern        | Flow                  | Use When                                |
| -------------- | --------------------- | --------------------------------------- |
| **Pipeline**   | A → B → C → D         | Sequential dependencies (feature dev)   |
| **Fan-out**    | Lead → A, B, C → Lead | Independent parallel work (research)    |
| **Supervisor** | Lead ↔ workers        | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

## Swarm & Routing

### Config

- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
ruflo swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task        | Agents                             | Topology     |
| ----------- | ---------------------------------- | ------------ |
| Bug Fix     | researcher, coder, tester          | hierarchical |
| Feature     | architect, coder, tester, reviewer | hierarchical |
| Refactor    | architect, coder, reviewer         | hierarchical |
| Performance | perf-engineer, coder               | hierarchical |
| Security    | security-architect, auditor        | hierarchical |

### When to Swarm

- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler              | Use Cases                                       |
| ---- | -------------------- | ----------------------------------------------- |
| 1    | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2    | Haiku                | Simple tasks, low complexity                    |
| 3    | Sonnet/Opus          | Architecture, security, complex reasoning       |

## Memory & Learning

### Before Any Task

```bash
ruflo memory search --query "[task keywords]" --namespace patterns
ruflo hooks route --task "[task description]"
```

### After Success

```bash
ruflo memory store --namespace patterns --key "[name]" --value "[what worked]"
ruflo hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category      | Key Tools                                                  |
| ------------- | ---------------------------------------------------------- |
| **Memory**    | `memory_store`, `memory_search`, `memory_search_unified`   |
| **Bridge**    | `memory_import_claude`, `memory_bridge_status`             |
| **Swarm**     | `swarm_init`, `swarm_status`, `swarm_health`               |
| **Agents**    | `agent_spawn`, `agent_list`, `agent_status`                |
| **Hooks**     | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch`  |
| **Security**  | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker     | When                   |
| ---------- | ---------------------- |
| `audit`    | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features  |
| `map`      | Every 5+ file changes  |
| `document` | After API changes      |

```bash
ruflo hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher` **Architecture**:
`system-architect`, `backend-dev`, `mobile-dev` **Security**: `security-architect`,
`security-auditor` **Performance**: `performance-engineer`, `perf-analyzer` **Coordination**:
`hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator` **GitHub**: `pr-manager`,
`code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
ruflo init --wizard           # Setup
ruflo swarm init --v3-mode     # Start swarm
ruflo memory search --query "" # Vector search
ruflo hooks route --task ""    # Route to agent
ruflo doctor --fix             # Diagnostics
ruflo security scan            # Security scan
ruflo performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- ruflo mcp start
ruflo doctor --fix
```

> The background `daemon` is optional. It runs interval workers that each spawn a headless `claude`
> session, so it consumes tokens continuously. Start it only if you want those sweeps:
> `ruflo daemon start` (self-stops after 12h by default; `--ttl 0` to disable, `daemon status --all`
> to audit running daemons).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination
(swarm, memory, hooks). **CLI** is the same via Bash.

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions
as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant
clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to
overcomplication, and clarifying questions come before implementation rather than after mistakes.
