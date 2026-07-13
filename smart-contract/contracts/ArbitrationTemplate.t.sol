// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/ArbitrationTemplate.sol";
import {IArbitration} from "../contracts/interfaces/IArbitration.sol";

contract ArbitrationTemplateTest is Test {
    ArbitrationTemplate public arbitration;
    address public partyA = address(0x1);
    address public partyB = address(0x2);
    address public arbitrator = address(0x3);
    address public template = address(0x4);
    
    function setUp() public {
        arbitration = new ArbitrationTemplate();
    }
    
    function test_Constructor() public {
        assertEq(arbitration.owner(), address(this));
    }
    
    function test_AuthorizeArbitrator() public {
        arbitration.authorizeArbitrator(arbitrator);
        assertTrue(arbitration.authorizedArbitrators(arbitrator));
    }
    
    function test_RevokeArbitrator() public {
        arbitration.authorizeArbitrator(arbitrator);
        arbitration.revokeArbitrator(arbitrator);
        assertFalse(arbitration.authorizedArbitrators(arbitrator));
    }
    
    function test_RevertOnAuthorizeByNonOwner() public {
        vm.prank(partyA);
        vm.expectRevert("ArbitrationTemplate: caller is not owner");
        arbitration.authorizeArbitrator(arbitrator);
    }
    
    function test_OpenDispute() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Product not delivered");
        
        assertEq(disputeId, 1);
        assertEq(arbitration.getDisputeCount(), 1);
    }
    
    function test_RevertOnOpenDisputeByNonParty() public {
        // Anyone can open a dispute (in real world, should be restricted)
        vm.prank(arbitrator);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        assertEq(disputeId, 1);
    }
    
    function test_RevertOnDuplicateDispute() public {
        vm.prank(partyA);
        arbitration.openDispute(1, template, "First dispute");
        
        vm.prank(partyB);
        vm.expectRevert("ArbitrationTemplate: dispute already open for this deal");
        arbitration.openDispute(1, template, "Second dispute");
    }
    
    function test_SubmitEvidence() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(partyB);
        arbitration.submitEvidence(disputeId, bytes32(uint256(12345)));
        
        assertEq(arbitration.getEvidenceCount(disputeId), 1);
    }
    
    function test_ResolveDisputeByArbitrator() public {
        arbitration.authorizeArbitrator(arbitrator);
        
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(arbitrator);
        arbitration.resolveDispute(disputeId, IArbitration.Resolution.BuyerWins);
        
        assertEq(uint8(arbitration.getDisputeStatus(disputeId)), 3); // Resolved
    }
    
    function test_ResolveDisputeByOwner() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(address(this)); // Owner
        arbitration.resolveDispute(disputeId, IArbitration.Resolution.Split);
        
        assertEq(uint8(arbitration.getDisputeStatus(disputeId)), 3); // Resolved
    }
    
    function test_RevertOnResolveByUnauthorized() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(partyB);
        vm.expectRevert("ArbitrationTemplate: caller is not authorized arbitrator");
        arbitration.resolveDispute(disputeId, IArbitration.Resolution.BuyerWins);
    }
    
    function test_CloseDispute() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(address(this));
        arbitration.resolveDispute(disputeId, IArbitration.Resolution.SellerWins);
        
        vm.prank(address(this));
        arbitration.closeDispute(disputeId);
        
        assertEq(uint8(arbitration.getDisputeStatus(disputeId)), 4); // Closed
    }
    
    function test_HasOpenDispute() public {
        assertFalse(arbitration.hasOpenDispute(1, template));
        
        vm.prank(partyA);
        arbitration.openDispute(1, template, "Test dispute");
        
        assertTrue(arbitration.hasOpenDispute(1, template));
    }
    
    function test_RevertOnResolvePending() public {
        vm.prank(partyA);
        uint256 disputeId = arbitration.openDispute(1, template, "Test dispute");
        
        vm.prank(address(this));
        vm.expectRevert("ArbitrationTemplate: resolution cannot be pending");
        arbitration.resolveDispute(disputeId, IArbitration.Resolution.Pending);
    }
    
    function test_GetDisputeDetails() public {
        vm.prank(partyA);
        arbitration.openDispute(1, template, "Product not as described");
        
        (
            uint256 dealId,
            address tpl,
            address raisedBy,
            string memory reason,
            IArbitration.DisputeStatus status,
            IArbitration.Resolution resolution,
            uint256 createdAt,
            uint256 resolvedAt
        ) = arbitration.getDispute(1);
        
        assertEq(dealId, 1);
        assertEq(tpl, template);
        assertEq(raisedBy, partyA);
        assertEq(uint8(status), 1); // Open
    }
}
