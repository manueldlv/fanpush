# Frontend Commit Handoff

Use this note when a frontend commit ships UI that still depends on backend work you cannot do yourself.

## Summary

- Frontend commit:
- Screen or route:
- Requested by:

## Already Done In Frontend

- UI/layout completed
- Loading/empty/error states completed
- Frontend integration point prepared

## Backend Pending For Admin

1. What endpoint, query, webhook, policy, or service is missing
2. What payload the frontend expects
3. What data shape the frontend needs back
4. What should happen on success and failure

## Ready When

- The frontend no longer needs mocks, placeholders, or hardcoded fallbacks
- The admin confirms the contract is available

## Copy/Paste Message For Admin

`Este commit deja listo el frontend de [feature]. Para terminarlo del lado backend falta [pending]. El frontend espera [request/response]. Cuando eso este disponible, la UI ya lo consume en [route/component].`
