// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/Identity.sol";

contract IdentityTest is Test {
    Identity public identity;
    
    address public owner1 = address(0x1);
    address public owner2 = address(0x2);
    
    bytes32 public constant COMPANY_HASH_1 = bytes32(uint256(1));
    bytes32 public constant COMPANY_HASH_2 = bytes32(uint256(2));
    
    function setUp() public {
        identity = new Identity();
    }
    
    function test_RegisterIdentity() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        assertEq(id, 1);
        
        IIdentity.IdentityData memory data = identity.getIdentity(id);
        assertEq(data.owner, owner1);
        assertEq(data.companyHash, COMPANY_HASH_1);
        assertTrue(data.active);
    }
    
    function test_RegisterMultipleIdentities() public {
        vm.prank(owner1);
        uint256 id1 = identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner2);
        uint256 id2 = identity.registerIdentity(COMPANY_HASH_2);
        
        assertEq(id1, 1);
        assertEq(id2, 2);
    }
    
    function test_RevertOnDuplicateRegistration() public {
        vm.prank(owner1);
        identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner1);
        vm.expectRevert("Identity: already registered");
        identity.registerIdentity(COMPANY_HASH_2);
    }
    
    function test_RevertOnZeroCompanyHash() public {
        vm.prank(owner1);
        vm.expectRevert("Identity: companyHash cannot be zero");
        identity.registerIdentity(bytes32(0));
    }
    
    function test_DeactivateIdentity() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner1);
        identity.deactivateIdentity();
        
        IIdentity.IdentityData memory data = identity.getIdentity(id);
        assertFalse(data.active);
    }
    
    function test_RevertOnDeactivateNotRegistered() public {
        vm.prank(owner1);
        vm.expectRevert("Identity: not registered");
        identity.deactivateIdentity();
    }
    
    function test_RevertOnDeactivateAlreadyInactive() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner1);
        identity.deactivateIdentity();
        
        vm.prank(owner1);
        vm.expectRevert("Identity: already inactive");
        identity.deactivateIdentity();
    }
    
    function test_ReactivateIdentity() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner1);
        identity.deactivateIdentity();
        
        vm.prank(owner1);
        identity.reactivateIdentity(COMPANY_HASH_2);
        
        IIdentity.IdentityData memory data = identity.getIdentity(id);
        assertTrue(data.active);
        assertEq(data.companyHash, COMPANY_HASH_2);
    }
    
    function test_UpdateCompanyHash() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        vm.prank(owner1);
        identity.updateCompanyHash(COMPANY_HASH_2);
        
        IIdentity.IdentityData memory data = identity.getIdentity(id);
        assertEq(data.companyHash, COMPANY_HASH_2);
    }
    
    function test_GetIdentityByOwner() public {
        vm.prank(owner1);
        uint256 id = identity.registerIdentity(COMPANY_HASH_1);
        
        IIdentity.IdentityData memory data = identity.getIdentityByOwner(owner1);
        assertEq(data.id, id);
        assertEq(data.owner, owner1);
    }
    
    function test_RevertOnGetIdentityByOwnerNotRegistered() public {
        vm.expectRevert("Identity: owner has no identity");
        identity.getIdentityByOwner(owner1);
    }
    
    function test_IsActiveIdentity() public {
        vm.prank(owner1);
        identity.registerIdentity(COMPANY_HASH_1);
        
        assertTrue(identity.isActiveIdentity(owner1));
        assertFalse(identity.isActiveIdentity(owner2));
    }
    
    function test_GetIdentityCount() public {
        assertEq(identity.getIdentityCount(), 0);
        
        vm.prank(owner1);
        identity.registerIdentity(COMPANY_HASH_1);
        assertEq(identity.getIdentityCount(), 1);
        
        vm.prank(owner2);
        identity.registerIdentity(COMPANY_HASH_2);
        assertEq(identity.getIdentityCount(), 2);
    }
}
