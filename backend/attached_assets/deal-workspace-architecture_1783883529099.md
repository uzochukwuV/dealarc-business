# Deal Workspace Architecture — MVP

**Scope:** the transaction system that sits between discovery and settlement — connections, the Deal Workspace itself, requirements/proposals, term negotiation, internal approvals, contract handoff, and the link into funding/execution. This document assumes `backend-architecture.md` (org/user model, verification, IPFS document service, Circle wallets) as its foundation and extends it — it does not repeat that content.

**MVP flow this doc is scoped to:** buyer-led procurement (search → connect → workspace → requirements → proposal → terms → contract → fund → deliver → accept → settle → reputation). Opportunity marketplace and AI-matching are discovery-layer features that feed into the same workspace model later — not required to ship v1.

---

## 1. Naming

**Deal Workspace**, not "chat room" or "joint org." A workspace is temporary, scoped to one commercial objective, and owned jointly by the participating organizations for the life of that deal only. It does not imply shared membership, shared wallets, or any relationship outside its own scope.

---

## 2. Core state machine

```text
DISCOVERED
    ↓
CONNECTION_REQUESTED
    ↓
QUALIFYING
    ↓
WORKSPACE_ACTIVE
    ↓
REQUIREMENTS_DEFINED
    ↓
PROPOSAL_SUBMITTED
    ↓
NEGOTIATING
    ↓
TERMS_AGREED
    ↓
INTERNAL_APPROVAL
    ↓
CONTRACT_SIGNED
    ↓
AWAITING_FUNDING
    ↓
FUNDED
    ↓
IN_PROGRESS
    ↓
AWAITING_ACCEPTANCE
    ↓
COMPLETED
```

Branches:

```text
NEGOTIATING        → CANCELLED
AWAITING_ACCEPTANCE → REVISION_REQUIRED   (back to IN_PROGRESS)
IN_PROGRESS         → DISPUTED
DISPUTED            → REFUNDED | PARTIALLY_SETTLED | COMPLETED
```

This state lives on `DealWorkspace.status`. Every transition is written by a specific backend action (never inferred), and every transition is logged to `WorkspaceActivityLog` with actor, org, timestamp, and reason — this log is what reputation, disputes, and audits all read from later.

---

## 3. Domain model

```text
Connection
 ├── id, requesting_org_id, target_org_id
 ├── reason, proposed_deal_category, approx_value, timeline
 ├── requires_nda: boolean
 ├── status: PENDING | ACCEPTED | DECLINED | PROFILE_ONLY
 ├── created_at, responded_at

DealWorkspace
 ├── id, connection_id (nullable — a workspace can also be created
 │      directly by mutual agreement without a formal Connection)
 ├── title, objective_summary
 ├── status: <state machine above>
 ├── participant_org_ids: [org_id]
 ├── created_at, updated_at

WorkspaceMember
 ├── id, workspace_id, organization_id, user_id
 ├── org_role (inherited from OrganizationMember)
 ├── can_propose, can_approve_terms, can_sign, can_fund: booleans
 │      (derived from org_role + is_authorized_signer, but stored
 │       explicitly per-workspace so permissions can be scoped
 │       tighter than the org-wide default for this one deal)
 ├── added_at, removed_at

Message
 ├── id, workspace_id, sender_user_id, sender_org_id
 ├── body, created_at
 ├── linked_object_type, linked_object_id (nullable — set when a
 │      message is "converted to proposal/requirement/etc.")

Requirement
 ├── id, workspace_id, created_by_org_id
 ├── fields (jsonb): item/service, quantity, specs, delivery_location,
 │      deadline, quality_requirements, budget_range, certifications,
 │      payment_preference
 ├── status: DRAFT | PUBLISHED | SUPERSEDED

Proposal
 ├── id, workspace_id, version, proposed_by_org_id
 ├── supersedes_proposal_id (nullable)
 ├── template_id (nullable until template is selected — see §7)
 ├── terms (jsonb): price, quantity, delivery_timeline, payment_structure,
 │      warranty, validity_period, exclusions
 ├── status: DRAFT | COUNTERED | ACCEPTED | WITHDRAWN | EXPIRED
 ├── created_at

TermSheet
 ├── id, workspace_id, accepted_proposal_id
 ├── terms (jsonb, locked copy of the accepted Proposal's terms —
 │      immutable once created; term sheet is a snapshot, not a
 │      pointer, so later Proposal edits can't retroactively alter it)
 ├── created_at

ApprovalRequest
 ├── id, workspace_id, organization_id, term_sheet_id
 ├── required_approvers: [{role, member_id, status}]
 ├── policy_tier (derived from deal value — see §8)
 ├── status: PENDING | APPROVED | REJECTED
 ├── resolved_at

Agreement
 ├── id, workspace_id, term_sheet_id
 ├── legal_document_ref (DocumentRef — encrypted on IPFS, per
 │      backend-architecture.md §5)
 ├── agreement_hash (sha256 of the legal document, stored in
 │      Postgres and later anchored onchain by the settlement contract)
 ├── signatures: [{org_id, user_id, role, signed_at}]
 ├── status: DRAFTED | UNDER_REVIEW | LOCKED | SIGNED

DealContract
 ├── id, workspace_id, agreement_id
 ├── template_id, chain, contract_address
 ├── settlement_status (mirrors onchain state via webhook/indexer —
 │      see §9)

Milestone
 ├── id, deal_contract_id, description_hash, amount, due_date
 ├── status: PENDING | SUBMITTED | APPROVED | DISPUTED | RELEASED

Evidence
 ├── id, workspace_id, milestone_id (nullable), submitted_by_org_id
 ├── evidence_type: DELIVERY_RECEIPT | TRACKING | COMPLETION_CERT |
 │      INSPECTION_REPORT | DELIVERABLE | INVOICE | OTHER
 ├── document_ref (encrypted, IPFS)
 ├── content_hash

Dispute
 ├── id, workspace_id, deal_contract_id, opened_by_org_id
 ├── reason, status: OPEN | EVIDENCE_PERIOD | UNDER_REVIEW | RESOLVED
 ├── arbitrator_id (scoped access — see §10)
 ├── resolution: FULL_RELEASE | FULL_REFUND | SPLIT | MILESTONE_SPECIFIC
 ├── resolved_at

ReputationRecord
 ├── id, organization_id, workspace_id, counterparty_org_id
 ├── role_in_deal: BUYER | SELLER
 ├── dimensions (jsonb): on_time, quality_match, communication,
 │      dispute_involved, would_repeat
 ├── created_at   (only writable once workspace = COMPLETED, and only
 │      by the counterparty — never self-reported)
```

Reused as-is from `backend-architecture.md`: `Organization`, `OrganizationMember`, `VerificationAttestation`, `DocumentRef`, `Wallet`.

---

## 4. Connection → Workspace handoff

A workspace is never created cold. It always originates from a `Connection`:

```text
Org A finds Org B (search / opportunity / AI match)
      ↓
Org A submits Connection request
      ↓
Org B: ACCEPT | DECLINE | PROFILE_ONLY | (accept → create workspace)
      ↓
On accept with intent to transact:
   DealWorkspace created, status = WORKSPACE_ACTIVE
   Both orgs' default WorkspaceMembers added (creator picks who)
```

Keeping `Connection` and `DealWorkspace` as separate objects (rather than one) matters for two reasons: (1) a `PROFILE_ONLY` accept shouldn't create transaction infrastructure, and (2) one `Connection` between two orgs can spawn multiple workspaces over time (repeat business, §13) without re-running the qualification step each time.

---

## 5. Permissions model

Permissions are resolved at two layers, and both must pass:

```text
Org-level (from OrganizationMember):
  role, is_authorized_signer

Workspace-level (from WorkspaceMember):
  can_propose, can_approve_terms, can_sign, can_fund
```

Default mapping at workspace creation (overridable by the org's admin before/during the deal):

| Org role | can_propose | can_approve_terms | can_sign | can_fund |
|---|---|---|---|---|
| Owner / Director | ✓ | ✓ | ✓ | ✓ |
| Sales / Procurement | ✓ | – | – | – |
| Finance | – | ✓ | – | ✓ |
| Legal | – | ✓ | – | – |
| Viewer | – | – | – | – |

`can_sign` should require `is_authorized_signer = true` at the org level regardless of workspace-level override — a workspace can restrict signing authority further, never grant it beyond what the org itself has authorized. Every UI surface showing a participant must display name, org, role, and verification status (per doc 4 §5) so counterparties always know whether the person they're negotiating with can actually commit the company.

---

## 6. Chat → structured object conversion

Messages are plain rows (`Message`), but any message can be converted into a structured object rather than staying free text:

```text
Message: "We can deliver 10,000 units for $18,000 within 30 days."
      ↓ [Convert to Proposal]
Proposal v1 created, terms extracted into structured fields,
Message.linked_object_type/id set to point at the new Proposal
```

At MVP, "convert to proposal" can be a manual action (user fills a form pre-seeded with message text) rather than NLP extraction — ship the structured-object model first, automate the extraction later. The important architectural point is that `Requirement` and `Proposal` are first-class objects the contract layer can consume directly, not something parsed out of a chat transcript at signing time.

---

## 7. Negotiation → Term Sheet → Template selection

```text
Requirement published (buyer)
      ↓
Proposal v1 (seller) — references Requirement
      ↓
Counter-proposal v2, v3... (supersedes_proposal_id chains them)
      ↓
Both sides mark the same version ACCEPTED
      ↓
TermSheet created (immutable snapshot of that Proposal's terms)
```

Template selection (`ContractTemplate`, per doc 3 §"Contract-template architecture") happens **after** terms are agreed, not before — locking it early causes abandoned workspaces when the deal shape changes mid-negotiation (per earlier discussion in this thread). Suggested mapping, shown to users as a recommendation they can override:

```text
Physical goods, one-time      → Purchase Order Escrow
Physical goods, staged        → Milestone Escrow
Software / services, staged   → Milestone Service Contract
Recurring service              → Subscription / Retainer
Partnership, commission-based → Revenue Share
```

---

## 8. Internal approvals

`ApprovalRequest` is generated once a `TermSheet` exists, per participating organization independently — Org A's approval chain and Org B's approval chain run in parallel, not sequentially.

Policy tiers (configurable per org, default shown):

```text
< $2,000            → 1 finance approval
$2,000 – $20,000     → finance + department head
> $20,000            → finance + legal + director
```

`DealWorkspace.status` only moves `TERMS_AGREED → CONTRACT_SIGNED` once **every** participating org's `ApprovalRequest` is `APPROVED`. This is enforced in the backend state-transition function, not left to the frontend to check — a workspace should be structurally incapable of skipping approval.

---

## 9. Contract handoff (workspace → settlement)

This is the seam into the onchain layer described in doc 3.

```text
Agreement drafted (legal doc, encrypted, IPFS) → hash computed
      ↓
Both sides review, LOCKED
      ↓
Authorized signers sign (recorded as organizational actions —
   name, role, authority-verified flag, timestamp — not just a
   wallet click, per doc 4 §12)
      ↓
DealFactory.createDeal(template, params from TermSheet, agreementHash)
      ↓
DealContract row created, contract_address stored
      ↓
Webhook/indexer subscribes to contract events →
   mirrors onchain state into DealContract.settlement_status
```

The backend never re-derives contract parameters independently at deployment time — it passes through the exact `TermSheet.terms` that both signers already approved, so what was signed is provably what got deployed (matches on `agreement_hash`).

Funding, milestone release, and withdrawal UI actions map directly to Circle wallet calls per `backend-architecture.md §6` — the workspace layer just needs to gate those actions on `DealWorkspace.status` (e.g., "Fund" only enabled when `status = AWAITING_FUNDING`) and on `WorkspaceMember.can_fund`.

---

## 10. Evidence, acceptance, disputes

Evidence submission (`Evidence` objects) is append-only against a workspace or specific milestone — sellers submit, buyers review, nothing is ever overwritten (matches the "every version preserved" principle from §7).

```text
IN_PROGRESS → AWAITING_ACCEPTANCE  (evidence submitted)
      ↓
Buyer: ACCEPT | PARTIAL_ACCEPT | REQUEST_CORRECTION | OPEN_DISPUTE
      ↓
ACCEPT → escrow release triggered → COMPLETED
OPEN_DISPUTE → Dispute created, DealContract funds frozen
```

Dispute access control is the one place where a third party (arbitrator) needs into the workspace. Reuse the deal-room-scoped document key model from `backend-architecture.md §5.3`: the arbitrator gets a time-boxed grant limited to `Evidence` and `Agreement` objects tied to that specific `Dispute.id` — never the org's general document vault, never other workspaces.

---

## 11. Reputation

`ReputationRecord` is written only on `COMPLETED` (or `DISPUTED → RESOLVED`), only by the counterparty, never self-reported, and reads from `WorkspaceActivityLog` for objective signals (on-time delivery, response time, dispute involvement) rather than trusting free-text review content alone. Aggregate scores shown publicly should be ranges/percentages, not raw transaction values — matches the privacy model in doc 3 (public profile vs. private commercial data).

---

## 12. API surface (MVP)

```text
POST   /connections
POST   /connections/:id/respond
POST   /workspaces                          (from an accepted connection)
GET    /workspaces/:id
POST   /workspaces/:id/members
POST   /workspaces/:id/messages
POST   /workspaces/:id/messages/:id/convert  (→ requirement | proposal)
POST   /workspaces/:id/requirements
POST   /workspaces/:id/proposals
POST   /workspaces/:id/proposals/:id/accept
POST   /workspaces/:id/term-sheet            (system-generated on accept)
POST   /workspaces/:id/approvals/:id/decide
POST   /workspaces/:id/agreement
POST   /workspaces/:id/agreement/sign
POST   /workspaces/:id/contract               (deploy from template)
POST   /workspaces/:id/fund
POST   /workspaces/:id/evidence
POST   /workspaces/:id/milestones/:id/approve
POST   /workspaces/:id/dispute
POST   /workspaces/:id/reputation
```

Every mutating endpoint writes to `WorkspaceActivityLog` before returning success — this log is the backbone for disputes, reputation, and audit, so it can't be an afterthought bolted on later.

---

## 13. Repeat business (post-MVP, but shape it now)

Design `DealWorkspace` so a new one can be seeded from a completed one without extra modeling later:

```text
POST /workspaces/:id/duplicate
   → new DealWorkspace, same participants,
     Proposal pre-filled from prior accepted TermSheet,
     status = WORKSPACE_ACTIVE (skips QUALIFYING — already known)
```

This is why `Connection` and `DealWorkspace` are separate objects (§4): repeat deals reuse the `Connection`, not the workspace, so qualification never has to happen twice between the same two orgs.

---

## 14. Build order

1. `Connection` request/accept flow
2. `DealWorkspace` + `WorkspaceMember` + permission resolution (§5)
3. `Message` + basic chat
4. `Requirement` / `Proposal` structured objects + versioning
5. Message → Proposal conversion (manual form, §6)
6. `TermSheet` generation on mutual accept
7. `ApprovalRequest` + policy tiers (§8)
8. `Agreement` (reuse Document Service) + signing flow
9. `DealContract` deployment hook into `DealFactory` (§9)
10. Fund / milestone / evidence flows wired to Circle wallet + webhook indexer
11. `Dispute` with scoped arbitrator access
12. `ReputationRecord` on completion

Steps 1–8 alone are enough to demo the full buyer-led procurement flow end-to-end before any settlement contract is live — worth sequencing a demo checkpoint there.
