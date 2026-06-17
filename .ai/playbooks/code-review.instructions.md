# Code Review Playbook

Lead with findings.

Check:

- illegal state transitions;
- inferred approvals;
- artifact writes before failed guards;
- missing ledger events;
- budget calculations that ignore cumulative limits;
- upload/publish paths enabled by default;
- future frontend route handlers mutating state directly;
- tests that cover happy path only.

If no findings, state residual risk and test gaps.
