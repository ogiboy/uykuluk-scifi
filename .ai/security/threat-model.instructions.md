# Threat Model

## Protected Properties

- Approval gates.
- Cost controls.
- Upload/public publish lock.
- Run evidence integrity.
- Local config and secrets.
- Visual asset provenance.
- Future web route mutation boundaries.

## Key Risks

- A generated artifact being treated as approval.
- A future dashboard action bypassing CLI/core validation.
- Public publish accidentally enabled by config default.
- Provider errors hiding paid or network behavior.
- QA artifacts leaking local paths or future tokens.
- Large generated media files entering git or review tools.

## Current Controls

- Strict state machine.
- Approval records persisted in state and ledger.
- Guard blocked events.
- Mock default provider.
- YouTube disabled by default.
- Usage smoke with negative gate checks.
- CodeRabbit pre-merge checks.
