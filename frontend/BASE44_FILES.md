# Base44 Files — Fix Tracker

50 source files reference `base44`. Grouped by domain so they can be fixed set by set.

## Status so far
- [x] `@/App.jsx` import error (vite.config.js alias added) — DONE
- [ ] `@base44/sdk` not installed — only `lib/AuthContext.jsx` imports it directly (the [B] blocker below)

## Legend
- `[A]`  imports `base44` via `@/api/base44Client` (resolves fine; fix by editing the client)
- `[B]`  imports directly from `@base44/sdk/...` (BLOCKER — package not installed)
- `[str]` only uses `base44_` storage-key strings, no import (low risk)

---

## 1. Auth & Account  (fix first — contains the [B] blocker)
- [ ] `lib/AuthContext.jsx`  **[B] BLOCKER** — `import { createAxiosClient } from '@base44/sdk/dist/utils/axios-client'`
- [ ] `pages/Login.jsx`  [A]
- [ ] `pages/Register.jsx`  [A]
- [ ] `pages/ForgotPassword.jsx`  [A]
- [ ] `pages/ResetPassword.jsx`  [A]
- [ ] `components/SplitAuthLayout.jsx`  [str]
- [ ] `lib/app-params.js`  [str]

## 2. Onboarding
- [ ] `hooks/useOnboarding.js`  [A]
- [ ] `pages/onboarding/OnboardingOrganization.jsx`  [A]
- [ ] `pages/onboarding/OnboardingDocuments.jsx`  [A]
- [ ] `pages/onboarding/OnboardingTeam.jsx`  [A]
- [ ] `pages/onboarding/OnboardingPending.jsx`  [A]

## 3. Organizations
- [ ] `backend/organisations.ts`  [A]
- [ ] `pages/organization/OrganizationProfile.jsx`  [A]
- [ ] `pages/organization/OrganizationTeam.jsx`  [A]
- [ ] `pages/organization/OrganizationVerification.jsx`  [A]
- [ ] `pages/organization/OrganizationWallets.jsx`  [A]
- [ ] `pages/organization/OrganizationApprovalPolicies.jsx`  [A]

## 4. Workspaces  (core entity + tabs + backend)
- [ ] `pages/Workspaces.jsx`  [A]
- [ ] `components/workspace/WorkspaceShell.jsx`  [A]
- [ ] `components/workspace/tabs/ChatTab.jsx`  [A]
- [ ] `components/workspace/tabs/RequirementsTab.jsx`  [A]
- [ ] `components/workspace/tabs/DocumentsTab.jsx`  [A]
- [ ] `components/workspace/tabs/TermsTab.jsx`  [A]
- [ ] `components/workspace/tabs/ApprovalsTab.jsx`  [A]
- [ ] `components/workspace/tabs/ContractTab.jsx`  [A]
- [ ] `components/workspace/tabs/ExecutionTab.jsx`  [A]
- [ ] `components/workspace/tabs/DisputeTab.jsx`  [A]
- [ ] `backend/workspaces.ts`  [A]
- [ ] `backend/requirements.ts`  [A]
- [ ] `backend/proposals.ts`  [A]
- [ ] `backend/milestones.ts`  [A]
- [ ] `backend/approvals.ts`  [A]
- [ ] `backend/agreements.ts`  [A]
- [ ] `backend/disputes.ts`  [A]
- [ ] `backend/types.ts`  [str]

## 5. Discovery & Connections
- [ ] `pages/Discover.jsx`  [A]
- [ ] `components/discover/ConnectionRequestDialog.jsx`  [A]
- [ ] `pages/BusinessProfile.jsx`  [A]
- [ ] `pages/OpportunityDetail.jsx`  [A]
- [ ] `backend/connections.ts`  [A]

## 6. Contracts & Payments
- [ ] `pages/Contracts.jsx`  [A]
- [ ] `pages/Payments.jsx`  [A]
- [ ] `pages/TransactionDetail.jsx`  [A]

## 7. Reputation
- [ ] `pages/Reputation.jsx`  [A]
- [ ] `backend/reputation.ts`  [A]

## 8. Settings
- [ ] `pages/settings/SettingsAccount.jsx`  [A]
- [ ] `pages/settings/SettingsNotifications.jsx`  [A]

## 9. App Shell / Routing / Misc
- [ ] `components/app/AppShell.jsx`  [A]
- [ ] `lib/PageNotFound.jsx`  [A]

---

## Counts
- Total: 50
- [A] via client: 46
- [B] direct SDK (blocker): 1  (`lib/AuthContext.jsx`)
- [str] string-only: 3  (`backend/types.ts`, `components/SplitAuthLayout.jsx`, `lib/app-params.js`)

## Note
File on disk is spelled `organisations.ts` (British) — your message said `organizations.ts`. Same file.
