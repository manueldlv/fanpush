# Repository Guidelines

## Project Structure & Module Organization
This repository is a Next.js 14 App Router project. Route pages and API handlers live in `app/`, including dynamic routes such as `app/user/[username]/page.tsx` and server endpoints under `app/api/**/route.ts`. Shared UI lives in `components/`. Business logic and helpers are split between `lib/` and `services/`. Static assets are stored in `public/`, global styles in `app/globals.css` and `styles/globals.css`, and Supabase setup SQL in `supabase/setup.sql`.

## Build, Test, and Development Commands
Use `npm install` to install dependencies.

- `npm run dev`: builds and serves locally on `127.0.0.1:3000` via `scripts/run-local-stable.sh`.
- `npm run dev:watch`: starts `next dev` with the safer cleanup wrapper in `scripts/dev-safe.sh`.
- `npm run dev:mobile`: serves on `0.0.0.0:3000` for device testing.
- `npm run build`: production build with `next build`.
- `npm run start`: runs the production server.
- `npm run lint`: runs ESLint across the repo.
- `npm run format` / `npm run format:check`: apply or verify Prettier formatting.

## Coding Style & Naming Conventions
TypeScript is configured in strict mode with the `@/*` import alias. Follow the existing code style: React components in `PascalCase`, hooks and utilities in `camelCase`, and route folders in lowercase. Prefer functional React components and keep route-specific code close to its page or API handler. Formatting is enforced with Prettier; linting uses `eslint-config-next` plus `eslint-config-prettier`.

## Testing Guidelines
There is no dedicated automated test suite in the repository yet. Until one is added, treat `npm run lint` and `npm run build` as the minimum validation before opening a PR. When adding tests, place them near the feature or in a focused `__tests__/` directory, and use names like `feature-name.test.ts` or `ComponentName.test.tsx`.

## Commit & Pull Request Guidelines
Recent commits are short and inconsistent (`fix3`, `25 03`), so use clearer messages going forward. Prefer imperative, scoped subjects such as `feat: add Mercado Pago return handling` or `fix: guard missing profile data`. PRs should include a concise description, impacted routes or APIs, linked issue if available, and screenshots for UI changes. Note any required environment variables or Supabase setup changes explicitly.

## Configuration Tips
Review integrations in `services/supabase`, `services/mercadopago.ts`, and `services/cloudinary.ts` before changing auth, payments, or media flows. Keep secrets out of the repo and document new environment variables in the PR.

## Vibe Coding Workflow
This repository includes a versioned agent workflow under `vibe-coding/` and a Codex plugin under `plugins/vibe-coding/`. Treat the plugin as the runtime source of truth and the repo docs as the human-readable mirror.

- Read `plugins/vibe-coding/AGENTS.md` before editing anything in the plugin workflow.
- Resolve the caller identity from `VIBE_IDENTITY` in `.env.local` or `.env` when available. Allowed values are `matias` and `manuel`.
- Use `plugins/vibe-coding/policies/scope.md` to decide whether a change is `safe`, `plan-only`, `needs_approval`, or `blocked`.
- Use `plugins/vibe-coding/agents/vibe-agent.md` as the single front door for both Matias and Manuel.
- Use `vibe-coding/registry/index.json` as the human-readable state registry for plans, approvals, and execution status.
- Store new requests in `vibe-coding/inbox/`, approved plans in `vibe-coding/plans/`, execution records in `vibe-coding/executions/`, and human-readable history in `vibe-coding/changelog/`.
- Matias can approve structural changes. Manuel can request and execute only scope-safe additions and UI work. Anything that removes, narrows, or breaks an existing contract must become a plan and wait for Matias approval.
