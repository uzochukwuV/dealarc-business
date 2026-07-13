Submission — The Stablecoins Commerce Stack Challenge (Arc
/ Circle)
Title
Hardbusiness — Verified B2B Trade Network with Stablecoin Escrow Settlement
Short Description
A verified business-to-business network where companies discover trustworthy
counterparties, negotiate privately in a structured Deal Workspace, and settle trade
agreements through milestone-gated USDC escrow — reducing both the discovery-trust
problem and the settlement-protection problem that block cross-border B2B trade today.
Track Submitted For
Track 2 — Best SME Trade Finance & Working Capital Workflow (Invoices, Escrow,
Settlement)
This is the closest fit: the product is a stablecoin escrow + invoice/receivables settlement
system for SMEs doing cross-border trade, with milestone-based release and a portable on
chain reputation record functioning as a verifiable payment history ("credit passport").
Email Associated with Circle Developer Account
vic.ezealor@gmail.com
Circle Products Used on Arc
USDC — settlement asset for all escrow, milestone, and invoice flows
Wallets — Circle user-controlled wallets (one per business org, abstracts away seed
phrases/gas) and developer-controlled wallets (platform-side treasury/keeper operations)
Gateway
CCTP / Bridge Kit
USYC
StableFX
Nanopayments
Functional MVP
Demo app:
Repo:
https://equals-deal-flow.base44.app/
https://github.com/uuzor/hardbusiness
Current state:
Smart contract suite: 
Identity 
, 
Reputation 
, 
TemplateRegistry 
,
AgreementTemplate 
, 
EscrowSplitTemplate 
, 
InvoiceTemplate
Backend: organization registration, KYC review flow, IPFS document
encryption/pinning, Circle wallet auto-provisioning
Deal lifecycle demonstrated: register → verify → discover → connect → negotiate in
Deal Workspace → sign agreement (hash-anchored) → fund escrow in USDC →
milestone release → reputation recorded on-chain
Architecture diagram:
text
Frontend (Next.js: Discover / Connections / Workspaces / Contracts / Payments / 
│ REST API
Backend (org, users, deals, verification queue, policy engine)
│            
│                  
Document      
Service       
Wallet Service     
(Circle SDK)       
│                  
(encrypt,        
pin, hash)   Circle API         
│          
IPFS           
(Pinata/         
(user + dev            
controlled            
wallets)            
Web3.Storage)                       
│
Chain Indexer
(mirrors on-chain state)
│
Contracts
├
─ Identity
├
─ Reputation
├
─ TemplateRegistry
├
─ AgreementTemplate
├
─ EscrowSplitTemplate
└─ InvoiceTemplate
Deal lifecycle: Registration → KYC review → Discovery → Connection →
Deal Workspace (requirements, proposals, terms, approvals) →
Agreement signed (hash anchored) → Escrow created → USDC funds escrow →
Milestone/delivery evidence → Buyer acceptance or dispute → Settlement →
Reputation recorded on-chain
Video Demonstration
https://youtube.com/shorts/3x0Yv8FLhgo?si=6X_wmmHMFn2l2Tm5
Demo Application URL
https://equals-deal-flow.base44.app/
GitHub / Code Repository
https://github.com/uuzor/hardbusiness
Circle Product Feedback
Why we chose these products: USDC as the settlement asset lets a first-time cross-border
counterparty pair transact without either side trusting the other's local banking rails, and
Circle's user-controlled wallets let us abstract "blockchain" away entirely — business
owners see a balance and a settlement status, never a seed phrase or a chain selector.
What worked well: The wallet UX abstraction was the single biggest unlock for a non
crypto-native SME audience — it let the product read as a normal fintech app rather than a
crypto app.
What could be improved: Onboarding/testnet documentation could be more explicit about
the flow for wiring a user-controlled wallet into a custom escrow contract rather than a
simple send/receive, since most sample material assumes direct wallet-to-wallet transfers.
Recommendations: More end-to-end sample apps showing Circle Wallets paired with a
custom smart-contract escrow layer (not just P2P transfer demos) would shorten
integration time for trade-finance-style use cases like this one.
Architecture and code developed for the 
hardbusiness
 project — full technical
documentation (
backend-architecture.md 
, 
deal-workspace-architecture.md 
,
frontend-architecture.md 
, 
smart-contract-architecture.md 
) is in the repository