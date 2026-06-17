## Summary

-

## Safety And Scope

- [ ] CLI/core remains the workflow source of truth.
- [ ] Upload and public/scheduled publish remain disabled by default.
- [ ] Approval, cost, readiness, and evidence semantics are unchanged or documented.
- [ ] Prompt, asset, or Studio changes update README/ROADMAP/`.ai` when needed.

## Test Plan

- [ ] `pnpm check`
- [ ] `pnpm qa:usage`
- [ ] `pnpm studio:test:e2e` when Studio UI changes
- [ ] `pnpm sonar` when SonarQube is available and the change is broad

## Notes

-
