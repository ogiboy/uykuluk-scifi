# UykulukSciFi Documentation

These versioned Markdown documents describe the operator workflow and the contracts behind it. They
are intentionally kept in the repository while the product and navigation are still changing. A
hosted documentation site is deferred until this structure stabilizes.

## Start Here

- [Getting started](getting-started.md): requirements, installation, configuration, and first
  launch.
- [Studio workflow](operator-guide/studio-workflow.md): the normal operator journey and review
  model.
- [CLI reference](reference/cli.md): automation, recovery, and diagnostic commands.
- [Run artifacts](reference/artifacts.md): canonical outputs, evidence, and revision history.

## Providers

- [Local models](providers/local-models.md): mock, Ollama, llama.cpp, prompt overrides, and
  evaluation.
- [Voice providers](providers/voice.md): deterministic reference, Piper, and ElevenLabs v3.
- [Visual providers](providers/visuals.md): static/manual fallback and approval-bound FLUX.2 Pro.
- [Provider and artifact troubleshooting](troubleshooting/provider-and-artifacts.md).

## Engineering

- [Architecture](architecture/overview.md): ownership boundaries, workflow state, and repository
  layout.
- [Security model](security/operating-model.md): approvals, costs, secrets, routes, and external
  effects.
- [Quality and releases](release/quality-gates.md): tests, static analysis, Sonar, and release
  policy.
- [Screenshot inventory](images/README.md): production-build Studio captures from browser UAT.

The current delivery order and product scope live in [ROADMAP.md](../ROADMAP.md). Development-only
agent instructions and checkpoints remain under `.ai/`; they are not runtime dependencies.
