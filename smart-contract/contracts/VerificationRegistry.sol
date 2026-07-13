// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IVerification} from "./interfaces/IVerification.sol";

/// @title VerificationRegistry
/// @notice On-chain mirror of backend KYC verification
/// @dev Stores attestations issued by backend-controlled wallet
/// @dev Keeps real KYC data in encrypted Postgres/IPFS, contract only has yes/no
contract VerificationRegistry is IVerification {
    /// @notice Mapping from organization address to attestation
    mapping(address => Attestation) private _attestations;

    /// @notice Protocol owner - can set/revoke attestations
    address public owner;

    /// @notice Emitted when attestation is set
    event AttestationSet(
        address indexed org,
        bytes32 claim,
        address indexed issuer,
        uint256 expiresAt
    );

    /// @notice Emitted when attestation is revoked
    event AttestationRevoked(address indexed org);

    /// @notice Constructor
    constructor() {
        owner = msg.sender;
    }

    /// @notice Modifier to restrict to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "VerificationRegistry: caller is not owner");
        _;
    }

    /// @notice Transfer ownership
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "VerificationRegistry: new owner is zero address");
        owner = newOwner;
    }

    /// @notice Set an attestation for an organization (owner/backend only)
    /// @param org Address of the organization
    /// @param attestation The attestation data
    function setAttestation(address org, Attestation calldata attestation) external onlyOwner {
        require(org != address(0), "VerificationRegistry: org is zero address");
        require(attestation.expiresAt > block.timestamp, "VerificationRegistry: expiresAt must be in future");
        require(attestation.issuer != address(0), "VerificationRegistry: issuer is zero address");

        _attestations[org] = Attestation({
            claim: attestation.claim,
            issuer: attestation.issuer,
            issuedAt: block.timestamp,
            expiresAt: attestation.expiresAt,
            revoked: false
        });

        emit AttestationSet(org, attestation.claim, attestation.issuer, attestation.expiresAt);
    }

    /// @notice Revoke an attestation (owner/backend only)
    /// @param org Address of the organization
    function revokeAttestation(address org) external onlyOwner {
        require(org != address(0), "VerificationRegistry: org is zero address");
        require(_attestations[org].issuedAt != 0, "VerificationRegistry: attestation not found");
        
        _attestations[org].revoked = true;

        emit AttestationRevoked(org);
    }

    /// @notice Check if an organization is verified
    /// @param org Address of the organization
    /// @return isVerified True if the organization has a valid attestation
    function isVerified(address org) external view returns (bool isVerified) {
        Attestation memory att = _attestations[org];
        return !att.revoked && att.expiresAt > block.timestamp && att.issuedAt != 0;
    }

    /// @notice Get attestation for an organization
    /// @param org Address of the organization
    /// @return attestation The attestation data
    function getAttestation(address org) external view returns (Attestation memory attestation) {
        return _attestations[org];
    }
}
