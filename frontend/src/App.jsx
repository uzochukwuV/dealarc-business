import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClientInstance } from '@/lib/query-client';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import OnboardingOrganization from '@/pages/onboarding/OnboardingOrganization';
import OnboardingDocuments from '@/pages/onboarding/OnboardingDocuments';
import OnboardingTeam from '@/pages/onboarding/OnboardingTeam';
import OnboardingPending from '@/pages/onboarding/OnboardingPending';
import AppShell from '@/components/app/AppShell';
import ComingSoon from '@/components/app/ComingSoon';
import Discover from '@/pages/Discover';
import BusinessProfile from '@/pages/BusinessProfile';
import OpportunityDetail from '@/pages/OpportunityDetail';
import Connections from '@/pages/Connections';
import Contracts from '@/pages/Contracts';
import ContractTemplates from '@/pages/ContractTemplates';
import Payments from '@/pages/Payments';
import TransactionDetail from '@/pages/TransactionDetail';
import Reputation from '@/pages/Reputation';
import Workspaces from '@/pages/Workspaces';
import WorkspaceShell from '@/components/workspace/WorkspaceShell';
import ChatTab from '@/components/workspace/tabs/ChatTab';
import RequirementsTab from '@/components/workspace/tabs/RequirementsTab';
import ProposalsTab from '@/components/workspace/tabs/ProposalsTab';
import DocumentsTab from '@/components/workspace/tabs/DocumentsTab';
import TermsTab from '@/components/workspace/tabs/TermsTab';
import ApprovalsTab from '@/components/workspace/tabs/ApprovalsTab';
import ContractTab from '@/components/workspace/tabs/ContractTab';
import ExecutionTab from '@/components/workspace/tabs/ExecutionTab';
import DisputeTab from '@/components/workspace/tabs/DisputeTab';
import OrganizationLayout from '@/components/organization/OrganizationLayout';
import OrganizationProfile from '@/pages/organization/OrganizationProfile';
import OrganizationTeam from '@/pages/organization/OrganizationTeam';
import OrganizationVerification from '@/pages/organization/OrganizationVerification';
import OrganizationWallets from '@/pages/organization/OrganizationWallets';
import OrganizationApprovalPolicies from '@/pages/organization/OrganizationApprovalPolicies';
import SettingsLayout from '@/components/settings/SettingsLayout';
import SettingsAccount from '@/pages/settings/SettingsAccount';
import SettingsNotifications from '@/pages/settings/SettingsNotifications';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-foreground/15 border-t-foreground rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/discover" element={<Discover />} />
          <Route path="/discover/business/:orgId" element={<BusinessProfile />} />
          <Route path="/discover/opportunities/:opportunityId" element={<OpportunityDetail />} />
          <Route path="/connections" element={<Connections />} />
          <Route path="/workspaces" element={<Workspaces />} />
          <Route path="/workspaces/:workspaceId" element={<WorkspaceShell />}>
            <Route index element={<Navigate to="chat" replace />} />
            <Route path="chat" element={<ChatTab />} />
            <Route path="requirements" element={<RequirementsTab />} />
            <Route path="proposals" element={<ProposalsTab />} />
            <Route path="documents" element={<DocumentsTab />} />
            <Route path="terms" element={<TermsTab />} />
            <Route path="approvals" element={<ApprovalsTab />} />
            <Route path="contract" element={<ContractTab />} />
            <Route path="execution" element={<ExecutionTab />} />
            <Route path="dispute" element={<DisputeTab />} />
          </Route>
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/contracts/templates" element={<ContractTemplates />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/payments/:transactionId" element={<TransactionDetail />} />
          <Route path="/organization" element={<OrganizationLayout />}>
            <Route index element={<Navigate to="profile" replace />} />
            <Route path="profile" element={<OrganizationProfile />} />
            <Route path="team" element={<OrganizationTeam />} />
            <Route path="verification" element={<OrganizationVerification />} />
            <Route path="wallets" element={<OrganizationWallets />} />
            <Route path="approval-policies" element={<OrganizationApprovalPolicies />} />
          </Route>
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="account" replace />} />
            <Route path="account" element={<SettingsAccount />} />
            <Route path="notifications" element={<SettingsNotifications />} />
          </Route>
        </Route>
        <Route path="/onboarding/organization" element={<OnboardingOrganization />} />
        <Route path="/onboarding/documents" element={<OnboardingDocuments />} />
        <Route path="/onboarding/team" element={<OnboardingTeam />} />
        <Route path="/onboarding/pending" element={<OnboardingPending />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
