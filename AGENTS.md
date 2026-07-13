# Repository Guidelines

## Project Structure & Module Organization
This repository is now organized as a single pnpm workspace with three top-level apps: `frontend` for the Vite/React UI, `backend` for the API and shared backend libraries, and `smart-contract` for the Hardhat contract suite. The backend workspace contains multiple packages under `backend/lib/*` and API artifacts under `backend/artifacts/*`; those are source packages, not generated output. The contract project keeps its Solidity sources under `smart-contract/contracts` and Hardhat deployment helpers under `smart-contract/ignition`.

## Build, Test, and Development Commands
Use the root scripts for cross-repo tasks: `pnpm build` runs build scripts across the workspace, `pnpm typecheck` runs package type checks, `pnpm frontend:dev` starts the UI, `pnpm frontend:build` builds the UI, `pnpm backend:build` builds the backend, `pnpm contracts:test` runs the Hardhat test suite, and `pnpm contracts:deploy` runs the sample Ignition deployment from `smart-contract/README.md`.

## Coding Style & Naming Conventions
The frontend uses ESLint with a Vite/React setup; keep JSX component files under `frontend/src` and prefer the existing path alias style (`@/...`). The backend uses TypeScript workspace packages with pnpm-managed dependencies. Contract work follows Hardhat 3 conventions and TypeScript config in `smart-contract`.

## Testing Guidelines
Frontend changes should at minimum pass `pnpm --dir frontend lint`. Backend changes should pass `pnpm --dir backend build` or the package-specific type check flow. Contract changes should pass `pnpm contracts:test` before deployment work. Avoid editing generated outputs under `smart-contract/artifacts`, `smart-contract/cache`, or deployment folders.
