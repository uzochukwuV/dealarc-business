---
name: B2B Deal Network Backend
description: Full backend built on Express + Drizzle + PostgreSQL; key decisions on auth, Circle wallets, on-chain identity, encryption, Orval/Zod compat, and multer.
---

## Auth
- Custom HS256 JWT via `node:crypto`, `SESSION_SECRET` env var.
- PBKDF2 password hashing (no bcrypt).
- Admin gate: `ADMIN_USER_IDS` comma-separated UUIDs in env var.

## Circle Wallets (developer-controlled)
- **Two separate wallet sets**: `CIRCLE_WALLET_SET_ID` (original, user-controlled/general) vs `CIRCLE_DEV_WALLET_SET_ID` (developer-controlled, needed for org wallets).
- Entity secret flow: fetch Circle's RSA public key (`GET /v1/w3s/config/entity/publicKey`), then RSA-OAEP-SHA256 encrypt the 32-byte hex `CIRCLE_ENTITY_SECRET`. Public key is cached in memory.
- `createOrgWallet` → `POST /v1/w3s/developer/wallets` with `entitySecretCiphertext`.
- `initiateTransfer` → `POST /v1/w3s/developer/transactions/transfer` with `entitySecretCiphertext`.
- **First-time setup**: call `POST /api/admin/setup/circle` (admin auth required) to create the developer wallet set via API, then save the returned `walletSetId` as `CIRCLE_DEV_WALLET_SET_ID` secret.

## On-Chain Identity (Polygon Amoy)
- Identity contract: `0x754DD9f8A8Eef03744738072Cfbb985Db769C7f9`
- Reputation contract: `0x7Ed0dd653C8Adf33438255bFFDbc2D43ED5d8119`
- VerificationRegistry: `0xbcC26e56724C96e5c8DFf90647360F9E9a9c0a65`
- All ABIs exported as TypeScript consts from `artifacts/api-server/src/contracts/abis.ts` (not JSON imports — avoids resolveJsonModule issues with isolatedModules).
- `registerIdentity(walletAddress, keccak256(orgId))` — called by platform signer (PLATFORM_PRIVATE_KEY) on org creation. The org's Circle wallet address becomes the on-chain identity owner.
- Reputation is mapping-based — no registration call needed; starts at zero; updated by authorized deal templates.
- Required env vars: `BLOCKCHAIN_RPC_URL`, `PLATFORM_PRIVATE_KEY` (contract owner account, needs MATIC for gas).

## Org Creation Flow (POST /organizations)
Sequential, all best-effort (errors logged, org still created):
1. Insert org row + add creator as OWNER member.
2. Create Circle developer-controlled wallet → get `address`.
3. Call `Identity.registerIdentity(address, keccak256(orgId))` via ethers v6 → get `identityId`.
4. Insert wallet row with `onChainIdentityId` + `identityTxHash`.
Response includes `provisioning` object with all results and any errors.

## DB Schema
- `wallets` table has `on_chain_identity_id` (text) and `identity_tx_hash` (text) columns (added via drizzle push).

## Build Notes (esbuild)
- `ethers` v6 bundles fine — pure JS, no native modules.
- JSON imports avoided (no `resolveJsonModule` in base tsconfig + `isolatedModules: true`). Use `.ts` files exporting ABI consts instead.
- `multer` and `js-yaml` must be bundled (not externalized) — pnpm virtual store prevents runtime resolution.
- Circle wallet name metadata must be ≤50 chars.

## Orval / Zod Compat
- All OpenAPI schemas need `additionalProperties: false` (avoids `z.looseObject()`).
- Remove `format: email` (causes `z.email()` which doesn't exist in Zod 3.x).
- Remove `format: binary` (causes `Blob`/`File` types).
