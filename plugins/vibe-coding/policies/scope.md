# Scope Policy

## Default Rule

- `Add` is allowed by default.
- `Edit` is allowed only when it preserves compatibility.
- `Remove` is forbidden by default.

## Manuel Can Add

- New UI components
- New routes and screens
- New helpers and utilities
- New tests and documentation
- New Redux slices, actions, reducers, and selectors
- New fields in Redux initial state if existing keys stay intact
- New endpoints
- New backward-compatible fields on existing endpoints

## Manuel Cannot Remove

- Existing DB structures
- Existing endpoints
- Existing Redux slices or keys
- Existing auth or security behavior
- Existing services or cross-cutting logic

## Structural Triggers

These always require a plan and Matias approval:

- DB structure changes
- Endpoint removal or breaking changes
- Redux shape reduction or rename
- Security or auth changes
- Any delete, rename, or narrowing that can break consumers
