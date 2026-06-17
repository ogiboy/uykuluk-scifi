# Security Policy

UykulukSciFi Producer is local-first and approval-gated. Security reports are welcome when they
affect operator safety, secret handling, generation boundaries, artifact integrity, local web
surfaces, or future upload/publish controls.

## Supported Versions

The project is pre-1.0. Security fixes target `main` and active module branches.

| Version / branch          | Supported   |
| ------------------------- | ----------- |
| `main`                    | yes         |
| active module branches    | yes         |
| older prerelease branches | best effort |
| modified local forks      | no promise  |

## What To Report

Please report vulnerabilities or hardening issues involving:

- bypassed idea, script, render, upload, or publish approval gates;
- public or scheduled YouTube publishing becoming possible by default;
- provider API keys, Sonar tokens, YouTube credentials, session cookies, or private keys leaking;
- local Studio route handlers accepting unsafe mutating requests;
- prompt overrides silently changing active runs or hiding prompt hashes from evidence;
- evidence bundles, run artifacts, logs, QA artifacts, or scanner output exposing secrets;
- subprocess helpers executing unexpected commands or losing ownership boundaries;
- downloaded or generated media assets with unclear provenance or unsafe embedded content.

Out of scope:

- quality complaints about generated creative output;
- claims that require public publishing, because public publish is intentionally blocked;
- social engineering or denial-of-service against third-party services.

## How To Report

Use GitHub private vulnerability reporting when available. If it is not available, open a minimal
public issue saying that you have a security report without posting exploit details, secrets, or
private artifacts.

Include:

- affected branch or commit;
- affected command, route, workflow, or artifact;
- reproduction steps;
- expected and actual behavior;
- whether secrets, local files, YouTube state, prompts, or generated assets are involved;
- suggested mitigation if you have one.

Do not include real API keys, Sonar tokens, OAuth credentials, account identifiers, or full runtime
artifacts in public issues.

## Security Posture

The intended defaults are:

- local-first operation;
- mock provider by default;
- no paid provider calls without explicit future configuration;
- manual approvals before script packaging, rendering, upload, or publish;
- upload and public/scheduled publish disabled by default;
- Studio routes as thin local wrappers around typed core services;
- secrets only in ignored local env/config files;
- evidence and QA artifacts redacted before sharing.

Any change that weakens these defaults should be treated as a security regression unless an explicit
architecture decision accepts the risk.
