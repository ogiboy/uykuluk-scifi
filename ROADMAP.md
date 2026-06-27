# UykulukSciFi Producer Roadmap

This roadmap keeps the product local-first and approval-gated while shifting the next delivery focus
from safety infrastructure to a real UykulukSciFi production loop.

## Product Direction

UykulukSciFi Producer is a channel-specific production desk, not a generic AI video platform or an
autonomous publishing machine. The product should help the channel regularly produce original,
scientifically careful, visually consistent YouTube draft packages.

The CLI/core state machine remains the source of truth for state, approvals, costs, evidence, and
disabled upload/publish controls. The Studio should make those contracts easier to review and
operate, not replace or weaken them.

Durable strategy:

- produce reliable local draft packages before adding broad integrations;
- prefer deterministic local assets, TTS, and FFmpeg before paid/generative video providers;
- learn from published performance through manual imports before YouTube Analytics API work;
- keep public/scheduled publish out of scope until a separate risk review.

## Phase A - Safe Core Stabilization

Status: mostly implemented; maintain and simplify.

The current CLI/core already covers the safe production foundation:

- mock/Ollama idea, script, review, package, estimate, evidence, and readiness stages;
- explicit idea, script, and cost approvals;
- content-addressed script review/approval and attributable script revisions;
- provider budget preflight, cost quote approval, reservation/settlement foundations, and hard
  budget accounting;
- provider failure diagnostics, Ollama receipts, prompt provenance, production-package integrity,
  and durable evidence;
- disabled-by-default local TTS, approval-gated local draft render, and disabled upload and
  public/scheduled publish scaffolds;
- CI, CodeQL, Sonar, formatting, modularity, secret scan, usage smoke, and release hygiene gates.

Ongoing work in this phase should improve operator clarity instead of adding more unused
infrastructure:

- make `status`, evidence, readiness, and docs answer the next safe action clearly;
- keep `.ai/` aligned with the source tree without becoming runtime state;
- keep provider failures, approval blockers, and cost blockers visible in durable artifacts;
- keep bounded long-form continuation evidence aligned with script receipts and prompt provenance;
- keep paid-provider internals isolated as future scaffolding until a real adapter is approved.

## Phase B - Real Production Loop

Status: next active phase.

Goal: turn an approved script/package into a complete local video draft package that can be reviewed
without upload or public publish.

First concrete slice: **Render Plan + Contact Sheet MVP**.

Status: implemented for deterministic CLI artifact generation; keep hardening evidence/readiness and
operator review wording as later polish.

Planned artifacts:

- `production/render_plan.json` - deterministic mapping from approved production package, scenes,
  subtitles, popup cards, and existing visual assets to an FFmpeg-ready draft plan;
- `production/storyboard_contact_sheet.md` - operator-readable scene/contact-sheet preview for
  reviewing visual rhythm before render;
- `production/asset_provenance.json` - exact asset paths, roles, and provenance used by the render
  plan.

Constraints:

- render planning consumes existing production-package and asset contracts;
- render planning does not create a second workflow engine;
- no upload, paid provider, or public publish is introduced in this slice;
- evidence/readiness should surface render-plan presence and blockers only after the artifact
  contract exists.

Next Real Production Loop slices:

- harden local TTS with continued Piper voice QA and better operator guidance; current foundation
  writes deterministic reference WAV metadata and an operator audio review checklist, can call a
  configured local Piper binary/model path, records model/config digest provenance, and surfaces
  Piper setup/remediation next actions through `producer doctor`;
- harden FFmpeg draft render quality and visual composition. Current foundation renders local review
  MP4 from the current render plan, intro/outro source cards or committed source-frame sequences,
  scene-timed background plates, voiceover audio, subtitles, lower-third, popup, waveform, and
  watermark overlays, then writes a render manifest with the exact timeline plus an
  operator-readable draft review checklist. `producer doctor` also warns when local FFmpeg/ffprobe
  tools are unavailable before operators reach render execution;
- define separate private-upload approval only after local final review is reliable.

## Phase C - Operator Studio

Status: read-only run review, artifact preview, asset inventory, home-page latest-run readiness,
home-page and `/doctor` producer doctor diagnostics, runtime prompt inventory, mutation-service
status, manual analytics overview, route-security contract foundations, and shared mutation service
contract foundations exist. Guarded route implementation still comes later.

The Studio should be a local operator surface over CLI/core contracts.

Priority order:

- maintain the read-only run index with state, warnings, approvals, readiness, and next action;
- maintain the read-only run detail with evidence, readiness, warning counts, approvals, and review
  artifact availability;
- maintain the read-only home latest-run readiness panel over existing run summaries without
  triggering CLI work;
- maintain artifact previews for scripts, production packages, render plans, contact sheets, audio,
  render evidence, and readiness artifacts;
- maintain the read-only visual asset inventory page backed by configured guard checks;
- maintain the read-only producer doctor diagnostics page backed by ignored local doctor artifacts;
- maintain read-only runtime prompt source/status visibility for tracked defaults and explicit local
  overrides before any prompt editor work, including the `/prompts` operator route;
- maintain read-only mutation-service status so operators can see that future
  approval/upload/publish actions are contract-defined but not routable;
- maintain the read-only manual analytics overview and import data-quality summary backed by ignored
  local CLI analytics artifacts;
- maintain shared service contracts for any future Studio read/write operation;
- maintain route security requirements and negative tests for current read-only routes and disabled
  future action routes;
- only after the contracts have concrete CSRF/session handling and negative route tests: approval
  forms and guarded mutations.

Frontend constraints:

- no second state machine;
- no arbitrary shell execution;
- no hidden provider calls;
- no upload, render, or publish bypasses;
- no mutating routes before route security requirements and negative tests.

## Phase D - Monetization Feedback Loop

Status: initial local CLI import/report foundation and read-only Studio overview implemented; API
integrations remain deferred.

The product should eventually learn from channel performance, but manual import comes before API
integrations.

Minimum loop:

- import operator-provided CSV/JSON performance data - implemented locally through
  `producer analytics import`;
- map performance records back to runs/videos with run-linked summaries and unmapped-record
  visibility;
- summarize CTR, views, average view duration, retention notes, subscriber deltas, and qualitative
  comments where provided - implemented in `analytics/performance_report.md`;
- review the imported local dataset and report preview in Studio without YouTube API calls, workflow
  mutation, upload, publish, or causal claims, including stale/missing report visibility;
- produce “repeat / avoid / test next” recommendations for future ideas, titles, formats, and
  thumbnail directions - implemented as non-causal operator planning prompts with
  confidence/missingness framing in `analytics/performance_report.md`.

This phase must not invent metrics or claim causality from weak data. YouTube Analytics API work is
optional later and requires its own credentials, privacy, cost, and approval design.

## Phase E - Optional Integrations

Status: deferred.

Allowed only after the local production loop is useful:

- private YouTube upload with explicit config, approval, and request/response evidence;
- YouTube Analytics API;
- idea-only scheduler;
- prompt override UI;
- subtitle, scene, popup card, thumbnail, and metadata revision contracts;
- thumbnail A/B planning;
- paid image/video/TTS providers through the existing approved reservation/execution boundary;
- Shorts repurposing.

Explicitly out of scope for v1:

- public/scheduled publish automation;
- generic SaaS dashboard, hosted auth, team workspaces, billing, cloud database, or queue workers;
- autonomous multi-agent runtime that bypasses operator approval;
- paid/generative video providers before deterministic local render works.

## Visual Asset Status

The current asset packs cover logo, watermark, banner, lower-third, name panel, popup info card,
subtitle panels, title card, end screen, thumbnail templates, text-safe thumbnail overlays,
background plates, glitch/no-signal transition overlays, popup icons, waveform overlays, and
intro/outro render source frames.

Useful additions before render work focus on editability and licensing:

- editable source files for thumbnail and overlay variants;
- render-ready intro/outro MP4 clips generated from committed source frames for reuse outside the
  draft renderer; source-frame sequences are already consumed by local draft render planning when
  present;
- font files and license notes for recurring title, thumbnail, lower-third, and subtitle typography;
- additional series-specific background plates once recurring episode categories are defined;
- storyboard/contact-sheet template refinements after the MVP render-plan artifact exists.
