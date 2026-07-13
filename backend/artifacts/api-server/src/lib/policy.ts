/**
 * Policy engine — maps verification status to allowed wallet/deal actions.
 * All gates live here so they're easy to find and change.
 */

export type VerificationStatus =
  | "UNVERIFIED"
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED";

export interface WalletPolicy {
  canViewBalance: boolean;
  canReceiveFunds: boolean;
  canFundEscrow: boolean;
  canReleaseSettle: boolean;
  canWithdraw: boolean;
}

const POLICIES: Record<VerificationStatus, WalletPolicy> = {
  UNVERIFIED: {
    canViewBalance: true,
    canReceiveFunds: false,
    canFundEscrow: false,
    canReleaseSettle: false,
    canWithdraw: false,
  },
  PENDING: {
    canViewBalance: true,
    canReceiveFunds: true,
    canFundEscrow: false,
    canReleaseSettle: false,
    canWithdraw: false,
  },
  VERIFIED: {
    canViewBalance: true,
    canReceiveFunds: true,
    canFundEscrow: true,
    canReleaseSettle: true,
    canWithdraw: true,
  },
  REJECTED: {
    canViewBalance: true,
    canReceiveFunds: false,
    canFundEscrow: false,
    canReleaseSettle: false,
    canWithdraw: true, // can withdraw own funds only
  },
  EXPIRED: {
    canViewBalance: true,
    canReceiveFunds: false,
    canFundEscrow: false,
    canReleaseSettle: false,
    canWithdraw: true,
  },
};

export function getWalletPolicy(status: VerificationStatus): WalletPolicy {
  return POLICIES[status] ?? POLICIES.UNVERIFIED;
}

export function requireKybVerified(status: string): void {
  if (status !== "VERIFIED") {
    throw new PolicyError(
      `Organization must be KYB-verified for this action. Current status: ${status}`,
      403,
    );
  }
}

export class PolicyError extends Error {
  constructor(
    message: string,
    public statusCode = 403,
  ) {
    super(message);
    this.name = "PolicyError";
  }
}

/**
 * Determine approval policy tier from deal value (USD).
 */
export function getApprovalTier(dealValueUsd: number): string {
  if (dealValueUsd < 2_000) return "TIER_1"; // finance only
  if (dealValueUsd < 20_000) return "TIER_2"; // finance + dept head
  return "TIER_3"; // finance + legal + director
}

export function getRequiredApprovers(tier: string, orgRole: string): string[] {
  switch (tier) {
    case "TIER_1":
      return ["FINANCE"];
    case "TIER_2":
      return ["FINANCE", "ADMIN"];
    case "TIER_3":
      return ["FINANCE", "ADMIN", "OWNER"];
    default:
      return ["FINANCE"];
  }
}
