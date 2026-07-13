// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/TemplateRegistry.sol";
import "../contracts/Reputation.sol";

contract TemplateRegistryTest is Test {
    TemplateRegistry public registry;
    Reputation public reputation;
    
    address public owner = address(0x1);
    address public template1 = address(0x2);
    address public template2 = address(0x3);
    address public user = address(0x4);
    
    function setUp() public {
        // Deploy registry with placeholder reputation
        registry = new TemplateRegistry(address(0));
        // Deploy real reputation
        reputation = new Reputation(address(registry));
    }
    
    function test_RegisterTemplate() public {
        registry.registerTemplate(template1, "Agreement Template");
        
        TemplateRegistry.TemplateInfo memory info = registry.getTemplate(template1);
        assertEq(info.templateAddress, template1);
        assertEq(info.name, "Agreement Template");
        assertFalse(info.authorized);
        assertEq(info.dealCount, 0);
    }
    
    function test_RegisterMultipleTemplates() public {
        registry.registerTemplate(template1, "Template 1");
        registry.registerTemplate(template2, "Template 2");
        
        assertEq(registry.getTemplateCount(), 2);
    }
    
    function test_RevertOnDuplicateRegistration() public {
        registry.registerTemplate(template1, "Template 1");
        
        vm.expectRevert("TemplateRegistry: template already registered");
        registry.registerTemplate(template1, "Template 1 Again");
    }
    
    function test_RevertOnZeroAddress() public {
        vm.expectRevert("TemplateRegistry: template is zero address");
        registry.registerTemplate(address(0), "Invalid");
    }
    
    function test_AuthorizeTemplate() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        assertTrue(registry.isTemplateAuthorized(template1));
    }
    
    function test_RevertOnAuthorizeNotRegistered() public {
        vm.expectRevert("TemplateRegistry: template not registered");
        registry.authorizeTemplate(template1);
    }
    
    function test_RevertOnAuthorizeAlreadyAuthorized() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.expectRevert("TemplateRegistry: template already authorized");
        registry.authorizeTemplate(template1);
    }
    
    function test_RevokeTemplateAuthorization() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        registry.revokeTemplateAuthorization(template1);
        assertFalse(registry.isTemplateAuthorized(template1));
    }
    
    function test_RevertOnRevokeNotAuthorized() public {
        registry.registerTemplate(template1, "Template 1");
        
        vm.expectRevert("TemplateRegistry: template not authorized");
        registry.revokeTemplateAuthorization(template1);
    }
    
    function test_RegisterDeal() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(template1);
        uint256 dealId = registry.registerDeal(template1, user);
        
        assertEq(dealId, 1);
        
        TemplateRegistry.DealInfo memory info = registry.getDeal(dealId);
        assertEq(info.template, template1);
        assertEq(info.creator, user);
        assertEq(uint8(info.state), uint8(ITemplate.DealState.Created));
    }
    
    function test_RevertOnRegisterDealUnauthorizedTemplate() public {
        registry.registerTemplate(template1, "Template 1");
        // Not authorized
        
        vm.prank(template1);
        vm.expectRevert("TemplateRegistry: template not authorized");
        registry.registerDeal(template1, user);
    }
    
    function test_RevertOnRegisterDealNotTemplate() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(user);
        vm.expectRevert("TemplateRegistry: caller is not the template");
        registry.registerDeal(template1, user);
    }
    
    function test_UpdateDealState() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(template1);
        uint256 dealId = registry.registerDeal(template1, user);
        
        vm.prank(template1);
        registry.updateDealState(dealId, ITemplate.DealState.Active);
        
        TemplateRegistry.DealInfo memory info = registry.getDeal(dealId);
        assertEq(uint8(info.state), uint8(ITemplate.DealState.Active));
    }
    
    function test_GetTemplateDeals() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(template1);
        registry.registerDeal(template1, user);
        
        vm.prank(template1);
        registry.registerDeal(template1, user);
        
        uint256[] memory deals = registry.getTemplateDeals(template1);
        assertEq(deals.length, 2);
        assertEq(deals[0], 1);
        assertEq(deals[1], 2);
    }
    
    function test_GetAllTemplates() public {
        registry.registerTemplate(template1, "Template 1");
        registry.registerTemplate(template2, "Template 2");
        
        address[] memory templates = registry.getAllTemplates();
        assertEq(templates.length, 2);
        assertEq(templates[0], template1);
        assertEq(templates[1], template2);
    }
    
    function test_GetDealCount() public {
        assertEq(registry.getDealCount(), 0);
        
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(template1);
        registry.registerDeal(template1, user);
        
        assertEq(registry.getDealCount(), 1);
    }
    
    function test_RevertOnNonOwnerRegisterTemplate() public {
        vm.prank(user);
        vm.expectRevert("TemplateRegistry: caller is not owner");
        registry.registerTemplate(template1, "Template 1");
    }
    
    function test_RevertOnNonOwnerAuthorizeTemplate() public {
        registry.registerTemplate(template1, "Template 1");
        
        vm.prank(user);
        vm.expectRevert("TemplateRegistry: caller is not owner");
        registry.authorizeTemplate(template1);
    }
    
    function test_RevertOnNonOwnerRevokeTemplate() public {
        registry.registerTemplate(template1, "Template 1");
        registry.authorizeTemplate(template1);
        
        vm.prank(user);
        vm.expectRevert("TemplateRegistry: caller is not owner");
        registry.revokeTemplateAuthorization(template1);
    }
    
    function test_Owner() public {
        assertEq(registry.owner(), address(this));
    }
    
    function test_TransferOwnership() public {
        vm.prank(user);
        vm.expectRevert("TemplateRegistry: caller is not owner");
        registry.transferOwnership(user);
        
        registry.transferOwnership(user);
        assertEq(registry.owner(), user);
    }
}

// Import ITemplate for DealState enum
import "../contracts/interfaces/ITemplate.sol";
