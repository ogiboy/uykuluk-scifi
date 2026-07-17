# CLI Reference

The CLI is the automation, diagnostics, and recovery interface behind Studio. Normal operators
should prefer Studio when a guarded action exists. Add `--json` to supported commands for typed
automation output.

## Setup and Inspection

```bash
pnpm producer init
pnpm producer doctor
pnpm producer status --run <run_id>
pnpm producer status --latest
pnpm producer list-runs
pnpm producer desk
pnpm producer desk --run <run_id>
pnpm producer desk --plain
```

## Idea, Script, and Package

```bash
pnpm producer ideas
pnpm producer approve idea --run <run_id> --idea <idea_id>
pnpm producer script --run <run_id>
pnpm producer review script --run <run_id>
pnpm producer approve script --run <run_id>
pnpm producer approve script --run <run_id> --acknowledge-warnings
pnpm producer revise script --run <run_id> --file <path> --reason "<reason>" --editor <name>
pnpm producer package --run <run_id>
pnpm producer revise package-artifact --run <run_id> --artifact subtitles \
  --file subtitles.srt --reason "<reason>" --editor <name>
```

Do not edit canonical run artifacts directly. Revisions record attribution, before/after snapshots,
digests, invalidated decisions, and ledger events.

## Voice Audition and Production

```bash
pnpm producer voice-candidates --run <run_id>
pnpm producer voice-preview --run <run_id> --voice <voice_id>
pnpm producer voice-select --run <run_id> --voice <voice_id> \
  --reviewed-by <operator> --notes "<audition notes>"
pnpm producer voice-select --run <run_id> --voice <voice_id> \
  --reviewed-by <operator> --notes "<audition notes>" --confirm-production-rights
pnpm producer voice-reselect --run <run_id> \
  --reviewed-by <operator> --reason "<reason>"
pnpm producer voice --run <run_id>
pnpm producer review voice --run <run_id>
```

Hosted production voice requires one exact confirmation bundle:

```bash
pnpm producer voice --run <run_id> \
  --binding-digest <sha256> \
  --quote-digest <sha256> \
  --approval-id <approval_id> \
  --confirm-paid-operation
```

The four hosted confirmation options are all-or-none. Core revalidates selection, quote, approval,
reservation, eligibility, and metadata before provider execution.

## Scene Visuals

```bash
pnpm producer visuals prepare --run <run_id>
pnpm producer visuals plan-hosted --run <run_id> --scenes 1,2,3
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id>
pnpm producer visuals generate-hosted --run <run_id> \
  --binding-digest <sha256> --quote-digest <sha256> --approval-id <approval_id> \
  --confirm-paid-operation
pnpm producer visuals plan-hosted --run <run_id> --scenes 2,7 \
  --purpose regenerate-rejected --reviewed-by <operator> --reason "<reason>"
```

Hosted planning is explicit and makes no provider request. The generation command revalidates the
exact plan, quote, approval, reservation, and server-only credential. Rejected-only planning
archives the spent plan and quote before a new estimate; accepted scenes are retained unchanged.

## Render and Review

```bash
pnpm producer render-plan --run <run_id>
pnpm producer review render-plan --run <run_id>
pnpm producer estimate --run <run_id>
pnpm producer approve cost --run <run_id>
pnpm producer evidence --run <run_id>
pnpm producer readiness --run <run_id>
pnpm producer approve render --run <run_id>
pnpm producer render --run <run_id>
pnpm producer review render --run <run_id>
pnpm producer decide render --run <run_id> \
  --decision accepted-for-local-review --notes "<notes>" --reviewed-by <operator>
pnpm producer decide render --run <run_id> \
  --decision needs-revision --notes "<notes>" --reviewed-by <operator>
pnpm producer revise render --run <run_id>
pnpm producer review render-decision --run <run_id>
pnpm producer review-bundle --run <run_id>
pnpm producer channel-handoff --run <run_id>
pnpm producer decide channel-handoff --run <run_id> \
  --decision accepted-for-manual-channel-prep \
  --thumbnail-candidate <candidate_id> --notes "<notes>" --reviewed-by <operator>
```

`channel-handoff` creates a local manual preparation package. It does not upload or publish.

## Local Model Evaluation

```bash
pnpm producer eval local-model
pnpm producer eval local-model --llm-mode llama.cpp --model <served-model.gguf>
pnpm producer eval local-model-candidates --llm-mode llama.cpp \
  --candidate <model-a.gguf> --candidate <model-b.gguf>
pnpm producer eval local-model-candidates --llm-mode llama.cpp --include-local-gguf
```

Evaluation does not create a run or edit config. It writes ignored reports without raw provider
output. In `llama.cpp` mode the candidate must already be served by the one loaded server.

## Manual Analytics

```bash
pnpm producer analytics import --file performance.csv
pnpm producer analytics report
```

Analytics input is operator-provided CSV or JSON. The importer and report remain local, make no
YouTube request, and do not claim causal relationships.

## Intentionally Unavailable

```bash
pnpm producer upload private --run <run_id>
pnpm producer publish schedule --run <run_id>
```

Private upload is a pending controlled-distribution deliverable. Public and scheduled publishing
remain out of v1 and inaccessible through normal product surfaces.
