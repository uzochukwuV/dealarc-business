// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";
import {BaseTemplate} from "./base/BaseTemplate.sol";
import {TemplateRegistry} from "./TemplateRegistry.sol";

/// @title AgreementTemplate
/// @notice Business deal contract WITHOUT money
/// @dev Tracks purchase orders, trade deals, service contracts, etc.
/// @dev Money flows are handled separately by EscrowSplitTemplate
contract AgreementTemplate is ITemplate, BaseTemplate {
    /// @notice Agreement data stored on-chain
    struct Agreement {
        uint256 agreementId;
        address creator;
        AgreementType agreementType;
        bytes32 termsHash; // IPFS hash of terms document
        DealState state;
        uint256 value; // Total value in USDC (for reference, no funds here)
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Party information
    struct Party {
        uint256 identityId;
        address partyAddress;
        PartyRole role;
        bool signed;
    }

    /// @notice Mapping from agreement ID to agreement data
    mapping(uint256 => Agreement) private _agreements;

    /// @notice Mapping from agreement ID to party index
    mapping(uint256 => Party[]) private _agreementParties;

    /// @notice Mapping from agreement ID to dispute info
    mapping(uint256 => DisputeInfo) private _disputes;

    /// @notice Mapping from agreement ID + party address to confirmation status
    mapping(uint256 => mapping(address => bool)) private _completionsConfirmed;

    /// @notice Mapping from agreement ID to proposed resolution
    mapping(uint256 => DisputeResolution) private _proposedResolution;

    /// @notice Dispute information
    struct DisputeInfo {
        address raisedBy;
        uint256 raisedAt;
        DisputeResolution resolution;
        string reason;
    }

    /// @notice Total agreement count
    uint256 private _agreementCount;

    /// @notice Emitted when agreement is created
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed creator,
        uint8 agreementType,
        bytes32 termsHash
    );

    /// @notice Emitted when a party signs
    event PartySigned(
        uint256 indexed agreementId,
        uint256 indexed identityId,
        uint8 role
    );

    /// @notice Emitted when agreement is activated
    event AgreementActivated(uint256 indexed agreementId);

    /// @notice Emitted when agreement status is updated
    event AgreementStatusUpdated(
        uint256 indexed agreementId,
        uint8 oldStatus,
        uint8 newStatus
    );

    /// @notice Emitted when dispute is raised
    event DisputeRaised(
        uint256 indexed agreementId,
        address indexed raisedBy,
        string reason
    );

    /// @notice Emitted when dispute is resolved
    event DisputeResolved(
        uint256 indexed agreementId,
        uint8 resolution
    );

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    /// @param registry Address of the TemplateRegistry contract
    /// @param verification Address of the VerificationRegistry contract
    constructor(
        address reputation, 
        address registry, 
        address verification
    ) BaseTemplate(reputation, registry, verification) {}

    /// @notice Create a new agreement
    /// @param agreementType Type of agreement
    /// @param termsHash IPFS hash of terms document
    /// @param value Total value in USDC (reference only)
    /// @param partyIdentities Array of party identity IDs
    /// @param partyAddresses Array of party addresses
    /// @param partyRoles Array of party roles
    /// @return agreementId The new agreement ID
    function createAgreement(
        AgreementType agreementType,
        bytes32 termsHash,
        uint256 value,
        uint256[] memory partyIdentities,
        address[] memory partyAddresses,
        PartyRole[] memory partyRoles
    ) external returns (uint256 agreementId) {
        require(partyIdentities.length == partyAddresses.length, 
            "AgreementTemplate: party arrays length mismatch");
        require(partyIdentities.length == partyRoles.length, 
            "AgreementTemplate: party arrays length mismatch");
        require(partyIdentities.length >= 2, 
            "AgreementTemplate: need at least 2 parties");
        require(termsHash != bytes32(0), 
            "AgreementTemplate: termsHash cannot be zero");

        // Register deal in registry
        uint256 dealId = TemplateRegistry(REGISTRY).registerDeal(address(this), msg.sender);

        _agreementCount++;
        agreementId = _agreementCount;

        _agreements[agreementId] = Agreement({
            agreementId: agreementId,
            creator: msg.sender,
            agreementType: agreementType,
            termsHash: termsHash,
            state: DealState.Created,
            value: value,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Add parties
        for (uint256 i = 0; i < partyIdentities.length; i++) {
            _agreementParties[agreementId].push(Party({
                identityId: partyIdentities[i],
                partyAddress: partyAddresses[i],
                role: partyRoles[i],
                signed: false
            }));
        }

        emit AgreementCreated(agreementId, msg.sender, uint8(agreementType), termsHash);
    }

    /// @notice Sign an agreement as a party
    /// @param agreementId The agreement ID
    /// @param identityId The identity ID of the signer
    function signAgreement(uint256 agreementId, uint256 identityId) external {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        require(_agreements[agreementId].state == DealState.Created ||
                _agreements[agreementId].state == DealState.Active, 
            "AgreementTemplate: agreement not open for signing");
        require(!_isPartySigned(agreementId, msg.sender), 
            "AgreementTemplate: already signed");

        Party[] storage parties = _agreementParties[agreementId];
        bool validParty = false;
        uint256 partyIndex;
        
        for (uint256 i = 0; i < parties.length; i++) {
            if (parties[i].partyAddress == msg.sender && parties[i].identityId == identityId) {
                validParty = true;
                partyIndex = i;
                parties[i].signed = true;
                break;
            }
        }
        require(validParty, "AgreementTemplate: not a valid party");

        emit PartySigned(agreementId, identityId, uint8(parties[partyIndex].role));

        // Check if all required parties have signed
        if (_allRequiredPartiesSigned(agreementId)) {
            _agreements[agreementId].state = DealState.Active;
            _agreements[agreementId].updatedAt = block.timestamp;
            emit AgreementActivated(agreementId);
        }
    }

    /// @notice Update agreement status
    /// @param agreementId The agreement ID
    /// @param newState The new state
    function updateStatus(uint256 agreementId, DealState newState) external {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        require(_agreements[agreementId].state != DealState.None, 
            "AgreementTemplate: agreement does not exist");
        
        // Access control: only parties can update status
        require(_isPartyInAgreement(agreementId, msg.sender), 
            "AgreementTemplate: not authorized to update status");
        
        DealState oldState = _agreements[agreementId].state;
        
        // Validate state transitions
        _validateStateTransition(oldState, newState);
        
        // Mutual confirmation for completion: all parties must confirm
        if (newState == DealState.Completed) {
            // Check if already confirmed by this party
            require(!_completionsConfirmed[agreementId][msg.sender], 
                "AgreementTemplate: already confirmed");
            
            _completionsConfirmed[agreementId][msg.sender] = true;
            
            // Check if ALL parties have confirmed
            Party[] storage parties = _agreementParties[agreementId];
            bool allConfirmed = true;
            for (uint256 i = 0; i < parties.length; i++) {
                if (!_completionsConfirmed[agreementId][parties[i].partyAddress]) {
                    allConfirmed = false;
                    break;
                }
            }
            
            // Only apply state change if all confirmed
            if (allConfirmed) {
                _agreements[agreementId].state = DealState.Completed;
                _agreements[agreementId].updatedAt = block.timestamp;
                
                // Clear confirmations
                for (uint256 i = 0; i < parties.length; i++) {
                    _completionsConfirmed[agreementId][parties[i].partyAddress] = false;
                }
                
                emit AgreementStatusUpdated(agreementId, uint8(oldState), uint8(DealState.Completed));
                TemplateRegistry(REGISTRY).updateDealState(agreementId, DealState.Completed);
                _updateReputationOnCompletion(agreementId);
            } else {
                // Not all confirmed yet - emit partial confirmation event
                emit AgreementStatusUpdated(agreementId, uint8(oldState), uint8(oldState));
            }
            return;
        }
        
        _agreements[agreementId].state = newState;
        _agreements[agreementId].updatedAt = block.timestamp;

        emit AgreementStatusUpdated(agreementId, uint8(oldState), uint8(newState));

        // Update registry
        TemplateRegistry(REGISTRY).updateDealState(agreementId, newState);
    }

    /// @notice Raise a dispute
    /// @param agreementId The agreement ID
    /// @param reason Reason for the dispute
    function raiseDispute(uint256 agreementId, string calldata reason) external {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        require(_agreements[agreementId].state == DealState.Active, 
            "AgreementTemplate: agreement not active");
        require(_isPartyInAgreement(agreementId, msg.sender), 
            "AgreementTemplate: not a party to agreement");
        require(bytes(reason).length > 0, 
            "AgreementTemplate: reason cannot be empty");

        _agreements[agreementId].state = DealState.Disputed;
        _agreements[agreementId].updatedAt = block.timestamp;

        _disputes[agreementId] = DisputeInfo({
            raisedBy: msg.sender,
            raisedAt: block.timestamp,
            resolution: DisputeResolution.Pending,
            reason: reason
        });
        
        // Clear any pending resolution proposals
        _proposedResolution[agreementId] = DisputeResolution.Pending;

        emit DisputeRaised(agreementId, msg.sender, reason);

        // Update registry
        TemplateRegistry(REGISTRY).updateDealState(agreementId, DealState.Disputed);
    }

    /// @notice Resolve a dispute
    /// @param agreementId The agreement ID
    /// @param resolution The resolution outcome
    function resolveDispute(uint256 agreementId, DisputeResolution resolution) external {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        require(_agreements[agreementId].state == DealState.Disputed, 
            "AgreementTemplate: agreement not disputed");
        require(_disputes[agreementId].resolution == DisputeResolution.Pending, 
            "AgreementTemplate: dispute already resolved");
        
        // Access control: only parties can resolve disputes
        require(_isPartyInAgreement(agreementId, msg.sender), 
            "AgreementTemplate: not authorized to resolve dispute");
        
        Party[] storage parties = _agreementParties[agreementId];
        
        // First party to call sets the proposed resolution
        if (_proposedResolution[agreementId] == DisputeResolution.Pending) {
            _proposedResolution[agreementId] = resolution;
        } else {
            // Subsequent parties must agree on the same resolution
            require(_proposedResolution[agreementId] == resolution, 
                "AgreementTemplate: resolution does not match");
        }
        
        // Mark this party as confirmed
        _completionsConfirmed[agreementId][msg.sender] = true;
        
        // Check if ALL parties have confirmed
        bool allConfirmed = true;
        for (uint256 i = 0; i < parties.length; i++) {
            if (!_completionsConfirmed[agreementId][parties[i].partyAddress]) {
                allConfirmed = false;
                break;
            }
        }
        
        // Only apply resolution if all confirmed
        if (allConfirmed) {
            _disputes[agreementId].resolution = _proposedResolution[agreementId];

            if (_proposedResolution[agreementId] == DisputeResolution.Cancelled) {
                _agreements[agreementId].state = DealState.Cancelled;
            } else {
                _agreements[agreementId].state = DealState.Resolved;
            }
            _agreements[agreementId].updatedAt = block.timestamp;

            emit DisputeResolved(agreementId, uint8(_proposedResolution[agreementId]));

            // Update registry
            TemplateRegistry(REGISTRY).updateDealState(agreementId, _agreements[agreementId].state);

            // Update reputation
            _updateReputationOnDispute(agreementId, _proposedResolution[agreementId]);
            
            // Clear confirmations and proposed resolution
            for (uint256 i = 0; i < parties.length; i++) {
                _completionsConfirmed[agreementId][parties[i].partyAddress] = false;
            }
            _proposedResolution[agreementId] = DisputeResolution.Pending;
        }
    }

    /// @notice Get agreement data
    /// @param agreementId The agreement ID
    /// @return agreement The agreement data struct
    function getAgreement(uint256 agreementId) external view returns (Agreement memory agreement) {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        return _agreements[agreementId];
    }

    /// @notice Get parties of an agreement
    /// @param agreementId The agreement ID
    /// @return parties Array of party structs
    function getParties(uint256 agreementId) external view returns (Party[] memory parties) {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        return _agreementParties[agreementId];
    }

    /// @notice Get dispute info
    /// @param agreementId The agreement ID
    /// @return dispute The dispute info struct
    function getDispute(uint256 agreementId) external view returns (DisputeInfo memory dispute) {
        require(agreementId != 0 && agreementId <= _agreementCount, 
            "AgreementTemplate: invalid agreement ID");
        return _disputes[agreementId];
    }

    /// @notice Get total agreement count
    /// @return count Total number of agreements
    function getAgreementCount() external view returns (uint256 count) {
        return _agreementCount;
    }

    /// @notice Check if party has signed
    function _isPartySigned(uint256 agreementId, address party) private view returns (bool) {
        Party[] storage parties = _agreementParties[agreementId];
        for (uint256 i = 0; i < parties.length; i++) {
            if (parties[i].partyAddress == party && parties[i].signed) {
                return true;
            }
        }
        return false;
    }

    /// @notice Check if all required parties have signed
    function _allRequiredPartiesSigned(uint256 agreementId) private view returns (bool) {
        Party[] storage parties = _agreementParties[agreementId];
        for (uint256 i = 0; i < parties.length; i++) {
            if (!parties[i].signed) {
                return false;
            }
        }
        return parties.length >= 2;
    }

    /// @notice Check if address is a party in agreement
    function _isPartyInAgreement(uint256 agreementId, address party) private view returns (bool) {
        Party[] storage parties = _agreementParties[agreementId];
        for (uint256 i = 0; i < parties.length; i++) {
            if (parties[i].partyAddress == party) {
                return true;
            }
        }
        return false;
    }

    /// @notice Validate state transitions
    function _validateStateTransition(
        DealState current,
        DealState next
    ) private pure {
        if (current == DealState.None) {
            revert("AgreementTemplate: cannot transition from None");
        } else if (current == DealState.Created) {
            require(
                next == DealState.Active || next == DealState.Cancelled,
                "AgreementTemplate: invalid transition from Created"
            );
        } else if (current == DealState.Active) {
            require(
                next == DealState.Completed || next == DealState.Disputed || next == DealState.Cancelled,
                "AgreementTemplate: invalid transition from Active"
            );
        } else if (current == DealState.Disputed) {
            require(
                next == DealState.Resolved || next == DealState.Completed || next == DealState.Cancelled,
                "AgreementTemplate: invalid transition from Disputed"
            );
        } else if (current == DealState.Resolved) {
            require(
                next == DealState.Completed || next == DealState.Cancelled,
                "AgreementTemplate: invalid transition from Resolved"
            );
        }
        // Completed and Cancelled are terminal states - no transitions allowed
    }

    /// @notice Update reputation on completion
    function _updateReputationOnCompletion(uint256 agreementId) private {
        Party[] storage parties = _agreementParties[agreementId];
        uint256 volume = _agreements[agreementId].value;

        for (uint256 i = 0; i < parties.length; i++) {
            IReputation(REPUTATION).recordSuccessfulSettlement(parties[i].partyAddress, volume);
        }
    }

    /// @notice Update reputation on dispute
    function _updateReputationOnDispute(uint256 agreementId, DisputeResolution resolution) private {
        if (resolution == DisputeResolution.BuyerWins) {
            Party[] storage parties = _agreementParties[agreementId];
            for (uint256 i = 0; i < parties.length; i++) {
                if (parties[i].role == PartyRole.Supplier) {
                    IReputation(REPUTATION).recordDispute(parties[i].partyAddress);
                }
            }
        } else if (resolution == DisputeResolution.SellerWins) {
            Party[] storage parties = _agreementParties[agreementId];
            for (uint256 i = 0; i < parties.length; i++) {
                if (parties[i].role == PartyRole.Buyer) {
                    IReputation(REPUTATION).recordDispute(parties[i].partyAddress);
                }
            }
        }
        // Split resolution - no reputation penalty
    }
}
