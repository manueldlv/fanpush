# Backend Handoff Plan Template

## Metadata

- `id`
- `title`
- `requested_by`
- `owner`: `matias`
- `status`: `pending_admin_review`
- `scope`: `needs_approval`
- `type`: `backend_handoff`
- `frontend_commit`

## Frontend Context

- What frontend changed
- Which route or screen depends on backend work
- What is already working from the UI side

## Backend Work Needed

1. Endpoint or service to create or adjust
2. Expected request shape
3. Expected response shape
4. DB or auth dependency if it exists

## Acceptance Criteria

- What the admin/backend side must leave working
- How frontend will know it is ready

## Not Allowed

- No breaking changes to existing contracts
- No removal of existing fields without approval
- No auth or security narrowing without approval

## Validation

- `npm run build`
- Manual UI check on the affected screen
- Admin confirms backend contract is ready

## Admin Notes

- Risk level
- Migration needed or not
- Env vars needed or not
