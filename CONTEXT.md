# UykulukSciFi Domain Context

## V1 Acceptance Evidence

**Definition:** The acceptance evidence that proves V1 is complete: two real episodes finished
through Studio without source-code changes or CLI use in the normal operator journey.

**Relationships:**

- One hosted episode uses hosted voice and hosted visuals, passes final review, and is uploaded
  privately to the intended YouTube channel.
- One fallback episode reaches a final MP4 with local or manual providers that require no paid
  credentials.
- Both episodes complete the brief, content review, voice, visuals, aligned subtitles, render, and
  final review stages.

**Business rules:**

- Episode-specific source-code changes invalidate the acceptance evidence.
- Hidden state repair or CLI intervention in the normal operator journey invalidates the acceptance
  evidence.
- V1 acceptance cannot be achieved until the hosted episode completes private upload and processing
  review.
- Public and scheduled publishing are not part of V1 acceptance.

**Examples:**

- An episode created in Studio with ElevenLabs production voice and approved hosted visuals,
  completed through private YouTube upload and processing review.
- An episode completed through MP4 and final review in Studio with Piper voice and MFLUX-generated
  or reviewed licensed manual visuals.

**Non-examples:**

- An MP4 assembled by manually combining artifacts in the file system.
- An episode that requires a CLI command to compensate for a missing Studio action.
- An automated test that uses only mock providers.
- A public or scheduled publishing operation.

**Evidence source:** Studio action history, immutable operation snapshots, approved artifact
digests, render evidence, final-review evidence, and private-upload and processing evidence for the
hosted episode.

## Real Episode

**Definition:** An original Turkish episode with a target duration of 8–12 minutes that is complete
enough to be evaluated as finished editorial and media work rather than as a diagnostic, demo, or
pipeline rehearsal.

**Relationships:**

- A real episode is created from operator-approved sources, claims, and script content.
- It contains 12–24 episode-specific visual scenes, production-quality voice, aligned subtitles,
  mastered audio, final thumbnail, and distribution metadata.
- A real episode may become either the hosted episode or the fallback episode in the V1 acceptance
  evidence.

**Business rules:**

- Placeholders and mock-provider outputs are not allowed in a real episode.
- Every source, claim, media item, and final output must retain its review and provenance evidence.
- A diagnostic smoke, shortened pipeline demonstration, or test fixture is not a real episode
  regardless of how many workflow stages it reaches.

**Examples:**

- A ten-minute Turkish science-fiction episode with reviewed claims, sixteen approved scene visuals,
  production narration, aligned captions, mastered audio, final thumbnail, and complete metadata.

**Non-examples:**

- A two-minute provider smoke assembled from sample narration and placeholder images.
- A full-length render that still contains mock audio, stock placeholders, or unreviewed claims.

**Evidence source:** Approved editorial artifacts, source-to-claim mappings, canonical media
selections, aligned subtitle evidence, render evidence, final-review evidence, thumbnail evidence,
and metadata evidence.

## Publishable Episode

**Definition:** A real episode that has passed every mandatory category in the minimum publishable
scorecard and has no unresolved high-risk claim.

**Relationships:**

- A real episode becomes publishable only after the minimum publishable scorecard passes.
- A publishable episode may proceed to final distribution review.
- Both episodes used as V1 acceptance evidence must be publishable episodes.

**Business rules:**

- Mandatory scorecard categories are scientific accuracy, source-to-claim traceability, narration
  quality, visual consistency and rights, subtitle readability, audio mastering, edit coherence,
  thumbnail quality, and distribution metadata.
- Every mandatory category must be in the `pass` state.
- A category in `revise` or `block` prevents publishable status.
- Any unresolved high-risk claim prevents publishable status.
- A general operator approval cannot override a mandatory category failure or an unresolved
  high-risk claim.

**Examples:**

- A real episode whose mandatory editorial, media, rights, and distribution checks all pass and
  whose high-risk claims are resolved.

**Non-examples:**

- A visually polished episode with an unresolved scientific claim.
- An operator-approved episode whose subtitle-readability category remains in `revise`.

**Evidence source:** Versioned scorecard results, operator-curated source-to-claim mappings,
category-level review decisions, and resolved-risk evidence.

## Studio-Only Operator Journey

**Definition:** The complete normal production and recovery journey that an operator can perform
through typed Studio actions without using the CLI or directly manipulating files or persisted
state.

**Relationships:**

- The Studio-only operator journey is required for V1 acceptance evidence.
- Core and CLI services remain the owners of workflow state and contracts, while Studio exposes
  their operator-safe actions.
- Recovery is part of the operator journey, not a separate developer-only workflow.

**Business rules:**

- Every production decision, provider retry, committed-result recovery, revision, reselection,
  render action, and distribution review required by a real episode must be available in Studio.
- Advanced Studio surfaces may expose read-only evidence, logs, diagnostics, and artifact metadata.
- Advanced Studio surfaces must not become an untyped state editor or a bypass around workflow
  contracts.
- If an episode requires CLI execution, direct file editing, or hidden state repair, it does not
  satisfy the Studio-only operator journey.
- Typed Studio actions call shared core services; Studio does not own a second workflow state
  machine.

**Examples:**

- Recovering a committed provider result, selecting the recovered candidate, and continuing
  production through guarded Studio actions.
- Inspecting a failed operation's redacted diagnostics in the Advanced section, then invoking its
  supported Studio retry action.

**Non-examples:**

- Running a CLI command because Studio has no recovery action.
- Editing a run-state JSON file to unblock the next stage.
- Mutating approval or digest fields from a generic Advanced form.

**Evidence source:** Studio action history, core transition evidence, recovery evidence, browser
journey recordings, and operator acceptance reports.

## Hosted Episode

**Definition:** A publishable episode that proves the controlled execution of production media
through configured hosted-provider APIs and completes private distribution review.

**Relationships:**

- A hosted episode is one of the two episodes required by V1 acceptance evidence.
- It uses ElevenLabs API output for at least one production voice and an approved hosted
  visual-provider API for at least one episode-specific visual.
- It completes private upload and processing review for the intended YouTube channel.
- Manually imported hosted media may supplement a hosted episode but does not establish
  hosted-provider execution evidence.

**Business rules:**

- Hosted acceptance requires real provider execution with an exact quote, operator approval, cost
  reservation, operation identity, settlement, and redacted provider evidence.
- A diagnostic smoke does not satisfy hosted production evidence.
- Manually imported output from ElevenLabs Image & Video or another hosted tool does not, by itself,
  satisfy hosted acceptance evidence.
- Hosted output must meet applicable production-rights and provenance requirements before canonical
  selection.

**Examples:**

- An episode with production narration generated through the ElevenLabs API and approved scene
  imagery generated through the selected hosted visual-provider API, followed by private YouTube
  processing review.

**Non-examples:**

- An episode whose only hosted media was downloaded from a provider website and manually imported.
- An episode that contains a successful ElevenLabs diagnostic smoke but uses no approved production
  synthesis.

**Evidence source:** Provider execution records, exact quote and approval bindings, reservation and
settlement evidence, canonical media-selection evidence, and private upload and processing evidence.

## Fallback Episode

**Definition:** A publishable episode completed without paid-provider credentials that proves the
production-capable local and manual fallback workflow.

**Relationships:**

- A fallback episode is one of the two episodes required by V1 acceptance evidence.
- It uses Piper for production narration.
- Most of its canonical scene visuals are generated with the local MFLUX provider.
- Licensed media imported and reviewed through Studio may replace weak local visual candidates.

**Business rules:**

- The fallback episode must not require paid-provider credentials or paid execution.
- Deterministic-local narration is diagnostic timing output and cannot satisfy production narration
  quality for a real episode.
- Placeholder static visuals are diagnostic inputs and cannot satisfy publishable visual quality.
- Manually imported licensed visuals are allowed when their provenance and rights are reviewed
  through Studio.
- The episode must remain within the Studio-only operator journey.

**Examples:**

- An episode narrated with Piper, using MFLUX for most selected scene visuals and a small number of
  licensed manual replacements for rejected scenes.

**Non-examples:**

- A pipeline rehearsal using deterministic-local audio and placeholder images.
- A locally rendered episode that depends on an unrecorded file-system copy to replace a failed
  visual.

**Evidence source:** Local-provider setup and execution evidence, Piper voice evidence, canonical
visual selections, manual-import provenance where applicable, render evidence, and final-review
evidence.

## Material Claim

**Definition:** A scientific, historical, numerical, causal, or otherwise verifiable statement that
the audience is expected to understand as factual and that materially affects the episode's accuracy
or conclusion.

**Relationships:**

- A material claim belongs to an episode's editorial evidence.
- Every material claim maps to at least one operator-approved source.
- A material claim may be proposed or located by a model, but only the operator can approve its
  source mapping.
- Material claims contribute to scientific-accuracy and source-to-claim scorecard categories.

**Business rules:**

- Scientific, historical, numerical, causal, and audience-relevant factual assertions must be
  classified as material claims.
- Fiction, explicitly labeled hypotheses, commentary, and narrative transitions do not require
  source mappings.
- The Studio must distinguish factual claims from fiction, hypotheses, commentary, and narrative
  transitions.
- Model-generated claim detection and source matching are suggestions and do not constitute
  evidence.
- An unresolved high-risk material claim blocks publishable status.

**Examples:**

- A numerical statement about the temperature or composition of an astronomical object.
- A causal explanation of how a physical process produces an observed effect.

**Non-examples:**

- An explicitly fictional event in the episode's narrative frame.
- A transition such as “Now consider the opposite possibility.”

**Evidence source:** Operator-curated claim records, source records, source-to-claim mappings, risk
classifications, and editorial review decisions.

## Claim Source Sufficiency

**Definition:** The risk-based rule that determines whether a material claim has enough credible
source support to pass editorial review.

**Relationships:**

- Claim source sufficiency is evaluated for each material claim.
- Its result contributes to the source-to-claim traceability and scientific-accuracy scorecard
  categories.
- A source-conflict decision may revise, qualify, or remove a material claim.

**Business rules:**

- An ordinary material claim requires at least one credible source.
- A high-risk, surprising, or conclusion-bearing material claim requires either one authoritative
  primary source or two independent credible sources.
- Conflicting sources prevent an automatic pass.
- When credible sources conflict, the episode must explicitly communicate the uncertainty or remove
  the claim.
- The operator owns the final source-sufficiency decision.

**Examples:**

- A routine background fact supported by one current authoritative reference.
- A central and surprising scientific claim supported by a primary research paper.
- A contested claim presented with explicit uncertainty after reviewing two independent sources.

**Non-examples:**

- A high-risk claim supported only by an unattributed model response.
- A claim marked as passed while its credible sources materially disagree and the script hides that
  disagreement.

**Evidence source:** Source metadata, source independence and authority assessments, claim-risk
classification, conflict notes, and operator review decisions.

## Script Audition

**Definition:** An optional candidate-generation workflow in which the operator selects one or more
models and chooses which resulting script candidate becomes canonical.

**Relationships:**

- Every candidate uses the same immutable episode brief, prompt profile, and operation-settings
  snapshot.
- Candidate generation does not advance the run beyond its pre-selection editorial state.
- The selected candidate becomes the canonical script; unselected candidates remain retained
  evidence.

**Business rules:**

- The operator may select one model for a direct single-candidate path or multiple models for
  comparison.
- Multiple candidates are generated sequentially to avoid local RAM or VRAM contention.
- Additional model cost and latency are never mandatory for an episode.
- Each candidate retains its text digest, model identity, prompt and settings digests, cost,
  latency, and rubric result.
- Only an explicit operator selection may create or replace the canonical script.

**Examples:**

- Generating one local-model candidate and selecting it directly.
- Comparing three candidates created from the same brief and selecting one after side-by-side
  review.

**Non-examples:**

- Generating candidates from different briefs and presenting them as a controlled comparison.
- Automatically replacing the canonical script with the highest model-generated rubric score.

**Evidence source:** Candidate artifacts, immutable input snapshots, provider and cost evidence,
rubric suggestions, and the operator's canonical-selection decision.

## Approval-Bound Stage

**Definition:** A production stage whose result must receive its own explicit operator decision
before a dependent stage can proceed.

**Relationships:** Idea, script, production package, voice, visuals, render, and final review are
approval-bound stages.

**Business rules:**

- A later approval never implies an earlier approval.
- A revised approved artifact invalidates dependent approvals.
- File existence, model confidence, or prior-stage success never substitutes for an operator
  decision.

**Evidence source:** Stage-specific decision records, approved artifact digests, reviewer identity,
notes, and decision timestamps.

## Operation Settings Snapshot

**Definition:** The immutable settings revision captured when an operation begins and used until
that operation reaches a terminal or recoverable state.

**Relationships:** A snapshot is derived from the currently active settings revision and is bound to
provider, generation, render, and distribution evidence.

**Business rules:**

- Saved settings appear immediately in Studio and affect the next operation.
- An in-progress operation continues with its captured snapshot.
- Listener, port, and build-time changes require a controlled restart or rebuild before becoming
  effective.
- Secret values are never returned to the operator; only configured or missing status is visible.

**Evidence source:** Versioned settings revisions, operation snapshots, effective-at metadata, and
restart-required status.

## Prompt Profile

**Definition:** A versioned, operator-editable content-generation instruction set associated with a
genre or a custom idea path.

**Relationships:** Science fiction is the default profile, not a product boundary. An episode brief
captures the selected profile revision and any operator edits.

**Business rules:**

- The operator may select a predefined genre profile, edit it, or write a custom idea.
- Saving an edit creates a new revision.
- Creating an episode captures an immutable brief, prompt-profile revision, and settings snapshot.

**Evidence source:** Prompt-profile revisions, genre selection, custom brief content, and the
episode's immutable input snapshot.

## Script Revision

**Definition:** A durable version of the canonical script created by an explicit operator edit after
candidate selection.

**Relationships:** A script revision descends from a selected script candidate or a previous script
revision.

**Business rules:**

- Editing never silently mutates a selected candidate or prior revision.
- The prior text, textual difference, editor identity, reason, and digest remain available.
- Dependent approvals are invalidated when their bound script digest changes.

**Evidence source:** Revision lineage, text digests, structured differences, editor identity,
reason, and timestamps.

## Production Voice

**Definition:** The single canonical narration selected and approved for use in an episode render.

**Relationships:** Voice previews support audition; a production voice is bound to an approved voice
identity, model, settings, rights status, audio, alignment, and cost evidence.

**Business rules:**

- Preview audio is diagnostic and cannot be bound into an episode render.
- Only one production voice is canonical for a render revision.
- Reselection archives the former selection and invalidates its quote and dependent render approval.
- Hosted production voice requires verified production rights.

**Evidence source:** Voice-catalog snapshot, preview evidence, selection and reselection history,
rights confirmation, production audio, alignment, and cost evidence.

## Visual Candidate Pool

**Definition:** The provider-neutral collection of generated or imported visual candidates available
for scene-level comparison and canonical selection.

**Relationships:** A visual-generation plan selects scenes and provider subsets. Every scene
contributes zero or more candidates to the pool and may have one canonical visual.

**Business rules:**

- Providers run only when explicitly selected for a scene or plan.
- Candidates from different providers remain distinct; pixels are not merged automatically.
- Hidden automatic provider execution is not allowed.
- A candidate retains provider, model, input, seed, settings, rights, provenance, latency, cost, and
  media-digest evidence when applicable.

**Evidence source:** Visual-generation plans, candidate batches, import evidence, provider evidence,
and scene review decisions.

## Canonical Visual

**Definition:** The single approved visual candidate selected for a scene in a specific
visual-manifest revision.

**Relationships:** A scene may accumulate many candidates and revisions but has at most one
canonical visual in the active manifest.

**Business rules:**

- Only rejected scenes need to be regenerated.
- Replacing a canonical visual preserves its revision history.
- Any canonical-visual change invalidates dependent render approval.

**Evidence source:** Scene-level selection decisions, candidate digests, revision lineage,
contact-sheet review, and active visual-manifest digest.

## Hosted Visual Provider Readiness

**Definition:** The operator-visible state describing whether a hosted visual provider is disabled,
experimental, or ready for production planning.

**Relationships:** BFL FLUX.2 Pro is the only hosted visual provider candidate for V1 and begins
disabled and experimental.

**Business rules:**

- Readiness requires a three-scene bake-off covering a cinematic wide shot, a human or character
  shot, and a scientific or explanatory shot.
- The provider must score at least 75 out of 100 and pass mandatory rights and provenance checks
  before becoming ready.
- V1 does not add another hosted visual provider.

**Evidence source:** Bake-off candidates, rubric results, rights and provenance review, latency and
cost evidence, and the readiness decision.

## Local Visual Generation

**Definition:** The mandatory credential-free visual-generation capability for V1, provided by local
MFLUX execution.

**Relationships:** Local visual generation supplies most canonical visuals in the fallback episode,
coexists with reviewed manual imports, and follows the same Studio-managed model-readiness lifecycle
as local language models.

**Business rules:**

- V1 is not complete without a working local MFLUX provider.
- The MFLUX model is installed and managed through Studio rather than downloaded implicitly during
  the base dependency install.
- Studio identifies MFLUX as required for real local visual generation and cannot report the
  provider as ready until its model and runtime pass readiness checks.
- Before MFLUX is ready, Studio may offer explicit mock output for diagnostics or operator-provided
  media input; neither path is represented as local model generation.
- Local execution must retain model revision, quantization, prompt digest, seed, settings, duration,
  and output digest.
- Licensed manual imports may replace rejected local candidates but do not replace the requirement
  for local visual generation.

**Evidence source:** Studio-managed installation state, model and runtime readiness, model identity,
generation evidence, canonical selections, and fallback-episode acceptance evidence.

## Local Model Readiness

**Definition:** The Studio-managed lifecycle that determines whether a required local model package
is absent, installing, ready, or unavailable.

**Relationships:** Local MFLUX and local language-model packages use the same operator-facing
readiness semantics while retaining capability-specific runtimes and validation.

**Business rules:**

- Large model packages are not downloaded implicitly during the base project dependency install.
- Studio explains the capability enabled by each model, its approximate download size, disk
  requirements, installation progress, and readiness result.
- A real install or generation smoke requires a persisted preflight estimate for monetary cost,
  elapsed time, and disk use plus explicit operator approval of that exact estimate.
- Each approved setup or smoke operation persists redacted QA and security evidence beneath its
  canonical `runs/<run_id>/` directory.
- A model-dependent action remains unavailable until its required package and runtime are ready.
- While a model is absent, Studio may expose clearly labeled mock diagnostics or operator-input
  alternatives where the workflow supports them.
- Mock output and operator input must never be mislabeled as local model inference.
- Failed and interrupted downloads are resumable or restartable through Studio without hidden
  file-system repair.

**Examples:**

- Studio marks local image generation as unavailable, explains that MFLUX is required, and offers
  model installation, diagnostic mock output, or reviewed manual media input.
- Studio marks local script generation as unavailable until the selected local language model is
  installed and verified.

**Non-examples:**

- Reporting a local provider as ready because its configuration entry exists while its model files
  are absent.
- Downloading several gigabytes during the base dependency install without an operator-visible
  Studio step.

**Evidence source:** Model-package manifest, disk preflight, download and verification events,
runtime doctor result, model identity, and Studio readiness state.

## Exact Cost Approval

**Definition:** The operator's authorization to spend against a quote bound to a precise provider
operation or multi-scene generation plan.

**Relationships:** An exact cost approval binds provider, model, inputs, output settings, operation
identity, and maximum cost. It precedes paid execution and settlement.

**Business rules:**

- Changing a scene, provider, model, input, or output setting requires a new quote and approval.
- A multi-scene plan displays both per-operation estimates and the total approved maximum.
- Approval never authorizes a different or more expensive operation.

**Evidence source:** Quote, approval, reservation, operation identity, execution result, settlement,
and reconciliation evidence.

## Recoverable Provider Operation

**Definition:** A provider operation whose durable evidence allows Studio to determine whether to
recover a committed result, inspect an uncertain outcome, or request a newly approved execution.

**Relationships:** A committed result may exist even when final Studio registration failed. An
uncertain outcome is distinct from a confirmed provider failure.

**Business rules:**

- Bounded retry under the same operation identity is allowed only for known transient failures.
- An uncertain paid outcome must not be submitted blindly again.
- A committed result is recovered from durable spool evidence without another provider request.
- Recovery actions must be available through Studio.

**Evidence source:** Operation identity, request diagnostics, spool state, provider result digest,
recovery decision, and cost reconciliation.

## Exact Render Approval

**Definition:** Approval for one exact render input set and its deterministic render plan.

**Relationships:** It binds production audio and voice evidence, active aligned subtitles and
metadata, canonical visual manifest, motion plan, licensed music and sound-effects manifest,
thumbnail, and render settings.

**Business rules:**

- Changing any bound digest invalidates render approval.
- Render output must use only the approved active descriptors.
- Subtitle presentation is limited to two readable lines.
- Mastered audio targets approximately `-14 ±1 LUFS` and no more than `-1 dBTP`.
- Motion is deterministic, and music and sound effects retain license and provenance evidence.
- The final thumbnail is a validated JPEG artifact.

**Evidence source:** Exact render binding, media manifests, subtitle metadata, audio measurements,
render output digest, media probe, and thumbnail evidence.

## Reviewed Media Import

**Definition:** External media introduced through Studio with explicit provenance, rights,
validation, and operator review.

**Relationships:** Reviewed imports may contribute voice or visual candidates and may replace
rejected generated media.

**Business rules:**

- Imports record source, rights, media type, content digest, and operator decision.
- Direct file-system copying does not create a reviewed media import.
- Imported media must satisfy the same canonical-selection and render-binding rules as generated
  media.

**Evidence source:** Import record, source and rights metadata, validated media digest, and
selection decision.

## Private Distribution Approval

**Definition:** Approval to upload one exact reviewed episode privately to one intended YouTube
channel.

**Relationships:** It binds target channel identity, MP4, metadata, thumbnail, captions, and the
invariant privacy value `private`.

**Business rules:**

- Public and scheduled publishing values do not exist in the V1 schema, action catalog, or Studio
  controls.
- Any bound digest or target-channel change requires a new approval.
- A resumable upload retains operation identity, session progress, and remote video identity.
- An uncertain upload outcome must be inspected before another upload is attempted.

**Evidence source:** Distribution approval, channel binding, artifact digests, resumable-session
evidence, and remote video identity.

## Processing Review

**Definition:** The operator's Studio review after YouTube has accepted and processed the private
episode, thumbnail, and captions.

**Relationships:** Processing review is the terminal distribution review for the hosted episode and
is required for V1 acceptance evidence.

**Business rules:**

- Transfer completion alone is not processing completion.
- The remote video identity, processing status, thumbnail status, and caption status must be
  visible.
- The operator must explicitly accept or revise the processed result.

**Evidence source:** Remote processing status, thumbnail and caption status, polling history,
redacted diagnostics, and operator decision.

## Studio Presentation Layers

**Definition:** The separation between the decision-focused normal operator surface and the
evidence-focused Advanced surface.

**Relationships:** Both surfaces read the same typed core services and workflow truth.

**Business rules:**

- The normal surface shows the current stage, decision content, cost, blockers, and one primary next
  action.
- Digests, paths, ledgers, raw diagnostics, and developer-oriented recovery context belong in
  Advanced.
- Advanced remains read-only except for explicitly typed recovery actions.
- Normal product documentation does not expose a CLI command catalog.

**Evidence source:** Studio action catalog, view contracts, browser acceptance evidence, and
versioned operator documentation.

## Studio Bootstrap

**Definition:** The single-command first-run journey that makes a fresh clone ready for Studio
operation without overwriting operator configuration.

**Relationships:** Bootstrap verifies the required toolchain, installs project dependencies, creates
missing default configuration, builds Studio, and starts it. Required large local models are
installed and verified through Studio onboarding rather than the base dependency step.

**Business rules:**

- Existing configuration is never overwritten.
- Studio onboarding remains incomplete while a mandatory V1 local-model capability is not ready,
  while unrelated manual or mock diagnostic paths may remain available with explicit labels.
- New installations default to Turkish while preserving an existing locale choice.
- Turkish and English operator surfaces must not mix languages within one selected locale.
- CLI details remain in technical reference documentation, not the normal operator journey.

**Evidence source:** Fresh-clone rehearsal, bootstrap event log, configuration-preservation checks,
locale tests, and first-run browser acceptance.

## Browser Acceptance Evidence

**Definition:** Functional and visual evidence collected from the production-built Studio across the
supported operator environments.

**Relationships:** Browser acceptance complements core tests and is required for Studio-first V1
claims.

**Business rules:**

- Chromium covers the complete journey and WebKit covers the primary path.
- Desktop, tablet, and mobile layouts; Turkish and English; light, dark, and system themes; keyboard
  operation; visible focus; 200 percent zoom; and representative failure states are reviewed.
- Automated assertions alone do not establish visual quality.

**Evidence source:** Production-build test results, browser traces, screenshots, accessibility
results, and operator-journey review.

## Live V1 Verification

**Definition:** The real external-provider and distribution evidence required before the product may
claim V1 completion.

**Relationships:** Live verification completes implemented provider contracts; mock-backed tests and
diagnostic smokes remain supporting evidence.

**Business rules:**

- V1 requires at least one commercial ElevenLabs production execution, one hosted visual production
  execution, and one private YouTube upload and processing review.
- Missing credit, subscription, production rights, or provider access leaves the feature implemented
  but V1 acceptance blocked.
- Live paid calls never run in CI.

**Evidence source:** Redacted live provider evidence, exact cost approvals, settlements, canonical
media selections, and private distribution evidence.

## V1 Non-Goals

**Definition:** Capabilities deliberately excluded from V1 even when adjacent infrastructure could
support them later.

**Business rules:**

- Public and scheduled publishing are excluded.
- Short generated video clips are excluded until still-image production succeeds across two real
  episodes.
- ComfyUI, additional hosted visual providers, a generic publishing platform, team or role
  management, cloud queues, and a standalone documentation site are excluded.
- Manual analytics import remains available; read-only YouTube Analytics waits until audience-facing
  videos exist.

**Evidence source:** Roadmap scope, action-catalog absence, schema restrictions, and release
acceptance review.
