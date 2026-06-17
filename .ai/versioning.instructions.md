# Versioning And Release Notes

The project currently has `package.json` version `0.1.0` and no formal release automation.

## Version Intent

- `0.1.x` - CLI MVP hardening, docs, QA, asset inventory, tooling.
- `0.2.x` - read-only local Next.js Producer Studio routes and shared service contracts.
- `0.3.x` - dashboard approvals and prompt editor.
- `0.4.x` - real Ollama doctor/readiness and improved provider diagnostics.
- `0.5.x` - local TTS behind approval/cost gates.
- `0.6.x` - local render behind approval/cost gates.
- `0.7.x` - private upload behind explicit approval/config.
- `1.0.0` - stable local producer workflow with strong evidence and no public publish by default.

## Release Note Buckets

- Runtime/CLI.
- Safeguards.
- Frontend/dashboard.
- Assets.
- Tests/QA.
- Docs/.ai.
- Tooling/CI.

## Do Not Release As Stable Until

- approval gates are covered by unit and usage tests;
- prompt revisions are attributable;
- evidence bundle reflects current state;
- dashboard and CLI agree;
- upload/public publish remain disabled by default unless deliberately scoped.
