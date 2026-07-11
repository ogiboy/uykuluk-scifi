# Security Skills Routing (Anthropic-Cybersecurity-Skills)

Use this route only for defensive, repo-scoped security review and repo security-boundary design decisions.

## Scope

Apply this file when work affects:

- Studio action routes and route-security contract changes.
- Local sessions, CSRF, same-origin, and loopback checks.
- CLI command execution and subprocess boundaries.
- Temp-file and artifact read/write safety.
- Path traversal and symlink/hardlink protections.
- Provider adapters, network boundaries, and prompt/tool injection risks.
- Upload/publish boundaries and disabled external actions.
- OAuth, secrets, CI/CD, release, dependency, and supply-chain controls.

## Library discovery (required before review)

The security library is intended for guidance only and must **not** be imported in runtime.

Before each review, verify the current workspace's security-skill catalog and installed bodies.
`skills-lock.json` may record discovery metadata and ignored `.agents/skills/` may contain local
skill bodies, but neither availability nor a specific module may be assumed across clones or CI.
Neither path is a runtime input.

Recommended modules for this repository (selected per review slice):

- `implementing-api-schema-validation-security`
- `implementing-secrets-scanning-in-ci-cd`
- `securing-github-actions-workflows`

If the local install or a recommended module is unavailable, record that limitation in the review
report and use `<workspace>/.agents/skills` only as a configurable placeholder. Never invent an
absolute path.
Inspect only folder names plus index/frontmatter/README/catalog metadata before selecting a skill.

The curated repository map and review status live in
`.ai/security/anthropic-security-skill-catalog.md`. Use that map before searching the full catalog,
but refresh it when a new security boundary is introduced.

## Skill selection discipline

1. Load only 1–3 relevant skills for a single review pass.
2. Prefer the most specific defensive skill for the area being reviewed.
3. Do **not** load offensive, offensive simulation, malware, phishing, network scanning, or exploit payload skills.

Recommended starting security review categories for this repository:

- Route/session/payload review: `implementing-api-schema-validation-security`.
- Secrets and credential review: `implementing-secrets-scanning-in-ci-cd`.
- CI/release/supply-chain review: `securing-github-actions-workflows`.

For file-path, provider, prompt/tool-injection, OAuth, or dependency work, search catalog names first
and select the narrowest defensive module. Do not open unrelated skill bodies.

## Non-goals

Do not use this route for:

- UI polish
- copywriting or asset design
- render visual rhythm tuning
- simple lint/type errors
- non-security docs except routing/contracts/security review evidence

## Safe boundaries

- The library is **development-time only** and must never become a runtime dependency.
- Do not add it to `package.json` or ship-time module import paths.
- Do not run offensive tools, exploit public targets, generate exploit payloads, weaken guards, add
  network scanning, or add malware/red-team behavior.

## Deliverables mapping

Security review outputs should become:

- tests or negative fixtures when behavior is testable,
- targeted docs/routing updates,
- guards or safer defaults,
- evidence/readiness updates,
- or explicit deferred-in-design notes.

## Operational reminder

For this project, Studio remains a guarded local control surface over CLI/core. Local-first and deterministic defaults must stay intact, and upload/publish remain disabled unless explicitly enabled by roadmap and route metadata.
