# Vibe Coding Plugin

This plugin provides the runtime agent workflow for the repository.

## Runtime Rules

- `vibe-agent` is the only visible front door.
- Identity must come from `VIBE_IDENTITY` in `.env.local` or `.env`, or from session metadata when the env variable is absent.
- Allowed identity values are `matias` and `manuel`.
- Free text is never identity proof.
- If the resolved identity is missing or invalid, stop with `needs_clarification`.
- Safe additive UI work can execute directly.
- Structural work always becomes a plan and waits for Matias approval.
- Manuel can request and execute safe work only.
- Matias can approve structural plans and execute sensitive changes.

## Files

- `agents/` contains the runtime agent contracts.
- `policies/` contains the scope and approval rules.
- `registry/` keeps machine-readable state.
