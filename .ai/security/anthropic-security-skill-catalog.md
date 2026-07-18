# Anthropic Cybersecurity Skill Catalog for UykulukSciFi

This is a development-only routing notebook for the ignored `.agents/skills/` installation. It is
not runtime configuration and must never be read or imported by CLI/Studio code.

## Selection Rules

1. Start with folder names and `skills-lock.json` metadata.
2. Read frontmatter/README only for likely candidates.
3. Load at most 1–3 full skill bodies for one bounded review pass.
4. Apply guidance only to this repository or another explicitly authorized local target.
5. Never run exploit tooling, public-target probes, malware detonation, credential attacks,
   phishing, network scanning, or destructive red-team workflows.

## Active Review Map

### Studio routes, sessions, and HTTP boundaries

- `implementing-api-schema-validation-security` — active. Check strict request schemas,
  unknown-field rejection, size bounds, enums, and response-data minimization.
- `performing-security-headers-audit` — active for local Studio responses. Check CSP, frame defense,
  referrer policy, permissions policy, HSTS applicability, and cookie attributes.
- `testing-for-host-header-injection` — checklist-only. Use static/local request review for Host and
  forwarded-host trust; do not run its attacker-domain, SSRF, cache-poisoning, or public probing
  steps.

### LLM, provider, and agent-input boundaries

- `detecting-ai-model-prompt-injection-attacks` — active. Review direct instruction override,
  delimiter abuse, encoded input, role confusion, and allow/flag/block behavior.
- `detecting-indirect-prompt-injection` — active for future web/document/image ingestion and current
  provider/tool output boundaries. Do not add heavyweight detector models before a real ingress path
  exists.
- `auditing-mcp-servers-for-tool-poisoning` — conditional. Apply before adding or changing an MCP
  server used by development agents; do not make MCP scanning part of application runtime.
- `defending-llms-with-guardrails` and `implementing-llm-guardrails-for-security` — reserve
  references when provider output validation or tool execution expands beyond current structured
  parsers.

### Secrets and credentials

- `implementing-secrets-scanning-in-ci-cd` — active. Compare the tracked-source scanner and CI gate
  against Gitleaks/TruffleHog coverage without sending secrets to external services.
- `implementing-secret-scanning-with-gitleaks` — optional local enhancement if Gitleaks is installed
  and configured with reviewed allowlists.
- `implementing-api-key-security-controls` — conditional for future cloud/provider credentials.
  Current local provider mode must not invent key storage or rotation machinery.
- `performing-oauth-scope-minimization-review` — required before any YouTube OAuth/private-upload
  implementation. It is deferred while upload/publish remain disabled.

### GitHub Actions, dependencies, and supply chain

- `securing-github-actions-workflows` — active. Check immutable action SHAs, minimal permissions,
  untrusted expression interpolation, fork handling, environment approvals, and secret exposure.
- `detecting-dependency-confusion` — active static review. Inventory workspace package names and
  registry configuration; never claim public namespaces as a test.
- `detecting-malicious-npm-packages` — active static review for lifecycle scripts, unexpected
  network installers, typosquatting, and lockfile anomalies. Do not detonate packages on the
  workstation.
- `detecting-typosquatting-packages-in-npm-pypi` — optional name-only follow-up during dependency
  additions.
- `analyzing-sbom-for-supply-chain-vulnerabilities` — conditional if the release workflow begins
  producing an SBOM.
- `implementing-code-signing-for-artifacts` — conditional for distributable binaries or signed media
  manifests; not needed for current local draft artifacts.

### Filesystem and artifact containment

- No catalog skill replaces the repository's run-id, relative-path, symlink, hardlink, atomic-write,
  and temp-directory contracts. Review those controls directly with defensive path-containment
  checklists.
- `performing-directory-traversal-testing` is not an active workflow because its offensive payload
  guidance conflicts with this project's no-exploit rule. Only existing local negative fixtures may
  represent traversal-shaped input.

## Explicitly Excluded Skill Families

- credential access, authentication bypass, exploitation, persistence, privilege escalation
- phishing, malware, ransomware, C2, packet injection, public reconnaissance
- network/port scanning and unauthorised endpoint probing
- attack simulation that requires live attacker infrastructure or data exfiltration
- cloud/Kubernetes/Active Directory/OT skills with no matching project boundary

## Sequential Review Passes

1. **Route pass:** schema validation + security headers + host/forwarded-host checklist.
2. **LLM pass:** direct prompt injection + indirect prompt injection + current structured-output
   gates.
3. **Supply-chain pass:** GitHub Actions + dependency confusion + malicious npm static triage.
4. **Secrets pass:** existing scanner coverage + optional installed local scanners.
5. **Deferred external-action pass:** OAuth scopes + API keys only when private upload or cloud
   providers enter an approved roadmap slice.

Each pass records selected skills, inspected boundaries, safe checks performed, findings, fixes, and
deferred controls in `.ai/security/studio-control-surface-security-review.md`.
