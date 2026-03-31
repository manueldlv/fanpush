# Vibe Coding Plugin

This plugin exposes the shared `vibe-agent` workflow in Codex.

## What It Does

- One visible agent for Manuel and Matias
- Internal scope guard for approval routing
- Plan, execution, and audit tracking
- Safe UI-only execution without structural drift

## Identity Setup

Set `VIBE_IDENTITY` in `.env.local` for machine-local role resolution.

Allowed values:

- `matias`
- `manuel`

Example:

```dotenv
VIBE_IDENTITY=matias
```
