# 1. OBJECTIVE

Build a lean, extensible RWA/trade finance smart contract system with **5 core contracts** that answer three on-chain questions:
1. **Who are you?** → Identity
2. **Can you be trusted?** → Reputation
3. **Where is the money?** → Agreement/Invoice/Split Escrow

**Key Insight**: Separate the **business deal** (AgreementTemplate) from the **money** (EscrowSplitTemplate). Many workflows track business progress BEFORE money moves.

Everything else (workflow logic, business rules) stays off-chain in the workflow engine.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    TemplateRegistry.sol                  │
│  (On-chain directory: tracks template→deal→owner→state) │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│              AgreementTemplate.sol                      │
│                                                         │
│  • Purchase Orders        ← No money here               │
│  • Trade Deals                                          │
│  • Service Contracts                                    │
│  • Procurement Requests                                  │
│  • Import/Export Contracts                              │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│EscrowSplitTemplate│ │   InvoiceTemplate │ │  (Future:         │
│                   │ │                   │ │   FinancingTemplate│
│• Settlement       │ │• Receivables     │ │   PayrollTemplate │
│• Milestones       │ │• Factoring assets │ │   etc.)           │
│• Revenue Sharing  │ │• Credit events   │ │                   │
│• Multi-party pay  │ │                   │ │                   │
└───────────────────┘ └───────────────────┘ └───────────────────┘
            │               │
            └───────────────┼───────────────┘
                            ▼
              ┌─────────────────────────┐
              │     Reputation.sol       │
              │  (Updated ONLY by       │
              │   authorized templates)  │
              └─────────────────────────┘
                            │
                            ▼
              ┌─────────────────────────┐
              │     Identity.sol         │
              │  (Non-transferable       │
              │   organizational passport)│
              └─────────────────────────┘
```

**Value Flow**:
```
Agreement created → Agreement accepted → Production/shipment tracked
        ↓                                           ↓
   Invoice issued                          EscrowSplit funded
        ↓                                           ↓
   (Future: Invoice Marketplace / Factoring)  →  Settlement via Split
```

---

# 2. CONTEXT SUMMARY

## Project Stack
- **Framework**: Hardhat 3 with viem client
- **Solidity**: 0.8.28
- **Testing**: Solidity (.t.sol) + TypeScript integration tests (node:test + viem)
- **Token**: USDC (ERC20) for settlements

## Existing Files
- Template files: `Counter.sol`, `Counter.t.sol`, `Counter.ts` (to be removed/replaced)
- Hardhat config with EDR simulated networks

## Contract Inventory (New)
| Contract | Purpose | Key Data |
|----------|---------|----------|
| `Identity.sol` | Non-transferable organizational passport | id, owner, companyHash, active |
| `Reputation.sol` | Credit history - updated only by templates | completedDeals, disputedDeals, financedDeals, totalVolume, score |
| `TemplateRegistry.sol` | Deal directory & template authorization | template→deal mapping, owner, status |
| `AgreementTemplate.sol` | Business deal without money | buyer, seller, agreementType, termsHash, status, parties[] |
| `InvoiceTemplate.sol` | Receivable asset contract | issuer, payer, amount, dueDate, status |
| `EscrowSplitTemplate.sol` | Multi-party payment splits | recipients[], amounts in bps |

---

# 3. APPROACH OVERVIEW

## Design Principles
1. **Separate business deal from money** - AgreementTemplate (no money) → EscrowSplitTemplate (money)
2. **Minimum contracts, maximum extensibility** - 5 contracts total, extensible with future templates
3. **Generic approval/release rules** - Reusable across all templates, not hardcoded
4. **Reputation as the crown jewel** - Only templates can update it; survives every deal
5. **Dispute handling from day one** - Financiers WILL ask "what if something goes wrong?"
6. **On-chain = immutable truth** - Workflow engine handles business logic off-chain

## Access Control Architecture
```
Only authorized callers can update Reputation:
  - AgreementTemplate
  - EscrowSplitTemplate
  - InvoiceTemplate

Only TemplateRegistry can:
  - Authorize new templates
  - Register new deals
  - Track deal ownership
```

## State Management
- All templates use enums for deal states (Draft, Active, Disputed, Resolved, Completed, Cancelled)
- Events emitted for every state transition (off-chain workflow engine subscribes)
- Immutable once certain states reached (no retroactive changes)

## Key Insight: AgreementTemplate Without Money
Many SME workflows don't need funds locked immediately:

```
PO issued → Supplier accepted → Production started → Shipment pending
```

No money has moved. Yet huge business value exists. AgreementTemplate captures this value on-chain.

Later:
```
Agreement milestones reached → EscrowSplit funded → Settlement
                         ↓
                    Invoice created → Factored on marketplace
```

---

# 4. IMPLEMENTATION STEPS

## Phase 1: Foundation Contracts

### Step 1.1: Create Access Control & Interfaces
**Goal**: Define shared interfaces and access control patterns
**Method**: Create `interfaces/ITemplate.sol` and `access/TemplateAccess.sol`
**Files**: 
- `contracts/interfaces/ITemplate.sol`
- `contracts/interfaces/IReputation.sol`
- `contracts/interfaces/IIdentity.sol`
- `contracts/access/TemplateAccess.sol`

**Content**:
```solidity
// Shared enums for all templates
enum DealState { Active, Disputed, Resolved, Cancelled }
enum ReleaseType { Milestone, Time, Manual }
enum PartyRole { Buyer, Supplier, Freight, Admin }

// Generic approval rule
struct ApprovalRule {
    PartyRole role;
    bool required;
}

// Generic release rule
struct ReleaseRule {
    ReleaseType ruleType;
    uint256 value; // milestone index OR timestamp
}
```

### Step 1.2: Implement Identity.sol
**Goal**: Non-transferable organizational passport
**Method**: Create `contracts/Identity.sol`
**Reference**: `contracts/Identity.sol`

**Key Functions**:
- `registerIdentity(bytes32 companyHash)` → creates new identity linked to msg.sender
- `deactivateIdentity()` → self-deactivation
- `transferOwnership(address newOwner)` → NOT included (non-transferable design)
- `getIdentityByOwner(address owner)` → lookup

**Events**: `IdentityRegistered`, `IdentityDeactivated`, `OwnershipUpdated`

### Step 1.3: Implement Reputation.sol
**Goal**: Credit history that survives every deal
**Method**: Create `contracts/Reputation.sol` with strict access control
**Reference**: `contracts/Reputation.sol`

**Key Struct**:
```solidity
struct Reputation {
    uint256 completedDeals;
    uint256 disputedDeals;
    uint256 financedDeals;
    uint256 totalVolume;
    uint256 score; // calculated: (completed * 10 - disputed * 30) / max(completed, 1)
}
```

**Key Functions** (only callable by authorized templates):
- `recordSuccessfulSettlement(address party, uint256 volume)`
- `recordDispute(address party)`
- `recordDefault(address party)`
- `recordFinancedDeal(address party, uint256 volume)`
- `getReputation(address party) → Reputation`

**Access Control**: 
- `onlyAuthorizedTemplate()` modifier
- Templates registered via `authorizeTemplate(address template)`

### Step 1.4: Implement TemplateRegistry.sol
**Goal**: On-chain directory of all deals and authorized templates
**Method**: Create `contracts/TemplateRegistry.sol`
**Reference**: `contracts/TemplateRegistry.sol`

**Key Data**:
```solidity
struct RegisteredDeal {
    address template;
    address owner;
    uint256 dealId;
    DealState state;
    uint256 createdAt;
}
```

**Key Functions**:
- `registerTemplate(address templateAddress, string memory templateType)`
- `registerDeal(address template, address owner, uint256 dealId)`
- `updateDealState(uint256 registryId, DealState newState)`
- `getDealInfo(uint256 registryId) → RegisteredDeal`
- `getDealsByOwner(address owner) → uint256[]`
- `getDealsByTemplate(address template) → uint256[]`

---

## Phase 2: Template Contracts

### Step 2.1: Implement Base Template Logic
**Goal**: Shared functionality for all templates
**Method**: Create `contracts/base/BaseTemplate.sol`
**Reference**: `contracts/base/BaseTemplate.sol`

**Shared Features**:
- Link to TemplateRegistry
- Link to Reputation
- Standard deal state management
- Event emissions for workflow engine
- Modifier: `onlyDealParticipant()`

### Step 2.2: Implement AgreementTemplate.sol (NEW - replaces EscrowTemplate)
**Goal**: Business deal WITHOUT money - captures POs, trade deals, service contracts
**Method**: Create `contracts/AgreementTemplate.sol`
**Reference**: `contracts/AgreementTemplate.sol`

**Key Insight**: Many workflows track business progress BEFORE money moves. This contract captures that value on-chain.

**Key Structs**:
```solidity
enum AgreementType {
    PurchaseOrder,      // Buyer orders goods from supplier
    TradeDeal,          // Import/export trade transaction
    ServiceContract,    // Service agreement
    ProcurementRequest, // Internal procurement
    ImportContract,     // International import
    ExportContract      // International export
}

enum AgreementStatus {
    Draft,      // Created but not yet binding
    Active,     // Accepted by all parties, in progress
    Fulfilled,  // All obligations met
    Disputed,   // Disagreement raised
    Resolved,   // Dispute resolved
    Cancelled   // Cancelled before fulfillment
}

struct AgreementParty {
    uint256 identityId;
    PartyRole role;  // Buyer, Supplier, Freight, Inspector, etc.
    bool signed;
}

struct Agreement {
    uint256 id;
    address creator;
    AgreementType agreementType;
    bytes32 termsHash;      // IPFS hash of off-chain terms document
    AgreementStatus status;
    AgreementParty[] parties;
    uint256 registryId;
    uint256 createdAt;
    uint256 updatedAt;
}
```

**Key Functions**:
- `createAgreement(AgreementType agreementType, bytes32 termsHash, AgreementParty[] calldata parties)` → creates draft
- `signAgreement(uint256 agreementId, uint256 identityId)` → party signs
- `activateAgreement(uint256 agreementId)` → when all parties signed
- `updateStatus(uint256 agreementId, AgreementStatus newStatus)` → status transitions
- `raiseDispute(uint256 agreementId)` → freezes agreement
- `resolveAgreement(uint256 agreementId, AgreementStatus resolution)` → dispute resolved
- `cancelAgreement(uint256 agreementId)` → cancel before fulfillment

**Workflow**:
```
Draft → [All parties sign] → Active → [Fulfill obligations] → Fulfilled
                ↓                    ↓
           Dispute raised      Dispute raised
                ↓                    ↓
           Resolved            Resolved
```

**Example Use Cases**:
```
PO Issued:       AgreementTemplate.createAgreement(PurchaseOrder, termsHash, [buyer, supplier])
                 ↓
Supplier Signs:  AgreementTemplate.signAgreement(agreementId, supplierIdentity)
                 ↓
Buyer Signs:     AgreementTemplate.signAgreement(agreementId, buyerIdentity)
                 ↓
Agreement Active: Workflow engine tracks production → shipment
                 ↓
Invoice Created: InvoiceTemplate.createInvoice(payer, amount, dueDate)
                 ↓
EscrowSplit:     EscrowSplitTemplate.createSplitEscrow(payer, totalAmount, recipients)
```

### Step 2.3: Implement EscrowSplitTemplate.sol
**Goal**: Multi-party settlement with generic recipients (NOW handles all money)
**Method**: Create `contracts/EscrowSplitTemplate.sol`
**Reference**: `contracts/EscrowSplitTemplate.sol`

**Key Improvement**: Since AgreementTemplate handles business deals, EscrowSplitTemplate can focus purely on money with or without milestones.

**Key Structs**:
```solidity
struct Recipient {
    address payable recipient;
    uint16 bps; // basis points (0-10000 = 0-100%)
}

struct Milestone {
    string description;
    uint256 amount;
    bool approved;
    bool released;
}

struct SplitEscrowDeal {
    address payer;
    address token;
    uint256 totalAmount;
    Recipient[] recipients;      // Generic - any number of parties
    Milestone[] milestones;       // Optional milestones
    bool funded;
    bool distributed;
    DealState state;
    uint256 registryId;
    uint256 linkedAgreementId;    // Link to AgreementTemplate (optional)
}
```

**Key Functions**:
- `createSplitEscrow(address payer, uint256 totalAmount, Recipient[] calldata recipients, uint256 linkedAgreementId)` → optional link to agreement
- `fundEscrow()` → deposits totalAmount
- `addMilestones(string[] calldata descriptions, uint256[] calldata amounts)` → add milestone after funding
- `approveMilestone(uint256 milestoneIndex)` → approval logic
- `distributeMilestone(uint256 milestoneIndex)` → release milestone amount
- `distributeFunds()` → distribute entire amount if no milestones
- `raiseDispute()` → freezes distribution
- `resolveDispute(ResolutionAction action)`

**Validation**: Sum of recipient bps must equal 10000 (100%)

### Step 2.4: Implement InvoiceTemplate.sol
**Goal**: Receivable asset contract (NOT financing yet)
**Method**: Create `contracts/InvoiceTemplate.sol`
**Reference**: `contracts/InvoiceTemplate.sol`

**Key Structs**:
```solidity
enum InvoiceState { Created, Accepted, Financed, Paid, Defaulted }

struct Invoice {
    uint256 id;
    address issuer;
    address payer;
    uint256 amount;
    uint256 dueDate;
    InvoiceState state;
    uint256 registryId;
    uint256 linkedAgreementId;    // Link to originating agreement (optional)
}
```

**Key Functions**:
- `createInvoice(address payer, uint256 amount, uint256 dueDate, uint256 linkedAgreementId)` → optional link
- `acceptInvoice()` → payer accepts the invoice
- `markAsFinanced(address financier)` → sold to financier (future marketplace)
- `settlePayment()` → payer pays full amount
- `markDefaulted()` → after due date if unpaid
- `raiseDispute()`

**Purpose**: Becomes discoverable receivable asset for future Invoice Marketplace

**Integration with AgreementTemplate**:
```
Agreement active → Milestone fulfilled → Invoice created from Agreement
                                                    ↓
                                    Invoice can be financed/factored
```

---

## Phase 3: Testing Suite

### Step 3.1: Solidity Unit Tests
**Goal**: Comprehensive unit tests for all contracts
**Method**: Create `.t.sol` files using forge-std
**Files**:
- `contracts/Identity.t.sol`
- `contracts/Reputation.t.sol`
- `contracts/TemplateRegistry.t.sol`
- `contracts/AgreementTemplate.t.sol`
- `contracts/EscrowSplitTemplate.t.sol`
- `contracts/InvoiceTemplate.t.sol`

**Test Coverage**:
- Happy path: full lifecycle
- Access control: unauthorized calls revert
- State transitions: invalid transitions revert
- Dispute handling: freeze + resolution
- Edge cases: zero amounts, invalid indices, missing signatures

### Step 3.2: TypeScript Integration Tests
**Goal**: End-to-end workflow tests using viem
**Method**: Create `.ts` files in `test/` directory
**Files**:
- `test/Identity.integration.ts`
- `test/Agreement.integration.ts`
- `test/SplitEscrow.integration.ts`
- `test/Invoice.integration.ts`

**Test Scenarios**:
- **Agreement workflow**: create → sign → activate → fulfill
- **Split escrow**: fund → distribute to multiple recipients
- **Invoice lifecycle**: create → accept → settle
- **Linked workflow**: Agreement → Invoice → EscrowSplit settlement
- Reputation updates after successful deal completion
- Dispute scenario: raise → resolve → state update

---

## Phase 4: Deployment & Documentation

### Step 4.1: Create Ignition Deployment Modules
**Goal**: Deploy contracts to testnet/mainnet
**Method**: Create Hardhat Ignition modules
**Files**:
- `ignition/modules/01_Identity.ts`
- `ignition/modules/02_Reputation.ts`
- `ignition/modules/03_TemplateRegistry.ts`
- `ignition/modules/04_AgreementTemplate.ts`
- `ignition/modules/05_EscrowSplitTemplate.ts`
- `ignition/modules/06_InvoiceTemplate.ts`

**Order**: Identity → Reputation → TemplateRegistry → (Templates)

### Step 4.2: Create TypeScript Type Exports
**Goal**: Type-safe contract interactions from frontend
**Method**: Export ABIs and type definitions
**Files**:
- `scripts/export-abis.ts` → exports deployed contract ABIs

### Step 4.3: Create Deployment Script for Full Protocol
**Goal**: Deploy all contracts in correct order with cross-references
**Method**: Single deployment script that wires everything together
**Files**:
- `scripts/deploy-full-protocol.ts` → deploys all 5 contracts with links

---

# 5. TESTING AND VALIDATION

## Success Criteria

### Identity.sol
- [ ] Can register new identity linked to wallet
- [ ] Cannot transfer identity ownership (non-transferable)
- [ ] Can deactivate own identity
- [ ] Can lookup identity by owner address

### Reputation.sol
- [ ] Only authorized templates can update reputation
- [ ] Score calculates correctly: (completed * 10 - disputed * 30)
- [ ] Reputation persists across deals
- [ ] Unauthorized calls revert with correct error

### TemplateRegistry.sol
- [ ] Can register new templates
- [ ] Can register deals with template+owner
- [ ] Can query deals by owner
- [ ] Can query deals by template
- [ ] Can update deal state

### AgreementTemplate.sol (NEW)
- [ ] Can create agreement with any number of parties
- [ ] Agreement starts in Draft state
- [ ] All parties must sign before activation
- [ ] Activates only when all parties signed
- [ ] Can link to EscrowSplitTemplate/invoice later
- [ ] Dispute freezes agreement
- [ ] Status transitions: Draft → Active → Fulfilled/Disputed → Resolved
- [ ] Events: AgreementCreated, PartySigned, AgreementActivated, StatusUpdated, DisputeRaised, DisputeResolved

### EscrowSplitTemplate.sol
- [ ] Recipients sum to 100% (10000 bps)
- [ ] Funding distributes correctly to all recipients
- [ ] Works with: supplier, freight, tax, insurance, platform, investor
- [ ] Optional: can link to AgreementTemplate
- [ ] Optional: milestones supported
- [ ] Dispute prevents distribution
- [ ] Reputation updated on completion

### InvoiceTemplate.sol
- [ ] Issuer can create invoice
- [ ] Payer must accept before payment
- [ ] Can mark as financed (for future marketplace)
- [ ] Optional: can link to AgreementTemplate
- [ ] Settle transfers amount to issuer
- [ ] Default after due date if unpaid
- [ ] Events for marketplace discovery

## Test Commands
```bash
# Run all tests
npx hardhat test

# Run only Solidity tests
npx hardhat test solidity

# Run only TypeScript integration tests
npx hardhat test nodejs

# Run with coverage (if added)
npx hardhat coverage
```

## Expected Event Emissions (for workflow engine)
```solidity
// Identity events
event IdentityRegistered(uint256 indexed id, address indexed owner, bytes32 companyHash);
event IdentityDeactivated(uint256 indexed id);

// Reputation events
event ReputationUpdated(address indexed party, uint256 completed, uint256 disputed, uint256 score);

// Agreement events
event AgreementCreated(uint256 indexed agreementId, address indexed creator, uint8 agreementType);
event PartySigned(uint256 indexed agreementId, uint256 indexed identityId, uint8 role);
event AgreementActivated(uint256 indexed agreementId);
event AgreementStatusUpdated(uint256 indexed agreementId, uint8 oldStatus, uint8 newStatus);
event DisputeRaised(uint256 indexed agreementId, address indexed raisedBy);
event DisputeResolved(uint256 indexed agreementId, uint8 resolution);

// Escrow events
event EscrowFunded(uint256 indexed dealId, address indexed payer, uint256 amount);
event MilestoneApproved(uint256 indexed dealId, uint256 milestoneIndex);
event MilestoneReleased(uint256 indexed dealId, uint256 milestoneIndex, uint256 amount);
event FundsDistributed(uint256 indexed dealId);
event DisputeRaisedEscrow(uint256 indexed dealId);
event DisputeResolvedEscrow(uint256 indexed dealId, uint8 action);

// Invoice events
event InvoiceCreated(uint256 indexed invoiceId, address indexed issuer, address indexed payer, uint256 amount);
event InvoiceAccepted(uint256 indexed invoiceId);
event InvoiceFinanced(uint256 indexed invoiceId, address indexed financier);
event InvoiceSettled(uint256 indexed invoiceId);
event InvoiceDefaulted(uint256 indexed invoiceId);
```

---

## File Structure (Final)
```
hardhat-project/
├── contracts/
│   ├── Identity.sol
│   ├── Reputation.sol
│   ├── TemplateRegistry.sol
│   ├── AgreementTemplate.sol      ← NEW: Business deal without money
│   ├── EscrowSplitTemplate.sol    ← Handles all money flows
│   ├── InvoiceTemplate.sol
│   ├── base/
│   │   └── BaseTemplate.sol
│   ├── access/
│   │   └── TemplateAccess.sol
│   ├── interfaces/
│   │   ├── ITemplate.sol
│   │   ├── IReputation.sol
│   │   └── IIdentity.sol
│   ├── Identity.t.sol
│   ├── Reputation.t.sol
│   ├── TemplateRegistry.t.sol
│   ├── AgreementTemplate.t.sol
│   ├── EscrowSplitTemplate.t.sol
│   └── InvoiceTemplate.t.sol
├── test/
│   ├── Identity.integration.ts
│   ├── Agreement.integration.ts
│   ├── SplitEscrow.integration.ts
│   └── Invoice.integration.ts
├── ignition/
│   └── modules/
│       ├── 01_Identity.ts
│       ├── 02_Reputation.ts
│       ├── 03_TemplateRegistry.ts
│       ├── 04_AgreementTemplate.ts
│       ├── 05_EscrowSplitTemplate.ts
│       └── 06_InvoiceTemplate.ts
└── scripts/
    ├── deploy-full-protocol.ts
    └── export-abis.ts
```

---

## Value Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         FULL WORKFLOW EXAMPLE                           │
│                    (Purchase Order → Settlement)                        │
└─────────────────────────────────────────────────────────────────────────┘

    BUYER                           SUPPLIER                         PLATFORM
      │                                │                                 │
      │  ── createAgreement(PurchaseOrder) ─────────────────────────────→ │
      │                                │                                 │
      │  ←── AgreementCreated(1) ──────┤                                 │
      │                                │                                 │
      │  ── signAgreement(1) ─────────→ │                                 │
      │                                │  ←── PartySigned(1) ──────────── │
      │                                │  ── signAgreement(1) ─────────→ │
      │  ←── AgreementActivated(1) ───┤                                 │
      │                                │                                 │
      │  [Off-chain: production, shipment tracking]                       │
      │                                │                                 │
      │  ── createInvoice(payer, 100K, dueDate, 1) ────────────────────→ │
      │                                │                                 │
      │  ←── InvoiceCreated(42) ───────┤                                 │
      │                                │                                 │
      │  ── acceptInvoice(42) ────────→ │                                 │
      │                                │  ←── InvoiceAccepted(42) ────── │
      │                                │                                 │
      │  [Future: Invoice financed by Investor on marketplace]            │
      │                                │                                 │
      │  ── createSplitEscrow(                         ───────────────→ │
      │       payer, 100K,                                    ─────────→ │
      │       [supplier: 80%, freight: 15%, platform: 5%])              │
      │                                │                                 │
      │  ←── EscrowCreated(1) ─────────┤                                 │
      │                                │                                 │
      │  ── fundEscrow() ────────────→ │                                 │
      │                                │  ←── EscrowFunded(1, 100K) ──── │
      │                                │                                 │
      │  [Milestone fulfilled]         │                                 │
      │  ── approveMilestone(0) ──────→│                                 │
      │                                │                                 │
      │  ── distributeMilestone(0) ──→ │                                 │
      │                                │  ←── MilestoneReleased(0, 80K) ─│
      │                                │  ←── FundsDistributed ─────────│
      │                                │                                 │
      │  [Agreement fulfilled]         │                                 │
      │  ── updateStatus(1, Fulfilled) ────────────────────────────────→ │
      │                                │                                 │
      │  ←── AgreementFulfilled(1) ───┤                                 │
      │                                │                                 │
      │  ←── ReputationUpdated ─────────┤  ←── ReputationUpdated ───────│
      │      (buyer)                        (supplier)                      │
      │                                │                                 │
```

---

## Extension Points (Future Templates)

The architecture supports adding more templates without modifying core contracts:

```
AgreementTemplate.sol ── already supports:
  - PurchaseOrder
  - TradeDeal
  - ServiceContract
  - ProcurementRequest
  - ImportContract
  - ExportContract

Future templates can be added to TemplateRegistry:
  - PayrollTemplate.sol      (salary disbursement)
  - RoyaltyTemplate.sol      (IP licensing)
  - SupplyChainTemplate.sol   (multi-tier supply chain)
  - CarbonCreditTemplate.sol  (environmental compliance)
```
