# Security and Operating Model

The product treats missing or stale approval, insufficient budget, unsafe config, tampered evidence,
provider failure, and uncertain external execution as blocked states.

## Secrets

- Keep `.env`, local config, provider tokens, Sentry auth tokens, OAuth tokens, and decryption keys
  out of Git.
- Keep secrets server-side; never include them in Studio responses, prompts, artifacts, diagnostics,
  logs, or provider evidence.
- Blank optional environment values disable their integration safely.
- Redaction is validated before provider diagnostics are persisted.

Encrypted dotenv vault ciphertext may be tracked under the repository's explicit environment policy,
but plaintext environments and decryption credentials must remain ignored.

## Approvals and Evidence

- File existence never grants approval.
- Script approval binds the reviewed script digest.
- Cost approval binds one exact quote digest.
- Render approval binds the active voice, subtitle, render plan, and approved media digests.
- Operator decisions include attribution and notes.
- Stale, malformed, mismatched, or unregistered evidence fails closed.

## Paid Providers

Every paid operation requires:

1. a current provider/model/settings snapshot;
2. a bounded exact quote;
3. hard-budget validation;
4. persisted approval of that quote;
5. an atomic reservation;
6. a stable operation ID;
7. explicit operator confirmation for the exact binding;
8. bounded timeout/retry behavior;
9. provider-aware settlement or uncertain-state recovery;
10. provenance and redacted diagnostics.

Live paid calls are forbidden in CI. A timeout or ambiguous response does not authorize a blind
retry. Active and uncertain reservations continue counting against budget until resolved.

## Studio Routes

Guarded mutations require loopback use, same-origin JSON, the correct action header, a short-lived
session token/cookie pair, typed bounded payloads, and server-side revalidation. Local preview media
uses allowlisted canonical artifact paths and supports bounded range requests without accepting
provider URLs.

Loopback HTTP intentionally has no HSTS or Secure cookie requirement. Serving Studio beyond loopback
requires a new transport, auth, CSRF, cookie, telemetry, and threat review.

## Providers and Paths

Local LLM base URLs are restricted to credential-free loopback origins. Artifact and run identifiers
are bounded safe path segments. Reads remain inside the run root and reject symlink/path traversal
escape.

## Upload and Publishing

Private upload is not yet implemented in the product path. Its v1 design requires server-side OAuth,
resumable session evidence, target-channel binding, exact MP4/metadata/thumbnail/caption digests,
and privacy fixed to `private`.

Public and scheduled publishing are unavailable at config, schema, action, and UI boundaries. Manual
channel handoff artifacts do not grant upload or publish authority.

## Telemetry

Optional Sentry reporting is non-authoritative and disabled without a DSN. It excludes request
bodies, prompt/provider content, run artifacts, credentials, and approval evidence. Telemetry
failure cannot change workflow state.

## Defensive Validation

CI runs secret scanning, dependency audit, CodeQL, tests, type checks, browser/product smoke, and
Sonar Cloud at release-relevant points. Security-sensitive changes require negative tests for route,
session, origin, path, artifact, approval, budget, and provider-failure boundaries.
