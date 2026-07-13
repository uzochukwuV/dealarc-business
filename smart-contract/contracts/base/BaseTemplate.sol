// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "../interfaces/ITemplate.sol";
import {TemplateAccess} from "../access/TemplateAccess.sol";
import {IVerification} from "../interfaces/IVerification.sol";

/// @title BaseTemplate
/// @notice Base contract with shared functionality for all templates
abstract contract BaseTemplate is ITemplate, TemplateAccess {
    /// @notice Address of the reputation contract
    address public immutable REPUTATION;

    /// @notice Address of the template registry
    address public immutable REGISTRY;

    /// @notice Address of the verification registry
    address public immutable VERIFICATION;

    /// @notice Protocol owner
    address public owner;

    /// @notice Modifier to ensure deal is in valid state for transition
    modifier onlyWhenNotFinalized(DealState current) {
        require(
            current != DealState.Completed && current != DealState.Cancelled,
            "BaseTemplate: deal is finalized"
        );
        _;
    }

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    /// @param registry Address of the TemplateRegistry contract
    /// @param verification Address of the VerificationRegistry contract
    constructor(address reputation, address registry, address verification) {
        require(reputation != address(0), "BaseTemplate: reputation is zero address");
        require(registry != address(0), "BaseTemplate: registry is zero address");
        REPUTATION = reputation;
        REGISTRY = registry;
        VERIFICATION = verification;
        owner = msg.sender;
    }

    /// @notice Validate that address is verified
    modifier onlyVerified(address account) {
        if (VERIFICATION != address(0)) {
            require(
                IVerification(VERIFICATION).isVerified(account),
                "BaseTemplate: account not verified"
            );
        }
        _;
    }

    /// @notice Validate approval rules
    /// @param rules Array of approval rules
    /// @param approvals Map of party role to approval status
    function _validateApprovals(
        ApprovalRule[] calldata rules,
        mapping(PartyRole => bool) storage approvals
    ) internal view {
        for (uint256 i = 0; i < rules.length; i++) {
            if (rules[i].required && !approvals[rules[i].role]) {
                revert("BaseTemplate: required approval missing");
            }
        }
    }

    /// @notice Get DealState as string for events
    function _dealStateToUint8(DealState state) internal pure returns (uint8) {
        return uint8(state);
    }
}
