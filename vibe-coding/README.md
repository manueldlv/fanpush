# Vibe Coding

This folder is the tracked operating system for the shared coding workflow.

## Goal

- One visible agent: `vibe-agent`
- Two user roles: `Matias` and `Manuel`
- Hard approval boundary for structural changes
- Traceable plans, approvals, executions, and changelog entries

## Identity Setup

Set `VIBE_IDENTITY` in `.env.local` for machine-local role resolution.

Allowed values:

- `matias`
- `manuel`

Example:

```dotenv
VIBE_IDENTITY=matias
```

## Layout

- `agents/` - persona contracts and routing rules
- `policies/` - scope and approval policy
- `inbox/` - incoming requests
- `plans/` - draft, pending, and approved plans
- `executions/` - implementation records
- `changelog/` - human readable change history
- `registry/` - machine readable state
- `templates/` - plan templates

## Workflow

1. A request enters `inbox/`.
2. `vibe-agent` runs the scope guard.
3. Safe UI or additive work can execute directly.
4. Structural work becomes a plan.
5. Matias approves or rejects the plan.
6. The execution is recorded.
7. The registry and changelog are updated.

## Frontend To Backend Handoff

If Manuel ships frontend-only work and backend is still pending, record the request in a traceable way instead of hiding it in commit text only.

- Use `templates/frontend-commit-handoff.md` as the short note attached to the frontend commit or delivery message.
- Use `templates/backend-handoff-plan.md` when the backend pending item needs admin review, approval, or a more explicit contract.
- Keep the backend ask concrete:
  - which route or screen depends on it
  - what request payload the frontend will send
  - what response shape the frontend expects
  - how the UI should behave on success or failure
- Backend handoff does not authorize Manuel to change DB, auth, or structural backend scope. It only makes the pending work explicit for Matias/admin.
