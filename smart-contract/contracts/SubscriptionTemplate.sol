// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";
import {BaseTemplate} from "./base/BaseTemplate.sol";
import {TemplateRegistry} from "./TemplateRegistry.sol";

/// @title SubscriptionTemplate
/// @notice Recurring payment/subscription contract
/// @dev Handles subscription cycles with automatic release at intervals
contract SubscriptionTemplate is ITemplate, BaseTemplate {
    /// @notice Subscription data
    struct Subscription {
        uint256 subscriptionId;
        address subscriber;
        address recipient;
        uint256 amountPerCycle;
        uint256 cycleDuration; // in seconds
        uint256 totalCycles;
        uint256 cyclesCompleted;
        uint256 nextPaymentAt;
        uint256 agreementId;
        DealState state;
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Mapping from subscription ID to subscription
    mapping(uint256 => Subscription) private _subscriptions;

    /// @notice Total subscription count
    uint256 private _subscriptionCount;

    /// @notice Allowed token
    address public immutable TOKEN;

    /// @notice Emitted when subscription is created
    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        address indexed subscriber,
        address indexed recipient,
        uint256 amountPerCycle,
        uint256 cycleDuration
    );

    /// @notice Emitted when payment is released
    event SubscriptionPayment(
        uint256 indexed subscriptionId,
        uint256 cycleNumber,
        uint256 amount
    );

    /// @notice Emitted when subscription is cancelled
    event SubscriptionCancelled(uint256 indexed subscriptionId);

    /// @notice Emitted when subscription is completed
    event SubscriptionCompleted(uint256 indexed subscriptionId);

    /// @notice Constructor
    /// @param reputation Address of the Reputation contract
    /// @param registry Address of the TemplateRegistry contract
    /// @param verification Address of the VerificationRegistry contract
    /// @param token Address of the payment token
    constructor(
        address reputation,
        address registry,
        address verification,
        address token
    ) BaseTemplate(reputation, registry, verification) {
        require(token != address(0), "SubscriptionTemplate: token is zero address");
        TOKEN = token;
    }

    /// @notice Create a new subscription
    /// @param recipient Address that receives payments
    /// @param amountPerCycle Amount released each cycle
    /// @param cycleDuration Duration of each cycle in seconds
    /// @param totalCycles Total number of cycles
    /// @param agreementId Optional link to AgreementTemplate
    /// @return subscriptionId The new subscription ID
    function createSubscription(
        address recipient,
        uint256 amountPerCycle,
        uint256 cycleDuration,
        uint256 totalCycles,
        uint256 agreementId
    ) external onlyVerified(msg.sender) returns (uint256 subscriptionId) {
        require(recipient != address(0), "SubscriptionTemplate: recipient is zero address");
        require(amountPerCycle > 0, "SubscriptionTemplate: amount must be positive");
        require(cycleDuration > 0, "SubscriptionTemplate: cycle duration must be positive");
        require(totalCycles > 0, "SubscriptionTemplate: total cycles must be positive");
        require(recipient != msg.sender, "SubscriptionTemplate: subscriber cannot be recipient");

        // Register deal in registry
        TemplateRegistry(REGISTRY).registerDeal(address(this), msg.sender);

        _subscriptionCount++;
        subscriptionId = _subscriptionCount;

        _subscriptions[subscriptionId] = Subscription({
            subscriptionId: subscriptionId,
            subscriber: msg.sender,
            recipient: recipient,
            amountPerCycle: amountPerCycle,
            cycleDuration: cycleDuration,
            totalCycles: totalCycles,
            cyclesCompleted: 0,
            nextPaymentAt: block.timestamp + cycleDuration,
            agreementId: agreementId,
            state: DealState.Active,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        emit SubscriptionCreated(
            subscriptionId,
            msg.sender,
            recipient,
            amountPerCycle,
            cycleDuration
        );
    }

    /// @notice Release payment for a cycle (can be called by anyone after due time)
    /// @param subscriptionId The subscription ID
    function releasePayment(uint256 subscriptionId) external {
        require(subscriptionId != 0 && subscriptionId <= _subscriptionCount,
            "SubscriptionTemplate: invalid subscription ID");
        require(_subscriptions[subscriptionId].state == DealState.Active,
            "SubscriptionTemplate: subscription not active");
        require(_subscriptions[subscriptionId].nextPaymentAt <= block.timestamp,
            "SubscriptionTemplate: payment not yet due");
        require(_subscriptions[subscriptionId].cyclesCompleted < _subscriptions[subscriptionId].totalCycles,
            "SubscriptionTemplate: all cycles completed");

        Subscription storage sub = _subscriptions[subscriptionId];

        // Transfer tokens from subscriber to recipient
        IERC20(TOKEN).transferFrom(sub.subscriber, sub.recipient, sub.amountPerCycle);

        sub.cyclesCompleted++;
        sub.nextPaymentAt = block.timestamp + sub.cycleDuration;
        sub.updatedAt = block.timestamp;

        emit SubscriptionPayment(subscriptionId, sub.cyclesCompleted, sub.amountPerCycle);

        // Check if all cycles completed
        if (sub.cyclesCompleted >= sub.totalCycles) {
            sub.state = DealState.Completed;
            sub.updatedAt = block.timestamp;

            IReputation(REPUTATION).recordSuccessfulSettlement(
                sub.subscriber,
                sub.amountPerCycle * sub.totalCycles
            );

            TemplateRegistry(REGISTRY).updateDealState(subscriptionId, DealState.Completed);

            emit SubscriptionCompleted(subscriptionId);
        }
    }

    /// @notice Cancel subscription
    /// @param subscriptionId The subscription ID
    function cancelSubscription(uint256 subscriptionId) external {
        require(subscriptionId != 0 && subscriptionId <= _subscriptionCount,
            "SubscriptionTemplate: invalid subscription ID");
        require(_subscriptions[subscriptionId].state == DealState.Active,
            "SubscriptionTemplate: subscription not active");
        require(
            msg.sender == _subscriptions[subscriptionId].subscriber ||
            msg.sender == _subscriptions[subscriptionId].recipient,
            "SubscriptionTemplate: not authorized"
        );

        _subscriptions[subscriptionId].state = DealState.Cancelled;
        _subscriptions[subscriptionId].updatedAt = block.timestamp;

        TemplateRegistry(REGISTRY).updateDealState(subscriptionId, DealState.Cancelled);

        emit SubscriptionCancelled(subscriptionId);
    }

    /// @notice Get subscription data
    /// @param subscriptionId The subscription ID
    /// @return subscription The subscription data
    function getSubscription(uint256 subscriptionId) external view returns (Subscription memory subscription) {
        require(subscriptionId != 0 && subscriptionId <= _subscriptionCount,
            "SubscriptionTemplate: invalid subscription ID");
        return _subscriptions[subscriptionId];
    }

    /// @notice Get total subscription count
    /// @return count Total number of subscriptions
    function getSubscriptionCount() external view returns (uint256 count) {
        return _subscriptionCount;
    }

    /// @notice Check if payment is due
    /// @param subscriptionId The subscription ID
    /// @return isDue True if payment is due
    function isPaymentDue(uint256 subscriptionId) external view returns (bool isDue) {
        require(subscriptionId != 0 && subscriptionId <= _subscriptionCount,
            "SubscriptionTemplate: invalid subscription ID");
        Subscription memory sub = _subscriptions[subscriptionId];
        return sub.state == DealState.Active && 
               sub.nextPaymentAt <= block.timestamp &&
               sub.cyclesCompleted < sub.totalCycles;
    }
}

/// @notice Minimal ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}
