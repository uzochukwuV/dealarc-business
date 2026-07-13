// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title FeeController
/// @notice Platform fee mechanism
/// @dev Takes a configurable platform cut before distributing funds
contract FeeController {
    /// @notice Protocol owner - can set fees
    address public owner;

    /// @notice Platform fee in basis points (default 0 - no fees)
    uint256 public feeBps;

    /// @notice Treasury address for collected fees
    address public treasury;

    /// @notice Maximum fee (50% = 5000 bps)
    uint256 public constant MAX_FEE_BPS = 5000;

    /// @notice Emitted when fee is updated
    event FeeUpdated(uint256 oldFeeBps, uint256 newFeeBps);

    /// @notice Emitted when treasury is updated
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    /// @notice Emitted when fee is collected
    event FeeCollected(uint256 amount, uint256 feeAmount, address indexed treasury);

    /// @notice Constructor
    /// @param _treasury Address of the treasury
    constructor(address _treasury) {
        require(_treasury != address(0), "FeeController: treasury is zero address");
        owner = msg.sender;
        treasury = _treasury;
        feeBps = 0; // No fee by default
    }

    /// @notice Modifier to restrict to owner only
    modifier onlyOwner() {
        require(msg.sender == owner, "FeeController: caller is not owner");
        _;
    }

    /// @notice Set platform fee
    /// @param _feeBps New fee in basis points
    function setFeeBps(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= MAX_FEE_BPS, "FeeController: fee exceeds maximum");
        uint256 oldFee = feeBps;
        feeBps = _feeBps;
        emit FeeUpdated(oldFee, _feeBps);
    }

    /// @notice Set treasury address
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "FeeController: treasury is zero address");
        address oldTreasury = treasury;
        treasury = _treasury;
        emit TreasuryUpdated(oldTreasury, _treasury);
    }

    /// @notice Transfer ownership
    /// @param newOwner Address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "FeeController: new owner is zero address");
        owner = newOwner;
    }

    /// @notice Calculate fee and return net amount
    /// @param amount Total amount
    /// @return netAmount Amount after fee deduction
    /// @return feeAmount Fee amount
    function takeFee(uint256 amount) external returns (uint256 netAmount, uint256 feeAmount) {
        if (feeBps == 0 || treasury == address(0)) {
            return (amount, 0);
        }

        feeAmount = (amount * feeBps) / 10000;
        netAmount = amount - feeAmount;

        emit FeeCollected(amount, feeAmount, treasury);
    }

    /// @notice Get fee amount without executing
    /// @param amount Total amount
    /// @return feeAmount Fee amount that would be taken
    function calculateFee(uint256 amount) external view returns (uint256 feeAmount) {
        return (amount * feeBps) / 10000;
    }
}
