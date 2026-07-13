// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IIdentity
/// @notice Interface for the Identity contract
interface IIdentity {
    struct IdentityData {
        uint256 id;
        address owner;
        bytes32 companyHash;
        bool active;
        uint256 registeredAt;
    }

    /// @notice Register a new organizational identity
    function registerIdentity(bytes32 companyHash) external returns (uint256);

    /// @notice Deactivate own identity
    function deactivateIdentity() external;

    /// @notice Reactivate own identity
    function reactivateIdentity(bytes32 companyHash) external;

    /// @notice Update company information hash
    function updateCompanyHash(bytes32 newHash) external;

    /// @notice Get identity data by ID
    function getIdentity(uint256 id) external view returns (IdentityData memory);

    /// @notice Get identity by owner address
    function getIdentityByOwner(address owner) external view returns (IdentityData memory);

    /// @notice Check if an address has an active identity
    function isActiveIdentity(address owner) external view returns (bool);

    /// @notice Get the total number of identities
    function getIdentityCount() external view returns (uint256);
}
