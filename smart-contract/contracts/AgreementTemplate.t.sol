// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/AgreementTemplate.sol";
import "../contracts/Reputation.sol";
import "../contracts/TemplateRegistry.sol";
import "../contracts/VerificationRegistry.sol";

contract AgreementTemplateTest is Test {
    AgreementTemplate public agreement;
    Reputation public reputation;
    TemplateRegistry public registry;
    VerificationRegistry public verification;
    
    address public buyer = address(0x1);
    address public supplier = address(0x2);
    address public other = address(0x3);
    
    bytes32 public constant TERMS_HASH = bytes32(uint256(1));
    uint256 public constant AGREEMENT_VALUE = 10000e6;
    
    function setUp() public {
        // Deploy registry first with placeholder
        registry = new TemplateRegistry(address(0));
        // Deploy verification
        verification = new VerificationRegistry();
        // Deploy reputation
        reputation = new Reputation(address(registry));
        // Deploy agreement template
        agreement = new AgreementTemplate(address(reputation), address(registry), address(verification));
        
        // Register and authorize agreement template
        registry.registerTemplate(address(agreement), "Agreement Template");
        registry.authorizeTemplate(address(agreement));
        
        // Authorize template in reputation
        vm.prank(address(registry));
        reputation.authorizeTemplate(address(agreement));
    }
    
    function test_CreateAgreement() public {
        uint256[] memory identities = new uint256[](2);
        identities[0] = 1;
        identities[1] = 2;
        
        address[] memory parties = new address[](2);
        parties[0] = buyer;
        parties[1] = supplier;
        
        ITemplate.PartyRole[] memory roles = new ITemplate.PartyRole[](2);
        roles[0] = ITemplate.PartyRole.Buyer;
        roles[1] = ITemplate.PartyRole.Supplier;
        
        vm.prank(buyer);
        uint256 agreementId = agreement.createAgreement(
            ITemplate.AgreementType.PurchaseOrder,
            TERMS_HASH,
            AGREEMENT_VALUE,
            identities,
            parties,
            roles
        );
        
        assertEq(agreementId, 1);
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(ag.creator, buyer);
        assertEq(uint8(ag.agreementType), uint8(ITemplate.AgreementType.PurchaseOrder));
        assertEq(ag.termsHash, TERMS_HASH);
        assertEq(ag.value, AGREEMENT_VALUE);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Created));
    }
    
    function test_RevertOnInvalidPartyArrays() public {
        uint256[] memory identities = new uint256[](2);
        identities[0] = 1;
        identities[1] = 2;
        
        address[] memory parties = new address[](1);
        parties[0] = buyer;
        
        ITemplate.PartyRole[] memory roles = new ITemplate.PartyRole[](2);
        roles[0] = ITemplate.PartyRole.Buyer;
        roles[1] = ITemplate.PartyRole.Supplier;
        
        vm.prank(buyer);
        vm.expectRevert("AgreementTemplate: party arrays length mismatch");
        agreement.createAgreement(
            ITemplate.AgreementType.PurchaseOrder,
            TERMS_HASH,
            AGREEMENT_VALUE,
            identities,
            parties,
            roles
        );
    }
    
    function test_SignAgreement() public {
        uint256 agreementId = _createTwoPartyAgreement();
        
        // Buyer signs
        vm.prank(buyer);
        agreement.signAgreement(agreementId, 1);
        
        // Supplier signs
        vm.prank(supplier);
        agreement.signAgreement(agreementId, 2);
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Active));
    }
    
    function test_RevertOnSignNotParty() public {
        uint256 agreementId = _createTwoPartyAgreement();
        
        vm.prank(other);
        vm.expectRevert("AgreementTemplate: not a valid party");
        agreement.signAgreement(agreementId, 99);
    }
    
    function test_RevertOnSignAlreadySigned() public {
        uint256 agreementId = _createTwoPartyAgreement();
        
        vm.prank(buyer);
        agreement.signAgreement(agreementId, 1);
        
        vm.prank(buyer);
        vm.expectRevert("AgreementTemplate: already signed");
        agreement.signAgreement(agreementId, 1);
    }
    
    function test_UpdateStatus() public {
        uint256 agreementId = _createActiveAgreement();
        
        // Both parties must confirm for completion
        vm.prank(buyer);
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
        
        vm.prank(supplier);
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Completed));
    }

    function test_RevertOnUpdateStatusNotParty() public {
        uint256 agreementId = _createActiveAgreement();
        
        // Other is not a party - should revert
        vm.prank(other);
        vm.expectRevert("AgreementTemplate: not authorized to update status");
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
    }

    function test_RevertOnInvalidStateTransition() public {
        uint256 agreementId = _createTwoPartyAgreement(); // Created state
        
        // Cannot go directly from Created to Completed
        vm.prank(buyer);
        vm.expectRevert("AgreementTemplate: invalid transition from Created");
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
    }

    function test_RevertOnTransitionFromNone() public {
        // Trying to update non-existent agreement should fail
        vm.prank(buyer);
        vm.expectRevert("AgreementTemplate: invalid agreement ID");
        agreement.updateStatus(999, ITemplate.DealState.Active);
    }
    
    function test_RaiseDispute() public {
        uint256 agreementId = _createActiveAgreement();
        
        vm.prank(buyer);
        agreement.raiseDispute(agreementId, "Product not delivered");
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Disputed));
        
        AgreementTemplate.DisputeInfo memory dispute = agreement.getDispute(agreementId);
        assertEq(dispute.raisedBy, buyer);
        assertEq(dispute.reason, "Product not delivered");
    }
    
    function test_RevertOnRaiseDisputeNotParty() public {
        uint256 agreementId = _createActiveAgreement();
        
        vm.prank(other);
        vm.expectRevert("AgreementTemplate: not a party to agreement");
        agreement.raiseDispute(agreementId, "Reason");
    }
    
    function test_ResolveDispute() public {
        uint256 agreementId = _createActiveAgreement();
        
        vm.prank(buyer);
        agreement.raiseDispute(agreementId, "Product not delivered");
        
        // Both parties must confirm for dispute resolution
        vm.prank(buyer);
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.BuyerWins);
        
        vm.prank(supplier);
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.BuyerWins);
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Resolved));
        
        AgreementTemplate.DisputeInfo memory dispute = agreement.getDispute(agreementId);
        assertEq(uint8(dispute.resolution), uint8(ITemplate.DisputeResolution.BuyerWins));
    }
    
    function test_GetParties() public {
        uint256 agreementId = _createTwoPartyAgreement();
        
        AgreementTemplate.Party[] memory parties = agreement.getParties(agreementId);
        assertEq(parties.length, 2);
        assertEq(parties[0].partyAddress, buyer);
        assertEq(parties[1].partyAddress, supplier);
    }
    
    function test_GetAgreementCount() public {
        assertEq(agreement.getAgreementCount(), 0);
        _createTwoPartyAgreement();
        assertEq(agreement.getAgreementCount(), 1);
    }
    
    function test_RevertOnSinglePartyCannotComplete() public {
        uint256 agreementId = _createActiveAgreement();
        
        // First party confirms
        vm.prank(buyer);
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
        
        // State should still be Active since not all parties confirmed
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Active));
        
        // Second party confirms - now should complete
        vm.prank(supplier);
        agreement.updateStatus(agreementId, ITemplate.DealState.Completed);
        
        ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Completed));
    }
    
    function test_RevertOnDifferentProposedResolutions() public {
        uint256 agreementId = _createActiveAgreement();
        
        vm.prank(buyer);
        agreement.raiseDispute(agreementId, "Product not delivered");
        
        // Buyer proposes BuyerWins
        vm.prank(buyer);
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.BuyerWins);
        
        // Supplier proposes SellerWins - should revert
        vm.prank(supplier);
        vm.expectRevert("AgreementTemplate: resolution does not match");
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.SellerWins);
    }
    
    function test_MutualConfirmationDisputeResolution() public {
        uint256 agreementId = _createActiveAgreement();
        
        vm.prank(buyer);
        agreement.raiseDispute(agreementId, "Product not delivered");
        
        // Both propose BuyerWins
        vm.prank(buyer);
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.BuyerWins);
        
        vm.prank(supplier);
        agreement.resolveDispute(agreementId, ITemplate.DisputeResolution.BuyerWins);
        
        AgreementTemplate.Agreement memory ag = agreement.getAgreement(agreementId);
        assertEq(uint8(ag.state), uint8(ITemplate.DealState.Resolved));
    }
    
    function _createTwoPartyAgreement() internal returns (uint256) {
        uint256[] memory identities = new uint256[](2);
        identities[0] = 1;
        identities[1] = 2;
        
        address[] memory parties = new address[](2);
        parties[0] = buyer;
        parties[1] = supplier;
        
        ITemplate.PartyRole[] memory roles = new ITemplate.PartyRole[](2);
        roles[0] = ITemplate.PartyRole.Buyer;
        roles[1] = ITemplate.PartyRole.Supplier;
        
        vm.prank(buyer);
        return agreement.createAgreement(
            ITemplate.AgreementType.PurchaseOrder,
            TERMS_HASH,
            AGREEMENT_VALUE,
            identities,
            parties,
            roles
        );
    }
    
    function _createActiveAgreement() internal returns (uint256) {
        uint256 agreementId = _createTwoPartyAgreement();
        
        vm.prank(buyer);
        agreement.signAgreement(agreementId, 1);
        
        vm.prank(supplier);
        agreement.signAgreement(agreementId, 2);
        
        return agreementId;
    }
}

// Import ITemplate for types
import "../contracts/interfaces/ITemplate.sol";
