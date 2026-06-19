# Project Capability Routing Plan

## Goal

Turn the installed skill, plugin, MCP, connector, browser, and multi-agent surface into a compact
project-local routing contract so agents can select relevant capabilities without reloading the
entire host catalog in every thread.

## Architecture

- `.ai/capabilities.instructions.md` is the mandatory entry point.
- `.ai/capabilities/inventory.instructions.md` records scan coverage, installed families, MCP
  availability, exclusions, and refresh triggers.
- `.ai/capabilities/routing.instructions.md` maps project task families to preferred capabilities,
  evidence, and safety boundaries.
- `.ai/capabilities/orchestration.instructions.md` owns single-agent, swarm, checkpoint, and context
  budget rules.
- `.ai/checkpoints/README.instructions.md` defines durable long-task checkpoints.
- `AGENTS.md` requires agents to route through the project catalog instead of enumerating the host
  capability surface.

## Tech Stack

Repository-local Markdown instructions, Codex skills/plugins/connectors, MCP servers, native
multi-agent tools, pnpm quality gates.

## Baseline / Authority Refs

- `AGENTS.md`
- `.ai/README.md`
- `.ai/rules.instructions.md`
- `.ai/architecture.instructions.md`
- `.ai/decisions.instructions.md`
- `.ai/workflows/*.instructions.md`
- host capability metadata under `~/.codex` and `~/.agents`

## Compatibility Boundary

- This work changes agent routing only; it does not change runtime workflow state or product code.
- It does not enable paid APIs, upload, render, publish, deployment, ad spend, or external writes.
- Existing dirty script-revision work and operator prompt/config edits remain untouched.
- The catalog summarizes metadata; it does not copy every installed skill body into the repo.

## Verification

```bash
pnpm format:check
pnpm changelog:check
pnpm qa:modularity
pnpm version:plan
```

## Tasks

1. Record capability inventory coverage and availability boundaries.
2. Define technical, product, design, marketing, data, security, testing, and release routes.
3. Define low-context swarm and long-task checkpoint rules.
4. Wire the entry point into `AGENTS.md`, `.ai/README.md`, workflows, decisions, roadmap, and
   current state.
5. Run documentation-relevant quality gates and inspect the final diff without staging unrelated
   work.
