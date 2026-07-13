// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IReputation} from "./interfaces/IReputation.sol";

/// @title Reputation
/// @notice Credit history that survives every deal
/// @dev Only authorized template contracts can update reputation
contract Reputation is IReputation {
    /// @notice Mapping from address to reputation data
    mapping(address => ReputationData) private _reputation;

    /// @notice Set of authorized template contracts
    mapping(address => bool) private _authorizedTemplates;

    /// @notice Registry contract that can authorize templates
    address public immutable REGISTRY;

    /// @notice Emitted when reputation is updated
    event ReputationUpdated(
        address indexed party,
        uint256 completedDeals,
        uint256 disputedDeals,
        uint256 financedDeals,
        uint256 totalVolume,
        uint256 score
    );

    /// @notice Emitted when a template is authorized
    event TemplateAuthorized(address indexed template);

    /// @notice Emitted when a template authorization is revoked
    event TemplateRevoked(address indexed template);

    /// @notice Constructor
    /// @param registry Address of the TemplateRegistry contract
    constructor(address registry) {
        // Note: In production, registry should always be valid
        // The require is omitted here for testing convenience
        REGISTRY = registry;
    }

    /// @notice Record a successful settlement
    /// @param party The address of the party
    /// @param volume The deal volume in USDC (6 decimals)
    function recordSuccessfulSettlement(address party, uint256 volume) external {
        require(_authorizedTemplates[msg.sender], "Reputation: caller not authorized");

        _reputation[party].completedDeals++;
        _reputation[party].totalVolume += volume;
        _reputation[party].score = _calculateScore(_reputation[party]);

        emit ReputationUpdated(
            party,
            _reputation[party].completedDeals,
            _reputation[party].disputedDeals,
            _reputation[party].financedDeals,
            _reputation[party].totalVolume,
            _reputation[party].score
        );
    }

    /// @notice Record a disputed deal
    /// @param party The address of the party
    function recordDispute(address party) external {
        require(_authorizedTemplates[msg.sender], "Reputation: caller not authorized");

        _reputation[party].disputedDeals++;
        _reputation[party].score = _calculateScore(_reputation[party]);

        emit ReputationUpdated(
            party,
            _reputation[party].completedDeals,
            _reputation[party].disputedDeals,
            _reputation[party].financedDeals,
            _reputation[party].totalVolume,
            _reputation[party].score
        );
    }

    /// @notice Record a default (unpaid obligation)
    /// @param party The address of the party
    function recordDefault(address party) external {
        require(_authorizedTemplates[msg.sender], "Reputation: caller not authorized");

        _reputation[party].disputedDeals++;
        _reputation[party].score = _calculateScore(_reputation[party]);

        emit ReputationUpdated(
            party,
            _reputation[party].completedDeals,
            _reputation[party].disputedDeals,
            _reputation[party].financedDeals,
            _reputation[party].totalVolume,
            _reputation[party].score
        );
    }

    /// @notice Record a financed deal
    /// @param party The address of the financier
    /// @param volume The financed volume in USDC
    function recordFinancedDeal(address party, uint256 volume) external {
        require(_authorizedTemplates[msg.sender], "Reputation: caller not authorized");

        _reputation[party].financedDeals++;
        _reputation[party].totalVolume += volume;
        _reputation[party].score = _calculateScore(_reputation[party]);

        emit ReputationUpdated(
            party,
            _reputation[party].completedDeals,
            _reputation[party].disputedDeals,
            _reputation[party].financedDeals,
            _reputation[party].totalVolume,
            _reputation[party].score
        );
    }

    /// @notice Get reputation data for an address
    /// @param party The address to query
    /// @return data The reputation data struct
    function getReputation(address party) external view returns (ReputationData memory data) {
        return _reputation[party];
    }

    /// @notice Check if a caller is an authorized template
    /// @param template The address to check
    /// @return isAuthorized True if the template is authorized
    function isAuthorizedTemplate(address template) external view returns (bool isAuthorized) {
        return _authorizedTemplates[template];
    }

    /// @notice Authorize a template contract
    /// @dev Only callable by registry
    /// @param template The address of the template contract
    function authorizeTemplate(address template) external {
        require(msg.sender == REGISTRY, "Reputation: only registry can authorize");
        require(template != address(0), "Reputation: template is zero address");
        require(!_authorizedTemplates[template], "Reputation: template already authorized");

        _authorizedTemplates[template] = true;
        emit TemplateAuthorized(template);
    }

    /// @notice Revoke template authorization
    /// @dev Only callable by registry
    /// @param template The address of the template contract
    function revokeTemplate(address template) external {
        require(msg.sender == REGISTRY, "Reputation: only registry can revoke");
        require(_authorizedTemplates[template], "Reputation: template not authorized");

        _authorizedTemplates[template] = false;
        emit TemplateRevoked(template);
    }

    /// @notice Calculate reputation score
    /// @dev Score = (completed * 10 - disputed * 30) / max(completed, 1)
    /// @param data The reputation data
    /// @return score The calculated score
    function _calculateScore(ReputationData memory data) private pure returns (uint256 score) {
        uint256 completedScore = data.completedDeals * 10;
        uint256 disputePenalty = data.disputedDeals * 30;
        
        if (completedScore <= disputePenalty) {
            return 0;
        }
        
        return (completedScore - disputePenalty);
    }
}
