// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";
import {IArbitration} from "./interfaces/IArbitration.sol";
import {BaseTemplate} from "./base/BaseTemplate.sol";
import {TemplateRegistry} from "./TemplateRegistry.sol";
import {FeeController} from "./FeeController.sol";

/// @title EscrowSplitTemplate
/// @notice Multi-party payment splits with milestone support
/// @dev Handles all money flows - settlement, milestones, revenue sharing
contract EscrowSplitTemplate is ITemplate, BaseTemplate {
    /// @notice Escrow data
    struct Escrow {
        uint256 escrowId;
        address payer;
        address token; // USDC address
        uint256 totalAmount;
        uint256 fundedAmount;
        uint256 releasedAmount; // Track total released for precision
        uint256 totalFeesPaid;
        DealState state;
        uint256 agreementId; // Optional link to AgreementTemplate
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Recipient data
    struct Recipient {
        address payable recipientAddress;
        uint256 bps; // Basis points (1% = 100 bps, max 10000)
        bool approved;
        bool released;
    }

    /// @notice Milestone data
    struct Milestone {
        uint256 index;
        string description;
        uint256 amount;
        bool approved;
        bool released;
    }

    /// @notice Dispute info
    struct EscrowDispute {
        address raisedBy;
        uint256 raisedAt;
        string reason;
    }

    /// @notice Mapping from escrow ID to escrow data
    mapping(uint256 => Escrow) private _escrows;

    /// @notice Mapping from escrow ID to recipients array
    mapping(uint256 => Recipient[]) private _escrowRecipients;

    /// @notice Mapping from escrow ID to milestones array
    mapping(uint256 => Milestone[]) private _escrowMilestones;

    /// @notice Mapping from escrow ID to dispute info
    mapping(uint256 => EscrowDispute) private _escrowDisputes;

    /// @notice Reentrancy guard for distribution
    mapping(uint256 => bool) private _distributing;

    /// @notice Total escrow count
    uint256 private _escrowCount;

    /// @notice Allowed token (USDC)
    address public immutable USDC;

    /// @notice Fee controller address
    FeeController public feeController;

    /// @notice Arbitration template address
    IArbitration public arbitrationTemplate;

    /// @notice Emitted when escrow is created
    event EscrowCreated(
        uint256 indexed escrowId,
        address indexed payer,
        address indexed token,
        uint256 totalAmount,
        uint256 agreementId
    );

    /// @notice Emitted when escrow is funded
    event EscrowFunded(
        uint256 indexed escrowId,
        address indexed payer,
        uint256 amount
    );

    /// @notice Emitted when escrow is activated (fully funded)
    event EscrowActivated(uint256 indexed escrowId);

    /// @notice Emitted when recipient is added
    event RecipientAdded(
        uint256 indexed escrowId,
        address indexed recipient,
        uint256 bps
    );

    /// @notice Emitted when milestone is approved
    event MilestoneApproved(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex
    );

    /// @notice Emitted when milestone is released
    event MilestoneReleased(
        uint256 indexed escrowId,
        uint256 indexed milestoneIndex,
        uint256 amount
    );

    /// @notice Emitted when funds are distributed
    event FundsDistributed(
        uint256 indexed escrowId,
        address indexed to,
        uint256 amount,
        uint256 feeAmount
    );

    /// @notice Emitted when dispute is raised
    event DisputeRaisedEscrow(
        uint256 indexed escrowId,
        address indexed raisedBy,
        string reason
    );

    /// @notice Emitted when dispute is resolved
    event DisputeResolvedEscrow(
        uint256 indexed escrowId,
        uint8 action
    );

    /// @notice Emitted when fee controller is updated
    event FeeControllerUpdated(address indexed oldFeeController, address indexed newFeeController);

    /// @notice Emitted when arbitration template is updated
    event ArbitrationTemplateUpdated(address indexed oldArbitration, address indexed newArbitration);

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    /// @param registry Address of the TemplateRegistry contract
    /// @param verification Address of the VerificationRegistry contract
    /// @param feeCtrl Address of the FeeController contract
    /// @param arbitration Address of the ArbitrationTemplate contract
    /// @param usdc Address of the USDC token
    constructor(
        address reputation,
        address registry,
        address verification,
        address feeCtrl,
        address arbitration,
        address usdc
    ) BaseTemplate(reputation, registry, verification) {
        require(usdc != address(0), "EscrowSplitTemplate: USDC is zero address");
        USDC = usdc;
        feeController = FeeController(feeCtrl);
        arbitrationTemplate = IArbitration(arbitration);
    }

    /// @notice Set fee controller
    /// @param _feeController Address of the FeeController contract
    function setFeeController(address _feeController) external {
        require(msg.sender == BaseTemplate(this).owner(), "EscrowSplitTemplate: caller is not owner");
        address old = address(feeController);
        feeController = FeeController(_feeController);
        emit FeeControllerUpdated(old, _feeController);
    }

    /// @notice Set arbitration template
    /// @param _arbitration Address of the ArbitrationTemplate contract
    function setArbitrationTemplate(address _arbitration) external {
        require(msg.sender == BaseTemplate(this).owner(), "EscrowSplitTemplate: caller is not owner");
        address old = address(arbitrationTemplate);
        arbitrationTemplate = IArbitration(_arbitration);
        emit ArbitrationTemplateUpdated(old, _arbitration);
    }

    /// @notice Check if escrow has open dispute
    modifier noOpenDispute(uint256 escrowId) {
        require(
            address(arbitrationTemplate) == address(0) ||
            !arbitrationTemplate.hasOpenDispute(escrowId, address(this)),
            "EscrowSplitTemplate: escrow has open dispute"
        );
        _;
    }

    /// @notice Create a new escrow with split recipients
    /// @param totalAmount Total amount to be held in escrow
    /// @param recipients Array of recipient addresses
    /// @param bpsArray Array of basis points for each recipient (must sum to 10000)
    /// @param agreementId Optional link to AgreementTemplate
    /// @return escrowId The new escrow ID
    function createEscrow(
        uint256 totalAmount,
        address[] memory recipients,
        uint256[] memory bpsArray,
        uint256 agreementId
    ) external returns (uint256 escrowId) {
        require(recipients.length == bpsArray.length, 
            "EscrowSplitTemplate: arrays length mismatch");
        require(recipients.length >= 1 && recipients.length <= 10, 
            "EscrowSplitTemplate: invalid recipient count");
        require(_validateBpsSum(bpsArray), 
            "EscrowSplitTemplate: bps must sum to 10000");
        require(_noDuplicateRecipients(recipients), 
            "EscrowSplitTemplate: duplicate recipients not allowed");

        // Register deal in registry
        uint256 dealId = TemplateRegistry(REGISTRY).registerDeal(address(this), msg.sender);

        _escrowCount++;
        escrowId = _escrowCount;

        _escrows[escrowId] = Escrow({
            escrowId: escrowId,
            payer: msg.sender,
            token: USDC,
            totalAmount: totalAmount,
            fundedAmount: 0,
            releasedAmount: 0,
            totalFeesPaid: 0,
            state: DealState.Created,
            agreementId: agreementId,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        // Add recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            _escrowRecipients[escrowId].push(Recipient({
                recipientAddress: payable(recipients[i]),
                bps: bpsArray[i],
                approved: false,
                released: false
            }));
            emit RecipientAdded(escrowId, recipients[i], bpsArray[i]);
        }

        emit EscrowCreated(escrowId, msg.sender, USDC, totalAmount, agreementId);
    }

    /// @notice Check for duplicate recipients
    function _noDuplicateRecipients(address[] memory recipients) private pure returns (bool) {
        for (uint256 i = 0; i < recipients.length; i++) {
            for (uint256 j = i + 1; j < recipients.length; j++) {
                if (recipients[i] == recipients[j]) {
                    return false;
                }
            }
        }
        return true;
    }

    /// @notice Add milestones to an escrow
    /// @param escrowId The escrow ID
    /// @param amounts Array of milestone amounts
    /// @param descriptions Array of milestone descriptions
    function addMilestones(
        uint256 escrowId,
        uint256[] memory amounts,
        string[] memory descriptions
    ) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(msg.sender == _escrows[escrowId].payer, 
            "EscrowSplitTemplate: caller is not payer");
        require(_escrows[escrowId].state == DealState.Created, 
            "EscrowSplitTemplate: escrow not in created state");
        require(amounts.length == descriptions.length, 
            "EscrowSplitTemplate: arrays length mismatch");

        uint256 totalMilestoneAmount;
        for (uint256 i = 0; i < amounts.length; i++) {
            _escrowMilestones[escrowId].push(Milestone({
                index: _escrowMilestones[escrowId].length,
                description: descriptions[i],
                amount: amounts[i],
                approved: false,
                released: false
            }));
            totalMilestoneAmount += amounts[i];
        }

        require(totalMilestoneAmount == _escrows[escrowId].totalAmount,
            "EscrowSplitTemplate: milestone amounts must equal total");
    }

    /// @notice Fund the escrow with tokens
    /// @param escrowId The escrow ID
    /// @param amount Amount to fund
    function fundEscrow(uint256 escrowId, uint256 amount) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(msg.sender == _escrows[escrowId].payer, 
            "EscrowSplitTemplate: caller is not payer");
        require(_escrows[escrowId].state == DealState.Created, 
            "EscrowSplitTemplate: escrow not in created state");
        require(_escrows[escrowId].fundedAmount + amount <= _escrows[escrowId].totalAmount,
            "EscrowSplitTemplate: amount exceeds total");

        // Transfer tokens from payer to contract
        IERC20(USDC).transferFrom(msg.sender, address(this), amount);

        _escrows[escrowId].fundedAmount += amount;
        _escrows[escrowId].updatedAt = block.timestamp;

        // Activate if fully funded
        if (_escrows[escrowId].fundedAmount == _escrows[escrowId].totalAmount) {
            _escrows[escrowId].state = DealState.Active;
            emit EscrowActivated(escrowId);
        }

        emit EscrowFunded(escrowId, msg.sender, amount);
    }

    /// @notice Approve a milestone
    /// @param escrowId The escrow ID
    /// @param milestoneIndex The milestone index
    function approveMilestone(uint256 escrowId, uint256 milestoneIndex) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(_escrows[escrowId].state == DealState.Active, 
            "EscrowSplitTemplate: escrow not active");
        require(milestoneIndex < _escrowMilestones[escrowId].length,
            "EscrowSplitTemplate: invalid milestone index");
        require(!_escrowMilestones[escrowId][milestoneIndex].approved,
            "EscrowSplitTemplate: milestone already approved");
        
        // Access control: only recipients can approve milestones
        require(_isRecipient(escrowId, msg.sender),
            "EscrowSplitTemplate: caller is not a recipient");

        _escrowMilestones[escrowId][milestoneIndex].approved = true;

        emit MilestoneApproved(escrowId, milestoneIndex);
    }

    /// @notice Release a milestone to recipients
    /// @param escrowId The escrow ID
    /// @param milestoneIndex The milestone index
    function releaseMilestone(uint256 escrowId, uint256 milestoneIndex) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(msg.sender == _escrows[escrowId].payer, 
            "EscrowSplitTemplate: caller is not payer");
        require(_escrows[escrowId].state == DealState.Active, 
            "EscrowSplitTemplate: escrow not active");
        require(_escrows[escrowId].fundedAmount > 0, 
            "EscrowSplitTemplate: escrow not funded");
        require(_escrowDisputes[escrowId].raisedAt == 0, 
            "EscrowSplitTemplate: escrow is disputed");
        require(milestoneIndex < _escrowMilestones[escrowId].length,
            "EscrowSplitTemplate: invalid milestone index");
        require(_escrowMilestones[escrowId][milestoneIndex].approved,
            "EscrowSplitTemplate: milestone not approved");
        require(!_escrowMilestones[escrowId][milestoneIndex].released,
            "EscrowSplitTemplate: milestone already released");

        _releaseMilestoneInternal(escrowId, milestoneIndex);
    }

    /// @notice Release all remaining funds
    /// @param escrowId The escrow ID
    function releaseAll(uint256 escrowId) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(msg.sender == _escrows[escrowId].payer, 
            "EscrowSplitTemplate: caller is not payer");
        require(_escrows[escrowId].state == DealState.Active, 
            "EscrowSplitTemplate: escrow not active");
        require(_escrowDisputes[escrowId].raisedAt == 0, 
            "EscrowSplitTemplate: escrow is disputed");
        require(_escrows[escrowId].fundedAmount > 0, 
            "EscrowSplitTemplate: escrow not funded");

        // Release all approved but unreleased milestones
        for (uint256 i = 0; i < _escrowMilestones[escrowId].length; i++) {
            if (_escrowMilestones[escrowId][i].approved && 
                !_escrowMilestones[escrowId][i].released) {
                _releaseMilestoneInternal(escrowId, i);
            }
        }

        // Release remaining balance proportionally (only what hasn't been released)
        uint256 remaining = _escrows[escrowId].fundedAmount - _escrows[escrowId].releasedAmount;
        if (remaining > 0) {
            _distributeToRecipients(escrowId, remaining);
        }
    }

    /// @notice Raise a dispute
    /// @param escrowId The escrow ID
    /// @param reason Reason for dispute
    function raiseDispute(uint256 escrowId, string calldata reason) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(_escrows[escrowId].state == DealState.Active, 
            "EscrowSplitTemplate: escrow not active");
        require(_escrowDisputes[escrowId].raisedAt == 0, 
            "EscrowSplitTemplate: dispute already raised");

        // Check if msg.sender is payer or recipient
        bool isPayer = msg.sender == _escrows[escrowId].payer;
        bool isRecipient = _isRecipient(escrowId, msg.sender);
        require(isPayer || isRecipient, 
            "EscrowSplitTemplate: not authorized to dispute");

        _escrowDisputes[escrowId] = EscrowDispute({
            raisedBy: msg.sender,
            raisedAt: block.timestamp,
            reason: reason
        });

        emit DisputeRaisedEscrow(escrowId, msg.sender, reason);
    }

    /// @notice Resolve a dispute
    /// @param escrowId The escrow ID
    /// @param action 0 = cancel and refund, 1 = release to recipients, 2 = split
    function resolveDispute(uint256 escrowId, uint8 action) external {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        require(_escrowDisputes[escrowId].raisedAt > 0, 
            "EscrowSplitTemplate: no dispute raised");
        require(_escrows[escrowId].state != DealState.Completed && 
                _escrows[escrowId].state != DealState.Cancelled, 
            "EscrowSplitTemplate: escrow already finalized");
        
        // Access control: only payer or recipients can resolve dispute
        bool isPayer = msg.sender == _escrows[escrowId].payer;
        bool isRecipient = _isRecipient(escrowId, msg.sender);
        require(isPayer || isRecipient, 
            "EscrowSplitTemplate: not authorized to resolve dispute");

        Escrow storage escrow = _escrows[escrowId];
        uint256 balance = escrow.fundedAmount;

        if (action == 0) {
            // Cancel and refund to payer
            escrow.state = DealState.Cancelled;
            IERC20(USDC).transfer(escrow.payer, balance);
        } else if (action == 1) {
            // Release to recipients
            escrow.state = DealState.Completed;
            _distributeToRecipients(escrowId, balance);
        } else if (action == 2) {
            // Split: refund payer 50%
            escrow.state = DealState.Completed;
            uint256 refundAmount = balance / 2;
            IERC20(USDC).transfer(escrow.payer, refundAmount);
            _distributeToRecipients(escrowId, balance - refundAmount);
        }

        escrow.updatedAt = block.timestamp;

        emit DisputeResolvedEscrow(escrowId, action);

        // Update registry
        TemplateRegistry(REGISTRY).updateDealState(escrowId, escrow.state);
    }

    /// @notice Get escrow data
    function getEscrow(uint256 escrowId) external view returns (Escrow memory escrow) {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        return _escrows[escrowId];
    }

    /// @notice Get recipients of an escrow
    function getRecipients(uint256 escrowId) external view returns (Recipient[] memory recipients) {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        return _escrowRecipients[escrowId];
    }

    /// @notice Get milestones of an escrow
    function getMilestones(uint256 escrowId) external view returns (Milestone[] memory milestones) {
        require(escrowId != 0 && escrowId <= _escrowCount, 
            "EscrowSplitTemplate: invalid escrow ID");
        return _escrowMilestones[escrowId];
    }

    /// @notice Get total escrow count
    function getEscrowCount() external view returns (uint256 count) {
        return _escrowCount;
    }

    /// @notice Validate BPS sum equals 10000
    function _validateBpsSum(uint256[] memory bpsArray) private pure returns (bool) {
        uint256 sum;
        for (uint256 i = 0; i < bpsArray.length; i++) {
            sum += bpsArray[i];
        }
        return sum == 10000;
    }

    /// @notice Check if address is a recipient
    function _isRecipient(uint256 escrowId, address addr) private view returns (bool) {
        Recipient[] storage recipients = _escrowRecipients[escrowId];
        for (uint256 i = 0; i < recipients.length; i++) {
            if (recipients[i].recipientAddress == addr) {
                return true;
            }
        }
        return false;
    }

    /// @notice Internal release milestone
    function _releaseMilestoneInternal(uint256 escrowId, uint256 milestoneIndex) private {
        Milestone storage milestone = _escrowMilestones[escrowId][milestoneIndex];
        milestone.released = true;

        Escrow storage escrow = _escrows[escrowId];
        escrow.releasedAmount += milestone.amount;
        escrow.updatedAt = block.timestamp;

        _distributeToRecipients(escrowId, milestone.amount);

        emit MilestoneReleased(escrowId, milestoneIndex, milestone.amount);

        // Check if all milestones released
        if (_allMilestonesReleased(escrowId)) {
            escrow.state = DealState.Completed;
            IReputation(REPUTATION).recordSuccessfulSettlement(
                escrow.payer,
                escrow.totalAmount
            );
            TemplateRegistry(REGISTRY).updateDealState(escrowId, DealState.Completed);
        }
    }

    /// @notice Distribute amount to recipients proportionally (after fees)
    function _distributeToRecipients(uint256 escrowId, uint256 amount) private {
        // Reentrancy guard
        require(!_distributing[escrowId], "EscrowSplitTemplate: reentrancy detected");
        _distributing[escrowId] = true;

        Recipient[] storage recipients = _escrowRecipients[escrowId];
        Escrow storage escrow = _escrows[escrowId];

        // Calculate fee if fee controller is set
        uint256 feeAmount = 0;
        uint256 netAmount = amount;
        
        if (address(feeController) != address(0)) {
            (netAmount, feeAmount) = feeController.takeFee(amount);
            escrow.totalFeesPaid += feeAmount;
            
            // Transfer fee to treasury
            if (feeAmount > 0) {
                address treasury = feeController.treasury();
                if (treasury != address(0)) {
                    IERC20(USDC).transfer(treasury, feeAmount);
                }
            }
        }

        // Distribute net amount to recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            uint256 recipientAmount = (netAmount * recipients[i].bps) / 10000;
            if (recipientAmount > 0) {
                recipients[i].released = true;
                IERC20(USDC).transfer(recipients[i].recipientAddress, recipientAmount);
                emit FundsDistributed(escrowId, recipients[i].recipientAddress, recipientAmount, feeAmount);
            }
        }

        _distributing[escrowId] = false;
    }

    /// @notice Check if all milestones are released
    function _allMilestonesReleased(uint256 escrowId) private view returns (bool) {
        Milestone[] storage milestones = _escrowMilestones[escrowId];
        if (milestones.length == 0) {
            return false; // No milestones means not "all released"
        }
        for (uint256 i = 0; i < milestones.length; i++) {
            if (!milestones[i].released) {
                return false;
            }
        }
        return true;
    }
}

/// @notice Minimal ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
