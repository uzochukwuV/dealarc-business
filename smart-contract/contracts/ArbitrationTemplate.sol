// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArbitration} from "./interfaces/IArbitration.sol";

/// @title ArbitrationTemplate
/// @notice Neutral dispute resolution contract
/// @dev Separate from AgreementTemplate/EscrowSplitTemplate for separation of concerns
/// @dev "Who decides" (arbitration) separate from "who moves money" (escrow)
contract ArbitrationTemplate is IArbitration {
    /// @notice Dispute data
    struct Dispute {
        uint256 disputeId;
        uint256 dealId;
        address template;
        address raisedBy;
        string reason;
        DisputeStatus status;
        Resolution resolution;
        uint256 createdAt;
        uint256 resolvedAt;
        uint256 evidenceCount;
    }

    /// @notice Mapping from dispute ID to dispute
    mapping(uint256 => Dispute) private _disputes;

    /// @notice Mapping from dispute ID + evidence index to evidence
    mapping(uint256 => mapping(uint256 => Evidence)) private _evidences;

    /// @notice Mapping from deal+template to dispute ID
    mapping(bytes32 => uint256) private _dealDisputes;

    /// @notice Protocol owner - can assign arbitrators
    address public owner;

    /// @notice Mapping of authorized arbitrators
    mapping(address => bool) public authorizedArbitrators;

    /// @notice Evidence submission window in seconds
    uint256 public constant EVIDENCE_WINDOW = 7 days;

    /// @notice Total dispute count
    uint256 private _disputeCount;

    /// @notice Emitted when dispute is opened
    event DisputeOpened(
        uint256 indexed disputeId,
        uint256 indexed dealId,
        address indexed template,
        address raisedBy,
        string reason
    );

    /// @notice Emitted when evidence is submitted
    event EvidenceSubmitted(
        uint256 indexed disputeId,
        address indexed submitter,
        bytes32 evidenceHash
    );

    /// @notice Emitted when dispute is resolved
    event DisputeResolved(
        uint256 indexed disputeId,
        Resolution resolution
    );

    /// @notice Emitted when dispute is closed
    event DisputeClosed(uint256 indexed disputeId);

    /// @notice Emitted when arbitrator is authorized
    event ArbitratorAuthorized(address indexed arbitrator);

    /// @notice Emitted when arbitrator is revoked
    event ArbitratorRevoked(address indexed arbitrator);

    /// @notice Constructor
    constructor() {
        owner = msg.sender;
    }

    /// @notice Modifier to restrict to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "ArbitrationTemplate: caller is not owner");
        _;
    }

    /// @notice Modifier to restrict to authorized arbitrators
    modifier onlyArbitrator() {
        require(
            authorizedArbitrators[msg.sender] || msg.sender == owner,
            "ArbitrationTemplate: caller is not authorized arbitrator"
        );
        _;
    }

    /// @notice Authorize an arbitrator
    /// @param arbitrator Address of the arbitrator
    function authorizeArbitrator(address arbitrator) external onlyOwner {
        require(arbitrator != address(0), "ArbitrationTemplate: arbitrator is zero address");
        authorizedArbitrators[arbitrator] = true;
        emit ArbitratorAuthorized(arbitrator);
    }

    /// @notice Revoke an arbitrator's authorization
    /// @param arbitrator Address of the arbitrator
    function revokeArbitrator(address arbitrator) external onlyOwner {
        authorizedArbitrators[arbitrator] = false;
        emit ArbitratorRevoked(arbitrator);
    }

    /// @notice Open a dispute (either party)
    /// @param dealId The deal ID
    /// @param template The template contract address
    /// @param reason Reason for the dispute
    /// @return disputeId The new dispute ID
    function openDispute(
        uint256 dealId,
        address template,
        string calldata reason
    ) external returns (uint256 disputeId) {
        require(dealId != 0, "ArbitrationTemplate: invalid deal ID");
        require(template != address(0), "ArbitrationTemplate: template is zero address");
        require(bytes(reason).length > 0, "ArbitrationTemplate: reason cannot be empty");
        require(
            !hasOpenDispute(dealId, template),
            "ArbitrationTemplate: dispute already open for this deal"
        );

        _disputeCount++;
        disputeId = _disputeCount;

        _disputes[disputeId] = Dispute({
            disputeId: disputeId,
            dealId: dealId,
            template: template,
            raisedBy: msg.sender,
            reason: reason,
            status: DisputeStatus.Open,
            resolution: Resolution.Pending,
            createdAt: block.timestamp,
            resolvedAt: 0,
            evidenceCount: 0
        });

        _dealDisputes[keccak256(abi.encode(dealId, template))] = disputeId;

        emit DisputeOpened(disputeId, dealId, template, msg.sender, reason);
    }

    /// @notice Submit evidence for a dispute
    /// @param disputeId The dispute ID
    /// @param evidenceHash IPFS hash of evidence
    function submitEvidence(uint256 disputeId, bytes32 evidenceHash) external {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        require(
            _disputes[disputeId].status == DisputeStatus.Open ||
            _disputes[disputeId].status == DisputeStatus.EvidenceSubmitted,
            "ArbitrationTemplate: dispute not open for evidence"
        );
        require(evidenceHash != bytes32(0), "ArbitrationTemplate: evidence hash cannot be zero");

        uint256 idx = _disputes[disputeId].evidenceCount;
        _evidences[disputeId][idx] = Evidence({
            submittedBy: msg.sender,
            evidenceHash: evidenceHash,
            submittedAt: block.timestamp
        });
        _disputes[disputeId].evidenceCount++;

        _disputes[disputeId].status = DisputeStatus.EvidenceSubmitted;

        emit EvidenceSubmitted(disputeId, msg.sender, evidenceHash);
    }

    /// @notice Resolve a dispute (arbitrator only)
    /// @param disputeId The dispute ID
    /// @param resolution The resolution outcome
    function resolveDispute(uint256 disputeId, Resolution resolution) external onlyArbitrator {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        require(
            _disputes[disputeId].status == DisputeStatus.Open ||
            _disputes[disputeId].status == DisputeStatus.EvidenceSubmitted,
            "ArbitrationTemplate: dispute not resolvable"
        );
        require(
            resolution != Resolution.Pending,
            "ArbitrationTemplate: resolution cannot be pending"
        );

        _disputes[disputeId].status = DisputeStatus.Resolved;
        _disputes[disputeId].resolution = resolution;
        _disputes[disputeId].resolvedAt = block.timestamp;

        emit DisputeResolved(disputeId, resolution);
    }

    /// @notice Close a dispute (after resolution)
    /// @param disputeId The dispute ID
    function closeDispute(uint256 disputeId) external onlyArbitrator {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        require(
            _disputes[disputeId].status == DisputeStatus.Resolved,
            "ArbitrationTemplate: dispute not yet resolved"
        );

        _disputes[disputeId].status = DisputeStatus.Closed;

        emit DisputeClosed(disputeId);
    }

    /// @notice Get dispute status
    /// @param disputeId The dispute ID
    /// @return status The dispute status
    function getDisputeStatus(uint256 disputeId) external view returns (DisputeStatus status) {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        return _disputes[disputeId].status;
    }

    /// @notice Check if deal has an open dispute
    /// @param dealId The deal ID
    /// @param template The template contract address
    /// @return hasDispute True if there's an open dispute
    function hasOpenDispute(uint256 dealId, address template) public view returns (bool hasDispute) {
        uint256 disputeId = _dealDisputes[keccak256(abi.encode(dealId, template))];
        if (disputeId == 0) return false;
        DisputeStatus status = _disputes[disputeId].status;
        return status == DisputeStatus.Open || status == DisputeStatus.EvidenceSubmitted;
    }

    /// @notice Get dispute details
    /// @param disputeId The dispute ID
    /// @return dDealId The deal ID
    /// @return dTemplate The template address
    /// @return dRaisedBy Who raised the dispute
    /// @return dReason The reason
    /// @return dStatus The status
    /// @return dResolution The resolution
    /// @return dCreatedAt When created
    /// @return dResolvedAt When resolved
    function getDispute(uint256 disputeId) external view returns (
        uint256 dDealId,
        address dTemplate,
        address dRaisedBy,
        string memory dReason,
        DisputeStatus dStatus,
        Resolution dResolution,
        uint256 dCreatedAt,
        uint256 dResolvedAt
    ) {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        Dispute storage d = _disputes[disputeId];
        return (
            d.dealId,
            d.template,
            d.raisedBy,
            d.reason,
            d.status,
            d.resolution,
            d.createdAt,
            d.resolvedAt
        );
    }

    /// @notice Get evidence count for a dispute
    /// @param disputeId The dispute ID
    /// @return count Number of evidence submissions
    function getEvidenceCount(uint256 disputeId) external view returns (uint256 count) {
        require(disputeId != 0 && disputeId <= _disputeCount, 
            "ArbitrationTemplate: invalid dispute ID");
        return _disputes[disputeId].evidenceCount;
    }

    /// @notice Get total dispute count
    /// @return count Total number of disputes
    function getDisputeCount() external view returns (uint256 count) {
        return _disputeCount;
    }
}
