# Backend Architecture — Verified B2B Deal Network (MVP)

**Scope of this document:** backend service design for registration + manual (mocked) verification, IPFS-based document storage, and Circle wallet integration. Discovery, deal-room, and settlement-contract design are referenced only where they touch these three systems.

---

## 1. Design principles

1. **Public discovery data lives in Postgres. Sensitive documents live encrypted on IPFS. Settlement proofs live onchain.** Nothing sensitive is ever written in plaintext to a public store.
2. **KYC is mocked, not faked-in-a-way-that's-hard-to-replace.** Real registration flow, real data model, real admin review queue — the only thing missing is an actual KYC provider call. Swapping in Persona/Sumsub later should mean adding a service, not rewriting the model.
3. **Circle wallets are provisioned automatically at registration**, not as a separate "connect wallet" step. Business users should never see the word "wallet" if we can help it.
4. **Every state-changing action is logged.** Verification decisions, document access, wallet actions — all auditable.

---

## 2. High-level architecture

```text
                         ┌─────────────────────┐
                         │   Frontend (web)     │
                         └──────────┬───────────┘
                                    │ HTTPS/REST
                         ┌──────────▼───────────┐
                         │     API Gateway       │  (auth, rate limit)
                         └──────────┬───────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                            │
┌───────▼────────┐        ┌─────────▼─────────┐        ┌─────────▼─────────┐
│  Core Backend    │        │  Verification      │        │  Wallet Service    │
│  (org, users,     │◄──────►│  Service           │        │  (Circle SDK       │
│   deals, search)   │        │  (mock KYC + admin)│        │   wrapper)         │
└───────┬────────┘        └─────────┬─────────┘        └─────────┬─────────┘
        │                           │                            │
┌───────▼────────┐        ┌─────────▼─────────┐        ┌─────────▼─────────┐
│   Postgres       │        │   Postgres          │        │   Circle API        │
│  (public +        │        │  (verification      │        │  (user-controlled + │
│   encrypted-field  │        │   cases, admin log) │        │   dev-controlled     │
│   private data)    │        └────────────────────┘        │   wallets)           │
└───────┬────────┘                                          └────────────────────┘
        │
┌───────▼────────┐
│  Document Service │
│  (encrypt, pin,    │
│   hash-anchor)     │
└───────┬────────┘
        │
┌───────▼────────┐
│  IPFS (pinned via  │
│   Pinata/Web3.Storage)│
└────────────────────┘
```

Everything is a monolith-with-clear-modules at MVP stage — Core Backend, Verification Service, Wallet Service, and Document Service can be separate NestJS/Express modules in one deployable, split into services later if load demands it.

**Suggested stack:** Node.js + TypeScript (NestJS), Postgres, Redis (sessions/queues), BullMQ (async jobs — pinning, wallet creation retries), S3-compatible bucket as a local cache in front of IPFS pinning.

---

## 3. Domain model

```text
Organization
 ├── id, legal_name, trading_name, country, industry, regions_served
 ├── registration_number, tax_id (encrypted)
 ├── verification_status: UNVERIFIED | PENDING | VERIFIED | REJECTED | EXPIRED
 ├── public_profile (jsonb: products, certifications, description)
 ├── created_at, updated_at

OrganizationMember
 ├── id, organization_id, user_id, role (OWNER | ADMIN | FINANCE | MEMBER)
 ├── is_authorized_signer: boolean
 ├── invited_by, joined_at, revoked_at

User
 ├── id, email, phone, auth_provider_id
 ├── created_at

VerificationCase   (this is the "mock KYC" object)
 ├── id, organization_id
 ├── status: SUBMITTED | IN_REVIEW | APPROVED | REJECTED | MORE_INFO_NEEDED
 ├── submitted_documents: [DocumentRef]
 ├── reviewer_admin_id
 ├── decision_notes
 ├── decided_at

DocumentRef
 ├── id, organization_id, doc_type (REGISTRATION_CERT | ID | PROOF_OF_ADDRESS | OTHER)
 ├── ipfs_cid (of the *encrypted* blob)
 ├── content_hash (sha256 of plaintext, for integrity proof)
 ├── encryption_key_ref (pointer into KMS, not the key itself)
 ├── uploaded_by, uploaded_at

Wallet
 ├── id, organization_id, circle_wallet_id, blockchain_address, chain
 ├── wallet_type: USER_CONTROLLED | DEVELOPER_CONTROLLED
 ├── purpose: TREASURY | PROCUREMENT | SALES_RECEIPT | PLATFORM
 ├── created_at
```

---

## 4. Registration & manual verification flow (mocked KYC)

No third-party KYC call. Real document upload, real admin review, real audit trail — just no automated identity check yet.

```text
1. User signs up (email/social) → User row created
2. User creates Organization → Organization row, status = UNVERIFIED
   - creator becomes OWNER + is_authorized_signer = true
3. Org uploads: registration certificate, proof of address,
   representative ID → each file:
     a. encrypted client-side or at ingest (see §5)
     b. pinned to IPFS → ipfs_cid stored
     c. sha256 hash stored for integrity
   → VerificationCase created, status = SUBMITTED
4. Wallet Service auto-provisions a Circle user-controlled wallet
   for the org (org can transact only in limited/no-escrow mode
   until VERIFIED — enforced by policy engine, not by wallet itself)
5. Admin dashboard shows queue of SUBMITTED / IN_REVIEW cases
6. Admin opens case → views decrypted documents (via scoped,
   logged access) → APPROVE / REJECT / REQUEST_MORE_INFO
7. On APPROVE:
   - Organization.verification_status = VERIFIED
   - VerificationAttestation issued (signed record, see §4.1)
   - Org unlocked for escrow-eligible deal templates
8. On REJECT / MORE_INFO:
   - Org notified, can resubmit → new VerificationCase
```

### 4.1 Verification attestation (forward-compatible with real KYC)

Even though the check is manual, model the *output* the same way a real KYC provider's output would look, so nothing downstream needs to change later:

```json
{
  "organizationId": "org_123",
  "claim": "KYB_VERIFIED",
  "issuer": "platform-admin",       // later: "persona" | "sumsub"
  "reviewerId": "admin_42",
  "issuedAt": "2026-07-12T10:00:00Z",
  "expiresAt": "2027-07-12T10:00:00Z",
  "revoked": false
}
```

Store this as its own `VerificationAttestation` table, not just a status flag on `Organization`. The deal-eligibility policy engine (§6) checks the attestation, not the raw status — this is the seam where a real KYC provider slots in later without touching any deal logic.

### 4.2 Admin review requirements

- Every document view by an admin is logged: `admin_id, document_id, timestamp, reason`.
- Admins should not have standing decrypt access — access is granted per-review-session and expires (see §5.3).
- Two-person review optional toggle for orgs above a configurable transaction-limit tier.

---

## 5. IPFS document storage

### 5.1 What goes on IPFS vs. Postgres

| Data | Location |
|---|---|
| Public org profile (name, industry, products) | Postgres, plaintext |
| Registration cert, ID docs, proof of address | IPFS, **encrypted** |
| Contracts, invoices, delivery evidence, private pricing | IPFS, **encrypted** |
| Document metadata (who uploaded, type, timestamp) | Postgres, plaintext |
| Document content hash (sha256) | Postgres, plaintext (used for integrity proofs, and optionally anchored onchain) |
| Encryption key material | KMS (AWS KMS / GCP KMS) — never in Postgres, never on IPFS |

IPFS is a *content store*, not an access-control layer — anyone with a CID can fetch the raw bytes from any node/gateway. Therefore: **never upload plaintext.** Encryption happens before pinning, always.

### 5.2 Upload flow

```text
1. File selected for upload
2. Backend generates a per-document data key (DEK) via KMS
3. File encrypted with DEK (AES-256-GCM)
4. Encrypted blob pinned to IPFS (via Pinata or Web3.Storage API)
   → returns CID
5. DEK itself is encrypted with the organization's KMS key (envelope
   encryption) and stored as encryption_key_ref
6. sha256 of the *original plaintext* computed and stored
   (proves later that a decrypted file matches what was submitted)
7. DocumentRef row written: cid, hash, key_ref, org_id, type
```

### 5.3 Access / decrypt flow

```text
1. Requester (org member or admin) asks to view document_id
2. Backend checks: is requester authorized for this org / deal room?
3. If authorized: backend fetches encrypted blob from IPFS via CID,
   unwraps DEK via KMS (short-lived, in-memory only), decrypts,
   streams to requester over HTTPS (never write plaintext to disk)
4. Access event logged: requester_id, document_id, timestamp, context
```

Admin access to verification documents uses the same flow with `context = "verification_review"` and should require the admin to have an open, time-boxed review session on that `VerificationCase`.

### 5.4 Pinning & availability

- Use a pinning provider (Pinata, Web3.Storage, or Filebase) rather than running our own IPFS node at MVP stage.
- Store the CID in Postgres as the source of truth; treat the pinning service as swappable infrastructure, not a dependency baked into the data model.
- Set up a periodic job (BullMQ cron) that verifies pinned CIDs are still retrievable and re-pins/alerts if not.
- Do **not** rely on public IPFS gateways for serving private documents — always fetch server-side and stream, so a CID leak alone doesn't equal a data leak (the attacker would still need the DEK).

### 5.5 Hash anchoring (light touch at MVP)

For documents tied to a live deal (signed agreement, delivery evidence), store the sha256 hash against the deal record so it *can* be anchored onchain later (`agreementHash` field per doc 3's contract design). At MVP, storing the hash in Postgres alongside the deal is enough — onchain anchoring can be added when the settlement contracts are live, since the hash format doesn't need to change.

---

## 6. Circle wallet integration

### 6.1 Wallet provisioning at registration

Auto-create a Circle **user-controlled wallet** the moment an organization is created — don't wait for verification. This lets the org see a "Business Balance" from day one, even though the policy engine restricts what an unverified org can actually do with it (no escrow funding, no payouts above a small cap).

```text
Organization created
      ↓
Wallet Service calls Circle: create user-controlled wallet
  (org's OWNER authenticates via email/social per Circle's flow)
      ↓
Wallet row: circle_wallet_id, blockchain_address, purpose=TREASURY,
            wallet_type=USER_CONTROLLED
      ↓
Org sees "Business Balance: $0" in dashboard
```

Additional purpose-specific wallets (PROCUREMENT, SALES_RECEIPT) can be created on demand rather than all upfront — don't over-provision at MVP.

### 6.2 Platform wallets

A small, fixed set of **developer-controlled** wallets, created once at deploy time, not per-organization:

- `PLATFORM_FEE_TREASURY` — collects platform fees
- `PLATFORM_AUTOMATION` — pays gas / triggers keeper operations, strict policy limits

These are configured via infra/deploy scripts, not through the same API path as business wallets.

### 6.3 Verification gates what the wallet can do

The wallet exists regardless of verification status; **the policy engine, not Circle, enforces the gate**:

| Org status | Allowed wallet actions |
|---|---|
| UNVERIFIED | View balance only |
| PENDING | View balance, receive funds |
| VERIFIED | Fund escrow, release/receive settlement, withdraw |
| REJECTED / EXPIRED | View balance, withdraw own funds only |

Implement this as a check in the deal-creation and escrow-funding endpoints (`requireAttestation('KYB_VERIFIED')` middleware), not inside Circle wallet config — keeps the rule visible and easy to change.

### 6.4 Mapping table

Because a Circle wallet ID is just a signing instrument, always resolve through this chain before trusting a wallet's actions:

```text
circle_wallet_id → Wallet row → organization_id → Organization
                                                 → VerificationAttestation (current status)
                                                 → OrganizationMember (is this signer authorized?)
```

Never authorize a deal action off `blockchain_address` alone — always resolve back to org + verification + signer authority.

### 6.5 Minimal Circle API surface needed at MVP

- Create user-controlled wallet (per org, on registration)
- Create developer-controlled wallet (platform, at deploy)
- Get wallet balance
- Initiate transfer (funding escrow / withdrawal) — user-controlled wallets route through Circle's signing UI; developer-controlled through the policy-checked automation wallet
- Webhook listener for transaction status (`pending` → `confirmed` → update Postgres deal/settlement state)

---

## 7. Suggested build order

1. Org/user registration + Postgres schema (§3)
2. Document upload → encryption → IPFS pin → DocumentRef (§5.2)
3. VerificationCase creation + admin review queue, no decryption UI yet
4. Admin decrypt-and-view flow with access logging (§5.3, §4.2)
5. Approve/reject → VerificationAttestation issuance (§4.1)
6. Circle wallet auto-provisioning on org creation (§6.1)
7. Policy-engine gate wiring verification status to wallet/deal permissions (§6.3)
8. Webhook handling for wallet transaction status

---

## 8. Notes on swapping in real KYC later

Because §4.1's attestation format and §6.3's policy gate both key off `VerificationAttestation`, not off "an admin clicked approve," adding Persona/Sumsub later is:

1. Add a `VerificationProvider` service that calls the real API.
2. On provider callback, write a `VerificationAttestation` with `issuer = "persona"` instead of `"platform-admin"`.
3. Leave the admin review path in place as a manual override / edge-case queue.

No changes needed to Document Service, Wallet Service, or the policy engine.
