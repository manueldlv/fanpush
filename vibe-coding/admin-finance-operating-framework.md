# Admin Finance Operating Framework

## Purpose

This document defines how to design and implement admin features that touch money, balances, roles, moderation side effects, and operational reporting in FanPush.

It exists to avoid three common failures:

- UI that shows totals without a reliable source of truth.
- backend flows that partially succeed and leave misleading state behind.
- database models that hide business differences under ambiguous fields.

The rule for this area is simple:

- model the business truth first
- encode it in backend and persistence second
- let the UI explain that truth without inventing it

## Scope

Use this framework for work related to:

- admin dashboard metrics
- purchases and tips
- sales and creator balances
- withdrawal requests and withdrawal history
- promotion, commission, and payout metadata
- moderation or account states that affect finance or visibility
- any reporting surface that aggregates money, status, or operational throughput

## Core Programming Rule

No admin number, badge, status, or action should exist unless all of the following are clear:

1. what the concept means in business terms
2. where the source of truth lives
3. which states count and which do not
4. how the value can be audited later
5. what happens if the operation fails halfway

If any of those answers is unclear, stop and define them before building UI.

## Domain Modeling Rules

### 1. Define semantic meaning before fields

Never create or reuse a field only because it is convenient for a screen.

Every field must answer:

- what it represents
- whether it is canonical or derived
- whether it is operational, financial, visual, or audit-only
- whether null is a valid business state

Examples:

- `created_at` is not the same as `settled_at`
- `withdrawal status` is not the same as `ledger impact`
- `visible total` is not the same as `canonical total`
- `promotion state` is not the same as `author role`

If two concepts behave differently, model them separately.

### 2. Separate operational, financial, and visual data

For every feature, distinguish three layers:

- operational data: what happened in the product
- financial data: what impacted balances, commissions, or payout state
- visual data: how admin sees summaries, cards, badges, and drilldowns

The UI may group or label data, but it must not become the place where those meanings are defined.

### 3. One source of truth per metric

Each admin metric must declare:

- canonical table or repository
- allowed statuses
- grouping key
- currency unit
- rounding rule
- exclusion rules

Never mix totals from multiple unrelated paths in the UI without a backend definition that explains the aggregation.

### 4. Derived values must be identifiable

If a value is cached, precomputed, or summarized, the code must make that obvious.

Use naming and comments that distinguish:

- canonical record
- derived summary
- cached display field
- computed view model

Do not present a derived value as if it were the canonical ledger fact.

## Backend Rules

### 5. Critical rules live in backend

Any rule that affects one of these belongs to backend or database constraints, not only frontend:

- balances
- purchases
- withdrawals
- commissions
- author/admin permissions
- moderation states with financial consequences
- reporting filters that define totals

Frontend may validate obvious input, but backend decides validity.

### 6. Partial success is not acceptable

If a flow creates or updates multiple records, the visible outcome must be either:

- complete
- not applied

Avoid:

- state changes without the corresponding ledger or history update
- records created without the related side effects
- UI saying a change failed when persistence already mutated business state

Use one of these strategies explicitly:

- database transaction
- idempotent command with strong post-conditions
- manual compensation that reverts prior writes

The strong rule is:

- if it failed, it must not look successful

### 7. Commands and queries should be separated

For admin and finance code, prefer a clear split between:

- commands: mutate business state
- queries: read reporting or operational views

This reduces the risk of mixing write logic, aggregation logic, and presentation shaping in one place.

Recommended layering:

- route/controller: request and response adaptation
- service/use case: business intent and invariants
- repository: persistence and fetch details
- serializer/view model builder: admin-facing shape

### 8. Idempotency for sensitive actions

Any action that may be retried by network, UI, or operator behavior should be designed to avoid duplicate effects.

Examples:

- approving a purchase
- creating ledger movements
- marking a withdrawal as sent
- applying a promotion change

When duplication is dangerous, define:

- idempotency key or unique business key
- repeat behavior
- safe retry path

## Database and Persistence Rules

### 9. Database must reflect the real business model

Do not force fake values to satisfy an old schema.

If business truth allows absence, use nullable fields and clear rules.

Bad pattern:

- fake enum value or fake relation only to satisfy schema shape

Good pattern:

- optional relation plus explicit handling of the missing business case

### 10. Migrations are part of the feature

When business meaning changes, TypeScript updates are not enough.

A structural change requires:

- migration
- backfill or compatibility strategy when needed
- review of existing reads and writes
- validation of downstream reporting impact

If the schema and code disagree, the schema wins at runtime.

### 11. Auditability over convenience

Critical admin numbers must be explainable after the fact.

Persist enough data to reconstruct:

- who acted
- on what entity
- when it happened
- previous state
- new state
- financial side effect, if any
- reason or note, if required

If a total cannot be drilled down or reconstructed, it is not production-safe enough for admin use.

## UI and UX Rules

### 12. UI explains system state, it does not define it

The admin UI should:

- capture operator intent
- show current state
- expose reasons, constraints, and drilldowns
- prevent obvious mistakes

The admin UI should not:

- invent totals client-side from mixed sources without backend contract
- silently reinterpret business states
- hide missing data under decorative labels

### 13. Internal UX favors clarity over novelty

For internal tools, ambiguity is more dangerous than visual plainness.

Prefer:

- explicit statuses
- clear money labels
- action labels that distinguish mutate vs classify vs dismiss
- empty states that explain why data is absent
- drilldowns for critical totals

Avoid:

- overloaded badges with unclear meaning
- destructive actions that look harmless
- totals without date range or state definition
- multiple screens that use the same label with different logic

### 14. Critical numbers need drilldown

Every important total should have at least one of:

- linked detail table
- expandable breakdown
- tooltip with calculation rule
- traceable API response shape

No black-box numbers for:

- gross sales
- platform share
- creator share
- pending withdrawals
- sent withdrawals
- rejected withdrawals
- promotions affecting payout or visibility

### 15. Consistency across screens

If a concept exists across admin, creator, and user views, define it once and reuse the same rule everywhere.

Examples:

- withdrawal statuses
- creator balance meaning
- purchase approval criteria
- payout profile completeness
- blocked account finance access rules

Do not let each screen define its own local truth.

## Financial Safety Rules

### 16. Explicit currency and rounding policy

All money-sensitive code must define:

- storage unit
- display unit
- rounding behavior
- aggregation order

Do not rely on ad hoc formatting or float-like behavior hidden inside UI code.

### 17. Reconciliation strategy

Every finance-facing area should answer:

- what is the canonical source if totals disagree
- how to recompute the number from base records
- how to detect drift between dashboard summaries and ledger-like records
- which tables are authoritative versus convenience reads

If reconciliation is impossible, the design is incomplete.

### 18. Invariants must be writable in plain language

For each feature, define invariants as short statements.

Examples:

- an approved purchase counts once and only once
- a sent withdrawal must correspond to a prior requested withdrawal
- a rejected withdrawal must not remain available as sent in summaries
- a balance-affecting action must leave an auditable trace

If a team member cannot state the invariant clearly, the code is likely under-modeled.

## Delivery Pattern For New Admin Features

Every new admin feature should pass this checklist before UI polish:

1. What is the business meaning of the data?
2. Is it operational, financial, visual, or mixed?
3. What is the canonical source of truth?
4. Which statuses or transitions are valid?
5. Does it affect balances, payout, or ledger-like totals?
6. Can it legitimately be null or absent?
7. What happens if the flow fails after the first write?
8. How does admin audit the number or action later?
9. Does the feature require a migration?
10. Does the UI expose drilldown for critical totals?

## Recommended Implementation Pattern

When building admin and finance surfaces, prefer this sequence:

1. define business vocabulary and invariants
2. verify schema and migration needs
3. define repository contract and query shape
4. implement backend command/query logic
5. define admin view model and serialization
6. implement UI against stable contracts
7. validate totals and drilldowns with seed or fixture data

Do not start from visual layout when the feature includes money, balances, or approval flows.

## Rule Mother

For this repository, the governing rule for admin and finance work is:

- no UI should tell the operator that something failed if the system already left business data mutated
- no metric should be shown if its source, status filter, and audit path are unclear
- no business concept should be collapsed just because two labels look similar on screen
