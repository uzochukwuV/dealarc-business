// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IArbitration
/// @notice Interface for arbitration services
interface IArbitration {
    /// @notice Dispute status
    enum DisputeStatus {
        None,
        Open,
        EvidenceSubmitted,
        Resolved,
        Closed
    }

    /// @notice Resolution outcome
    enum Resolution {
        Pending,
        BuyerWins,
        SellerWins,
        Split,
        Cancelled
    }

    /// @notice Evidence submitted by a party
    struct Evidence {
        address submittedBy;
        bytes32 evidenceHash;
        uint256 submittedAt;
    }

    /// @notice Open a dispute
    /// @param dealId The deal ID
    /// @param template The template contract address
    /// @param reason Reason for the dispute
    function openDispute(
        uint256 dealId, 
        address template, 
        string calldata reason
    ) external returns (uint256 disputeId);

    /// @notice Submit evidence for a dispute
    /// @param disputeId The dispute ID
    /// @param evidenceHash IPFS hash of evidence
    function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external;

    /// @notice Resolve a dispute (arbitrator only)
    /// @param disputeId The dispute ID
    /// @param resolution The resolution outcome
    function resolveDispute(uint256 disputeId, Resolution resolution) external;

    /// @notice Close a dispute (after resolution)
    /// @param disputeId The dispute ID
    function closeDispute(uint256 disputeId) external;

    /// @notice Get dispute status
    /// @param disputeId The dispute ID
    /// @return status The dispute status
    function getDisputeStatus(uint256 disputeId) external view returns (DisputeStatus status);

    /// @notice Check if deal has an open dispute
    /// @param dealId The deal ID
    /// @param template The template contract address
    /// @return hasDispute True if there's an open dispute
    function hasOpenDispute(uint256 dealId, address template) external view returns (bool hasDispute);
}
