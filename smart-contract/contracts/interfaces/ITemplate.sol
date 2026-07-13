// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title ITemplate
/// @notice Shared interfaces and enums for all templates
interface ITemplate {
    /// @notice Deal lifecycle states
    enum DealState {
        None,
        Created,
        Active,
        Disputed,
        Resolved,
        Completed,
        Cancelled
    }

    /// @notice Release mechanisms for escrow
    enum ReleaseType {
        Milestone,
        Time,
        Manual
    }

    /// @notice Party roles in agreements
    enum PartyRole {
        Buyer,
        Supplier,
        Freight,
        Tax,
        Insurance,
        Platform,
        Investor,
        Admin
    }

    /// @notice Agreement types
    enum AgreementType {
        PurchaseOrder,
        TradeDeal,
        ServiceContract,
        ProcurementRequest,
        ImportContract,
        ExportContract
    }

    /// @notice Invoice status
    enum InvoiceState {
        None,
        Created,
        Accepted,
        Financed,
        Settled,
        Defaulted,
        Cancelled
    }

    /// @notice Generic approval rule
    struct ApprovalRule {
        PartyRole role;
        bool required;
    }

    /// @notice Generic release rule
    struct ReleaseRule {
        ReleaseType ruleType;
        uint256 value; // milestone index OR timestamp
    }

    /// @notice Dispute resolution outcomes
    enum DisputeResolution {
        Pending,
        BuyerWins,
        SellerWins,
        Split,
        Cancelled
    }
}
