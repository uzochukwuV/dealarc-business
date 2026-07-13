// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";

// Use DealState from ITemplate

/// @title TemplateRegistry
/// @notice On-chain directory tracking template→deal→owner→state
/// @dev Single source of truth for deal creation and template authorization
contract TemplateRegistry {
    /// @notice Deal metadata stored on-chain
    struct DealInfo {
        address template;
        address creator;
        uint256 dealId;
        ITemplate.DealState state;
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Template information
    struct TemplateInfo {
        address templateAddress;
        string name;
        bool authorized;
        uint256 dealCount;
    }

    /// @notice Mapping from deal ID to deal info
    mapping(uint256 => DealInfo) private _deals;

    /// @notice Mapping from template address to template info
    mapping(address => TemplateInfo) private _templates;

    /// @notice Mapping from template to array of deal IDs
    mapping(address => uint256[]) private _templateDeals;

    /// @notice Total deal count
    uint256 private _dealCount;

    /// @notice Total template count
    uint256 private _templateCount;

    /// @notice List of all template addresses
    address[] private _templateList;

    /// @notice Reputation contract reference
    IReputation public immutable REPUTATION;

    /// @notice Protocol owner - can register/authorize templates
    address public owner;

    /// @notice Emitted when a new template is registered
    event TemplateRegistered(address indexed template, string name);

    /// @notice Emitted when a template is authorized
    event TemplateAuthorized(address indexed template);

    /// @notice Emitted when a template authorization is revoked
    event TemplateAuthorizationRevoked(address indexed template);

    /// @notice Emitted when a new deal is registered
    event DealCreated(
        uint256 indexed dealId,
        address indexed template,
        address indexed creator,
        ITemplate.DealState state
    );

    /// @notice Emitted when deal state is updated
    event DealStateUpdated(uint256 indexed dealId, ITemplate.DealState oldState, ITemplate.DealState newState);

    /// @notice Emitted when owner transfers ownership
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    constructor(address reputation) {
        owner = msg.sender;
        REPUTATION = IReputation(reputation);
    }

    /// @notice Modifier to restrict to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "TemplateRegistry: caller is not owner");
        _;
    }

    /// @notice Transfer ownership
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "TemplateRegistry: new owner is zero address");
        address previousOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(previousOwner, newOwner);
    }

    /// @notice Register a new template (owner only)
    /// @param templateAddress Address of the template contract
    /// @param name Human-readable name of the template
    function registerTemplate(address templateAddress, string calldata name) external onlyOwner {
        require(templateAddress != address(0), "TemplateRegistry: template is zero address");
        require(bytes(_templates[templateAddress].name).length == 0, 
            "TemplateRegistry: template already registered");
        require(bytes(name).length > 0, "TemplateRegistry: name cannot be empty");

        _templateCount++;
        _templates[templateAddress] = TemplateInfo({
            templateAddress: templateAddress,
            name: name,
            authorized: false,
            dealCount: 0
        });
        _templateList.push(templateAddress);

        emit TemplateRegistered(templateAddress, name);
    }

    /// @notice Authorize a registered template (owner only)
    /// @dev Also authorizes the template in the Reputation contract
    /// @param templateAddress Address of the template contract
    function authorizeTemplate(address templateAddress) external onlyOwner {
        require(bytes(_templates[templateAddress].name).length > 0, 
            "TemplateRegistry: template not registered");
        require(!_templates[templateAddress].authorized, 
            "TemplateRegistry: template already authorized");

        _templates[templateAddress].authorized = true;
        
        // Only call Reputation if it's set (not address(0))
        if (address(REPUTATION) != address(0)) {
            REPUTATION.authorizeTemplate(templateAddress);
        }

        emit TemplateAuthorized(templateAddress);
    }

    /// @notice Revoke template authorization (owner only)
    /// @dev Also revokes authorization in the Reputation contract
    /// @param templateAddress Address of the template contract
    function revokeTemplateAuthorization(address templateAddress) external onlyOwner {
        require(_templates[templateAddress].authorized, 
            "TemplateRegistry: template not authorized");

        _templates[templateAddress].authorized = false;
        
        // Only call Reputation if it's set (not address(0))
        if (address(REPUTATION) != address(0)) {
            REPUTATION.revokeTemplate(templateAddress);
        }

        emit TemplateAuthorizationRevoked(templateAddress);
    }

    /// @notice Register a new deal created by a template
    /// @param template Address of the template that created the deal
    /// @param creator Address that created the deal
    /// @return dealId The new deal ID
    function registerDeal(address template, address creator) external returns (uint256 dealId) {
        require(_templates[template].authorized, "TemplateRegistry: template not authorized");
        require(msg.sender == template, "TemplateRegistry: caller is not the template");

        _dealCount++;
        dealId = _dealCount;

        _deals[dealId] = DealInfo({
            template: template,
            creator: creator,
            dealId: dealId,
            state: ITemplate.DealState.Created,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        _templates[template].dealCount++;
        _templateDeals[template].push(dealId);

        emit DealCreated(dealId, template, creator, ITemplate.DealState.Created);
    }

    /// @notice Update deal state
    /// @param dealId The deal ID
    /// @param newState The new state
    function updateDealState(uint256 dealId, ITemplate.DealState newState) external {
        require(dealId != 0 && dealId <= _dealCount, "TemplateRegistry: invalid deal ID");
        require(msg.sender == _deals[dealId].template, "TemplateRegistry: caller is not the template");

        ITemplate.DealState oldState = _deals[dealId].state;
        _deals[dealId].state = newState;
        _deals[dealId].updatedAt = block.timestamp;

        emit DealStateUpdated(dealId, oldState, newState);
    }

    /// @notice Get deal information
    /// @param dealId The deal ID
    /// @return info The deal info struct
    function getDeal(uint256 dealId) external view returns (DealInfo memory info) {
        require(dealId != 0 && dealId <= _dealCount, "TemplateRegistry: invalid deal ID");
        return _deals[dealId];
    }

    /// @notice Get template information
    /// @param templateAddress The template address
    /// @return info The template info struct
    function getTemplate(address templateAddress) external view returns (TemplateInfo memory info) {
        require(_templates[templateAddress].templateAddress == templateAddress, 
            "TemplateRegistry: template not registered");
        return _templates[templateAddress];
    }

    /// @notice Get all deals for a template
    /// @param templateAddress The template address
    /// @return dealIds Array of deal IDs
    function getTemplateDeals(address templateAddress) external view returns (uint256[] memory dealIds) {
        return _templateDeals[templateAddress];
    }

    /// @notice Get all registered templates
    /// @return templates Array of template addresses
    function getAllTemplates() external view returns (address[] memory templates) {
        return _templateList;
    }

    /// @notice Check if a template is authorized
    /// @param templateAddress The template address
    /// @return isAuthorized True if the template is authorized
    function isTemplateAuthorized(address templateAddress) external view returns (bool isAuthorized) {
        return _templates[templateAddress].authorized;
    }

    /// @notice Get total deal count
    /// @return count Total number of deals
    function getDealCount() external view returns (uint256 count) {
        return _dealCount;
    }

    /// @notice Get total template count
    /// @return count Total number of registered templates
    function getTemplateCount() external view returns (uint256 count) {
        return _templateCount;
    }
}
