# Scope Policy

This policy controls what Manuel and Matias can do through `vibe-agent`.

## Default Rule

- `Add` is allowed by default.
- `Edit` is allowed only if it preserves existing contracts and behavior.
- `Remove` is forbidden by default.

## Manuel Can Add

- New UI components
- New screens and route-level modules
- New CSS and visual polish
- New helpers and utilities
- New tests and documentation
- New Redux slices, actions, reducers, and selectors
- New fields in Redux initial state, if existing keys remain intact
- New API endpoints
- New backward-compatible fields in existing API responses
- New plan documents and changelog entries

## Manuel Can Edit

- UI composition if the existing flow stays intact
- Styles and layout if the behavior remains compatible
- Redux state shape only when it is an additive change
- API handlers only when the contract stays backward compatible
- New modules that are not wired into critical data flows

## Manuel Cannot Remove

- Existing DB tables, columns, constraints, or indexes
- Existing API endpoints
- Existing Redux slices, reducers, actions, selectors, or initial state keys
- Existing auth or security logic
- Existing services that other modules depend on
- Existing behavior unless Matias approves the plan

## Structural Change Triggers

These always require a plan and explicit Matias approval:

- DB structure changes
- Endpoint removal or contract breakage
- Redux reduction, rename, or shape breakage
- Auth or security changes
- Service layer changes with cross-cutting impact
- Any rename or deletion that can break existing consumers

## Decision Labels

- `safe` - can execute now
- `plan-only` - must document first, no execution
- `needs_approval` - Matias must approve the plan
- `blocked` - not allowed in this workflow
