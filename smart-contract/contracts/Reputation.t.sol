// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/Reputation.sol";
import "../contracts/TemplateRegistry.sol";

contract ReputationTest is Test {
    Reputation public reputation;
    TemplateRegistry public registry;
    
    address public owner = address(0x1);
    address public template = address(0x2);
    address public party = address(0x3);
    
    function setUp() public {
        // Deploy registry first with placeholder reputation
        registry = new TemplateRegistry(address(0));
        // Deploy reputation with the registry
        reputation = new Reputation(address(registry));
        // Now update registry with the real reputation address
        // For testing, we directly authorize in reputation since registry has address(0) reputation
        // In production, this would be done through proper initialization
    }

    function _authorizeTemplateInReputation() internal {
        // Helper to authorize template in reputation for tests
        // Since registry.reputation is address(0), we need to manually authorize
        // This simulates what registry.authorizeTemplate would do
        vm.prank(address(registry));
        reputation.authorizeTemplate(template);
    }
    
    function test_RecordSuccessfulSettlement() public {
        _authorizeTemplateInReputation();
        
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.completedDeals, 1);
        assertEq(rep.totalVolume, 1000e6);
        assertEq(rep.score, 10); // 1 * 10 - 0 * 30
    }
    
    function test_RecordMultipleSuccessfulSettlements() public {
        _authorizeTemplateInReputation();
        
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 2000e6);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.completedDeals, 2);
        assertEq(rep.totalVolume, 3000e6);
        assertEq(rep.score, 20); // 2 * 10 - 0 * 30
    }
    
    function test_RecordDispute() public {
        _authorizeTemplateInReputation();
        
        vm.prank(template);
        reputation.recordDispute(party);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.disputedDeals, 1);
        assertEq(rep.score, 0); // 0 * 10 - 1 * 30
    }
    
    function test_RecordDefault() public {
        _authorizeTemplateInReputation();
        
        vm.prank(template);
        reputation.recordDefault(party);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.disputedDeals, 1);
        assertEq(rep.score, 0);
    }
    
    function test_RecordFinancedDeal() public {
        _authorizeTemplateInReputation();
        
        vm.prank(template);
        reputation.recordFinancedDeal(party, 5000e6);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.financedDeals, 1);
        assertEq(rep.totalVolume, 5000e6);
        // Note: Score only considers completedDeals, not financedDeals
        // financedDeals track financing activity but don't affect score directly
        assertEq(rep.score, 0); // 0 completed * 10 - 0 disputed * 30
    }
    
    function test_ScoreCalculation() public {
        _authorizeTemplateInReputation();
        
        // 5 completed, 1 disputed: (5*10 - 1*30) = 20
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        vm.prank(template);
        reputation.recordSuccessfulSettlement(party, 1000e6);
        vm.prank(template);
        reputation.recordDispute(party);
        
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.completedDeals, 5);
        assertEq(rep.disputedDeals, 1);
        assertEq(rep.score, 20);
    }
    
    function test_RevertOnUnauthorizedCaller() public {
        vm.expectRevert("Reputation: caller not authorized");
        reputation.recordSuccessfulSettlement(party, 1000e6);
    }
    
    function test_IsAuthorizedTemplate() public {
        _authorizeTemplateInReputation();
        assertTrue(reputation.isAuthorizedTemplate(template));
        assertFalse(reputation.isAuthorizedTemplate(owner));
    }
    
    function test_AuthorizeTemplate() public {
        // Authorize in reputation directly (bypass registry since it's address(0))
        address newTemplate = address(0x4);
        vm.prank(address(registry));
        reputation.authorizeTemplate(newTemplate);
        
        assertTrue(reputation.isAuthorizedTemplate(newTemplate));
    }
    
    function test_RevokeTemplate() public {
        // Authorize directly in Reputation
        vm.prank(address(registry));
        reputation.authorizeTemplate(template);
        
        assertTrue(reputation.isAuthorizedTemplate(template));
        
        // Revoke directly
        vm.prank(address(registry));
        reputation.revokeTemplate(template);
        
        assertFalse(reputation.isAuthorizedTemplate(template));
    }
    
    function test_GetReputationForNewParty() public {
        IReputation.ReputationData memory rep = reputation.getReputation(party);
        assertEq(rep.completedDeals, 0);
        assertEq(rep.disputedDeals, 0);
        assertEq(rep.financedDeals, 0);
        assertEq(rep.totalVolume, 0);
        assertEq(rep.score, 0);
    }
}
