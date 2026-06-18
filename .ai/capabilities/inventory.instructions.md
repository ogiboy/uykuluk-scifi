# Capability Inventory

Snapshot date: 2026-06-19

## Scan Coverage

The initial routing pass inspected:

- metadata for 1,467 installed `SKILL.md` files under `~/.codex/skills`, `~/.agents/skills`, and
  `~/.codex/plugins/cache`;
- 72 installed plugin/version directories;
- configured MCP server declarations in `~/.codex/config.toml`;
- current project architecture, workflows, agents, roadmap, assets, QA, and safety contracts.

This is a routing inventory, not a vendored copy of host instructions. Skill bodies remain
host-owned and must be loaded only after routing selects them.

## Primary Project Families

| Family                          | Preferred use                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Aegis 2.1.5                     | Goal framing, brainstorming, plans, TDD, debugging, review, verification, long-task continuity |
| Build Web Apps 0.1.2            | Studio implementation, React quality, shadcn composition, rendered frontend QA                 |
| Product Design 0.1.46           | UX research, design brief, audit, visual ideation, prototypes, design QA                       |
| Frontend taste skills           | Public-facing visual direction, redesign critique, cinematic landing pages, Stitch design docs |
| Creative Production 0.1.23      | Positioning, moodboards, channel creative, offers, ads, scenes, shots, identity exploration    |
| Web Data Visualization          | Analytics dashboards, uncertainty-aware charts, accessibility, visualization testing           |
| Codex Security 0.1.8            | Threat models, scoped/repository scans, diff scans, finding validation and repair              |
| CodeRabbit 1.1.4                | Independent code and PR review                                                                 |
| GitHub 0.1.5                    | PR/issue orientation, CI diagnosis, review comments, intentional publish flow                  |
| Browser / Chrome / Computer Use | Local browser QA, authenticated browser state, native app UI respectively                      |
| Ruflo selected modules          | Persistent goals, explicit swarm coordination, cost/observability, ADRs, test-gap analysis     |
| Context7 MCP                    | Current library/framework/API documentation                                                    |
| SonarQube MCP and scripts       | Static quality and maintainability evidence                                                    |
| Firecrawl MCP                   | External discovery and extraction when normal web/browser research is insufficient             |
| Hugging Face 1.0.3              | Model, dataset, paper, evaluation, and local inference research when roadmap-relevant          |
| Primary runtime document tools  | Spreadsheets, reports, PDFs, and presentations when a deliverable needs them                   |

## Frontend Taste Skills

These host-local skills are available as narrow visual-direction authorities. Select at most one for
a task; they are not a bundle to load together.

| Skill                      | Host path                                            | Approved route                                                                                                  |
| -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `design-taste-frontend`    | `~/.agents/skills/design-taste-frontend/SKILL.md`    | Default taste layer for public product pages, campaign surfaces, portfolios, and audit-first public redesigns   |
| `gpt-taste`                | `~/.agents/skills/gpt-taste/SKILL.md`                | Explicit cinematic, Awwwards-style, GSAP-rich, AIDA landing-page work when motion scope and dependencies permit |
| `stitch-design-taste`      | `~/.agents/skills/stitch-design-taste/SKILL.md`      | Google Stitch-oriented `DESIGN.md` and screen-generation direction when Stitch access is available              |
| `design-taste-frontend-v1` | `~/.agents/skills/design-taste-frontend-v1/SKILL.md` | Legacy compatibility only when the user or an existing artifact requires the original v1 behavior               |

These skills do not replace Product Design context gathering, the repository design system,
accessibility, performance, or rendered QA. `design-taste-frontend` explicitly excludes dashboards,
data tables, and dense multi-step product UI, so it is not the primary rule set for Producer Studio.

## Configured MCP Servers

| Server        | Default project status                                                      |
| ------------- | --------------------------------------------------------------------------- |
| `context7`    | Use on demand for current technical documentation                           |
| `sonarqube`   | Use for quality analysis when configured and relevant                       |
| `firecrawl`   | Use for scoped external research/extraction                                 |
| `node_repl`   | Use primarily as the browser-control runtime                                |
| `ruflo`       | Conditional; use one orchestration layer only                               |
| `claude-flow` | Conditional; do not combine with Ruflo/native swarm without a specific need |
| `figma`       | Configured but disabled; never assume availability                          |
| `alpaca`      | Out of scope for this product                                               |

Connector and plugin tools may be deferred. Discover them only when the route requires them.

## Conditional Families

- Vercel: Next.js/platform documentation is useful; deployment, hosted services, storage, auth,
  queues, analytics, and paid integrations require an explicit roadmap decision.
- OpenAI Developers: use only for an approved OpenAI-backed feature; current runtime remains
  mock/Ollama-first.
- Hugging Face: use for evidence-backed model/dataset evaluation, not as an automatic cloud-compute
  path.
- Supabase/database tools: use only after file persistence is intentionally retired or supplemented.
- Jam: use when the user supplies or requests analysis of a recorded bug session.
- Figma: use only after it is enabled and a design task requires it.
- Vercel/Product Design sharing tools: external sharing or deployment requires explicit user intent.

## Out Of Scope By Default

- Trading, Alpaca, investment-banking, and public-equity workflows.
- iOS, macOS, Expo/mobile, and game-development stacks.
- Cloud database, payments, marketplace, hosted queue, or public deployment capabilities.
- Offensive security, malware analysis, red-team, forensics, and infrastructure-specific security
  skills unless an explicitly authorized project need appears.
- AgentDB, knowledge-graph, federation, neural-trading, IoT, or distributed-consensus systems unless
  a future architecture decision introduces them.

## Known Gaps

- No dedicated YouTube Analytics or YouTube publishing connector is part of the approved capability
  route.
- Marketing/data analysis must use operator-provided exports, local files, or scoped public
  research.
- No connector or tool may be treated as evidence of publish authority.

## Refresh Triggers

Refresh this inventory when:

- Codex, a primary plugin, or MCP configuration changes materially;
- a project phase introduces deployment, render, upload, publishing, database, or paid-provider
  work;
- a task has no matching route;
- a selected capability is missing, renamed, disabled, or incompatible.

Refresh by rescanning names, descriptions, versions, and MCP declarations. Do not read all skill
bodies. Read complete instructions only for the newly selected routes.
