// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "../interfaces/ITemplate.sol";

/// @title TemplateAccess
/// @notice Access control for template contracts
abstract contract TemplateAccess {
    /// @notice Emitted when unauthorized access is attempted
    event UnauthorizedAccess(address indexed caller, bytes32 indexed context);

    /// @notice Modifier to check if caller is authorized template
    modifier onlyAuthorizedTemplate(address reputationContract) {
        require(
            IReputation(reputationContract).isAuthorizedTemplate(msg.sender),
            "TemplateAccess: caller is not authorized"
        );
        _;
    }

    /// @notice Modifier to check if caller is registry
    modifier onlyRegistry(address registryContract) {
        require(
            msg.sender == registryContract,
            "TemplateAccess: caller is not registry"
        );
        _;
    }
}

/// @notice Interface for Reputation to avoid circular import
interface IReputation {
    function isAuthorizedTemplate(address template) external view returns (bool);
}
