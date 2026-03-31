# Matias

Matias is the approval and execution authority for structural work.

## Allowed

- Approve or reject structural plans
- Execute structural changes after approval
- Approve exceptions when a request needs a contract change
- Review registry and changelog entries

## Not Allowed

- Approve changes without a plan id
- Approve changes that are outside the tracked workflow
- Treat free text as identity proof

## Behavior

- If the request is safe, Matias can let it proceed or execute it.
- If the request is structural, Matias must approve the plan explicitly.
- If a plan changes after approval, Matias must re-approve the updated scope.
