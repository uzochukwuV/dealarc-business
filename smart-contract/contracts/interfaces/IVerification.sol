// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IVerification
/// @notice Interface for on-chain verification attestation
interface IVerification {
    /// @notice Attestation structure for verified claims
    struct Attestation {
        bytes32 claim;
        address issuer;
        uint256 issuedAt;
        uint256 expiresAt;
        bool revoked;
    }
    
    /// @notice Set an attestation for an organization
    /// @param org Address of the organization
    /// @param attestation The attestation data
    function setAttestation(address org, Attestation calldata attestation) external;
    
    /// @notice Revoke an attestation
    /// @param org Address of the organization
    function revokeAttestation(address org) external;
    
    /// @notice Check if an organization is verified
    /// @param org Address of the organization
    /// @return isVerified True if the organization has a valid attestation
    function isVerified(address org) external view returns (bool isVerified);
    
    /// @notice Get attestation for an organization
    /// @param org Address of the organization
    /// @return attestation The attestation data
    function getAttestation(address org) external view returns (Attestation memory attestation);
}
