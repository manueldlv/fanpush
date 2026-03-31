# scope-guard

The guard classifies every request before execution.

## Classification

- `safe` - additive UI, additive module work, or backward-compatible extension
- `plan-only` - needs explanation, sequencing, or explicit technical design
- `needs_approval` - structural change that must wait for Matias
- `blocked` - disallowed in this workflow

## Approval Triggers

- DB structure change
- Removal of existing endpoints
- Removal of existing Redux shape
- Security or auth change
- Any breaking API contract change
- Any delete, rename, or narrowing that can break consumers

## Allowlist Examples

- New UI surface
- New module under a new or isolated route
- New endpoint that does not remove an existing one
- New Redux slice
- New Redux keys added to an existing initial state
- New tests, docs, and plans
