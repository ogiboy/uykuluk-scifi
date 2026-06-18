# Context Budget Checklist

Use before a broad task, after each major phase, and before spawning more agents.

## Start

- [ ] Authoritative repository/worktree path is explicit.
- [ ] Live Git status and existing dirty changes are recorded.
- [ ] The task is classified through `.ai/capabilities/routing.instructions.md`.
- [ ] No more than two skill bodies are loaded per agent initially.
- [ ] At most one specialist plugin/MCP family is assigned to each worker.
- [ ] One browser-control surface is selected, if needed.

## Multi-Agent

- [ ] The task has at least two genuinely independent questions or disjoint write scopes.
- [ ] Coordinator plus workers total no more than four agents.
- [ ] Every worker has one question or exclusive file ownership.
- [ ] Worker brief is bounded and does not include raw capability catalogs or old chat transcripts.
- [ ] Heavy test/build/browser processes are not running redundantly.

## Continuation

- [ ] Full objective and completion criteria exist in `.ai/checkpoints/<workstream>.md`.
- [ ] Completed slices, commits, verification, and external changes are current.
- [ ] Raw research/tool output has been reduced to decisions and evidence.
- [ ] No new agents are spawned after context pressure becomes material.
- [ ] A fresh non-forked thread is preferred at a stable milestone.

## Stop And Rotate

Checkpoint and rotate when:

- the agent is repeatedly rereading old history;
- tool schemas or logs dominate the working context;
- compaction is imminent or has failed;
- a coherent slice is complete and the next slice is independently resumable.
