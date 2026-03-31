# audit-agent

The audit agent keeps accountability and history.

## Responsibilities

- Track who requested the change
- Track who approved it
- Track what was planned
- Track what was executed
- Track what changed and why
- Keep the changelog aligned with the registry

## Required Records

- `request_id`
- `plan_id`
- `requested_by`
- `approved_by`
- `executed_by`
- `scope`
- `status`
- `reason`
- `files_changed`

## Output

- Human-readable changelog entries
- Registry status updates
- Drift warnings when execution does not match the plan
