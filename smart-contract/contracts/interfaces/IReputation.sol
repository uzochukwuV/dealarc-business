// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IReputation
/// @notice Interface for the Reputation contract
interface IReputation {
    struct ReputationData {
        uint256 completedDeals;
        uint256 disputedDeals;
        uint256 financedDeals;
        uint256 totalVolume;
        uint256 score;
    }

    /// @notice Record a successful settlement
    function recordSuccessfulSettlement(address party, uint256 volume) external;

    /// @notice Record a disputed deal
    function recordDispute(address party) external;

    /// @notice Record a default (unpaid obligation)
    function recordDefault(address party) external;

    /// @notice Record a financed deal
    function recordFinancedDeal(address party, uint256 volume) external;

    /// @notice Get reputation data for an address
    function getReputation(address party) external view returns (ReputationData memory);

    /// @notice Check if a caller is an authorized template
    function isAuthorizedTemplate(address template) external view returns (bool);

    /// @notice Authorize a template contract
    function authorizeTemplate(address template) external;

    /// @notice Revoke template authorization
    function revokeTemplate(address template) external;
}
