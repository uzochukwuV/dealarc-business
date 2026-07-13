// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IIdentity} from "./interfaces/IIdentity.sol";

/// @title Identity
/// @notice Non-transferable organizational passport
/// @dev Each organization gets one identity tied to their wallet address
contract Identity is IIdentity {
    /// @notice Mapping from identity ID to identity data
    mapping(uint256 => IdentityData) private _identities;

    /// @notice Mapping from owner address to identity ID
    mapping(address => uint256) private _ownerToId;

    /// @notice Total count of identities
    uint256 private _identityCount;

    /// @notice Emitted when a new identity is registered
    event IdentityRegistered(uint256 indexed id, address indexed owner, bytes32 companyHash);

    /// @notice Emitted when an identity is deactivated
    event IdentityDeactivated(uint256 indexed id);

    /// @notice Emitted when an identity is reactivated
    event IdentityReactivated(uint256 indexed id, bytes32 companyHash);

    /// @notice Emitted when company hash is updated
    event CompanyHashUpdated(uint256 indexed id, bytes32 oldHash, bytes32 newHash);

    /// @notice Register a new organizational identity
    /// @dev One identity per address - cannot register twice
    /// @param companyHash IPFS hash or similar reference to company documents
    /// @return id The newly created identity ID
    function registerIdentity(bytes32 companyHash) external returns (uint256 id) {
        require(companyHash != bytes32(0), "Identity: companyHash cannot be zero");
        require(_ownerToId[msg.sender] == 0, "Identity: already registered");

        _identityCount++;
        id = _identityCount;

        _identities[id] = IdentityData({
            id: id,
            owner: msg.sender,
            companyHash: companyHash,
            active: true,
            registeredAt: block.timestamp
        });

        _ownerToId[msg.sender] = id;

        emit IdentityRegistered(id, msg.sender, companyHash);
    }

    /// @notice Deactivate own identity
    /// @dev Self-deactivation only - identity record preserved for history
    function deactivateIdentity() external {
        uint256 id = _ownerToId[msg.sender];
        require(id != 0, "Identity: not registered");
        require(_identities[id].active, "Identity: already inactive");

        _identities[id].active = false;

        emit IdentityDeactivated(id);
    }

    /// @notice Reactivate own identity
    /// @param companyHash Updated company hash (in case documents changed)
    function reactivateIdentity(bytes32 companyHash) external {
        require(companyHash != bytes32(0), "Identity: companyHash cannot be zero");
        uint256 id = _ownerToId[msg.sender];
        require(id != 0, "Identity: not registered");
        require(!_identities[id].active, "Identity: already active");

        _identities[id].active = true;
        _identities[id].companyHash = companyHash;

        emit IdentityReactivated(id, companyHash);
    }

    /// @notice Update company information hash
    /// @param newHash New IPFS hash or reference
    function updateCompanyHash(bytes32 newHash) external {
        require(newHash != bytes32(0), "Identity: companyHash cannot be zero");
        uint256 id = _ownerToId[msg.sender];
        require(id != 0, "Identity: not registered");

        bytes32 oldHash = _identities[id].companyHash;
        _identities[id].companyHash = newHash;

        emit CompanyHashUpdated(id, oldHash, newHash);
    }

    /// @notice Get identity data by ID
    /// @param id The identity ID
    /// @return data The identity data struct
    function getIdentity(uint256 id) external view returns (IdentityData memory data) {
        require(id != 0 && id <= _identityCount, "Identity: invalid id");
        return _identities[id];
    }

    /// @notice Get identity by owner address
    /// @param owner The owner's address
    /// @return data The identity data struct
    function getIdentityByOwner(address owner) external view returns (IdentityData memory data) {
        uint256 id = _ownerToId[owner];
        require(id != 0, "Identity: owner has no identity");
        return _identities[id];
    }

    /// @notice Check if an address has an active identity
    /// @param owner The address to check
    /// @return isActive True if the address has an active identity
    function isActiveIdentity(address owner) external view returns (bool isActive) {
        uint256 id = _ownerToId[owner];
        if (id == 0) return false;
        return _identities[id].active;
    }

    /// @notice Get the total number of identities
    /// @return count Total registered identities
    function getIdentityCount() external view returns (uint256 count) {
        return _identityCount;
    }
}
