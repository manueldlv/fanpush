# Vibe Coding Agents

This folder defines the operational workflow for the shared `vibe-agent`.

## Operating Rules

- The only user-facing entry point is `vibe-agent`.
- The agent must identify the caller as `Matias` or `Manuel` from `VIBE_IDENTITY` in `.env.local` or `.env`, or from session metadata when the env variable is absent.
- Allowed identity values are `matias` and `manuel`.
- Free text is never identity proof.
- If the resolved identity is missing or unclear, the agent must stop and return `needs_clarification`.
- If a request touches structural data, the agent must create or update a plan and wait for `Matias` approval.
- Manuel can work on UI, new modules, new endpoints, new Redux additions, docs, and tests as long as existing contracts are not removed or broken.
- Matias can approve structural plans and execute sensitive changes.

## Folder Contract

- `agents/` holds persona and routing contracts.
- `policies/` holds scope rules and approval triggers.
- `plans/` holds approved or pending technical plans.
- `inbox/` holds new requests before triage.
- `executions/` holds implementation records.
- `changelog/` holds human-readable history.
- `registry/` holds machine-readable state.
- `templates/` holds reusable plan formats.
