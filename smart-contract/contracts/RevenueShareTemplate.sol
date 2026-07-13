// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ITemplate} from "./interfaces/ITemplate.sol";
import {IReputation} from "./interfaces/IReputation.sol";
import {BaseTemplate} from "./base/BaseTemplate.sol";
import {TemplateRegistry} from "./TemplateRegistry.sol";

/// @title RevenueShareTemplate
/// @notice Ongoing percentage-based revenue sharing
/// @dev Splits incoming revenue among multiple recipients based on BPS
/// @dev Unlike one-time EscrowSplitTemplate, this is for continuous revenue streams
contract RevenueShareTemplate is ITemplate, BaseTemplate {
    /// @notice Recipient data
    struct ShareRecipient {
        address recipientAddress;
        uint256 bps; // Basis points (must sum to 10000)
        bool active;
    }

    /// @notice Revenue share pool data
    struct RevenuePool {
        uint256 poolId;
        address creator;
        uint256 totalCollected;
        uint256 totalDistributed;
        ShareRecipient[] recipients;
        DealState state;
        uint256 createdAt;
        uint256 updatedAt;
    }

    /// @notice Mapping from pool ID to revenue pool
    mapping(uint256 => RevenuePool) private _pools;

    /// @notice Total pool count
    uint256 private _poolCount;

    /// @notice Allowed token
    address public immutable TOKEN;

    /// @notice Reentrancy guard
    mapping(uint256 => bool) private _distributing;

    /// @notice Emitted when pool is created
    event RevenuePoolCreated(
        uint256 indexed poolId,
        address indexed creator,
        uint256 recipientCount
    );

    /// @notice Emitted when revenue is deposited
    event RevenueDeposited(
        uint256 indexed poolId,
        address indexed depositor,
        uint256 amount
    );

    /// @notice Emitted when revenue is distributed
    event RevenueDistributed(
        uint256 indexed poolId,
        uint256 totalAmount,
        uint256 recipientCount
    );

    /// @notice Emitted when recipient is added
    event RecipientAdded(
        uint256 indexed poolId,
        address indexed recipient,
        uint256 bps
    );

    /// @notice Emitted when recipient is removed
    event RecipientRemoved(uint256 indexed poolId, address indexed recipient);

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
        require(token != address(0), "RevenueShareTemplate: token is zero address");
        TOKEN = token;
    }

    /// @notice Create a new revenue share pool
    /// @param recipients Array of recipient addresses
    /// @param bpsArray Array of basis points for each recipient (must sum to 10000)
    /// @return poolId The new pool ID
    function createPool(
        address[] memory recipients,
        uint256[] memory bpsArray
    ) external onlyVerified(msg.sender) returns (uint256 poolId) {
        require(recipients.length == bpsArray.length,
            "RevenueShareTemplate: arrays length mismatch");
        require(recipients.length >= 1 && recipients.length <= 20,
            "RevenueShareTemplate: invalid recipient count");
        require(_validateBpsSum(bpsArray),
            "RevenueShareTemplate: bps must sum to 10000");
        require(_noDuplicateRecipients(recipients),
            "RevenueShareTemplate: duplicate recipients not allowed");

        // Register deal in registry
        TemplateRegistry(REGISTRY).registerDeal(address(this), msg.sender);

        _poolCount++;
        poolId = _poolCount;

        RevenuePool storage pool = _pools[poolId];
        pool.poolId = poolId;
        pool.creator = msg.sender;
        pool.state = DealState.Active;
        pool.createdAt = block.timestamp;
        pool.updatedAt = block.timestamp;

        // Add recipients
        for (uint256 i = 0; i < recipients.length; i++) {
            pool.recipients.push(ShareRecipient({
                recipientAddress: recipients[i],
                bps: bpsArray[i],
                active: true
            }));
            emit RecipientAdded(poolId, recipients[i], bpsArray[i]);
        }

        emit RevenuePoolCreated(poolId, msg.sender, recipients.length);
    }

    /// @notice Deposit revenue into pool
    /// @param poolId The pool ID
    /// @param amount Amount to deposit
    function depositRevenue(uint256 poolId, uint256 amount) external {
        require(poolId != 0 && poolId <= _poolCount,
            "RevenueShareTemplate: invalid pool ID");
        require(_pools[poolId].state == DealState.Active,
            "RevenueShareTemplate: pool not active");
        require(amount > 0, "RevenueShareTemplate: amount must be positive");

        // Transfer tokens from depositor to contract
        IERC20(TOKEN).transferFrom(msg.sender, address(this), amount);

        _pools[poolId].totalCollected += amount;
        _pools[poolId].updatedAt = block.timestamp;

        emit RevenueDeposited(poolId, msg.sender, amount);

        // Automatically distribute if contract balance allows
        _distribute(poolId);
    }

    /// @notice Distribute accumulated revenue to recipients
    /// @param poolId The pool ID
    function distributeRevenue(uint256 poolId) external {
        require(poolId != 0 && poolId <= _poolCount,
            "RevenueShareTemplate: invalid pool ID");
        require(_pools[poolId].state == DealState.Active,
            "RevenueShareTemplate: pool not active");

        _distribute(poolId);
    }

    /// @notice Internal distribute function
    function _distribute(uint256 poolId) private {
        require(!_distributing[poolId], "RevenueShareTemplate: reentrancy detected");
        _distributing[poolId] = true;

        RevenuePool storage pool = _pools[poolId];
        uint256 contractBalance = IERC20(TOKEN).balanceOf(address(this));

        if (contractBalance == 0) {
            _distributing[poolId] = false;
            return;
        }

        uint256 totalDistributed = 0;

        for (uint256 i = 0; i < pool.recipients.length; i++) {
            if (!pool.recipients[i].active) continue;

            uint256 recipientShare = (contractBalance * pool.recipients[i].bps) / 10000;
            if (recipientShare > 0) {
                IERC20(TOKEN).transfer(pool.recipients[i].recipientAddress, recipientShare);
                totalDistributed += recipientShare;
            }
        }

        pool.totalDistributed += totalDistributed;
        pool.updatedAt = block.timestamp;

        emit RevenueDistributed(poolId, totalDistributed, pool.recipients.length);

        _distributing[poolId] = false;
    }

    /// @notice Add recipient to pool
    /// @param poolId The pool ID
    /// @param recipient Recipient address
    /// @param bps Basis points for recipient
    function addRecipient(uint256 poolId, address recipient, uint256 bps) external {
        require(poolId != 0 && poolId <= _poolCount,
            "RevenueShareTemplate: invalid pool ID");
        require(msg.sender == _pools[poolId].creator,
            "RevenueShareTemplate: caller is not creator");
        require(recipient != address(0), "RevenueShareTemplate: recipient is zero address");

        // Check new total won't exceed 10000
        uint256 currentTotal = _getTotalBps(poolId);
        require(currentTotal + bps <= 10000,
            "RevenueShareTemplate: bps would exceed 10000");

        _pools[poolId].recipients.push(ShareRecipient({
            recipientAddress: recipient,
            bps: bps,
            active: true
        }));

        emit RecipientAdded(poolId, recipient, bps);
    }

    /// @notice Remove recipient from pool (only deactivates)
    /// @param poolId The pool ID
    /// @param index Index of recipient in array
    function removeRecipient(uint256 poolId, uint256 index) external {
        require(poolId != 0 && poolId <= _poolCount,
            "RevenueShareTemplate: invalid pool ID");
        require(msg.sender == _pools[poolId].creator,
            "RevenueShareTemplate: caller is not creator");
        require(index < _pools[poolId].recipients.length,
            "RevenueShareTemplate: invalid recipient index");

        address recipient = _pools[poolId].recipients[index].recipientAddress;
        _pools[poolId].recipients[index].active = false;

        emit RecipientRemoved(poolId, recipient);
    }

    /// @notice Validate BPS sum equals 10000
    function _validateBpsSum(uint256[] memory bpsArray) private pure returns (bool) {
        uint256 sum;
        for (uint256 i = 0; i < bpsArray.length; i++) {
            sum += bpsArray[i];
        }
        return sum == 10000;
    }

    /// @notice Get total BPS for a pool
    function _getTotalBps(uint256 poolId) private view returns (uint256) {
        uint256 total;
        for (uint256 i = 0; i < _pools[poolId].recipients.length; i++) {
            if (_pools[poolId].recipients[i].active) {
                total += _pools[poolId].recipients[i].bps;
            }
        }
        return total;
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

    /// @notice Get pool data
    /// @param poolId The pool ID
    /// @return pool The pool data
    function getPool(uint256 poolId) external view returns (RevenuePool memory pool) {
        require(poolId != 0 && poolId <= _poolCount,
            "RevenueShareTemplate: invalid pool ID");
        return _pools[poolId];
    }

    /// @notice Get total pool count
    /// @return count Total number of pools
    function getPoolCount() external view returns (uint256 count) {
        return _poolCount;
    }
}

/// @notice Minimal ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
