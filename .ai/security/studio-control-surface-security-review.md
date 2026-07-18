# Studio Control Surface Security Review

- **Branch:** `feat/studio-control-surface-polish`
- **Date:** 2026-07-11
- **Audited base commit:** `65001df7f4ffffe9477714e5fa8b5755da5b5747`
- **Mode:** Defensive, repo-scoped, development-time review only
- **Skill library:** `.agents/skills/` from `mukul975/Anthropic-Cybersecurity-Skills`
- **Catalog:** `.ai/security/anthropic-security-skill-catalog.md`
- **Catalog SHA-256:** `a813b6cb26b4fb09838fc4f1980db884ca54d416bb0fcf8470d78ac748729e1b`
- **Skill lock SHA-256:** `c3bc16c1bda6a93b20a1eb7d4f8c7d12fd1ccfcb21e5a18b281104fe95d43444`
- **Runtime dependency:** None; `.agents/` and `.ai/` are not application inputs

## Selected Skills

Loaded or applied in bounded groups of at most three:

1. Route and HTTP pass
   - `implementing-api-schema-validation-security`
   - `performing-security-headers-audit`
   - `testing-for-host-header-injection` as a local/static checklist only
2. LLM and provider pass
   - `detecting-ai-model-prompt-injection-attacks`
   - `detecting-indirect-prompt-injection`
   - current structured provider-output contracts
3. Supply-chain pass
   - `securing-github-actions-workflows`
   - `detecting-dependency-confusion`
   - `detecting-malicious-npm-packages` as static triage only
4. Secrets pass
   - `implementing-secrets-scanning-in-ci-cd`
   - local Gitleaks
   - local TruffleHog with verification disabled and summarized/redacted output

OAuth scope and API-key skills were cataloged but not applied because YouTube upload, publish, cloud
providers, OAuth, and runtime API-key storage are not implemented.

## Skill-Based Checks Performed

### Live local Studio HTTP checks

A local Next.js Studio instance was bound to `127.0.0.1:3137`. Only the authorized local target was
queried.

- `/` returned 200.
- `/actions/session` with matching local Origin returned 200.
- Session cookie was `HttpOnly`, `SameSite=Strict`, scoped to `/actions`, and limited to 900
  seconds.
- Cross-origin session request returned 403.
- Cross-site originless session request returned 403.
- Mutation route called with GET returned 405.
- POST mutation without session proof returned 401.
- Cross-origin POST mutation returned 403.
- POST mutation with `text/plain` returned 415.
- `localhost` and `127.0.0.1` alias request returned 200 as intended.
- A request with `Host: 0.0.0.0` and local Origin returned 200; see Medium finding 1.

### LLM/provider boundary checks

- Reviewed idea-history prompt construction, script-section context, repair prompts, provider JSON
  parsing, idea payload schemas, model-eval error redaction, and Ollama/llama.cpp adapters.
- Ran an inert local canary through `ideaHistoryPromptBlock()`. A newline plus pseudo-heading was
  preserved as raw prompt structure and no untrusted-data boundary marker was added.
- No model server, hosted API, detector model, or offensive payload generator was used.

### Supply-chain checks

- Both workspace packages are `private`.
- GitHub Actions use immutable full SHAs and explicit permissions.
- No `pull_request_target` workflow was found.
- No untrusted PR title/branch/commit expression was interpolated into a shell command.
- `@sentry/cli@2.58.6` is reached through the official `@sentry/nextjs` bundler plugin chain and is
  explicitly allowlisted in pnpm lifecycle-script policy.
- No private registry or mixed public/private package source is configured, so dependency-confusion
  exposure is currently limited.
- Dynamic malware detonation, public namespace claiming, and external package probing were not run.

### Secret scans

- Gitleaks scanned 745 commits and reported zero leaks.
- TruffleHog full-worktree scan produced 128 unverified matches, mostly from ignored skill examples,
  generated/local content, and fixtures.
- A second TruffleHog scan copied only tracked files into an isolated temporary directory and
  produced three unverified matches:
  - two URI detector matches in explicit llama.cpp redaction fixtures;
  - one JDBC detector match in the local SonarQube compose file.
- The three tracked matches were reviewed with values redacted. They are test fixtures or local
  development defaults, not confirmed live credentials.
- TruffleHog verification was intentionally disabled to prevent outbound credential validation.

## Findings

### High

- No confirmed high-severity vulnerability, credential leak, or upload/publish bypass was found.

### Medium

1. **Runtime Host validation does not reject the wildcard bind host.**
   - Live request: `Host: 0.0.0.0` with a local Origin returned 200 from `/actions/session`.
   - The helper validates `Request.url` and forwarded candidates, but the live Next.js request URL
     stayed on `127.0.0.1`; the raw Host value did not become the rejected candidate.
   - Synthetic URL tests therefore do not fully model the App Router runtime behavior.
   - Risk is limited by local binding, but the trust proof is weaker than its test suggests.

2. **Persisted idea titles can change prompt structure.**
   - `ideaHistoryPromptBlock()` joins persisted generated/approved titles directly into the next
     model prompt.
   - Titles are non-empty strings but are not bounded to one line or wrapped as untrusted data.
   - The inert canary confirmed that a newline and Markdown heading survive unchanged.
   - Current impact is content-integrity degradation because providers have no tools or secrets;
     impact increases if web/document ingestion, tools, or hosted providers are later added.

3. **Local provider URLs are not restricted to local origins.**
   - `ollamaBaseUrl` and `llamaCppBaseUrl` accept any valid URL.
   - Provider calls can therefore be directed to arbitrary HTTP(S) endpoints by configuration.
   - This is operator-controlled rather than remote-user-controlled, but it weakens the local-only
     boundary and becomes an SSRF/credential concern if config mutation ever becomes web-accessible.
   - llama.cpp diagnostics redact URL credentials/path/query; Ollama diagnostics currently display
     the configured URL directly in failures.

### Low

1. **Studio response headers are minimal.**
   - Live `/` response exposed `X-Powered-By: Next.js` and did not include CSP, frame protection,
     `X-Content-Type-Options`, Referrer-Policy, or Permissions-Policy.
   - Local-only exposure lowers severity. HSTS is not applicable while Studio intentionally uses
     loopback HTTP.

2. **Session cookie has no Secure attribute.**
   - This is compatible with current loopback HTTP and is not a defect under the local-only model.
   - It becomes a blocker if Studio is ever served over HTTPS or beyond loopback.

3. **Sentry dependencies bypass release-age quarantine by exact version.**
   - `minimumReleaseAgeExclude` contains exact Sentry 10.65.0 packages.
   - Exact versions reduce drift, but each future exception should remain deliberate and reviewed.

4. **A low-severity development dependency advisory remains.**
   - `diff@5.1.0` via Prettier tooling is affected by `GHSA-73rr-hh4g-fpgx`.
   - It is development-only; patched versions start at 5.2.2.

5. **Local Sonar file scanner authentication warning persists.**
   - File scans completed with no detected secrets but warned that authentication over local HTTP
     was not accepted. The warning was not suppressed by weakening transport policy.

## Confirmed Controls

- Studio mutation routes are POST-only and reject missing session proof, cross-origin requests, and
  unsupported content types.
- Session tokens use cryptographic randomness, short expiry, HttpOnly cookie storage,
  SameSite=Strict, and timing-safe header/cookie comparison.
- Payloads use strict schema parsing before CLI argument construction.
- CLI mutation execution is allowlisted, uses `shell: false`, and has bounded output/time limits.
- Artifact/run path contracts reject traversal and unsafe link boundaries.
- GitHub Actions permissions and action pinning follow the selected workflow-hardening skill.
- Tracked history contains no Gitleaks finding; TruffleHog matches were unverified
  fixtures/defaults.
- Upload and public/scheduled publish remain disabled and fail closed.
- Studio remains an operator surface over CLI/core, not a second workflow engine.

## Deferred Skill Gates

- Run `performing-oauth-scope-minimization-review` before any YouTube OAuth/private-upload work.
- Run `implementing-api-key-security-controls` before any hosted provider credential path.
- Run `auditing-mcp-servers-for-tool-poisoning` before adding/changing an MCP server used by project
  development agents; never place MCP scanning in application runtime.
- Revisit indirect prompt injection before importing web pages, PDFs, images, comments, or external
  analytics text into model context.

## Do-Not-Do Boundaries

- Do not import, bundle, or read `.agents/skills` or `.ai` at runtime.
- Do not run exploit tools, public-target probes, malware detonation, namespace claiming, or
  outbound secret verification.
- Do not weaken approval, cost, artifact, provider, upload, or publish guards for testing.
- Do not add OAuth, cloud providers, upload, publish, or new Studio mutations as a security-review
  side effect.

## Pre-Remediation Verdict

The selected skill passes found no confirmed secret leak or publication bypass. The main unresolved
risks are live Host-header trust drift, untrusted idea-title prompt structure, unrestricted provider
base URLs, and missing browser hardening headers. Per operator instruction, these findings are
reported only and were not remediated during the skill-testing phase. Upload and public/scheduled
publish remain disabled.

## Remediation Applied After Review

- Session trust now rejects unsafe declared `Host` or forwarded authorities even when Next.js keeps
  `Request.url` on a loopback origin; a regression test models the live Host-header case.
- Historical idea titles are normalized, bounded, and JSON-encoded as explicitly untrusted prompt
  data so embedded newlines cannot create model-prompt headings.
- Ollama and `llama.cpp` config/CLI overrides now accept only credential-free loopback HTTP(S)
  origins. Hosted or LAN endpoints require a future adapter review.
- Studio disables `X-Powered-By` and sends frame, MIME-sniffing, referrer, permissions, and minimal
  CSP protections. `Secure` cookies remain deferred while the app is loopback HTTP only.
- The vulnerable development-only `diff` version is overridden to the patched `5.2.x` line.
- Exact Sentry release-age exceptions remain deliberate and pinned for this reviewed installation.

## Current Status

The four actionable findings from the side-task review are remediated and covered by targeted tests
or browser checks. The remaining items are deliberate constraints rather than open defects: the
session cookie cannot use `Secure` while Studio is intentionally loopback HTTP, Sentry release-age
exceptions remain exact and reviewed, and upload/public/scheduled publishing remain unavailable. The
immutable hashes above bind this report to the skill catalog and lock used during the review; the
pull request and Git history bind the final remediation commit without creating a self-referential
document hash.
