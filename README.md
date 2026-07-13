# Hardbusiness Monorepo

Hardbusiness is a unified workspace for the SME trade-finance product. The repo brings together the frontend, backend, and smart contracts that support verified business discovery, deal workspaces, USDC escrow flows, contracts, payments, and reputation.

## What Lives Where

- `frontend/` - React + Vite app for onboarding, discovery, workspaces, contracts, and payments.
- `backend/` - API server, shared backend libraries, smoke scripts, and generated API artifacts.
- `smart-contract/` - Hardhat 3 contract project, deployment helpers, tests, and contract docs.
- `backend-architecture.md`, `frontend-architecture.md`, `deal-workspace-architecture.md` - design notes and implementation context.
- `PITCH.md` - submission pitch and Circle/Arc framing.

## Prerequisites

- Node.js 20+.
- pnpm.
- Backend and contract environment variables as described in their local `.env` files.

## Install

Run installs from the repository root:

```bash
pnpm install
```

The root is a pnpm workspace, so package installs are shared across the three projects.

## Common Commands

Frontend:

```bash
pnpm --dir frontend dev
pnpm --dir frontend build
pnpm --dir frontend lint
```

Backend:

```bash
pnpm --dir backend build
pnpm --dir backend typecheck:libs
```

Contracts:

```bash
pnpm --dir smart-contract test
pnpm --dir smart-contract exec hardhat test
pnpm --dir smart-contract exec hardhat ignition deploy ignition/modules/Counter.ts
```

Workspace-wide:

```bash
pnpm build
pnpm typecheck
```

## Development Flow

1. Start with the frontend for product work and UI integration.
2. Use the backend API as the source of truth for auth, onboarding, discovery, workspaces, contracts, payments, and reputation.
3. Keep smart-contract changes isolated to `smart-contract/` and validate them with the Hardhat test flow before deployment.
4. Use the backend smoke scripts in `backend/tmp-*.mjs` when you need to validate API flows against live data.

## Notes

- The old separate git roots for `backend/` and `smart-contract/` were backed up as `.git.backup` folders during repo unification.
- Avoid editing build outputs under `frontend/dist`, `backend/node_modules`, `smart-contract/artifacts`, or `smart-contract/cache`.
- The frontend is now wired to backend-backed auth and workspace flows rather than the old Base44 scaffolding.
