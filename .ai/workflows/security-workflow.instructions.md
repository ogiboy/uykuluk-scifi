# Security Workflow

Use for approvals, costs, providers, upload/publish, route handlers, config, secrets, subprocesses,
and QA artifacts.

## Required Lens

- Spoofing: can a caller pretend to be the operator?
- Tampering: can inputs alter state, approvals, costs, or artifacts without validation?
- Repudiation: is there an append-only event trail?
- Information disclosure: can prompts, secrets, provider errors, or artifacts leak?
- Denial of service: can large inputs, file scans, or provider calls stall the local app?
- Elevation of privilege: can a read-only surface mutate workflow state?

## Minimum Controls

- Explicit approval records for gates.
- Publish disabled by default.
- Config enablement does not imply approval.
- Shape validation for future web route inputs.
- Secret redaction in logs and QA artifacts.
- No raw web/provider text treated as instructions.

## Negative Tests

- Missing approval rejected.
- Stale approval rejected.
- Malformed run id rejected.
- Public publish rejected by default.
- Future web route rejects foreign/malformed action requests.
