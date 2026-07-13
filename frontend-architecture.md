# Frontend Architecture — Pages & Project Structure

**Scope:** what pages the product needs, what each page is responsible for and contains, and how the codebase should be organized. No code — this is the map the actual build should follow. Assumes a Next.js (React) app, since that pairs naturally with the backend/API design in `backend-architecture.md` and `deal-workspace-architecture.md`, but the page/folder logic applies regardless of framework choice.

---

## 1. Information architecture — the seven areas

Matches the navigation model from the Deal Workspace doc:

```text
Discover   Connections   Workspaces   Contracts   Payments   Organization   Reputation
```

Plus three areas that sit outside the main nav: **Auth/Onboarding**, **Admin** (internal, separate app shell), and **Settings**.

---

## 2. Auth & Onboarding

### `/login`, `/signup`
- Email/social auth entry point.
- Signup branches into "create organization" vs. "join existing organization via invite."

### `/onboarding/organization`
- Form: legal name, trading name, industry, countries served, products/services, description, website.
- On submit: creates the org in `UNVERIFIED` state, auto-provisions a Circle wallet in the background (silent — no wallet UI shown yet).
- Progress indicator: Profile → Documents → Team → Review.

### `/onboarding/documents`
- Upload registration certificate, proof of address, representative ID.
- Each upload shows encryption/pinning status (uploading → encrypting → stored), not raw IPFS/CID detail.
- Submitting moves org to `PENDING` and creates the `VerificationCase`.

### `/onboarding/team`
- Invite teammates by email, assign initial roles (Owner/Admin/Sales/Finance/Legal/Viewer).
- Skippable — can be done later from Organization settings.

### `/onboarding/pending`
- Shown after submission while verification is `PENDING`.
- Explains what's being reviewed, expected turnaround, what the org can/can't do meanwhile (view-only wallet, no escrow funding — per backend doc §6.3).

---

## 3. Discover

### `/discover`
- **Function:** primary business/opportunity search surface — this is the top-of-funnel page.
- **Contains:**
  - Search bar + filters (industry, location, verification status, transaction-history range, product/service category).
  - Two result modes, toggled by tab: **Businesses** and **Opportunities**.
  - Result cards show: name, logo, verification badge, industry, regions served, reputation summary (completed deals, on-time %), "typical deal size" band.
  - "AI match" entry point — a plain-language box ("Find a logistics provider that handles cold-chain between Lagos and Accra") that returns ranked, explained matches.

### `/discover/business/[orgId]`
- **Function:** public business profile — what a prospective counterparty sees before connecting.
- **Contains:**
  - Public profile fields only (per privacy model — no financials, no private docs).
  - Verification badge with issuer/date (from `VerificationAttestation`).
  - Reputation block: completed deal count, average settlement reliability %, dispute rate — ranges/percentages, never raw transaction values.
  - Products/services list, certifications, markets served.
  - Primary CTA: **Request Connection**.

### `/discover/opportunities/[opportunityId]`
- **Function:** view a single published RFQ/opportunity.
- **Contains:** requirement summary (quantity, spec, delivery location/deadline), poster's public profile, "submit proposal" or "request to bid" CTA, and — for sealed-bid opportunities — a notice that bids are private/committed rather than an open list.

---

## 4. Connections

### `/connections`
- **Function:** inbox for relationship requests, distinct from deal negotiation itself.
- **Contains:** three tabs — **Received**, **Sent**, **Accepted** — each row showing counterparty org, reason for contact, proposed deal category, approx. value, timeline, and status.
- Actions on a received request: Accept / Decline / Request More Info / Profile-Only.
- Accepting with transaction intent routes into workspace creation.

---

## 5. Workspaces (the core of the product)

### `/workspaces`
- **Function:** list of all active/past deal workspaces for the org.
- **Contains:** filterable list (status, counterparty, value range), status badges matching the state machine (`NEGOTIATING`, `AWAITING_FUNDING`, `IN_PROGRESS`, `DISPUTED`, `COMPLETED`, etc.), quick-glance next-action prompt per row ("Awaiting your approval," "Fund escrow to proceed").

### `/workspaces/[id]` — the workspace shell
- **Function:** container page with sub-navigation into the workspace's own areas. This is the single most important screen in the product.
- **Contains (persistent header):** participant list with org/role/authority/verification status shown per person (per the "who can commit the company" requirement), current workspace status, objective summary.
- **Sub-tabs:**

  - **`/workspaces/[id]/chat`**
    Message thread. Any message can be selected and "Converted to Requirement/Proposal," which opens a structured form pre-filled from the message text.

  - **`/workspaces/[id]/requirements`**
    Buyer's structured requirement (item, quantity, specs, delivery, deadline, budget range, certifications). Editable until a proposal is submitted against it.

  - **`/workspaces/[id]/proposals`**
    Version history of proposals (v1, v2, v3...) shown as a timeline/diff, not just a flat list — each version shows what changed from the last. Accept/Counter actions live here, gated by `can_propose`/`can_approve_terms` permission.

  - **`/workspaces/[id]/documents`**
    Shared document vault scoped to this workspace only. Upload, view (streamed/decrypted, not downloadable by default), expiry and access-scope controls per document (who can see it, does it expire).

  - **`/workspaces/[id]/terms`**
    The locked Term Sheet once negotiation concludes — read-only structured display of final terms (price, quantity, delivery, payment structure, warranty, validity).

  - **`/workspaces/[id]/approvals`**
    Internal approval chain for the viewing org only (never shows the counterparty's internal approval chain — that's their business). Shows required approvers, who's approved, who's pending, and lets an authorized approver approve/reject with a note.

  - **`/workspaces/[id]/contract`**
    Contract template selection (with recommendation + override), legal agreement draft/review, signing flow. Shows signature block per doc 4's format (name, role, authority-verified, timestamp) once signed.

  - **`/workspaces/[id]/execution`**
    Milestone/delivery tracker. For purchase orders: order confirmed → production → shipped → delivered → inspection window. For milestone services: per-milestone submit/review/approve. Evidence upload lives here (delivery receipts, tracking, completion certs).

  - **`/workspaces/[id]/dispute`** (only visible once a dispute is opened)
    Evidence submission from both sides, dispute status/timeline, resolution outcome once decided. Arbitrator identity shown but arbitrator's own view is a separate restricted page, not this one.

---

## 6. Contracts

### `/contracts`
- **Function:** cross-workspace view of all contracts — drafts, pending signature, active, completed. Useful once an org has many concurrent deals and needs a single place to see contract status without opening each workspace.
- **Contains:** list with template type, counterparty, value, status, linked workspace.

### `/contracts/templates`
- **Function:** browse the available contract templates (Simple Escrow, Milestone Escrow, Purchase Order, Subscription, Revenue Share, Sealed-Bid Award) with plain-language descriptions of what each is for and how funds flow — informational, not editable by end users at MVP.

---

## 7. Payments

### `/payments`
- **Function:** the business's financial home — deliberately framed in business language, not crypto/wallet language.
- **Contains:**
  - Balance card ("Business Balance: $X"), never showing raw wallet address or chain details prominently (available in an "advanced" expandable section for anyone who wants it).
  - Funds in escrow (aggregated across active workspaces) vs. available balance.
  - Transaction history: fund, release, refund, withdrawal — each linked back to its workspace.
  - Actions: **Fund Escrow** (only enabled contextually from a workspace at `AWAITING_FUNDING`), **Withdraw**, **Add Funds**.

### `/payments/[transactionId]`
- **Function:** single transaction detail/receipt — amount, counterparty, linked workspace/milestone, onchain status (pending/confirmed), downloadable receipt.

---

## 8. Organization

### `/organization/profile`
- **Function:** manage the public + private profile split.
- **Contains:** editable public fields (name, industry, products, description) and a separate, clearly-labeled private section (registration details, financial evidence) with explanation of who can ever see private fields and under what circumstance.

### `/organization/team`
- **Function:** member management.
- **Contains:** member list with role, `is_authorized_signer` flag, invite/revoke actions, pending invites.

### `/organization/verification`
- **Function:** verification status and document management.
- **Contains:** current status (`UNVERIFIED`/`PENDING`/`VERIFIED`/`REJECTED`), submitted documents, resubmission flow if rejected/more-info-needed, expiry date if applicable.

### `/organization/wallets`
- **Function:** the "advanced" wallet view for those who want it — purpose-specific wallets (Treasury, Procurement, Sales Receipt), balances, addresses.

### `/organization/approval-policies`
- **Function:** configure the deal-value tiers and required approvers (per Deal Workspace doc §8) — e.g. "$2,000–$20,000 requires finance + department head."

---

## 9. Reputation

### `/reputation`
- **Function:** the org's own trust profile as seen by others, plus its history of reviewing counterparties.
- **Contains:** aggregate scores (on-time delivery %, communication, dispute rate, repeat-customer rate), completed deal count, list of completed workspaces with the review given/received on each. Reviews are only ever visible/writable in relation to a `COMPLETED` workspace with that specific counterparty — no open-ended review composition.

---

## 10. Settings (utility, outside main nav)

### `/settings/account`
Personal profile, notification preferences, security (password/2FA).

### `/settings/notifications`
Granular control over what triggers email/in-app notification (new connection, proposal update, approval needed, funding required, dispute opened, etc.).

---

## 11. Admin (separate app shell — internal only)

### `/admin/verification-queue`
- **Function:** the manual KYC review surface described in `backend-architecture.md §4`.
- **Contains:** queue of `SUBMITTED`/`IN_REVIEW` verification cases, document viewer (time-boxed decrypt access, logged), Approve/Reject/Request-More-Info actions with notes field.

### `/admin/disputes`
- **Function:** arbitrator/mediator working view.
- **Contains:** dispute queue, scoped evidence viewer (only that dispute's evidence — never the org's general vault), resolution decision form.

### `/admin/organizations`
- General org lookup/management, verification status override, suspension for policy violations.

---

## 12. Page-to-permission summary

| Page | Visible to | Notes |
|---|---|---|
| `/discover*` | Any verified org | Public data only |
| `/connections` | Org members with relevant role | Org-scoped |
| `/workspaces/[id]/*` | Only `WorkspaceMember`s of that workspace | Enforced per-tab (e.g. `approvals` shows own org's chain only) |
| `/payments` | Members with `can_fund` or finance role | Balance visible to more roles than funding action |
| `/organization/verification` | Org admins | — |
| `/admin/*` | Internal staff only | Separate auth/role, not org-scoped |

---

## 13. Project folder structure (Next.js, App Router)

```text
/src
  /app
    /(auth)
      /login
      /signup
    /(onboarding)
      /onboarding
        /organization
        /documents
        /team
        /pending
    /(main)                          ← authenticated shell w/ main nav
      /discover
        /business/[orgId]
        /opportunities/[opportunityId]
      /connections
      /workspaces
        /[id]
          /chat
          /requirements
          /proposals
          /documents
          /terms
          /approvals
          /contract
          /execution
          /dispute
      /contracts
        /templates
      /payments
        /[transactionId]
      /organization
        /profile
        /team
        /verification
        /wallets
        /approval-policies
      /reputation
      /settings
        /account
        /notifications
    /(admin)                         ← separate shell, separate auth guard
      /admin
        /verification-queue
        /disputes
        /organizations

  /components
    /ui                              ← generic design-system primitives
    /workspace                       ← workspace-specific composite components
      WorkspaceHeader.*
      ParticipantList.*
      ProposalVersionTimeline.*
      ApprovalChain.*
      SignatureBlock.*
      MilestoneTracker.*
    /discover
      BusinessCard.*
      OpportunityCard.*
    /payments
      BalanceCard.*
      TransactionRow.*
    /verification
      VerificationBadge.*
      DocumentUploadStatus.*

  /features                          ← feature-scoped logic (hooks, queries, mutations)
    /auth
    /organization
    /verification
    /discovery
    /connections
    /workspaces
      /proposals
      /terms
      /approvals
      /contract
      /execution
      /disputes
    /payments
    /reputation

  /lib
    api-client.*                     ← typed wrapper over backend REST API
    circle-wallet-client.*           ← wraps Circle SDK calls, hides wallet
                                        complexity from feature code
    permissions.*                    ← resolves org-role + workspace-role
                                        into can_propose/can_sign/etc.
    formatting.*                     ← money, dates, status-label helpers

  /types
    organization.ts
    workspace.ts
    proposal.ts
    contract.ts
    payment.ts

  /styles
```

**Structure notes:**

- Route groups `(auth)`, `(onboarding)`, `(main)`, `(admin)` keep layout/auth-guard logic cleanly separated — a user should never accidentally render the main nav shell before onboarding is complete, or the admin shell without staff auth.
- `/components` holds presentation; `/features` holds the data-fetching/mutation logic per domain area. Keeps a workspace page's file from becoming a dumping ground of both API calls and JSX.
- `lib/circle-wallet-client` is deliberately isolated — per the backend doc's principle that business users (and most of the frontend) should never touch raw wallet/chain concepts, all Circle SDK interaction funnels through this one module so it's the only place that needs to change if the wallet provider ever changes.
- `lib/permissions` centralizes the org-role + workspace-role resolution (§5 of the Deal Workspace doc) so permission checks aren't duplicated ad hoc across every tab component.

---

## 14. Suggested build order (frontend)

1. Auth + Onboarding (org creation, document upload, pending state)
2. Organization settings (profile, team, verification status display)
3. Discover (business search + public profile page)
4. Connections (request/accept flow)
5. Workspace shell + chat + requirements + proposals
6. Terms + approvals
7. Contract (template selection, agreement review, signing)
8. Payments (balance display, fund/release actions wired to Circle)
9. Execution (milestones, evidence)
10. Dispute flow
11. Reputation
12. Admin shell (verification queue, disputes)

Matches the backend build order in both prior docs closely enough that frontend and backend work can proceed in the same sequence, in parallel.
