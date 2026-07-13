// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/FeeController.sol";

contract FeeControllerTest is Test {
    FeeController public feeController;
    address public treasury = address(0x123);
    address public user = address(0x456);
    
    function setUp() public {
        feeController = new FeeController(treasury);
    }
    
    function test_Constructor() public {
        assertEq(feeController.owner(), address(this));
        assertEq(feeController.treasury(), treasury);
        assertEq(feeController.feeBps(), 0);
    }
    
    function test_SetFeeBps() public {
        feeController.setFeeBps(250); // 2.5%
        assertEq(feeController.feeBps(), 250);
    }
    
    function test_RevertOnFeeExceedsMax() public {
        vm.expectRevert("FeeController: fee exceeds maximum");
        feeController.setFeeBps(5001); // 50.01%
    }
    
    function test_RevertOnSetFeeByNonOwner() public {
        vm.prank(user);
        vm.expectRevert("FeeController: caller is not owner");
        feeController.setFeeBps(100);
    }
    
    function test_SetTreasury() public {
        address newTreasury = address(0x789);
        feeController.setTreasury(newTreasury);
        assertEq(feeController.treasury(), newTreasury);
    }
    
    function test_RevertOnSetTreasuryToZero() public {
        vm.expectRevert("FeeController: treasury is zero address");
        feeController.setTreasury(address(0));
    }
    
    function test_TakeFee() public {
        feeController.setFeeBps(100); // 1%
        
        (uint256 netAmount, uint256 feeAmount) = feeController.takeFee(10000);
        
        assertEq(netAmount, 9900);
        assertEq(feeAmount, 100);
    }
    
    function test_TakeFeeWithNoFee() public {
        feeController.setFeeBps(0);
        
        (uint256 netAmount, uint256 feeAmount) = feeController.takeFee(10000);
        
        assertEq(netAmount, 10000);
        assertEq(feeAmount, 0);
    }
    
    function test_CalculateFee() public {
        feeController.setFeeBps(200); // 2%
        
        uint256 fee = feeController.calculateFee(50000);
        
        assertEq(fee, 1000); // 2% of 50000
    }
    
    function test_TransferOwnership() public {
        feeController.transferOwnership(user);
        assertEq(feeController.owner(), user);
    }
    
    function test_RevertOnTransferToZero() public {
        vm.expectRevert("FeeController: new owner is zero address");
        feeController.transferOwnership(address(0));
    }
}
